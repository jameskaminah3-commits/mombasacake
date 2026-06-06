import { randomUUID } from "node:crypto";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "cake-media";

function deriveSupabaseUrlFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const match = databaseUrl.match(/postgres\.([a-z0-9-]+):/i);
  if (!match?.[1]) return "";
  return `https://${match[1]}.supabase.co`;
}

function isValidSupabaseUrl(value: string) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value.replace(/\/$/, ""));
}

export function getSupabaseProjectUrl() {
  const envUrl = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
  if (envUrl && isValidSupabaseUrl(envUrl)) {
    return envUrl;
  }

  const derivedUrl = deriveSupabaseUrlFromDatabaseUrl();
  if (derivedUrl) {
    return derivedUrl.replace(/\/$/, "");
  }

  return envUrl;
}

export function getSupabaseServiceRoleKey() {
  return SUPABASE_SERVICE_ROLE_KEY;
}

function assertStorageConfig() {
  if (!getSupabaseProjectUrl()) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeFolder(folder: string) {
  const clean = folder
    .split("/")
    .map(sanitizeSegment)
    .filter(Boolean)
    .join("/");

  return clean || "uploads";
}

function extensionFromContentType(contentType: string) {
  switch (contentType.toLowerCase()) {
    case "image/avif":
      return "avif";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildObjectPath(folder: string, contentType: string) {
  const safeFolder = normalizeFolder(folder);
  const ext = extensionFromContentType(contentType);
  return `${safeFolder}/${Date.now()}-${randomUUID()}.${ext}`;
}

export function isSupabaseMediaUrl(value: string | null | undefined): boolean {
  const SUPABASE_URL = getSupabaseProjectUrl();
  if (!value || !SUPABASE_URL) return false;

  try {
    const url = new URL(value);
    return url.origin === SUPABASE_URL;
  } catch {
    return false;
  }
}

export function extractSupabaseMediaPath(value: string): string | null {
  const publicPrefix = `/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/`;
  const directPrefix = `/storage/v1/object/${SUPABASE_MEDIA_BUCKET}/`;
  const mediaRoutePrefix = "/api/media";

  try {
    const url = new URL(value, "http://localhost");
    if (url.pathname === mediaRoutePrefix) {
      return url.searchParams.get("path");
    }

    if (!isSupabaseMediaUrl(url.toString())) {
      return null;
    }

    if (url.pathname.startsWith(publicPrefix)) {
      return decodeURIComponent(url.pathname.slice(publicPrefix.length));
    }

    if (url.pathname.startsWith(directPrefix)) {
      return decodeURIComponent(url.pathname.slice(directPrefix.length));
    }
  } catch {
    if (value.startsWith(mediaRoutePrefix)) {
      return new URL(value, "http://localhost").searchParams.get("path");
    }
  }

  return null;
}

export async function uploadSupabaseStorageObject(
  folder: string,
  contentType: string,
  body: Buffer,
) {
  assertStorageConfig();

  const SUPABASE_URL = getSupabaseProjectUrl();
  const objectPath = buildObjectPath(folder, contentType);
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_MEDIA_BUCKET}/${encodePath(objectPath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: `${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType || "image/jpeg",
        "x-upsert": "true",
      },
      body,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Image upload failed");
  }

  return {
    path: objectPath,
    url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/${encodePath(objectPath)}`,
  };
}

export async function deleteSupabaseStorageObject(url: string) {
  assertStorageConfig();

  const SUPABASE_URL = getSupabaseProjectUrl();
  const path = extractSupabaseMediaPath(url);
  if (!path) return;

  await fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_MEDIA_BUCKET}/${encodePath(path)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: `${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
}
