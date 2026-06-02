import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, reviewsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateReviewBody = z.object({
  cakeId: z.coerce.number().int().positive(),
  authorName: z.string().min(1).max(100),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().min(5).max(2000),
});

const ReviewParams = z.object({ id: z.coerce.number() });
const CakeIdParams = z.object({ cakeId: z.coerce.number() });

router.get("/reviews/cake/:cakeId", async (req, res): Promise<void> => {
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
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [review] = await db.insert(reviewsTable).values(parsed.data).returning();
  res.status(201).json(formatReview(review));
});

router.delete("/reviews/:id", async (req, res): Promise<void> => {
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
