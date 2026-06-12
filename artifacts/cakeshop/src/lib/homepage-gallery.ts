import { getApiBaseUrl } from "@/lib/api-base";
import { buildSupabaseMediaUrl, normalizeSupabaseMediaUrl } from "@/lib/supabase-media";

export type HomepageGalleryItem = {
  label: string;
  imageUrl: string;
};

export type HomepageGalleryContent = {
  items: HomepageGalleryItem[];
};

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

export async function fetchHomepageGallery(): Promise<HomepageGalleryContent> {
  const response = await fetch(`${getApiBaseUrl()}/api/homepage-gallery`);
  if (!response.ok) {
    return DEFAULT_HOMEPAGE_GALLERY;
  }

  const data = (await response.json()) as HomepageGalleryContent;
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return DEFAULT_HOMEPAGE_GALLERY;
  }

  return {
    items: data.items.map((item) => ({
      ...item,
      imageUrl: normalizeSupabaseMediaUrl(item.imageUrl) || item.imageUrl,
    })),
  };
}

export async function saveHomepageGallery(
  token: string | null,
  content: HomepageGalleryContent,
): Promise<HomepageGalleryContent> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}/api/homepage-gallery`, {
    method: "PUT",
    headers,
    body: JSON.stringify(content),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to save homepage gallery");
  }

  return (await response.json()) as HomepageGalleryContent;
}
