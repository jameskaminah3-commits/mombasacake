import { getApiBaseUrl } from "@/lib/api-base";
import { buildSupabaseMediaUrl, normalizeSupabaseMediaUrl } from "@/lib/supabase-media";

export type HomepageHeroSlide = {
  title: string;
  label: string;
  accent: string;
  imageUrl: string;
};

export type HomepageHeroContent = {
  brandLine: string;
  headline: string;
  description: string;
  slides: HomepageHeroSlide[];
};

export const DEFAULT_HOMEPAGE_HERO: HomepageHeroContent = {
  brandLine: "Channah Cake House",
  headline: "Decadence in Every Bite",
  description:
    "Choose from our signature creations or custom designs, all crafted to make your celebration feel unforgettable.",
  slides: [
    {
      title: "Couture celebration cakes",
      label: "Signature artistry",
      accent: "Hand-sculpted finishes for milestone moments",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/hero-cake-lady-dress.jpeg"),
    },
    {
      title: "Butterfly birthday cakes",
      label: "Birthday favorites",
      accent: "Delicate wings, metallic details, and soft buttercream",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/hero-cake-gold-butterfly.jpeg"),
    },
    {
      title: "Luxury occasion cakes",
      label: "Blue and gold",
      accent: "Polished statement cakes for elegant gatherings",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/hero-cake-blue-gold.jpeg"),
    },
    {
      title: "Themed party cakes",
      label: "Kids celebrations",
      accent: "Character cakes with color, detail, and plenty of joy",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/hero-cake-spiderman.jpeg"),
    },
  ],
};

export async function fetchHomepageHero(): Promise<HomepageHeroContent> {
  const response = await fetch(`${getApiBaseUrl()}/api/homepage-hero`);
  if (!response.ok) {
    return DEFAULT_HOMEPAGE_HERO;
  }

  const data = (await response.json()) as HomepageHeroContent;
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    return DEFAULT_HOMEPAGE_HERO;
  }

  return {
    ...data,
    slides: data.slides.map((slide) => ({
      ...slide,
      imageUrl: normalizeSupabaseMediaUrl(slide.imageUrl) || slide.imageUrl,
    })),
  };
}

export async function saveHomepageHero(token: string | null, content: HomepageHeroContent): Promise<HomepageHeroContent> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}/api/homepage-hero`, {
    method: "PUT",
    headers,
    body: JSON.stringify(content),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to save homepage hero");
  }

  return (await response.json()) as HomepageHeroContent;
}
