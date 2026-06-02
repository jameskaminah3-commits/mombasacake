import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, blogPostsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateBlogBody = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  coverImageUrl: z.string().optional(),
  published: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

const BlogParams = z.object({ id: z.coerce.number() });
const SlugParams = z.object({ slug: z.string() });

router.get("/blog", async (_req, res): Promise<void> => {
  const posts = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.published, true))
    .orderBy(desc(blogPostsTable.publishedAt));
  res.json(posts.map(formatPost));
});

router.get("/blog/all", async (_req, res): Promise<void> => {
  const posts = await db
    .select()
    .from(blogPostsTable)
    .orderBy(desc(blogPostsTable.createdAt));
  res.json(posts.map(formatPost));
});

router.post("/blog", async (req, res): Promise<void> => {
  const parsed = CreateBlogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.publishedAt) data.publishedAt = new Date(parsed.data.publishedAt);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [post] = await db.insert(blogPostsTable).values(data as any).returning();
  res.status(201).json(formatPost(post));
});

router.get("/blog/:slug", async (req, res): Promise<void> => {
  const params = SlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [post] = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.slug, params.data.slug));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(formatPost(post));
});

router.patch("/blog/:id", async (req, res): Promise<void> => {
  const params = BlogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateBlogBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data?.publishedAt) data.publishedAt = new Date(parsed.data.publishedAt);
  const [post] = await db
    .update(blogPostsTable)
    .set(data)
    .where(eq(blogPostsTable.id, params.data.id))
    .returning();
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(formatPost(post));
});

router.delete("/blog/:id", async (req, res): Promise<void> => {
  const params = BlogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, params.data.id));
  res.sendStatus(204);
});

function formatPost(p: typeof blogPostsTable.$inferSelect) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? null,
    content: p.content,
    coverImageUrl: p.coverImageUrl ?? null,
    published: p.published,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;
