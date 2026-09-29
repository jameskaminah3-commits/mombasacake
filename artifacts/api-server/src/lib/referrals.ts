import { randomInt } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { customersTable, db, ordersTable, referralsTable, type Customer } from "@workspace/db";
import { logger } from "./logger";
import { phoneKey } from "./phone";
import { readStoreSetting, writeStoreSetting } from "./store-settings";

const SETTINGS_KEY = "referral-programme";

// Give-and-get referrals: a friend's first order gets friendDiscount off; once it is paid, the customer who
// referred them gets referrerReward credit, taken off their next order automatically.
export const ReferralSettingsSchema = z.object({
  enabled: z.boolean(),
  friendDiscount: z.number().min(0).max(100_000),
  referrerReward: z.number().min(0).max(100_000),
});
export type ReferralSettings = z.infer<typeof ReferralSettingsSchema>;
export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = { enabled: true, friendDiscount: 200, referrerReward: 200 };

export async function readReferralSettings(): Promise<ReferralSettings> {
  const saved = ReferralSettingsSchema.safeParse(await readStoreSetting(SETTINGS_KEY));
  return saved.success ? saved.data : DEFAULT_REFERRAL_SETTINGS;
}

export async function writeReferralSettings(settings: ReferralSettings) {
  await writeStoreSetting(SETTINGS_KEY, settings);
  return settings;
}

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const samePhone = (key: string) => sql`right(regexp_replace(${customersTable.phone}, '[^0-9]', '', 'g'), 9) = ${key}`;
const orderPhone = (key: string) => sql`right(regexp_replace(${ordersTable.customerPhone}, '[^0-9]', '', 'g'), 9) = ${key}`;

// The customer record for a phone number, however it was written.
export async function findCustomerByPhone(phone: string, conn: Db | Tx = db): Promise<Customer | null> {
  const key = phoneKey(phone);
  if (key.length !== 9) return null;
  const [customer] = await conn.select().from(customersTable).where(samePhone(key)).orderBy(customersTable.id).limit(1);
  return customer ?? null;
}

// A customer's code: their first name in capitals and four digits, e.g. AMINA4821.
export async function ensureReferralCode(customer: Pick<Customer, "id" | "name" | "referralCode">): Promise<string> {
  if (customer.referralCode) return customer.referralCode;
  const base = (customer.name.trim().split(/\s+/)[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "FRIEND";
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = `${base}${randomInt(1000, 10000)}`;
    try {
      const [updated] = await db
        .update(customersTable)
        .set({ referralCode: code })
        .where(and(eq(customersTable.id, customer.id), sql`${customersTable.referralCode} IS NULL`))
        .returning({ referralCode: customersTable.referralCode });
      if (updated?.referralCode) return updated.referralCode;
      const [current] = await db.select({ referralCode: customersTable.referralCode }).from(customersTable).where(eq(customersTable.id, customer.id));
      if (current?.referralCode) return current.referralCode;
    } catch (err) {
      // Someone else has this code; try another number.
      logger.debug({ err }, "Referral code taken, retrying");
    }
  }
  throw new Error("Could not create a referral code");
}

export async function findReferrerByCode(code: string): Promise<Customer | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const [referrer] = await db.select().from(customersTable).where(sql`upper(${customersTable.referralCode}) = ${clean}`).limit(1);
  return referrer ?? null;
}

export class ReferralCodeError extends Error {}

// At checkout: the discount for a friend's code, or an explanation of why it can't be used.
export async function referralDiscountFor(code: string, customerPhone: string, settings: ReferralSettings, subtotal: number) {
  const referrer = await findReferrerByCode(code);
  if (!referrer || !settings.enabled) return null;
  const key = phoneKey(customerPhone);
  if (key === phoneKey(referrer.phone)) throw new ReferralCodeError("That's your own referral code. Share it with friends: they get a discount and you get credit.");
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(and(orderPhone(key), ne(ordersTable.status, "cancelled")));
  if (count > 0) throw new ReferralCodeError("Referral codes are for a friend's first order. Welcome back!");
  return { referrer, discount: Math.min(settings.friendDiscount, subtotal) };
}

// Once a friend's order is paid, the customer who referred them gets their reward (only once).
export async function rewardReferralForPaidOrder(orderId: number) {
  const referral = await db.transaction(async (tx) => {
    const [referral] = await tx
      .update(referralsTable)
      .set({ status: "rewarded", rewardedAt: new Date() })
      .where(and(eq(referralsTable.referredOrderId, orderId), eq(referralsTable.status, "pending")))
      .returning();
    if (referral) {
      await tx
        .update(customersTable)
        .set({ creditBalance: sql`${customersTable.creditBalance} + ${referral.referrerReward}` })
        .where(eq(customersTable.id, referral.referrerCustomerId));
    }
    return referral;
  });
  if (referral) logger.info({ orderId, referrerCustomerId: referral.referrerCustomerId }, "Referral rewarded");
}

// A cancelled order earns no referral reward, and gives back any credit it used (once, however often it's called).
export async function undoRewardsForCancelledOrder(order: { id: number }) {
  await db
    .update(referralsTable)
    .set({ status: "cancelled" })
    .where(and(eq(referralsTable.referredOrderId, order.id), eq(referralsTable.status, "pending")));
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ creditUsed: ordersTable.creditUsed, customerId: ordersTable.customerId })
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id))
      .for("update");
    const credit = parseFloat(current?.creditUsed ?? "0");
    if (!current?.customerId || !(credit > 0)) return;
    await tx
      .update(customersTable)
      .set({ creditBalance: sql`${customersTable.creditBalance} + ${credit}` })
      .where(eq(customersTable.id, current.customerId));
    // The order no longer holds the credit, so un-cancelling it later means paying the full price.
    await tx
      .update(ordersTable)
      .set({ creditUsed: "0", total: sql`${ordersTable.total} + ${credit}` })
      .where(eq(ordersTable.id, order.id));
  });
}
