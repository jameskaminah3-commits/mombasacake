import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ilike } from "drizzle-orm";
import { db, cakesTable, categoriesTable, orderItemsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
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
    .orderBy(desc(cakesTable.createdAt));

  res.json(cakes.map(({ cake, categoryName }) => formatCake(cake, categoryName)));
});

router.get("/cakes/featured", async (_req, res): Promise<void> => {
  const cakes = await db
    .select({ cake: cakesTable, categoryName: categoriesTable.name })
    .from(cakesTable)
    .leftJoin(categoriesTable, eq(cakesTable.categoryId, categoriesTable.id))
    .where(and(eq(cakesTable.featured, true), eq(cakesTable.available, true)))
    .orderBy(desc(cakesTable.createdAt))
    .limit(8);
  res.json(cakes.map(({ cake, categoryName }) => formatCake(cake, categoryName)));
});

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
    .orderBy(desc(sql`count(${orderItemsTable.id})`))
    .limit(8);
  res.json(popular.map(({ cake, categoryName }) => formatCake(cake, categoryName)));
});

router.post("/cakes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cake] = await db.insert(cakesTable).values({
    ...parsed.data,
    imageUrl: normalizeSupabaseMediaUrl(parsed.data.imageUrl) || undefined,
    price: String(parsed.data.price),
    variants: parsed.data.variants ? JSON.stringify(parsed.data.variants) : null,
  }).returning();
  res.status(201).json(formatCake(cake, null));
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
  res.json(formatCake(row.cake, row.categoryName));
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
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (typeof updateData.imageUrl === "string") {
    updateData.imageUrl = normalizeSupabaseMediaUrl(updateData.imageUrl) || undefined;
  }
  if (parsed.data.price != null) updateData.price = String(parsed.data.price);
  if ("variants" in parsed.data) {
    updateData.variants = parsed.data.variants ? JSON.stringify(parsed.data.variants) : null;
  }

  const [cake] = await db
    .update(cakesTable)
    .set(updateData)
    .where(eq(cakesTable.id, params.data.id))
    .returning();
  if (!cake) {
    res.status(404).json({ error: "Cake not found" });
    return;
  }
  res.json(formatCake(cake, null));
});

router.delete("/cakes/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCakeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(cakesTable).where(eq(cakesTable.id, params.data.id));
  res.sendStatus(204);
});

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
  categoryName: string | null | undefined
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
    createdAt: cake.createdAt.toISOString(),
  };
}

export default router;
