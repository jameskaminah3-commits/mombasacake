import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import { AdminExistsError, INVITE_TTL_DAYS, addAdmin } from "../lib/admin-auth";
import { requireAdmin } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { sendTestAlert } from "../lib/order-notifications";
import { siteUrl } from "../lib/seo";

const router: IRouter = Router();

const AddAdminBody = z.object({
  name: z.string().trim().min(1, "Enter their name").max(80, "Use a shorter name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
});

// Resend's own reason when it refuses an email (e.g. a domain that isn't verified yet), else a plain message.
function emailProblem(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Resend is not configured.") return "Email isn't set up yet: add RESEND_API_KEY and RESEND_FROM_EMAIL in Railway.";
  try {
    const reason = (JSON.parse(message) as { message?: unknown }).message;
    if (typeof reason === "string" && reason) return `Resend says: ${reason}`;
  } catch {
    // Not Resend's JSON.
  }
  return message ? `The email didn't go out: ${message}` : "The email didn't go out.";
}

// Everyone who can sign in to Admin. They all get the shop's alerts (new orders, M-Pesa codes to check).
router.get("/admins", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const admins = await db
    .select({ id: adminsTable.id, name: adminsTable.name, email: adminsTable.email, createdAt: adminsTable.createdAt })
    .from(adminsTable)
    .orderBy(asc(adminsTable.createdAt), asc(adminsTable.id));
  res.json(admins.map((admin) => ({ ...admin, createdAt: admin.createdAt.toISOString(), you: String(admin.id) === req.admin?.id })));
});

router.post("/admins", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = AddAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the name and email" });
    return;
  }
  try {
    const added = await addAdmin(parsed.data, req.admin?.name || "The shop's owner", siteUrl(req));
    logger.info({ adminId: added.admin.id, by: req.admin?.id }, "Admin added");
    res.status(201).json({
      admin: { id: Number(added.admin.id), name: added.admin.name, email: added.admin.email, createdAt: added.createdAt.toISOString(), you: false },
      emailed: added.emailed,
      inviteLink: added.link,
      inviteDays: INVITE_TTL_DAYS,
    });
  } catch (error) {
    if (error instanceof AdminExistsError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.delete("/admins/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Unknown admin" });
    return;
  }
  // Nobody can lock themselves (or the shop) out.
  if (String(id) === req.admin?.id) {
    res.status(400).json({ error: "You can't remove yourself. Ask another admin to do it." });
    return;
  }
  const [removed] = await db.delete(adminsTable).where(eq(adminsTable.id, id)).returning({ id: adminsTable.id, email: adminsTable.email });
  if (!removed) {
    res.status(404).json({ error: "That admin was already removed." });
    return;
  }
  logger.info({ adminId: removed.id, by: req.admin?.id }, "Admin removed");
  res.json({ ok: true });
});

router.post("/admins/test-alert", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const recipients = await sendTestAlert(siteUrl(req), req.admin?.name || "An admin");
    res.json({ recipients });
  } catch (error) {
    logger.error({ err: error }, "Test alert failed");
    res.status(502).json({ error: emailProblem(error) });
  }
});

export default router;
