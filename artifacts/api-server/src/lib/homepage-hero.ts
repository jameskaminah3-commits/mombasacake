import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildSupabaseMediaUrl, normalizeSupabaseMediaUrl } from "./media-urls";
import { readStoreSetting, writeStoreSetting } from "./store-settings";

const HeroSlideSchema = z.object({
  title: z.string().min(2),
  label: z.string().min(2),
  accent: z.string().min(2),
  imageUrl: z.string().min(1),
});

const HomepageHeroSchema = z.object({
  brandLine: z.string().min(2),
  headline: z.string().min(2),
  description: z.string().min(2),
  slides: z.array(HeroSlideSchema).min(1),
});

export type HomepageHeroSlide = z.infer<typeof HeroSlideSchema>;
export type HomepageHeroContent = z.infer<typeof HomepageHeroSchema>;

const SETTINGS_KEY = "homepage-hero";

// Content shipped with the app, shown until the homepage is first saved in the admin panel.
const SHIPPED_FILE = path.join(process.cwd(), "data", "homepage-hero.json");

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

function normalizeImages(content: HomepageHeroContent): HomepageHeroContent {
  return {
    ...content,
    slides: content.slides.map((slide) => ({
      ...slide,
      imageUrl: normalizeSupabaseMediaUrl(slide.imageUrl) || slide.imageUrl,
    })),
  };
}

async function readShippedHero(): Promise<HomepageHeroContent> {
  try {
    const parsed = HomepageHeroSchema.safeParse(JSON.parse(await readFile(SHIPPED_FILE, "utf8")));
    return parsed.success ? parsed.data : DEFAULT_HOMEPAGE_HERO;
  } catch {
    return DEFAULT_HOMEPAGE_HERO;
  }
}

export async function readHomepageHero(): Promise<HomepageHeroContent> {
  const saved = HomepageHeroSchema.safeParse(await readStoreSetting(SETTINGS_KEY));
  return normalizeImages(saved.success ? saved.data : await readShippedHero());
}

export async function writeHomepageHero(content: HomepageHeroContent): Promise<HomepageHeroContent> {
  const parsed = HomepageHeroSchema.parse(normalizeImages(content));
  await writeStoreSetting(SETTINGS_KEY, parsed);
  return parsed;
}
