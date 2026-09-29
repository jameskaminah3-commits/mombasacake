import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, paymentsTable, ordersTable, orderItemsTable, paymentSettingsTable } from "@workspace/db";
import { InitiateMpesaPaymentBody, GetPaymentParams } from "@workspace/api-zod";
import { initiateStkPush, isValidCallbackKey, registerC2bUrls } from "../lib/mpesa";
import { emailCustomerAboutOrder } from "../lib/customer-notifications";
import { ensureOrdersSchema } from "../lib/ensure-orders-schema";
import { canAccessOrder } from "../lib/order-access";
import { rewardReferralForPaidOrder } from "../lib/referrals";
import { siteUrl } from "../lib/seo";
import { ensurePaymentSettingsSchema } from "../lib/ensure-payment-settings-schema";
import { logger } from "../lib/logger";
import { requireAdmin } from "../lib/auth-middleware";

const router: IRouter = Router();

router.get("/payments", requireAdmin, async (_req, res): Promise<void> => {
  const payments = await db
    .select()
    .from(paymentsTable)
    .orderBy(desc(paymentsTable.createdAt));
  res.json(payments.map(formatPayment));
});

router.post("/payments/mpesa/initiate", async (req, res): Promise<void> => {
  const parsed = InitiateMpesaPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureOrdersSchema();
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
  if (!order) {
    res.status(400).json({ error: "Order not found" });
    return;
  }
  // Only the customer (private link, phone number or account) or the owner can start a payment, and it is always
  // for the order's own amount and phone number, whatever the request says.
  if (!(await canAccessOrder(req, order))) {
    res.status(401).json({ error: "Open this order from your order link to pay for it." });
    return;
  }
  if (order.paymentStatus === "paid") {
    res.status(409).json({ error: "This order is already paid." });
    return;
  }
  const orderId = order.id;
  const phone = order.customerPhone;
  const amount = parseFloat(order.total);

  // Load operational config saved from the admin payment settings.
  await ensurePaymentSettingsSchema();
  const [settings] = await db
    .select()
    .from(paymentSettingsTable)
    .where(eq(paymentSettingsTable.settingsKey, "default"))
    .orderBy(desc(paymentSettingsTable.createdAt))
    .limit(1);

  const result = await initiateStkPush({
    orderId,
    phone,
    amount,
    shortcode: settings?.businessShortCode,
    transactionType: settings?.transactionType,
    tillNumber: settings?.tillNumber,
  });

  // Record pending payment
  await db.insert(paymentsTable).values({
    orderId,
    amount: String(amount),
    method: "mpesa",
    status: "pending",
    checkoutRequestId: result.checkoutRequestId,
    merchantRequestId: result.merchantRequestId,
  });

  const isBuyGoods = settings?.transactionType === "CustomerBuyGoodsOnline";
  const customerFacingNumber =
    isBuyGoods && settings?.tillNumber
      ? settings.tillNumber
      : settings?.businessShortCode || process.env.MPESA_SHORTCODE || "174379";

  res.json({
    checkoutRequestId: result.checkoutRequestId,
    merchantRequestId: result.merchantRequestId ?? null,
    responseDescription: result.responseDescription,
    businessShortCode: customerFacingNumber,
    transactionType: settings?.transactionType || "CustomerPayBillOnline",
  });
});

router.post("/payments/mpesa/callback", async (req, res): Promise<void> => {
  const body = req.body;
  req.log.info({ body }, "MPesa callback received");
  if (!isValidCallbackKey(req.query.key)) {
    logger.warn("M-Pesa callback without the right key ignored");
    res.json({ received: true });
    return;
  }

  try {
    await ensureOrdersSchema();
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      res.json({ received: true });
      return;
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    // Find payment by checkoutRequestId
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.checkoutRequestId, CheckoutRequestID));

    if (!payment) {
      logger.warn({ CheckoutRequestID }, "Payment not found for callback");
      res.json({ received: true });
      return;
    }

    let mpesaReceiptNo: string | undefined;
    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const receiptItem = CallbackMetadata.Item.find(
        (item: { Name: string }) => item.Name === "MpesaReceiptNumber"
      );
      mpesaReceiptNo = receiptItem?.Value;
    }

    const isSuccess = ResultCode === 0;
    const newStatus = isSuccess ? "completed" : "failed";

    await db
      .update(paymentsTable)
      .set({
        status: newStatus,
        mpesaReceiptNo: mpesaReceiptNo,
        rawCallback: JSON.stringify(body),
      })
      .where(eq(paymentsTable.id, payment.id));

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, payment.orderId));
    if (order && isSuccess) {
      // Confirm the order unless it has already moved on (e.g. being made).
      const [paidOrder] = await db
        .update(ordersTable)
        .set({ paymentStatus: "paid", mpesaReceiptNo, status: order.status === "pending" ? "confirmed" : order.status })
        .where(eq(ordersTable.id, order.id))
        .returning();
      if (order.paymentStatus !== "paid") await afterPayment(paidOrder, siteUrl(req));
    } else if (order && order.paymentStatus !== "paid") {
      // A cancelled or failed prompt never undoes a payment that already went through (e.g. a second attempt).
      await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Error processing MPesa callback");
    res.json({ received: true });
  }
});

// Safaricom calls this to validate an incoming C2B payment. We accept all.
router.post("/payments/mpesa/c2b/validation", (_req, res): void => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// Safaricom calls this for EVERY completed payment to the till, including ones
// the customer made manually via Buy Goods. Auto-reconcile when exactly one
// pending order matches the amount and payer phone; otherwise leave it for the
// owner to confirm via "Mark as paid".
router.post("/payments/mpesa/c2b/confirmation", async (req, res): Promise<void> => {
  const body = req.body;
  req.log.info({ body }, "MPesa C2B confirmation received");
  if (!isValidCallbackKey(req.query.key)) {
    // Registered before the key existed: register the URLs again in Admin → Payments. Until then the owner
    // confirms these payments with "Mark paid".
    logger.warn({ receipt: body?.TransID }, "M-Pesa C2B confirmation without the right key ignored");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  try {
    await ensureOrdersSchema();
    const amount = Math.ceil(Number(body?.TransAmount));
    const receipt = typeof body?.TransID === "string" ? body.TransID : undefined;
    const last9 = String(body?.MSISDN ?? "").replace(/\D/g, "").slice(-9);

    if (receipt && amount > 0 && last9) {
      const pending = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.paymentStatus, "pending"));

      const matches = pending.filter(
        (o) =>
          Math.ceil(Number(o.total)) === amount &&
          o.customerPhone.replace(/\D/g, "").slice(-9) === last9
      );

      if (matches.length === 1) {
        const order = matches[0];
        const [paidOrder] = await db
          .update(ordersTable)
          .set({ paymentStatus: "paid", status: "confirmed", mpesaReceiptNo: receipt })
          .where(eq(ordersTable.id, order.id))
          .returning();
        await db.insert(paymentsTable).values({
          orderId: order.id,
          amount: String(amount),
          method: "mpesa",
          status: "completed",
          mpesaReceiptNo: receipt,
          rawCallback: JSON.stringify(body),
        });
        logger.info({ orderId: order.id, receipt }, "C2B payment auto-reconciled");
        await afterPayment(paidOrder, siteUrl(req));
      } else {
        logger.warn(
          { receipt, amount, last9, matchCount: matches.length },
          "C2B payment needs manual confirmation"
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Error processing C2B confirmation");
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// Admin-triggered one-time registration of the C2B URLs with Safaricom.
router.post("/payments/mpesa/c2b/register", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const data = await registerC2bUrls();
    res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, "C2B URL registration failed");
    res.status(502).json({ ok: false, error: "Failed to register C2B URLs" });
  }
});

router.get("/payments/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.id, params.data.id));
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  res.json(formatPayment(payment));
});

function formatPayment(p: typeof paymentsTable.$inferSelect) {
  return {
    id: p.id,
    orderId: p.orderId,
    amount: parseFloat(p.amount),
    method: p.method,
    status: p.status,
    mpesaReceiptNo: p.mpesaReceiptNo ?? null,
    checkoutRequestId: p.checkoutRequestId ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;

// Once an order is paid: reward whoever referred the customer, and email the customer a receipt.
async function afterPayment(order: typeof ordersTable.$inferSelect, baseUrl: string) {
  try {
    await rewardReferralForPaidOrder(order.id);
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    await emailCustomerAboutOrder(order, items, "paid", baseUrl);
  } catch (err) {
    logger.error({ err, orderId: order.id }, "After-payment steps failed");
  }
}
