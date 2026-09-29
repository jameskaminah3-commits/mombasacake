import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { readStoreSetting, writeStoreSetting } from "../lib/store-settings";

const router: IRouter = Router();

const SETTINGS_KEY = "homepage-highlights";

// Pictures the shop can choose for each selling point; the storefront has one for every name here.
const HIGHLIGHT_ICONS = [
  "sparkles",
  "truck",
  "smartphone",
  "cake",
  "cake-slice",
  "gift",
  "party-popper",
  "heart",
  "leaf",
  "star",
  "award",
  "clock",
  "badge-percent",
  "map-pin",
] as const;

// The selling points on the shop's front page: a row of short benefits under the category photos,
// and a WhatsApp button for custom designs after the first group of cakes.
const HomepageHighlightsSchema = z.object({
  showHighlights: z.boolean(),
  highlights: z
    .array(
      z.object({
        icon: z.enum(HIGHLIGHT_ICONS),
        label: z.string().trim().min(1, "Each selling point needs a few words").max(30, "Keep each selling point to 30 characters"),
      }),
    )
    .max(4, "Show at most 4 selling points"),
  showCustomCakeButton: z.boolean(),
  customCakeTitle: z.string().trim().min(1, "The WhatsApp button needs a title").max(60),
  customCakeText: z.string().trim().max(120),
});

type HomepageHighlights = z.infer<typeof HomepageHighlightsSchema>;

const DEFAULT_HOMEPAGE_HIGHLIGHTS: HomepageHighlights = {
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

router.get("/homepage-highlights", async (_req: Request, res: Response): Promise<void> => {
  const saved = HomepageHighlightsSchema.safeParse(await readStoreSetting(SETTINGS_KEY));
  res.json(saved.success ? saved.data : DEFAULT_HOMEPAGE_HIGHLIGHTS);
});

router.put("/homepage-highlights", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = HomepageHighlightsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the selling points and try again." });
    return;
  }

  try {
    await writeStoreSetting(SETTINGS_KEY, parsed.data);
    res.json(parsed.data);
  } catch (err) {
    logger.error({ err }, "Saving the homepage selling points failed");
    res.status(500).json({ error: "Could not save the selling points. Please try again." });
  }
});

export default router;
