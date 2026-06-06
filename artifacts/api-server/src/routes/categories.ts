import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { normalizeSupabaseMediaUrl } from "../lib/media-urls";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  GetCategoryParams,
  DeleteCategoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select()
    .from(categoriesTable)
    .orderBy(categoriesTable.name);
  res.json(categories.map(formatCategory));
});

router.post("/categories", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values({
    ...parsed.data,
    imageUrl: normalizeSupabaseMediaUrl(parsed.data.imageUrl) || undefined,
  }).returning();
  res.status(201).json(formatCategory(cat));
});

router.get("/categories/:id", async (req, res): Promise<void> => {
  const params = GetCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, params.data.id));
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(formatCategory(cat));
});

router.patch("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cat] = await db
    .update(categoriesTable)
    .set({
      ...parsed.data,
      imageUrl: normalizeSupabaseMediaUrl(parsed.data.imageUrl) || undefined,
    })
    .where(eq(categoriesTable.id, params.data.id))
    .returning();
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(formatCategory(cat));
});

router.delete("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  res.sendStatus(204);
});

function formatCategory(cat: typeof categoriesTable.$inferSelect) {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    imageUrl: normalizeSupabaseMediaUrl(cat.imageUrl) ?? null,
    createdAt: cat.createdAt.toISOString(),
  };
}

export default router;
