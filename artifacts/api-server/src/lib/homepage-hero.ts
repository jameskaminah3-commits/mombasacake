import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildSupabaseMediaUrl, normalizeSupabaseMediaUrl } from "./media-urls";

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

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "homepage-hero.json");

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

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, `${JSON.stringify(DEFAULT_HOMEPAGE_HERO, null, 2)}\n`, "utf8");
  }
}

export async function readHomepageHero(): Promise<HomepageHeroContent> {
  await ensureDataFile();

  const raw = await readFile(DATA_FILE, "utf8");
  const parsed = HomepageHeroSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    await writeFile(DATA_FILE, `${JSON.stringify(DEFAULT_HOMEPAGE_HERO, null, 2)}\n`, "utf8");
    return DEFAULT_HOMEPAGE_HERO;
  }

  const normalized = {
    ...parsed.data,
    slides: parsed.data.slides.map((slide) => ({
      ...slide,
      imageUrl: normalizeSupabaseMediaUrl(slide.imageUrl) || slide.imageUrl,
    })),
  };

  if (JSON.stringify(normalized) !== JSON.stringify(parsed.data)) {
    await writeFile(DATA_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  }

  return normalized;
}

export async function writeHomepageHero(content: HomepageHeroContent): Promise<HomepageHeroContent> {
  const parsed = HomepageHeroSchema.parse({
    ...content,
    slides: content.slides.map((slide) => ({
      ...slide,
      imageUrl: normalizeSupabaseMediaUrl(slide.imageUrl) || slide.imageUrl,
    })),
  });
  await ensureDataFile();
  await writeFile(DATA_FILE, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return parsed;
}
