import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ilike } from "drizzle-orm";
import type { z } from "zod";
import { db, cakesTable, categoriesTable, orderItemsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { CakeMediaListSchema, deleteCakeMedia, mediaForCakes, replaceCakeMedia, type CakeMediaItem } from "../lib/cake-media";
import { normalizeSupabaseMediaUrl } from "../lib/media-urls";
import {
  CreateCakeBody,
  UpdateCakeBody,
  UpdateCakeParams,
  GetCakeParams,
  DeleteCakeParams,
  ListCakesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cakes", async (req, res): Promise<void> => {
  const query = ListCakesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.categoryId != null) {
    conditions.push(eq(cakesTable.categoryId, query.data.categoryId));
  }
  if (query.data.available != null) {
    conditions.push(eq(cakesTable.available, query.data.available));
  }
  if (query.data.search) {
    conditions.push(ilike(cakesTable.name, `%${query.data.search}%`));
  }

  const cakes = await db
    .select({
      cake: cakesTable,
      categoryName: categoriesTable.name,
    })
    .from(cakesTable)
    .leftJoin(categoriesTable, eq(cakesTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    // Newest first; cakes added at the same moment (e.g. together at setup) keep a fixed order.
    .orderBy(desc(cakesTable.createdAt), desc(cakesTable.id));

  const media = await mediaForCakes(cakes.map(({ cake }) => cake.id));
  res.json(cakes.map(({ cake, categoryName }) => formatCake(cake, categoryName, media.get(cake.id))));
});

router.get("/cakes/featured", async (_req, res): Promise<void> => {
  const cakes = await db
    .select({ cake: cakesTable, categoryName: categoriesTable.name })
    .from(cakesTable)
    .leftJoin(categoriesTable, eq(cakesTable.categoryId, categoriesTable.id))
    .where(and(eq(cakesTable.featured, true), eq(cakesTable.available, true)))
    .orderBy(desc(cakesTable.createdAt), desc(cakesTable.id))
    .limit(8);
  const media = await mediaForCakes(cakes.map(({ cake }) => cake.id));
  res.json(cakes.map(({ cake, categoryName }) => formatCake(cake, categoryName, media.get(cake.id))));
});

// The "Popular" row at the top of the shop: cakes the owner starred in admin first, then best sellers.
router.get("/cakes/popular", async (_req, res): Promise<void> => {
  const popular = await db
    .select({
      cake: cakesTable,
      categoryName: categoriesTable.name,
      orderCount: sql<number>`count(${orderItemsTable.id})::int`,
    })
    .from(cakesTable)
    .leftJoin(categoriesTable, eq(cakesTable.categoryId, categoriesTable.id))
    .leftJoin(orderItemsTable, eq(orderItemsTable.cakeId, cakesTable.id))
    .where(eq(cakesTable.available, true))
    .groupBy(cakesTable.id, categoriesTable.name)
    .orderBy(desc(cakesTable.featured), desc(sql`count(${orderItemsTable.id})`), desc(cakesTable.id))
    .limit(8);
  const media = await mediaForCakes(popular.map(({ cake }) => cake.id));
  res.json(popular.map(({ cake, categoryName }) => formatCake(cake, categoryName, media.get(cake.id))));
});

router.post("/cakes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const media = parseMedia(req.body?.media);
  if (!media.ok) {
    res.status(400).json({ error: media.error });
    return;
  }
  const [cake] = await db.insert(cakesTable).values({
    ...parsed.data,
    imageUrl: normalizeSupabaseMediaUrl(parsed.data.imageUrl) || undefined,
    price: String(parsed.data.price),
    variants: parsed.data.variants ? JSON.stringify(parsed.data.variants) : null,
  }).returning();
  if (media.items) await replaceCakeMedia(cake.id, media.items);
  res.status(201).json(formatCake(cake, null, (await mediaForCakes([cake.id])).get(cake.id)));
});

router.get("/cakes/:id", async (req, res): Promise<void> => {
  const params = GetCakeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ cake: cakesTable, categoryName: categoriesTable.name })
    .from(cakesTable)
    .leftJoin(categoriesTable, eq(cakesTable.categoryId, categoriesTable.id))
    .where(eq(cakesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Cake not found" });
    return;
  }
  res.json(formatCake(row.cake, row.categoryName, (await mediaForCakes([row.cake.id])).get(row.cake.id)));
});

router.patch("/cakes/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCakeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Photos and videos are only changed when the request includes them (not e.g. when toggling "Available").
  const media = parseMedia(req.body?.media);
  if (!media.ok) {
    res.status(400).json({ error: media.error });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (typeof updateData.imageUrl === "string") {
    updateData.imageUrl = normalizeSupabaseMediaUrl(updateData.imageUrl) || undefined;
  }
  if (parsed.data.price != null) updateData.price = String(parsed.data.price);
  if ("variants" in parsed.data) {
    updateData.variants = parsed.data.variants ? JSON.stringify(parsed.data.variants) : null;
  }
  // Only the photos and videos changed: still mark the cake as updated (the update needs something to set).
  if (Object.keys(updateData).length === 0) updateData.updatedAt = new Date();

  const [cake] = await db
    .update(cakesTable)
    .set(updateData)
    .where(eq(cakesTable.id, params.data.id))
    .returning();
  if (!cake) {
    res.status(404).json({ error: "Cake not found" });
    return;
  }
  if (media.items) await replaceCakeMedia(cake.id, media.items);
  res.json(formatCake(cake, null, (await mediaForCakes([cake.id])).get(cake.id)));
});

router.delete("/cakes/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCakeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(cakesTable).where(eq(cakesTable.id, params.data.id));
  await deleteCakeMedia(params.data.id);
  res.sendStatus(204);
});

// `media` left out means "no change"; an empty list removes them all.
function parseMedia(value: unknown): { ok: true; items: z.infer<typeof CakeMediaListSchema> | null } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, items: null };
  const parsed = CakeMediaListSchema.safeParse(value ?? []);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the photos and videos" };
  return { ok: true, items: parsed.data };
}

function parseVariants(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (v): v is { label: string; price: number } =>
        typeof v === "object" && v !== null && typeof v.label === "string" && typeof v.price === "number"
    );
  } catch {
    return null;
  }
}

function formatCake(
  cake: typeof cakesTable.$inferSelect,
  categoryName: string | null | undefined,
  media: CakeMediaItem[] = [],
) {
  return {
    id: cake.id,
    name: cake.name,
    slug: cake.slug,
    description: cake.description ?? null,
    price: parseFloat(cake.price),
    imageUrl: normalizeSupabaseMediaUrl(cake.imageUrl) ?? null,
    available: cake.available,
    featured: cake.featured,
    categoryId: cake.categoryId ?? null,
    categoryName: categoryName ?? null,
    variants: parseVariants(cake.variants),
    media,
    createdAt: cake.createdAt.toISOString(),
  };
}

export default router;
