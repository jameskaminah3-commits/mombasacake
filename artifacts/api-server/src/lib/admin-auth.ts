import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, adminsTable } from "@workspace/db";
import { adminPasswordResetsTable } from "@workspace/db/schema";
import { logger } from "./logger";
import { escapeHtml } from "./order-notifications";
import { sendResendEmail } from "./resend-email";

export interface AdminAuthPayload {
  id: string;
  email: string;
  name: string;
}

export interface LoginSessionResponse {
  token: string;
  refreshToken: string | null;
  expiresAt: string | null;
  admin: AdminAuthPayload;
}

export class InvalidAdminCredentialsError extends Error {
  readonly reason: "admin_not_found" | "invalid_password";

  constructor(reason: InvalidAdminCredentialsError["reason"]) {
    super("Invalid credentials");
    this.name = "InvalidAdminCredentialsError";
    this.reason = reason;
  }
}

const JWT_SECRET = process.env.SESSION_SECRET || "dev-only-session-secret";
const SESSION_TTL = "7d";
const RESET_TOKEN_TTL_MINUTES = 30;
export const INVITE_TTL_DAYS = 3;

// Password links (Forgot password, and invites for new admins). Created on first use: production databases get
// new tables this way rather than through migrations.
let ensureResetsPromise: Promise<void> | null = null;
function ensurePasswordLinksTable(): Promise<void> {
  ensureResetsPromise ??= db
    .execute(sql`
      CREATE TABLE IF NOT EXISTS admin_password_resets (
        id serial PRIMARY KEY,
        admin_id integer NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamp with time zone NOT NULL,
        used_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `)
    .then(() => undefined)
    .catch((error) => {
      ensureResetsPromise = null;
      throw error;
    });
  return ensureResetsPromise;
}

function normalizeAdmin(admin: { id: number; email: string; name: string }): AdminAuthPayload {
  return {
    id: String(admin.id),
    email: admin.email,
    name: admin.name,
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// The shop's address comes from PUBLIC_APP_URL, else from the request (so links work either way).
function passwordLinkUrl(token: string, baseUrl: string, type: "recovery" | "invite") {
  const appUrl = (process.env.PUBLIC_APP_URL || baseUrl).replace(/\/$/, "");
  return `${appUrl}/login#type=${type}&access_token=${token}`;
}

async function createPasswordLink(adminId: number, expiresAt: Date) {
  await ensurePasswordLinksTable();
  const token = randomBytes(32).toString("hex");
  await db.insert(adminPasswordResetsTable).values({ adminId, tokenHash: hashToken(token), expiresAt });
  return token;
}

export async function resolveAdminFromBearerToken(token: string): Promise<AdminAuthPayload | null> {
  let payload: AdminAuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AdminAuthPayload;
  } catch {
    return null;
  }
  // Only admins still on the list: someone removed in Admin → Admins loses access at once, not when their
  // sign-in runs out.
  const id = Number(payload.id);
  if (!Number.isInteger(id)) return null;
  const [admin] = await db
    .select({ id: adminsTable.id, email: adminsTable.email, name: adminsTable.name })
    .from(adminsTable)
    .where(eq(adminsTable.id, id));
  return admin ? normalizeAdmin(admin) : null;
}

export async function loginAdmin(email: string, password: string): Promise<LoginSessionResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, normalizedEmail));

  if (!admin) {
    logger.warn({ email: normalizedEmail, reason: "admin_not_found" }, "Admin login failed");
    throw new InvalidAdminCredentialsError("admin_not_found");
  }

  if (!(await bcrypt.compare(password, admin.passwordHash))) {
    logger.warn({ email: normalizedEmail, reason: "invalid_password" }, "Admin login failed");
    throw new InvalidAdminCredentialsError("invalid_password");
  }

  const adminPayload = normalizeAdmin(admin);
  const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: SESSION_TTL });
  logger.info({ email: normalizedEmail, adminId: adminPayload.id }, "Admin login succeeded");

  return {
    token,
    refreshToken: null,
    expiresAt: null,
    admin: adminPayload,
  };
}

export async function refreshAdminSession(_refreshToken: string): Promise<LoginSessionResponse> {
  throw new Error("Session refresh is not available for admin table auth.");
}

export async function sendAdminPasswordResetEmail(email: string, baseUrl: string) {
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email.trim().toLowerCase()));

  if (!admin) {
    return;
  }

  const token = await createPasswordLink(admin.id, new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000));
  const link = passwordLinkUrl(token, baseUrl, "recovery");

  await sendResendEmail({
    to: admin.email,
    subject: "Reset your admin password",
    html: `
      <p>Use the link below to reset your admin password:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
    `,
    text: `Use this link to reset your admin password (it expires in ${RESET_TOKEN_TTL_MINUTES} minutes):\n${link}`,
  });
}

export class AdminExistsError extends Error {}

// A new admin: they're emailed a link to set their password (they can't sign in until they do), and from then on
// get the shop's order alerts like every admin. If the email can't be sent, the link is returned for the owner to
// pass on themselves.
export async function addAdmin(input: { name: string; email: string }, invitedBy: string, baseUrl: string) {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.email, email));
  if (existing) throw new AdminExistsError(`${email} is already an admin.`);

  // A random password nobody knows, until they set their own.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const [admin] = await db.insert(adminsTable).values({ email, name: input.name.trim(), passwordHash }).returning();
  const token = await createPasswordLink(admin.id, new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000));
  const link = passwordLinkUrl(token, baseUrl, "invite");
  const firstName = admin.name.split(/\s+/)[0] || admin.name;
  const loginPage = `${(process.env.PUBLIC_APP_URL || baseUrl).replace(/\/$/, "")}/login`;

  let emailed = true;
  try {
    await sendResendEmail({
      to: admin.email,
      subject: "You've been added as an admin of Channah Cake House",
      html: `
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>${escapeHtml(invitedBy)} added you as an admin of the Channah Cake House shop. Set your password to sign in:</p>
        <p><a href="${escapeHtml(link)}">Set your password</a></p>
        <p>This link works for ${INVITE_TTL_DAYS} days. After that, use "Forgot password" on <a href="${escapeHtml(loginPage)}">the sign-in page</a>.</p>
        <p>As an admin you'll also get emails about new orders and M-Pesa codes to check.</p>
      `,
      text: [
        `Hi ${firstName},`,
        `${invitedBy} added you as an admin of the Channah Cake House shop. Set your password to sign in:`,
        link,
        `This link works for ${INVITE_TTL_DAYS} days. After that, use "Forgot password" on ${loginPage}.`,
        "As an admin you'll also get emails about new orders and M-Pesa codes to check.",
      ].join("\n\n"),
    });
  } catch (err) {
    logger.error({ err, adminId: admin.id }, "Admin invite email failed");
    emailed = false;
  }
  return { admin: normalizeAdmin(admin), createdAt: admin.createdAt, emailed, link: emailed ? null : link };
}

export async function updateAdminPassword(accessToken: string, password: string) {
  await ensurePasswordLinksTable();
  const tokenHash = hashToken(accessToken);
  const now = new Date();

  const [reset] = await db
    .select()
    .from(adminPasswordResetsTable)
    .where(
      and(
        eq(adminPasswordResetsTable.tokenHash, tokenHash),
        isNull(adminPasswordResetsTable.usedAt),
        gt(adminPasswordResetsTable.expiresAt, now),
      ),
    );

  if (!reset) {
    throw new Error("This reset link is invalid or has expired.");
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, reset.adminId));

  if (!admin) {
    throw new Error("Admin account not found.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.transaction(async (trx) => {
    await trx
      .update(adminsTable)
      .set({ passwordHash })
      .where(eq(adminsTable.id, admin.id));

    await trx
      .update(adminPasswordResetsTable)
      .set({ usedAt: now })
      .where(eq(adminPasswordResetsTable.id, reset.id));
  });

  return normalizeAdmin(admin);
}
