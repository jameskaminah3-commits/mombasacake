import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, paymentsTable, ordersTable, paymentSettingsTable } from "@workspace/db";
import { InitiateMpesaPaymentBody, GetPaymentParams } from "@workspace/api-zod";
import { initiateStkPush, registerC2bUrls } from "../lib/mpesa";
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

  const { orderId, phone, amount } = parsed.data;

  // Check order exists
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) {
    res.status(400).json({ error: "Order not found" });
    return;
  }

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

  try {
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

    // Update order payment status
    await db
      .update(ordersTable)
      .set({
        paymentStatus: isSuccess ? "paid" : "failed",
        mpesaReceiptNo: mpesaReceiptNo,
        status: isSuccess ? "confirmed" : "pending",
      })
      .where(eq(ordersTable.id, payment.orderId));

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

  try {
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
        await db
          .update(ordersTable)
          .set({ paymentStatus: "paid", status: "confirmed", mpesaReceiptNo: receipt })
          .where(eq(ordersTable.id, order.id));
        await db.insert(paymentsTable).values({
          orderId: order.id,
          amount: String(amount),
          method: "mpesa",
          status: "completed",
          mpesaReceiptNo: receipt,
          rawCallback: JSON.stringify(body),
        });
        logger.info({ orderId: order.id, receipt }, "C2B payment auto-reconciled");
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
