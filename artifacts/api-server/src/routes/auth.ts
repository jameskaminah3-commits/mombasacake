import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  loginAdmin,
  refreshAdminSession,
  resolveAdminFromBearerToken,
  sendAdminPasswordResetEmail,
  updateAdminPassword,
} from "../lib/admin-auth";

const router: IRouter = Router();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

const PasswordResetBody = z.object({
  email: z.string().email(),
});

const PasswordUpdateBody = z.object({
  accessToken: z.string().min(1),
  password: z.string().min(8),
});

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password format" });
    return;
  }

  try {
    const session = await loginAdmin(parsed.data.email, parsed.data.password);
    res.json(session);
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Invalid credentials",
    });
  }
});

router.post("/auth/refresh", async (req: Request, res: Response): Promise<void> => {
  const parsed = RefreshBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing refresh token" });
    return;
  }

  try {
    const session = await refreshAdminSession(parsed.data.refreshToken);
    res.json(session);
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Session refresh failed",
    });
  }
});

router.post("/auth/password-reset", async (req: Request, res: Response): Promise<void> => {
  const parsed = PasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await sendAdminPasswordResetEmail(parsed.data.email);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to send password reset email",
    });
  }
});

router.post("/auth/password-update", async (req: Request, res: Response): Promise<void> => {
  const parsed = PasswordUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const admin = await updateAdminPassword(parsed.data.accessToken, parsed.data.password);
    res.json({ admin });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update password",
    });
  }
});

router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const admin = await resolveAdminFromBearerToken(authHeader.slice(7));
  if (!admin) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  res.json(admin);
});

export default router;
