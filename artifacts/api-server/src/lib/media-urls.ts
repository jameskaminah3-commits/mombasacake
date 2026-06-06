const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "cake-media";

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

export function resolveSupabaseMediaPath(value: string | null | undefined) {
  const normalized = normalizeSupabaseMediaUrl(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized, "http://localhost");
    if (url.pathname === "/api/media") {
      return url.searchParams.get("path");
    }
  } catch {
    // Fall through.
  }

  if (normalized.startsWith("/api/media?")) {
    return new URL(`http://localhost${normalized}`).searchParams.get("path");
  }

  return null;
}
