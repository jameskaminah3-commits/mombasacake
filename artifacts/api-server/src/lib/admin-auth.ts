import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, adminsTable } from "@workspace/db";
import { adminPasswordResetsTable } from "@workspace/db/schema";
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

const JWT_SECRET = process.env.SESSION_SECRET || "dev-only-session-secret";
const SESSION_TTL = "7d";
const RESET_TOKEN_TTL_MINUTES = 30;
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "jameskaminah3@gmail.com").trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "James@Channah";
const DEFAULT_ADMIN_NAME = (process.env.ADMIN_NAME || "James").trim();

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

async function ensureDefaultAdminAccount(): Promise<AdminAuthPayload | null> {
  const [existing] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, DEFAULT_ADMIN_EMAIL));

  if (existing) {
    return normalizeAdmin(existing);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  const [inserted] = await db
    .insert(adminsTable)
    .values({
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      passwordHash,
    })
    .onConflictDoNothing({ target: adminsTable.email })
    .returning();

  if (inserted) {
    return normalizeAdmin(inserted);
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, DEFAULT_ADMIN_EMAIL));

  return admin ? normalizeAdmin(admin) : null;
}

function buildResetUrl(token: string) {
  const appUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${appUrl}/login#type=recovery&access_token=${token}`;
}

export async function resolveAdminFromBearerToken(token: string): Promise<AdminAuthPayload | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminAuthPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function loginAdmin(email: string, password: string): Promise<LoginSessionResponse> {
  await ensureDefaultAdminAccount();

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email.trim().toLowerCase()));

  if (!admin) {
    throw new Error("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const adminPayload = normalizeAdmin(admin);
  const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: SESSION_TTL });

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

export async function sendAdminPasswordResetEmail(email: string) {
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email.trim().toLowerCase()));

  if (!admin) {
    return;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await db.insert(adminPasswordResetsTable).values({
    adminId: admin.id,
    tokenHash,
    expiresAt,
  });

  await sendResendEmail({
    to: admin.email,
    subject: "Reset your admin password",
    html: `
      <p>Use the link below to reset your admin password:</p>
      <p><a href="${buildResetUrl(token)}">${buildResetUrl(token)}</a></p>
      <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
    `,
  });
}

export async function updateAdminPassword(accessToken: string, password: string) {
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
