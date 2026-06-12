import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, paymentsTable, ordersTable } from "@workspace/db";
import { InitiateMpesaPaymentBody, GetPaymentParams } from "@workspace/api-zod";
import { initiateStkPush } from "../lib/mpesa";
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

  const result = await initiateStkPush({ orderId, phone, amount });

  // Record pending payment
  await db.insert(paymentsTable).values({
    orderId,
    amount: String(amount),
    method: "mpesa",
    status: "pending",
    checkoutRequestId: result.checkoutRequestId,
    merchantRequestId: result.merchantRequestId,
  });

  res.json({
    checkoutRequestId: result.checkoutRequestId,
    merchantRequestId: result.merchantRequestId ?? null,
    responseDescription: result.responseDescription,
        businessShortCode: process.env.MPESA_SHORTCODE || "174379",
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
