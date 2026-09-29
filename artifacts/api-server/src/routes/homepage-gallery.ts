import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../lib/auth-middleware";
import { readHomepageGallery, writeHomepageGallery } from "../lib/homepage-gallery";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GalleryItemSchema = z.object({
  label: z.string().min(2),
  imageUrl: z.string().min(1),
});

const HomepageGallerySchema = z.object({
  items: z.array(GalleryItemSchema).min(1),
});

router.get("/homepage-gallery", async (_req: Request, res: Response): Promise<void> => {
  const gallery = await readHomepageGallery();
  res.json(gallery);
});

router.put("/homepage-gallery", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = HomepageGallerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const gallery = await writeHomepageGallery(parsed.data);
    res.json(gallery);
  } catch (err) {
    logger.error({ err }, "Saving the homepage gallery failed");
    res.status(500).json({ error: "Could not save the photos. Please try again." });
  }
});

export default router;
