import {
  Award,
  BadgePercent,
  Cake,
  CakeSlice,
  Clock,
  Gift,
  Heart,
  Leaf,
  MapPin,
  PartyPopper,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

// Pictures the shop can choose for each selling point (the server accepts the same names).
export const HIGHLIGHT_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  sparkles: { icon: Sparkles, label: "Sparkles" },
  truck: { icon: Truck, label: "Delivery" },
  smartphone: { icon: Smartphone, label: "Phone" },
  cake: { icon: Cake, label: "Cake" },
  "cake-slice": { icon: CakeSlice, label: "Cake slice" },
  gift: { icon: Gift, label: "Gift" },
  "party-popper": { icon: PartyPopper, label: "Party" },
  heart: { icon: Heart, label: "Heart" },
  leaf: { icon: Leaf, label: "Leaf" },
  star: { icon: Star, label: "Star" },
  award: { icon: Award, label: "Award" },
  clock: { icon: Clock, label: "Clock" },
  "badge-percent": { icon: BadgePercent, label: "Discount" },
  "map-pin": { icon: MapPin, label: "Location" },
};

export const MAX_HIGHLIGHTS = 4;
export const HIGHLIGHT_LABEL_MAX = 30;

export type Highlight = { icon: string; label: string };

// The selling points on the shop's front page: a row of short benefits under the category photos,
// and a WhatsApp button for custom designs after the first group of cakes.
export type HomepageHighlights = {
  showHighlights: boolean;
  highlights: Highlight[];
  showCustomCakeButton: boolean;
  customCakeTitle: string;
  customCakeText: string;
};

export const DEFAULT_HOMEPAGE_HIGHLIGHTS: HomepageHighlights = {
  showHighlights: true,
  highlights: [
    { icon: "sparkles", label: "Custom designs" },
    { icon: "truck", label: "Delivery in Mombasa" },
    { icon: "smartphone", label: "Pay with M-Pesa" },
  ],
  showCustomCakeButton: true,
  customCakeTitle: "Have a design in mind?",
  customCakeText: "Send us a photo on WhatsApp for a quote.",
};

export function highlightIcon(name: string): LucideIcon {
  return HIGHLIGHT_ICONS[name]?.icon ?? Sparkles;
}

export async function fetchHomepageHighlights(): Promise<HomepageHighlights> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/homepage-highlights`);
    if (!response.ok) return DEFAULT_HOMEPAGE_HIGHLIGHTS;
    const data = (await response.json()) as Partial<HomepageHighlights>;
    return {
      showHighlights: data.showHighlights !== false,
      highlights: Array.isArray(data.highlights) ? data.highlights : DEFAULT_HOMEPAGE_HIGHLIGHTS.highlights,
      showCustomCakeButton: data.showCustomCakeButton !== false,
      customCakeTitle: data.customCakeTitle || DEFAULT_HOMEPAGE_HIGHLIGHTS.customCakeTitle,
      customCakeText: typeof data.customCakeText === "string" ? data.customCakeText : DEFAULT_HOMEPAGE_HIGHLIGHTS.customCakeText,
    };
  } catch {
    return DEFAULT_HOMEPAGE_HIGHLIGHTS;
  }
}

// For the admin editor: fails instead of falling back to the defaults, so a save can't replace the shop's own.
export async function fetchHomepageHighlightsForEditing(): Promise<HomepageHighlights> {
  return customFetch<HomepageHighlights>(`${getApiBaseUrl()}/api/homepage-highlights`);
}

export async function saveHomepageHighlights(content: HomepageHighlights): Promise<HomepageHighlights> {
  return customFetch<HomepageHighlights>(`${getApiBaseUrl()}/api/homepage-highlights`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
}
