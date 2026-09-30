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

// ——— Cake videos ———

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPE_BY_EXTENSION: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

// Some phones don't label the file's type, so fall back to its extension.
function videoType(file: File) {
  if (ALLOWED_VIDEO_TYPES.has(file.type)) return file.type;
  return VIDEO_TYPE_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

// Uploads a video with progress (0–1) for the progress bar; resolves to its address.
export function uploadCakeVideo(file: File, accessToken: string, onProgress?: (fraction: number) => void): Promise<{ url: string }> {
  const type = videoType(file);
  if (!accessToken) return Promise.reject(new Error("You need to sign in before uploading videos."));
  if (!type) return Promise.reject(new Error("Use an MP4, MOV or WebM video."));
  if (file.size > MAX_VIDEO_BYTES) return Promise.reject(new Error("Videos can be up to 50 MB. Try a shorter clip."));

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${getApiBaseUrl()}/api/uploads/video?folder=cake-videos`);
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("Content-Type", type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(request.responseText);
      } catch {
        // Not JSON; the status decides.
      }
      if (request.status >= 200 && request.status < 300 && data.url) resolve({ url: data.url });
      else reject(new Error(data.error || "The video didn't upload. Please try again."));
    };
    request.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    request.send(file);
  });
}

// A still from about a second in, shown before the video plays. Null when this browser can't read the
// video (it still uploads and plays; it just shows a plain tile first).
export function captureVideoPoster(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const source = URL.createObjectURL(file);
    const video = document.createElement("video");
    let finished = false;
    const finish = (poster: File | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(source);
      resolve(poster);
    };
    const timer = window.setTimeout(() => finish(null), 10_000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (Number.isFinite(video.duration) ? video.duration : 2) / 3);
    };
    video.onseeked = () => {
      if (!video.videoWidth || !video.videoHeight) return finish(null);
      const scale = Math.min(1, 1080 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) return finish(null);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(blob ? new File([blob], "video-poster.jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.82);
    };
    video.onerror = () => finish(null);
    video.src = source;
  });
}
