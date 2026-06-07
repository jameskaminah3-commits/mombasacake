export type SiteImage = {
  src: string;
  label: string;
};

export const DEFAULT_CAKE_IMAGE_URL = "/images/cake1.png";
export const DEFAULT_GALLERY_IMAGE_URL = "/gallery/cake-gold-butterfly.jpeg";
export const DEFAULT_LOGO_IMAGE_URL = "/logo-clear.png";

export const SITE_IMAGE_OPTIONS: SiteImage[] = [
  { src: "/gallery/cake-lady-dress.jpeg", label: "Lady in Blue" },
  { src: "/gallery/cake-gold-butterfly.jpeg", label: "Gold Butterfly" },
  { src: "/gallery/cake-purple-butterfly.jpeg", label: "Purple Butterfly" },
  { src: "/gallery/cake-blue-gold.jpeg", label: "Blue and Gold" },
  { src: "/gallery/cake-heels.jpeg", label: "Glam Heels" },
  { src: "/gallery/cake-princess-wave.jpeg", label: "Princess Wave" },
  { src: "/gallery/cake-red-butterfly.jpeg", label: "Red Butterfly" },
  { src: "/gallery/cake-white-gold.jpeg", label: "White and Gold" },
  { src: "/gallery/cake-kenya-flag.jpeg", label: "Kenya Flag" },
  { src: "/gallery/cake-tuxedo.jpeg", label: "Tuxedo" },
  { src: "/gallery/cake-stitch.jpeg", label: "Stitch Birthday" },
  { src: "/gallery/cake-butterfly-birthday.jpeg", label: "Butterfly Birthday" },
  { src: "/gallery/cake-teenager.jpeg", label: "Teenager Special" },
  { src: "/gallery/cake-spiderman.jpeg", label: "Spiderman Party" },
  { src: "/gallery/cake-girl-jeans.jpeg", label: "Girls Vibes" },
  { src: "/gallery/cake-heart.jpeg", label: "Heart Anniversary" },
  { src: "/images/cake1.png", label: "Classic Cake" },
  { src: "/images/cake2.png", label: "Chocolate Cake" },
  { src: "/images/cake3.png", label: "Celebration Cake" },
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
