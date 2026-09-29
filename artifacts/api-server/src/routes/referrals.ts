import { Router, type IRouter, type Request, type Response } from "express";
import { desc, inArray } from "drizzle-orm";
import { customersTable, db, ordersTable, referralsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { ensureOrdersSchema } from "../lib/ensure-orders-schema";
import { ReferralSettingsSchema, findReferrerByCode, readReferralSettings, writeReferralSettings } from "../lib/referrals";

const router: IRouter = Router();

// What the shop tells customers: "Give KES 200, get KES 200".
router.get("/referrals/programme", async (_req: Request, res: Response): Promise<void> => {
  res.json(await readReferralSettings());
});

// Checkout's preview for a code the customer typed or followed a friend's link with. Whether it can be used on
// this order (a first order, not their own code) is checked when the order is placed.
router.get("/referrals/check", async (req: Request, res: Response): Promise<void> => {
  await ensureOrdersSchema();
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const settings = await readReferralSettings();
  const referrer = settings.enabled ? await findReferrerByCode(code) : null;
  res.json(referrer ? { valid: true, discount: settings.friendDiscount } : { valid: false });
});

router.get("/referrals/settings", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  res.json(await readReferralSettings());
});

router.put("/referrals/settings", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = ReferralSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the referral amounts" });
    return;
  }
  res.json(await writeReferralSettings(parsed.data));
});

// Recent referrals for the owner: who referred whom, and whether the reward has been earned.
router.get("/referrals", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  await ensureOrdersSchema();
  const referrals = await db.select().from(referralsTable).orderBy(desc(referralsTable.createdAt)).limit(100);
  const orderIds = referrals.map((referral) => referral.referredOrderId);
  const referrerIds = referrals.map((referral) => referral.referrerCustomerId);
  const orders = orderIds.length
    ? await db.select({ id: ordersTable.id, customerName: ordersTable.customerName, total: ordersTable.total, paymentStatus: ordersTable.paymentStatus }).from(ordersTable).where(inArray(ordersTable.id, orderIds))
    : [];
  const referrers = referrerIds.length
    ? await db.select({ id: customersTable.id, name: customersTable.name, creditBalance: customersTable.creditBalance }).from(customersTable).where(inArray(customersTable.id, referrerIds))
    : [];
  res.json(
    referrals.map((referral) => {
      const order = orders.find((candidate) => candidate.id === referral.referredOrderId);
      const referrer = referrers.find((candidate) => candidate.id === referral.referrerCustomerId);
      return {
        id: referral.id,
        code: referral.code,
        status: referral.status,
        friendName: order?.customerName ?? null,
        orderId: referral.referredOrderId,
        orderPaid: order?.paymentStatus === "paid",
        referrerName: referrer?.name ?? null,
        referrerCreditBalance: referrer ? parseFloat(referrer.creditBalance) : null,
        friendDiscount: parseFloat(referral.friendDiscount),
        referrerReward: parseFloat(referral.referrerReward),
        createdAt: referral.createdAt.toISOString(),
        rewardedAt: referral.rewardedAt?.toISOString() ?? null,
      };
    }),
  );
});

export default router;
