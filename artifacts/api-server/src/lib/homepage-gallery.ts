import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildSupabaseMediaUrl, normalizeSupabaseMediaUrl } from "./media-urls";
import { readStoreSetting, writeStoreSetting } from "./store-settings";

const GalleryItemSchema = z.object({
  label: z.string().min(2),
  imageUrl: z.string().min(1),
});

const HomepageGallerySchema = z.object({
  items: z.array(GalleryItemSchema).min(1),
});

export type HomepageGalleryItem = z.infer<typeof GalleryItemSchema>;
export type HomepageGalleryContent = z.infer<typeof HomepageGallerySchema>;

const SETTINGS_KEY = "homepage-gallery";

// Photos shipped with the app, shown until the gallery is first saved in the admin panel.
const SHIPPED_FILE = fileURLToPath(new URL("../data/homepage-gallery.json", import.meta.url));

export const DEFAULT_HOMEPAGE_GALLERY: HomepageGalleryContent = {
  items: [
    {
      label: "Lady in Blue",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-lady-dress.jpeg"),
    },
    {
      label: "Gold Butterfly",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-gold-butterfly.jpeg"),
    },
    {
      label: "Blue and Gold",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-blue-gold.jpeg"),
    },
    {
      label: "Spiderman Party",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-spiderman.jpeg"),
    },
    {
      label: "Heart Anniversary",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-heart.jpeg"),
    },
    {
      label: "Glam Heels",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-heels.jpeg"),
    },
    {
      label: "White and Gold",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-white-gold.jpeg"),
    },
    {
      label: "Tuxedo",
      imageUrl: buildSupabaseMediaUrl("gallery/landing/work-cake-tuxedo.jpeg"),
    },
  ],
};

function normalizeImages(content: HomepageGalleryContent): HomepageGalleryContent {
  return {
    items: content.items.map((item) => ({
      ...item,
      imageUrl: normalizeSupabaseMediaUrl(item.imageUrl) || item.imageUrl,
    })),
  };
}

async function readShippedGallery(): Promise<HomepageGalleryContent> {
  try {
    const parsed = HomepageGallerySchema.safeParse(JSON.parse(await readFile(SHIPPED_FILE, "utf8")));
    return parsed.success ? parsed.data : DEFAULT_HOMEPAGE_GALLERY;
  } catch {
    return DEFAULT_HOMEPAGE_GALLERY;
  }
}

export async function readHomepageGallery(): Promise<HomepageGalleryContent> {
  const saved = HomepageGallerySchema.safeParse(await readStoreSetting(SETTINGS_KEY));
  return normalizeImages(saved.success ? saved.data : await readShippedGallery());
}

export async function writeHomepageGallery(content: HomepageGalleryContent): Promise<HomepageGalleryContent> {
  const parsed = HomepageGallerySchema.parse(normalizeImages(content));
  await writeStoreSetting(SETTINGS_KEY, parsed);
  return parsed;
}
