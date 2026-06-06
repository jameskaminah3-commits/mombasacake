import { buildSupabaseMediaUrl } from "@/lib/supabase-media";

export type SiteImage = {
  src: string;
  label: string;
};

export const DEFAULT_CAKE_IMAGE_URL = buildSupabaseMediaUrl("images/cake1.png");
export const DEFAULT_GALLERY_IMAGE_URL = buildSupabaseMediaUrl("gallery/cake-gold-butterfly.jpeg");
export const DEFAULT_LOGO_IMAGE_URL = buildSupabaseMediaUrl("logo-clear.png");

export const SITE_IMAGE_OPTIONS: SiteImage[] = [
  { src: buildSupabaseMediaUrl("gallery/cake-lady-dress.jpeg"), label: "Lady in Blue" },
  { src: buildSupabaseMediaUrl("gallery/cake-gold-butterfly.jpeg"), label: "Gold Butterfly" },
  { src: buildSupabaseMediaUrl("gallery/cake-purple-butterfly.jpeg"), label: "Purple Butterfly" },
  { src: buildSupabaseMediaUrl("gallery/cake-blue-gold.jpeg"), label: "Blue and Gold" },
  { src: buildSupabaseMediaUrl("gallery/cake-heels.jpeg"), label: "Glam Heels" },
  { src: buildSupabaseMediaUrl("gallery/cake-princess-wave.jpeg"), label: "Princess Wave" },
  { src: buildSupabaseMediaUrl("gallery/cake-red-butterfly.jpeg"), label: "Red Butterfly" },
  { src: buildSupabaseMediaUrl("gallery/cake-white-gold.jpeg"), label: "White and Gold" },
  { src: buildSupabaseMediaUrl("gallery/cake-kenya-flag.jpeg"), label: "Kenya Flag" },
  { src: buildSupabaseMediaUrl("gallery/cake-tuxedo.jpeg"), label: "Tuxedo" },
  { src: buildSupabaseMediaUrl("gallery/cake-stitch.jpeg"), label: "Stitch Birthday" },
  { src: buildSupabaseMediaUrl("gallery/cake-butterfly-birthday.jpeg"), label: "Butterfly Birthday" },
  { src: buildSupabaseMediaUrl("gallery/cake-teenager.jpeg"), label: "Teenager Special" },
  { src: buildSupabaseMediaUrl("gallery/cake-spiderman.jpeg"), label: "Spiderman Party" },
  { src: buildSupabaseMediaUrl("gallery/cake-girl-jeans.jpeg"), label: "Girls Vibes" },
  { src: buildSupabaseMediaUrl("gallery/cake-heart.jpeg"), label: "Heart Anniversary" },
  { src: buildSupabaseMediaUrl("images/cake1.png"), label: "Classic Cake" },
  { src: buildSupabaseMediaUrl("images/cake2.png"), label: "Chocolate Cake" },
  { src: buildSupabaseMediaUrl("images/cake3.png"), label: "Celebration Cake" },
];

export function isValidImagePath(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function imageFallback(index = 0): SiteImage {
  return SITE_IMAGE_OPTIONS[index % SITE_IMAGE_OPTIONS.length];
}
