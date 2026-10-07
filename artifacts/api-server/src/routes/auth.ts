import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  InvalidAdminCredentialsError,
  ResetCodeError,
  loginAdmin,
  refreshAdminSession,
  resetAdminPasswordWithCode,
  resolveAdminFromBearerToken,
  sendAdminResetCode,
  updateAdminPassword,
} from "../lib/admin-auth";
import { logger } from "../lib/logger";
import { emailConfigured } from "../lib/resend-email";

const router: IRouter = Router();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

const PasswordResetBody = z.object({
  email: z.string().trim().email(),
});

const PasswordResetCodeBody = z.object({
  email: z.string().trim().email(),
  code: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(6, "Enter the 6-digit code from the email.")),
  password: z.string().min(8, "Use at least 8 characters for the password."),
});

// Asking for reset codes is limited per visitor too (on top of a few codes per admin an hour).
const resetRequests = new Map<string, number[]>();
function tooManyResetRequests(visitor: string) {
  if (resetRequests.size > 10_000) resetRequests.clear();
  const now = Date.now();
  const recent = (resetRequests.get(visitor) ?? []).filter((time) => now - time < 60 * 60_000);
  recent.push(now);
  resetRequests.set(visitor, recent);
  return recent.length > 20;
}

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
    if (error instanceof InvalidAdminCredentialsError) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    logger.error(
      { err: error, email: parsed.data.email.trim().toLowerCase() },
      "Admin login service error",
    );
    res.status(500).json({ error: "Login service unavailable" });
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

// Forgot password, step 1: email a 6-digit code to the admin.
router.post("/auth/password-reset", async (req: Request, res: Response): Promise<void> => {
  const parsed = PasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your admin email address." });
    return;
  }
  if (!emailConfigured()) {
    res.status(503).json({ error: "Email isn't set up for the shop yet, so reset codes can't be sent." });
    return;
  }
  if (tooManyResetRequests(req.ip ?? "unknown")) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  try {
    await sendAdminResetCode(parsed.data.email);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof ResetCodeError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error({ err: error }, "Admin reset code email failed");
    res.status(502).json({ error: "We couldn't send the email just now. Please try again." });
  }
});

// Forgot password, step 2: the code from the email and the new password.
router.post("/auth/password-reset/verify", async (req: Request, res: Response): Promise<void> => {
  const parsed = PasswordResetCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the code and password." });
    return;
  }
  try {
    const admin = await resetAdminPasswordWithCode(parsed.data.email, parsed.data.code, parsed.data.password);
    res.json({ admin });
  } catch (error) {
    if (error instanceof ResetCodeError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
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
