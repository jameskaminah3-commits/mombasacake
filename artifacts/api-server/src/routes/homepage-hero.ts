import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../lib/auth-middleware";
import { readHomepageHero, writeHomepageHero } from "../lib/homepage-hero";

const router: IRouter = Router();

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

router.get("/homepage-hero", async (_req: Request, res: Response): Promise<void> => {
  const hero = await readHomepageHero();
  res.json(hero);
});

router.put("/homepage-hero", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = HomepageHeroSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const hero = await writeHomepageHero(parsed.data);
    res.json(hero);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update homepage hero",
    });
  }
});

export default router;
