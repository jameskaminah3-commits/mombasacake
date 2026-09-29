import { buildSupabaseMediaUrl } from "@/lib/supabase-media";

const galleryImage = (path: string) => buildSupabaseMediaUrl(`gallery/${path}`);
const imageAsset = (path: string) => buildSupabaseMediaUrl(`images/${path}`);

export const DEFAULT_CAKE_IMAGE_URL = imageAsset("cake1.png");
export const DEFAULT_GALLERY_IMAGE_URL = galleryImage("cake-gold-butterfly.jpeg");
// Small copy bundled with the app (the full-size logo-clear.png is 350 KB); served directly, not via /api/media.
export const DEFAULT_LOGO_IMAGE_URL = "/logo-192.png";
