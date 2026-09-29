import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../lib/auth-middleware";
import { CakeOptionsSchema, DEFAULT_STANDARD_SIZES_KG, readCakeOptions, writeCakeOptions } from "../lib/cake-options";

const router: IRouter = Router();

router.get("/cake-options", async (_req: Request, res: Response): Promise<void> => {
  res.json(await readCakeOptions());
});

router.put("/cake-options", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = CakeOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.json(await writeCakeOptions({ ...parsed.data, standardSizesKg: parsed.data.standardSizesKg ?? DEFAULT_STANDARD_SIZES_KG }));
});

export default router;
