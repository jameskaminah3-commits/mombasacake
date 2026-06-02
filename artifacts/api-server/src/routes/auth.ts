import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET || "changeme-in-production";

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  adminSecret: z.string(),
});

// POST /api/auth/login
router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password format" });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, parsed.data.email.toLowerCase()));

  if (!admin) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
});

// POST /api/auth/register  (requires ADMIN_SETUP_SECRET env var)
router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const setupSecret = process.env.ADMIN_SETUP_SECRET;
  if (!setupSecret || parsed.data.adminSecret !== setupSecret) {
    res.status(403).json({ error: "Invalid admin setup secret" });
    return;
  }

  const existing = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, parsed.data.email.toLowerCase()));

  if (existing.length > 0) {
    res.status(409).json({ error: "An admin with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [admin] = await db
    .insert(adminsTable)
    .values({
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      passwordHash,
    })
    .returning();

  const token = jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.status(201).json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
});

// GET /api/auth/me
router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { id: number; email: string; name: string };
    res.json({ id: payload.id, email: payload.email, name: payload.name });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export { JWT_SECRET };
export default router;
