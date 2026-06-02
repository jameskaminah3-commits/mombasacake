import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, promotionsTable } from "@workspace/db";
import {
  CreatePromotionBody,
  UpdatePromotionBody,
  UpdatePromotionParams,
  DeletePromotionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/promotions", async (_req, res): Promise<void> => {
  const promotions = await db
    .select()
    .from(promotionsTable)
    .orderBy(desc(promotionsTable.createdAt));
  res.json(promotions.map(formatPromotion));
});

router.post("/promotions", async (req, res): Promise<void> => {
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.discountPct != null) data.discountPct = String(parsed.data.discountPct);
  if (parsed.data.startsAt) data.startsAt = new Date(parsed.data.startsAt as string);
  if (parsed.data.endsAt) data.endsAt = new Date(parsed.data.endsAt as string);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [promo] = await db.insert(promotionsTable).values(data as any).returning();
  res.status(201).json(formatPromotion(promo));
});

router.patch("/promotions/:id", async (req, res): Promise<void> => {
  const params = UpdatePromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.discountPct != null) data.discountPct = String(parsed.data.discountPct);
  if (parsed.data.startsAt) data.startsAt = new Date(parsed.data.startsAt as string);
  if (parsed.data.endsAt) data.endsAt = new Date(parsed.data.endsAt as string);

  const [promo] = await db
    .update(promotionsTable)
    .set(data)
    .where(eq(promotionsTable.id, params.data.id))
    .returning();
  if (!promo) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }
  res.json(formatPromotion(promo));
});

router.delete("/promotions/:id", async (req, res): Promise<void> => {
  const params = DeletePromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(promotionsTable).where(eq(promotionsTable.id, params.data.id));
  res.sendStatus(204);
});

function formatPromotion(p: typeof promotionsTable.$inferSelect) {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    bannerUrl: p.bannerUrl ?? null,
    discountPct: p.discountPct != null ? parseFloat(p.discountPct) : null,
    active: p.active,
    startsAt: p.startsAt?.toISOString() ?? null,
    endsAt: p.endsAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;
