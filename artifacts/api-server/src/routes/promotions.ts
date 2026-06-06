import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, promotionsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { normalizeSupabaseMediaUrl } from "../lib/media-urls";
import {
  CreatePromotionBody,
  UpdatePromotionBody,
  UpdatePromotionParams,
  DeletePromotionParams,
} from "@workspace/api-zod";
import { ensurePromotionsSchema } from "../lib/ensure-promotions-schema";

const router: IRouter = Router();

router.get("/promotions", async (_req, res): Promise<void> => {
  await ensurePromotionsSchema();
  const promotions = await db
    .select()
    .from(promotionsTable)
    .orderBy(desc(promotionsTable.createdAt));
  res.json(promotions.map(formatPromotion));
});

router.post("/promotions", requireAdmin, async (req, res): Promise<void> => {
  await ensurePromotionsSchema();
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.discountPct == null && parsed.data.discountAmount == null) {
    res.status(400).json({ error: "Either a percentage or a fixed amount discount is required" });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof data.bannerUrl === "string") {
    data.bannerUrl = normalizeSupabaseMediaUrl(data.bannerUrl) || undefined;
  }
  normalizePromotionPayload(data);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [promo] = await db.insert(promotionsTable).values(data as any).returning();
    res.status(201).json(formatPromotion(promo));
  } catch (error) {
    handlePromotionWriteError(error, res);
  }
});

router.patch("/promotions/:id", requireAdmin, async (req, res): Promise<void> => {
  await ensurePromotionsSchema();
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
  if (parsed.data.discountPct == null && parsed.data.discountAmount == null) {
    res.status(400).json({ error: "Either a percentage or a fixed amount discount is required" });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof data.bannerUrl === "string") {
    data.bannerUrl = normalizeSupabaseMediaUrl(data.bannerUrl) || undefined;
  }
  normalizePromotionPayload(data);

  try {
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
  } catch (error) {
    handlePromotionWriteError(error, res);
  }
});

router.delete("/promotions/:id", requireAdmin, async (req, res): Promise<void> => {
  await ensurePromotionsSchema();
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
    code: p.code ?? null,
    description: p.description ?? null,
    bannerUrl: normalizeSupabaseMediaUrl(p.bannerUrl) ?? null,
    discountPct: p.discountPct != null ? parseFloat(p.discountPct) : null,
    discountAmount: p.discountAmount != null ? parseFloat(p.discountAmount) : null,
    active: p.active,
    startsAt: p.startsAt?.toISOString() ?? null,
    endsAt: p.endsAt?.toISOString() ?? null,
    minimumOrderAmount: p.minimumOrderAmount != null ? parseFloat(p.minimumOrderAmount) : null,
    applicableCakeSlugs: parseApplicableCakeSlugs(p.applicableCakeSlugs),
    showInStrip: p.showInStrip,
    createdAt: p.createdAt.toISOString(),
  };
}

function normalizePromotionPayload(data: Record<string, unknown>) {
  if (typeof data.code === "string") {
    data.code = data.code.trim() || null;
  }
  if (typeof data.discountPct === "number") data.discountPct = String(data.discountPct);
  if (typeof data.discountAmount === "number") data.discountAmount = String(data.discountAmount);
  if (typeof data.minimumOrderAmount === "number") data.minimumOrderAmount = String(data.minimumOrderAmount);
  if (typeof data.startsAt === "string" && data.startsAt) data.startsAt = new Date(data.startsAt);
  if (typeof data.endsAt === "string" && data.endsAt) data.endsAt = new Date(data.endsAt);
  if (Array.isArray(data.applicableCakeSlugs)) {
    data.applicableCakeSlugs = data.applicableCakeSlugs.length > 0 ? JSON.stringify(data.applicableCakeSlugs) : null;
  }
}

function parseApplicableCakeSlugs(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return value
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);
  }
}

function handlePromotionWriteError(error: unknown, res: { status: (code: number) => { json: (body: { error: string }) => void } }) {
  const dbError = error as { code?: string; constraint?: string };
  if (dbError?.code === "23505" && dbError.constraint === "promotions_code_unique") {
    res.status(409).json({ error: "A promotion with this code already exists" });
    return;
  }

  if (dbError?.code === "23505") {
    res.status(409).json({ error: "This promotion conflicts with an existing database record" });
    return;
  }

  res.status(500).json({ error: "Failed to save promotion" });
}

export default router;
