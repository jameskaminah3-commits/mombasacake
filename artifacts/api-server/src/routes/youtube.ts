import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { YouTubeError, latestChannelVideos } from "../lib/youtube";

const router: IRouter = Router();

// The owner picks cake videos from the shop's YouTube channel (its latest uploads).
router.get("/youtube/videos", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const channel = typeof req.query.channel === "string" ? req.query.channel.slice(0, 300) : "";
  try {
    res.json(await latestChannelVideos(channel));
  } catch (error) {
    if (!(error instanceof YouTubeError)) logger.error({ err: error }, "YouTube videos unavailable");
    res.status(502).json({ error: error instanceof YouTubeError ? error.message : "Couldn't load the channel's videos." });
  }
});

export default router;
