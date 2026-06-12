import { buildSupabaseMediaUrl } from "@/lib/supabase-media";

export type SiteImage = {
  src: string;
  label: string;
};

const galleryImage = (path: string) => buildSupabaseMediaUrl(`gallery/${path}`);
const imageAsset = (path: string) => buildSupabaseMediaUrl(`images/${path}`);
const rootAsset = (path: string) => buildSupabaseMediaUrl(path);

export const DEFAULT_CAKE_IMAGE_URL = imageAsset("cake1.png");
export const DEFAULT_GALLERY_IMAGE_URL = galleryImage("cake-gold-butterfly.jpeg");
export const DEFAULT_LOGO_IMAGE_URL = rootAsset("logo-clear.png");

export const SITE_IMAGE_OPTIONS: SiteImage[] = [
  { src: galleryImage("cake-lady-dress.jpeg"), label: "Lady in Blue" },
  { src: galleryImage("cake-gold-butterfly.jpeg"), label: "Gold Butterfly" },
  { src: galleryImage("cake-purple-butterfly.jpeg"), label: "Purple Butterfly" },
  { src: galleryImage("cake-blue-gold.jpeg"), label: "Blue and Gold" },
  { src: galleryImage("cake-heels.jpeg"), label: "Glam Heels" },
  { src: galleryImage("cake-princess-wave.jpeg"), label: "Princess Wave" },
  { src: galleryImage("cake-red-butterfly.jpeg"), label: "Red Butterfly" },
  { src: galleryImage("cake-white-gold.jpeg"), label: "White and Gold" },
  { src: galleryImage("cake-kenya-flag.jpeg"), label: "Kenya Flag" },
  { src: galleryImage("cake-tuxedo.jpeg"), label: "Tuxedo" },
  { src: galleryImage("cake-stitch.jpeg"), label: "Stitch Birthday" },
  { src: galleryImage("cake-butterfly-birthday.jpeg"), label: "Butterfly Birthday" },
  { src: galleryImage("cake-teenager.jpeg"), label: "Teenager Special" },
  { src: galleryImage("cake-spiderman.jpeg"), label: "Spiderman Party" },
  { src: galleryImage("cake-girl-jeans.jpeg"), label: "Girls Vibes" },
  { src: galleryImage("cake-heart.jpeg"), label: "Heart Anniversary" },
  { src: imageAsset("cake1.png"), label: "Classic Cake" },
  { src: imageAsset("cake2.png"), label: "Chocolate Cake" },
  { src: imageAsset("cake3.png"), label: "Celebration Cake" },
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
