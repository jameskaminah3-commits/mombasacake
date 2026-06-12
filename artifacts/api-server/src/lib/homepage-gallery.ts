import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildSupabaseMediaUrl, normalizeSupabaseMediaUrl } from "./media-urls";

const GalleryItemSchema = z.object({
  label: z.string().min(2),
  imageUrl: z.string().min(1),
});

const HomepageGallerySchema = z.object({
  items: z.array(GalleryItemSchema).min(1),
});

export type HomepageGalleryItem = z.infer<typeof GalleryItemSchema>;
export type HomepageGalleryContent = z.infer<typeof HomepageGallerySchema>;

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "homepage-gallery.json");

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

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, `${JSON.stringify(DEFAULT_HOMEPAGE_GALLERY, null, 2)}\n`, "utf8");
  }
}

export async function readHomepageGallery(): Promise<HomepageGalleryContent> {
  await ensureDataFile();

  const raw = await readFile(DATA_FILE, "utf8");
  const parsed = HomepageGallerySchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    await writeFile(DATA_FILE, `${JSON.stringify(DEFAULT_HOMEPAGE_GALLERY, null, 2)}\n`, "utf8");
    return DEFAULT_HOMEPAGE_GALLERY;
  }

  const normalized = {
    items: parsed.data.items.map((item) => ({
      ...item,
      imageUrl: normalizeSupabaseMediaUrl(item.imageUrl) || item.imageUrl,
    })),
  };

  if (JSON.stringify(normalized) !== JSON.stringify(parsed.data)) {
    await writeFile(DATA_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  }

  return normalized;
}

export async function writeHomepageGallery(content: HomepageGalleryContent): Promise<HomepageGalleryContent> {
  const parsed = HomepageGallerySchema.parse({
    items: content.items.map((item) => ({
      ...item,
      imageUrl: normalizeSupabaseMediaUrl(item.imageUrl) || item.imageUrl,
    })),
  });

  await ensureDataFile();
  await writeFile(DATA_FILE, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return parsed;
}
