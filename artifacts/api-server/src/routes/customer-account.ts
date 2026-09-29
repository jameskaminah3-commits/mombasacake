import { randomInt } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { customerAccountsTable, customerLoginCodesTable, customersTable, db, orderItemsTable, ordersTable, type CustomerAccount } from "@workspace/db";
import { emailLoginAvailable, hashLoginCode, requireCustomer, signCustomerSession } from "../lib/customer-auth";
import { ensureOrdersSchema } from "../lib/ensure-orders-schema";
import { logger } from "../lib/logger";
import { normalizeKenyanPhone } from "../lib/phone";
import { ensureReferralCode, readReferralSettings } from "../lib/referrals";
import { sendResendEmail } from "../lib/resend-email";

const router: IRouter = Router();

const CODE_TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
const MAX_CODES_PER_VISITOR_PER_HOUR = 20;

const EmailSchema = z.string().trim().toLowerCase().email().max(200);

// How many sign-in emails each visitor asked for in the last hour (kept in memory; resets on restart).
const recentRequests = new Map<string, number[]>();
function tooManyFromVisitor(visitor: string) {
  if (recentRequests.size > 10_000) recentRequests.clear();
  const now = Date.now();
  const recent = (recentRequests.get(visitor) ?? []).filter((time) => now - time < 60 * 60_000);
  recent.push(now);
  recentRequests.set(visitor, recent);
  return recent.length > MAX_CODES_PER_VISITOR_PER_HOUR;
}

function formatAccount(account: CustomerAccount) {
  return { email: account.email, name: account.name ?? "", phone: account.phone ?? "", address: account.address ?? "" };
}

// Signing in needs the shop to be able to send email; the shop hides "Sign in" until it can.
router.get("/customer/auth/config", (_req: Request, res: Response): void => {
  res.json({ emailLogin: emailLoginAvailable() });
});

router.post("/customer/auth/start", async (req: Request, res: Response): Promise<void> => {
  if (!emailLoginAvailable()) {
    res.status(503).json({ error: "Signing in isn't available yet." });
    return;
  }
  const email = EmailSchema.safeParse(req.body?.email);
  if (!email.success) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  await ensureOrdersSchema();
  if (tooManyFromVisitor(req.ip ?? "unknown")) {
    res.status(429).json({ error: "Too many sign-in requests. Please try again later." });
    return;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerLoginCodesTable)
    .where(and(eq(customerLoginCodesTable.email, email.data), gt(customerLoginCodesTable.createdAt, new Date(Date.now() - 60 * 60_000))));
  if (count >= MAX_CODES_PER_EMAIL_PER_HOUR) {
    res.status(429).json({ error: "We've sent several codes already. Check your email, or try again in an hour." });
    return;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(customerLoginCodesTable).values({
    email: email.data,
    codeHash: hashLoginCode(email.data, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  try {
    await sendResendEmail({
      to: email.data,
      subject: `Your Channah Cakes sign-in code: ${code}`,
      html: `<p>Your sign-in code is</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>It works for 15 minutes. If you didn't ask for it, you can ignore this email.</p><p>Channah Cake House, Mombasa</p>`,
      text: `Your Channah Cakes sign-in code is ${code}. It works for 15 minutes. If you didn't ask for it, you can ignore this email.`,
    });
  } catch (err) {
    logger.error({ err }, "Sign-in code email failed");
    res.status(502).json({ error: "We couldn't send the email just now. Please try again." });
    return;
  }
  res.json({ sent: true });
});

router.post("/customer/auth/verify", async (req: Request, res: Response): Promise<void> => {
  const email = EmailSchema.safeParse(req.body?.email);
  const code = typeof req.body?.code === "string" ? req.body.code.replace(/\D/g, "") : "";
  if (!email.success || code.length !== 6) {
    res.status(400).json({ error: "Enter the 6-digit code from the email." });
    return;
  }
  await ensureOrdersSchema();
  const [latest] = await db
    .select()
    .from(customerLoginCodesTable)
    .where(and(eq(customerLoginCodesTable.email, email.data), isNull(customerLoginCodesTable.usedAt), gt(customerLoginCodesTable.expiresAt, new Date())))
    .orderBy(desc(customerLoginCodesTable.createdAt))
    .limit(1);
  if (!latest || latest.attempts >= MAX_ATTEMPTS_PER_CODE) {
    res.status(400).json({ error: "That code has expired. Ask for a new one." });
    return;
  }
  if (latest.codeHash !== hashLoginCode(email.data, code)) {
    await db.update(customerLoginCodesTable).set({ attempts: latest.attempts + 1 }).where(eq(customerLoginCodesTable.id, latest.id));
    res.status(400).json({ error: "That code isn't right. Check the email and try again." });
    return;
  }
  await db.update(customerLoginCodesTable).set({ usedAt: new Date() }).where(eq(customerLoginCodesTable.id, latest.id));

  // The first sign-in creates the account, filled in from their latest order with this email.
  let [account] = await db.select().from(customerAccountsTable).where(eq(customerAccountsTable.email, email.data));
  if (!account) {
    const [lastOrder] = await db
      .select()
      .from(ordersTable)
      .where(sql`lower(${ordersTable.customerEmail}) = ${email.data}`)
      .orderBy(desc(ordersTable.createdAt))
      .limit(1);
    await db
      .insert(customerAccountsTable)
      .values({
        email: email.data,
        name: lastOrder?.customerName ?? null,
        phone: lastOrder?.customerPhone ?? null,
        address: lastOrder?.deliveryAddress ?? null,
      })
      .onConflictDoNothing();
    [account] = await db.select().from(customerAccountsTable).where(eq(customerAccountsTable.email, email.data));
  }
  res.json({ token: signCustomerSession(account), account: formatAccount(account) });
});

// The signed-in customer's details, their orders (placed with their email) and their referral code and credit.
router.get("/customer/me", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  await ensureOrdersSchema();
  const account = req.customer!;
  const orders = await db
    .select()
    .from(ordersTable)
    .where(sql`lower(${ordersTable.customerEmail}) = ${account.email.toLowerCase()}`)
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);
  const items = orders.length
    ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orders.map((order) => order.id)))
    : [];

  // Their referral code and credit belong to the customer record behind their own orders.
  let referral = null;
  const settings = await readReferralSettings();
  const customerId = orders.find((order) => order.customerId)?.customerId;
  if (settings.enabled && customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
    if (customer) {
      referral = {
        code: await ensureReferralCode(customer),
        creditBalance: parseFloat(customer.creditBalance),
        friendDiscount: settings.friendDiscount,
        referrerReward: settings.referrerReward,
        // Credit comes off orders placed with this number, so checkout can show it before they pay.
        phone: customer.phone,
      };
    }
  }

  res.json({
    account: formatAccount(account),
    orders: orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      total: parseFloat(order.total),
      status: order.status,
      paymentStatus: order.paymentStatus,
      accessToken: order.accessToken,
      items: items
        .filter((item) => item.orderId === order.id)
        .map((item) => ({ cakeName: item.cakeName, quantity: item.quantity, variantLabel: item.variantLabel })),
    })),
    referral,
  });
});

const AccountDetailsSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
});

router.put("/customer/me", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const parsed = AccountDetailsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check your details" });
    return;
  }
  const [account] = await db
    .update(customerAccountsTable)
    .set({
      name: parsed.data.name ?? req.customer!.name,
      phone: parsed.data.phone !== undefined ? normalizeKenyanPhone(parsed.data.phone) || null : req.customer!.phone,
      address: parsed.data.address ?? req.customer!.address,
    })
    .where(eq(customerAccountsTable.id, req.customer!.id))
    .returning();
  res.json({ account: formatAccount(account) });
});

export default router;
