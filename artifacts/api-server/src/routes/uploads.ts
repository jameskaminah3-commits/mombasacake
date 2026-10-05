import express, { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { buildSupabaseMediaUrl, resolveSupabaseMediaPath } from "../lib/media-urls";
import {
  deleteSupabaseStorageObject,
  getSupabaseProjectUrl,
  uploadSupabaseStorageObject,
} from "../lib/supabase-storage";

const SUPABASE_URL = getSupabaseProjectUrl();
const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "cake-media";

const router: IRouter = Router();

function normalizeFolderPrefix(value: string) {
  const clean = value
    .trim()
    .replace(/[^a-zA-Z0-9._/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\/+|\/+$/g, "");

  return clean
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("/");
}

router.get("/media", async (req: Request, res: Response): Promise<void> => {
  const rawPath = typeof req.query.path === "string" ? req.query.path : "";
  const path = decodeURIComponent(rawPath.replace(/^\/+/, ""));

  if (!path) {
    res.status(400).json({ error: "Missing media path" });
    return;
  }

  if (!SUPABASE_URL) {
    res.status(500).json({ error: "Supabase project URL could not be determined from environment" });
    return;
  }
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/${encodedPath}`,
    );

    if (response.ok && response.body) {
      res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
      return;
    }
  } catch {
    // Fall back to the static asset path below.
  }

  res.redirect(302, `/${path}`);
});

router.get("/uploads/media/library", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const folder = typeof req.query.folder === "string" ? normalizeFolderPrefix(req.query.folder) : "";
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 24;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 24;

  try {
    const conditions = ["bucket_id = $1", "name ~* $2"];
    const values: Array<string | number> = [SUPABASE_MEDIA_BUCKET, "\\.(jpe?g|png|webp|avif)$"];

    if (folder) {
      values.push(`${folder}/%`);
      conditions.push(`name LIKE $${values.length}`);
    }

    values.push(limit);

    const query = `
      SELECT name, created_at, updated_at, metadata
      FROM storage.objects
      WHERE ${conditions.join(" AND ")}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT $${values.length}
    `;

    const result = await pool.query(query, values);
    const items = result.rows.map((row) => {
      const path = String(row.name || "");
      const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as {
        mimetype?: string;
        size?: number;
      };

      return {
        path,
        url: buildSupabaseMediaUrl(path),
        filename: path.split("/").pop() || path,
        folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        mimeType: metadata.mimetype || null,
        size: typeof metadata.size === "number" ? metadata.size : null,
      };
    });

    res.json({ items });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load media library",
    });
  }
});

router.post(
  "/uploads/media",
  requireAdmin,
  express.raw({ type: "image/*", limit: "3mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const folder = typeof req.query.folder === "string" ? req.query.folder : "uploads";
    const contentType = (req.headers["content-type"] || "image/jpeg").toString();
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");

    if (body.length === 0) {
      res.status(400).json({ error: "Missing image data" });
      return;
    }

    try {
      const uploaded = await uploadSupabaseStorageObject(folder, contentType, body);
      res.json({
        ...uploaded,
        url: buildSupabaseMediaUrl(uploaded.path),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  },
);

router.delete(
  "/uploads/media",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    if (!url) {
      res.status(400).json({ error: "Missing image url" });
      return;
    }

    try {
      const path = resolveSupabaseMediaPath(url);
      if (!path) {
        res.status(400).json({ error: "That URL is not a managed media object" });
        return;
      }
      await deleteSupabaseStorageObject(buildSupabaseMediaUrl(path));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Delete failed",
      });
    }
  },
);

export default router;
