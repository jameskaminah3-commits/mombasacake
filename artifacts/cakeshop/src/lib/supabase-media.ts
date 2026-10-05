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

export type SupabaseMediaLibraryItem = {
  path: string;
  url: string;
  filename: string;
  folder: string;
  createdAt: string | null;
  updatedAt: string | null;
  mimeType: string | null;
  size: number | null;
};

export function buildSupabaseMediaUrl(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  return `/api/media?path=${encodeURIComponent(cleanPath)}`;
}

function isSupabaseMediaUrl(value: string | null | undefined): boolean {
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

// Phone photos are often 3–8 MB. Shrink big ones in the browser (longest side 2000 px) so they upload
// quickly and fit the limit; PNGs stay PNG so see-through logos keep their transparency.
async function shrinkImageIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_IMAGE_BYTES || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const keepPng = file.type === "image/png";
  try {
    for (const [longestSide, quality] of [
      [2000, 0.85],
      [1600, 0.8],
      [1200, 0.75],
    ]) {
      const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      if (!keepPng) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, keepPng ? "image/png" : "image/jpeg", quality));
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${keepPng ? "png" : "jpg"}`, { type: blob.type });
      }
    }
  } finally {
    bitmap.close();
  }
  return file;
}

export async function uploadSupabaseMedia(
  original: File,
  accessToken: string,
  folder: string,
) {
  assertSupabaseMediaConfig();

  if (!accessToken) {
    throw new Error("You need to sign in before uploading images.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(original.type)) {
    throw new Error("Use JPG, PNG, WebP, or AVIF images.");
  }

  const file = await shrinkImageIfNeeded(original);

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

export async function fetchSupabaseMediaLibrary(
  accessToken: string,
  folder?: string,
  limit = 24,
): Promise<SupabaseMediaLibraryItem[]> {
  assertSupabaseMediaConfig();

  if (!accessToken) {
    throw new Error("You need to sign in before browsing images.");
  }

  const params = new URLSearchParams();
  if (folder) {
    params.set("folder", folder);
  }
  params.set("limit", String(limit));

  const response = await fetch(`${getApiBaseUrl()}/api/uploads/media/library?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load media library");
  }

  const data = (await response.json()) as { items?: SupabaseMediaLibraryItem[] };
  return Array.isArray(data.items) ? data.items : [];
}
