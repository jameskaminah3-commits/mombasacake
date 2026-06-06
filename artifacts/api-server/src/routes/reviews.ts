import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, reviewsTable, cakesTable, ordersTable, orderItemsTable, ensureReviewsSchema } from "@workspace/db";
import { z } from "zod";
import { requireAdmin } from "../lib/auth-middleware";

const router: IRouter = Router();

const CreateReviewBody = z.object({
  cakeId: z.coerce.number().int().positive(),
  authorName: z.string().min(1).max(100),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().min(5).max(2000),
  orderId: z.coerce.number().int().positive(),
  customerPhone: z.string().min(7).max(30),
});

const ReviewParams = z.object({ id: z.coerce.number() });
const CakeIdParams = z.object({ cakeId: z.coerce.number() });

router.get("/reviews", async (_req, res): Promise<void> => {
  await ensureReviewsSchema();
  const reviews = await db
    .select({
      review: reviewsTable,
      cakeName: cakesTable.name,
    })
    .from(reviewsTable)
    .leftJoin(cakesTable, eq(cakesTable.id, reviewsTable.cakeId))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(
    reviews.map(({ review, cakeName }) => ({
      ...formatReview(review),
      cakeName: cakeName ?? `Cake #${review.cakeId}`,
    })),
  );
});

router.get("/reviews/cake/:cakeId", async (req, res): Promise<void> => {
  await ensureReviewsSchema();
  const params = CakeIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.cakeId, params.data.cakeId))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(reviews.map(formatReview));
});

router.post("/reviews", async (req, res): Promise<void> => {
  await ensureReviewsSchema();
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customerPhone = parsed.data.customerPhone.trim();

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
  if (!order) {
    res.status(400).json({ error: "That order could not be found" });
    return;
  }
  if (order.paymentStatus !== "paid") {
    res.status(400).json({ error: "You can only review after a paid order" });
    return;
  }
  if (order.customerPhone !== customerPhone) {
    res.status(400).json({ error: "The phone number does not match that order" });
    return;
  }

  const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const purchasedCake = orderItems.some((item) => item.cakeId === parsed.data.cakeId);
  if (!purchasedCake) {
    res.status(400).json({ error: "That order does not include this cake" });
    return;
  }

  const [existingReview] = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.orderId, order.id), eq(reviewsTable.cakeId, parsed.data.cakeId)));
  if (existingReview) {
    res.status(409).json({ error: "This order has already been used to submit a review" });
    return;
  }
  const [review] = await db.insert(reviewsTable).values({
    cakeId: parsed.data.cakeId,
    orderId: order.id,
    authorName: parsed.data.authorName,
    rating: parsed.data.rating,
    body: parsed.data.body,
  }).returning();
  res.status(201).json(formatReview(review));
});

router.delete("/reviews/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = ReviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(reviewsTable).where(eq(reviewsTable.id, params.data.id));
  res.sendStatus(204);
});

function formatReview(r: typeof reviewsTable.$inferSelect) {
  return {
    id: r.id,
    cakeId: r.cakeId,
    authorName: r.authorName,
    rating: r.rating,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
