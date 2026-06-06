import { getApiBaseUrl } from "@/lib/api-base";

const SUPABASE_MEDIA_BUCKET = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || "cake-media";
const MAX_IMAGE_BYTES = Number(import.meta.env.VITE_SUPABASE_MAX_IMAGE_BYTES || 1_500_000);

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function assertSupabaseMediaConfig() {
  if (!SUPABASE_MEDIA_BUCKET) {
    throw new Error("Supabase media storage is not configured.");
  }
}

export function getSupabaseMediaBucket() {
  return SUPABASE_MEDIA_BUCKET;
}

export function getSupabaseMediaMaxBytes() {
  return MAX_IMAGE_BYTES;
}

export function buildSupabaseMediaUrl(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  return `/api/media?path=${encodeURIComponent(cleanPath)}`;
}

export function isSupabaseMediaUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.pathname === "/api/media";
  } catch {
    return value.startsWith("/api/media");
  }
}

function isLegacyAssetPath(value: string) {
  return (
    value.startsWith("/gallery/") ||
    value.startsWith("/images/") ||
    value === "/logo.jpeg" ||
    value === "/logo-clear.png" ||
    value === "/opengraph.jpg"
  );
}

export function normalizeSupabaseMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (isSupabaseMediaUrl(value)) return value;

  const publicPrefix = `/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/`;
  const directPrefix = `/storage/v1/object/${SUPABASE_MEDIA_BUCKET}/`;
  if (value.startsWith(publicPrefix)) {
    return buildSupabaseMediaUrl(value.slice(publicPrefix.length));
  }
  if (value.startsWith(directPrefix)) {
    return buildSupabaseMediaUrl(value.slice(directPrefix.length));
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    try {
      const url = new URL(value);
      if (url.pathname.startsWith(publicPrefix)) {
        return buildSupabaseMediaUrl(url.pathname.slice(publicPrefix.length));
      }
      if (url.pathname.startsWith(directPrefix)) {
        return buildSupabaseMediaUrl(url.pathname.slice(directPrefix.length));
      }
    } catch {
      return value;
    }
    return value;
  }
  if (isLegacyAssetPath(value)) {
    return buildSupabaseMediaUrl(value);
  }
  return value;
}

export function extractSupabaseMediaPath(value: string) {
  if (!isSupabaseMediaUrl(value)) return null;

  const url = new URL(value);
  const publicPrefix = `/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/`;
  const directPrefix = `/storage/v1/object/${SUPABASE_MEDIA_BUCKET}/`;

  if (url.pathname.startsWith(publicPrefix)) {
    return decodeURIComponent(url.pathname.slice(publicPrefix.length));
  }

  if (url.pathname.startsWith(directPrefix)) {
    return decodeURIComponent(url.pathname.slice(directPrefix.length));
  }

  return null;
}

function fileExtension(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };

  return byType[file.type] || (file.name.split(".").pop()?.toLowerCase() || "img");
}

function uniquePath(folder: string, file: File) {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const filename = `${Date.now()}-${crypto.randomUUID()}.${fileExtension(file)}`;
  return `${cleanFolder}/${filename}`;
}

export async function uploadSupabaseMedia(
  file: File,
  accessToken: string,
  folder: string,
) {
  assertSupabaseMediaConfig();

  if (!accessToken) {
    throw new Error("You need to sign in before uploading images.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use JPG, PNG, WebP, or AVIF images.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    const maxMb = Math.round((MAX_IMAGE_BYTES / 1024 / 1024) * 10) / 10;
    throw new Error(`Image must be ${maxMb} MB or smaller.`);
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/uploads/media?folder=${encodeURIComponent(folder)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "image/jpeg",
      },
      body: file,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Image upload failed");
  }

  const uploaded = (await response.json()) as { path?: string; url?: string };
  const uploadedPath = uploaded.path || uniquePath(folder, file);

  return {
    path: uploadedPath,
    url: uploaded.url || buildSupabaseMediaUrl(uploadedPath),
  };
}

export async function deleteSupabaseMedia(url: string, accessToken: string) {
  assertSupabaseMediaConfig();

  if (!url || !accessToken) return;

  const response = await fetch(
    `${getApiBaseUrl()}/api/uploads/media`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Image delete failed");
  }
}
