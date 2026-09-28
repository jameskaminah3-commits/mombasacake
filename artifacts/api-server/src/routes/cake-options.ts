import { Router, type IRouter, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { ensureStoreSettingsSchema } from "../lib/ensure-store-settings-schema";

const router: IRouter = Router();

const SETTINGS_KEY = "cake-options";

// Flavours customers choose from on every cake page. An empty list hides the flavour question.
const CakeOptionsSchema = z.object({
  flavours: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        description: z.string().trim().max(120).optional().default(""),
      }),
    )
    .max(40),
  // Cakes of at least this many kg may have an optional second flavour (e.g. one per tier). Null turns it off.
  secondFlavourMinKg: z.number().positive().max(100).nullable().optional().default(null),
});

type CakeOptions = z.infer<typeof CakeOptionsSchema>;

const DEFAULT_CAKE_OPTIONS: CakeOptions = { flavours: [], secondFlavourMinKg: null };

router.get("/cake-options", async (_req: Request, res: Response): Promise<void> => {
  res.json(await readCakeOptions());
});

router.put("/cake-options", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = CakeOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureStoreSettingsSchema();
  await db.execute(sql`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (${SETTINGS_KEY}, ${JSON.stringify(parsed.data)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `);

  res.json(parsed.data);
});

export default router;

async function readCakeOptions(): Promise<CakeOptions> {
  await ensureStoreSettingsSchema();

  const result = await db.execute(sql`SELECT value FROM store_settings WHERE key = ${SETTINGS_KEY} LIMIT 1`);
  const parsed = CakeOptionsSchema.safeParse(result.rows[0]?.value);
  return parsed.success ? parsed.data : DEFAULT_CAKE_OPTIONS;
}
