import { Router, type IRouter, type Response } from "express";
import { eq, desc, and, gt, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureOrdersSchema } from "../lib/ensure-orders-schema";
import { db, ordersTable, orderItemsTable, cakesTable, promotionsTable, customersTable, paymentsTable, referralsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { sendNewOrderNotification, sendPaymentCodeNotification } from "../lib/order-notifications";
import { normalizeSupabaseMediaUrl } from "../lib/media-urls";
import {
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  ListOrdersQueryParams,
} from "@workspace/api-zod";
import { ensurePromotionsSchema } from "../lib/ensure-promotions-schema";
import { cakeSizes, readCakeOptions } from "../lib/cake-options";
import { resolveCustomerFromRequest } from "../lib/customer-auth";
import { emailCustomerAboutOrder, emailCustomerPaymentCodeNotFound } from "../lib/customer-notifications";
import { CUSTOMER_CODE_METHOD, extractMpesaCode, paymentCheckFor } from "../lib/payment-codes";
import { canAccessOrder, newOrderAccessToken } from "../lib/order-access";
import {
  ReferralCodeError,
  ensureReferralCode,
  findCustomerByPhone,
  readReferralSettings,
  referralDiscountFor,
  rewardReferralForPaidOrder,
  undoRewardsForCancelledOrder,
} from "../lib/referrals";
import { siteUrl } from "../lib/seo";

const router: IRouter = Router();

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"] as const;

// Orders the owner enters or edits in the admin panel (e.g. taken on WhatsApp or by phone).
const AdminOrderItemBody = z.object({
  cakeId: z.number().int().positive(),
  variantLabel: z.string().max(60).nullish(),
  flavour: z.string().max(60).nullish(),
  secondFlavour: z.string().max(60).nullish(),
  cakeMessage: z.string().max(120).nullish(),
  quantity: z.number().int().min(1).max(100),
  // Empty uses the cake's price for the chosen size; set it for a custom quote.
  unitPrice: z.number().min(0).max(10_000_000).nullish(),
});

const AdminOrderBody = z.object({
  customerName: z.string().trim().min(1, "Enter the customer's name").max(120),
  customerPhone: z.string().trim().min(1, "Enter the customer's phone number").max(40),
  customerEmail: z.string().trim().max(200).nullish(),
  deliveryAddress: z.string().trim().max(500).nullish(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Delivery date must be YYYY-MM-DD").nullish(),
  notes: z.string().trim().max(2000).nullish(),
  discountAmount: z.number().min(0).max(10_000_000).default(0),
  status: z.enum(ORDER_STATUSES).default("confirmed"),
  items: z.array(AdminOrderItemBody).min(1, "Add at least one cake").max(50),
});

const ManualOrderBody = AdminOrderBody.extend({
  // Payment already received, e.g. cash or an M-Pesa payment confirmed from the SMS.
  paid: z.boolean().default(false),
  mpesaReceiptNo: z.string().trim().max(40).nullish(),
});

class OrderInputError extends Error {}

// Free-text choices: trimmed, empty becomes null, capped so one field can't bloat an order.
function cleanText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim();
  return text ? text.slice(0, maxLength) : null;
}

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid order details";
  return issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
}

function sendOrderError(res: Response, err: unknown, logMessage: string) {
  if (err instanceof OrderInputError || err instanceof ReferralCodeError) {
    res.status(400).json({ error: err.message });
    return;
  }
  logger.error({ err }, logMessage);
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
}

// Prices each cake from the catalogue (size price, or the base price), unless the admin set a price.
// When editing, a cake that has since been removed from the catalogue keeps its saved name, photo and price.
async function priceAdminItems(
  items: z.infer<typeof AdminOrderItemBody>[],
  savedItems: (typeof orderItemsTable.$inferSelect)[] = [],
) {
  const cakeOptions = await readCakeOptions();
  let subtotal = 0;
  const priced = [];
  for (const item of items) {
    const [cake] = await db.select().from(cakesTable).where(eq(cakesTable.id, item.cakeId));
    const saved = savedItems.find((savedItem) => savedItem.cakeId === item.cakeId);
    if (!cake && !saved) throw new OrderInputError(`Cake ${item.cakeId} was not found`);

    const variantLabel = cleanText(item.variantLabel, 60);
    let unitPrice = item.unitPrice ?? null;
    if (unitPrice == null && cake) {
      unitPrice = parseFloat(cake.price);
      if (variantLabel) {
        const variant = cakeSizes(cake, cakeOptions).find((v) => v.label === variantLabel);
        if (!variant) throw new OrderInputError(`${cake.name} has no "${variantLabel}" size any more; choose a size or enter a price`);
        unitPrice = variant.price;
      }
    }
    if (unitPrice == null) unitPrice = parseFloat(saved!.unitPrice);

    const lineSubtotal = unitPrice * item.quantity;
    subtotal += lineSubtotal;
    priced.push({
      cakeId: item.cakeId,
      cakeName: cake?.name ?? saved!.cakeName,
      cakeImage: cake ? normalizeSupabaseMediaUrl(cake.imageUrl) : saved!.cakeImage,
      variantLabel,
      flavour: cleanText(item.flavour, 60),
      secondFlavour: cleanText(item.secondFlavour, 60),
      cakeMessage: cleanText(item.cakeMessage, 120),
      quantity: item.quantity,
      unitPrice: String(unitPrice),
      subtotal: String(lineSubtotal),
    });
  }
  return { priced, subtotal };
}

router.get("/orders", requireAdmin, async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  await ensureOrdersSchema();

  const conditions = [];
  if (query.data.status) conditions.push(eq(ordersTable.status, query.data.status));
  if (query.data.customerId != null) conditions.push(eq(ordersTable.customerId, query.data.customerId));

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt));

  // Payments to check before confirming: M-Pesa codes customers sent after paying the till themselves, and
  // paybill payments M-Pesa reported without the secret key. The newest one per order is shown.
  const reported = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "reported")).orderBy(desc(paymentsTable.createdAt));
  const result = await Promise.all(orders.map(async (order) => {
    const items = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));
    const report = order.paymentStatus === "paid" ? undefined : reported.find((payment) => payment.orderId === order.id);
    return {
      ...formatOrder(order, items),
      reportedPayment: report
        ? {
            receipt: report.mpesaReceiptNo,
            amount: parseFloat(report.amount),
            at: report.createdAt.toISOString(),
            source: report.method === CUSTOMER_CODE_METHOD ? "customer" : "mpesa",
          }
        : null,
    };
  }));

  res.json(result);
});

router.post("/orders", async (req, res): Promise<void> => {
  try {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Price each cake from the catalogue: the chosen size's price (its own sizes, or the shop's standard sizes
  // priced per kg), else the cake's price.
  const cakeOptions = await readCakeOptions();
  let orderSubtotal = 0;
  const enrichedItems = await Promise.all(
    parsed.data.items.map(async (item) => {
      const [cake] = await db.select().from(cakesTable).where(eq(cakesTable.id, item.cakeId));
      if (!cake) throw new OrderInputError("One of the cakes in your cart is no longer available. Please remove it and try again.");
      let unitPrice = parseFloat(cake.price);
      if (item.variantLabel) {
        const size = cakeSizes(cake, cakeOptions).find((v) => v.label === item.variantLabel);
        if (!size) throw new OrderInputError(`${cake.name} no longer comes in "${item.variantLabel}". Please choose its size again.`);
        unitPrice = size.price;
      }
      const lineSubtotal = unitPrice * item.quantity;
      orderSubtotal += lineSubtotal;
      return {
        cakeId: item.cakeId,
        cakeSlug: cake.slug,
        cakeName: cake.name,
        cakeImage: normalizeSupabaseMediaUrl(cake.imageUrl),
        variantLabel: item.variantLabel ?? null,
        flavour: cleanText(item.flavour, 60),
        secondFlavour: cleanText(item.secondFlavour, 60),
        cakeMessage: cleanText(item.cakeMessage, 120),
        quantity: item.quantity,
        unitPrice: String(unitPrice),
        subtotal: String(lineSubtotal),
      };
    })
  );
    
  await ensureOrdersSchema();
  try {
    await ensurePromotionsSchema();
  } catch (err) {
    logger.error({ err }, "ensurePromotionsSchema failed, continuing without promotions");
  }
  const promotions = await db.select().from(promotionsTable).orderBy(desc(promotionsTable.createdAt)).catch(() => []);
  const eligiblePromotions = promotions
    .map(formatPromotion)
    .filter((promo) => isPromotionActive(promo))
    .filter((promo) => isPromotionEligible(promo, enrichedItems, orderSubtotal));

  // One code per order: a promotion's code, or a friend's referral code on a first order.
  const requestedCode = parsed.data.promoCode?.trim() || null;
  const appliedPromotion = requestedCode
    ? eligiblePromotions.find((promo) => promo.code?.toLowerCase() === requestedCode.toLowerCase()) ?? null
    : eligiblePromotions
        .filter((promo) => !promo.code)
        .sort((a, b) => calculateDiscount(b, orderSubtotal, enrichedItems) - calculateDiscount(a, orderSubtotal, enrichedItems))[0] ?? null;
  const referralSettings = await readReferralSettings();
  const referral =
    requestedCode && !appliedPromotion
      ? await referralDiscountFor(requestedCode, parsed.data.customerPhone, referralSettings, orderSubtotal)
      : null;

  if (requestedCode && !appliedPromotion && !referral) {
    res.status(400).json({ error: "That promo code is invalid or not eligible for this order" });
    return;
  }

  const discountAmount = appliedPromotion ? calculateDiscount(appliedPromotion, orderSubtotal, enrichedItems) : referral?.discount ?? 0;
  // A signed-in customer's orders are linked to their account by its email address.
  const account = await resolveCustomerFromRequest(req);
  const customer = await resolveCustomer({
    name: parsed.data.customerName.trim(),
    phone: parsed.data.customerPhone.trim(),
    email: parsed.data.customerEmail?.trim() || account?.email || null,
  });

  const { order, items } = await db.transaction(async (tx) => {
    // Referral rewards this customer has earned come off automatically.
    let creditUsed = Math.min(parseFloat(customer.creditBalance), Math.max(orderSubtotal - discountAmount, 0));
    if (creditUsed > 0) {
      const [spent] = await tx
        .update(customersTable)
        .set({ creditBalance: sql`${customersTable.creditBalance} - ${creditUsed}` })
        .where(and(eq(customersTable.id, customer.id), sql`${customersTable.creditBalance} >= ${creditUsed}`))
        .returning({ id: customersTable.id });
      if (!spent) creditUsed = 0;
    }

    const [order] = await tx
      .insert(ordersTable)
      .values({
        customerId: customer.id,
        customerName: parsed.data.customerName.trim(),
        customerPhone: parsed.data.customerPhone.trim(),
        customerEmail: customer.email,
        deliveryAddress: parsed.data.deliveryAddress,
        deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate + "T00:00:00Z") : null,
        notes: parsed.data.notes,
        promoCode: appliedPromotion?.code ?? requestedCode,
        discountAmount: String(discountAmount),
        creditUsed: String(creditUsed),
        total: String(Math.max(orderSubtotal - discountAmount - creditUsed, 0)),
        status: "pending",
        paymentStatus: "pending",
        accessToken: newOrderAccessToken(),
      })
      .returning();

    const items = await tx
      .insert(orderItemsTable)
      .values(enrichedItems.map((i) => ({ ...i, orderId: order.id })))
      .returning();

    if (referral) {
      await tx.insert(referralsTable).values({
        code: referral.referrer.referralCode ?? requestedCode!,
        referrerCustomerId: referral.referrer.id,
        referredOrderId: order.id,
        friendDiscount: String(discountAmount),
        referrerReward: String(referralSettings.referrerReward),
      });
    }
    return { order, items };
  });

  try {
    await sendNewOrderNotification(order, items);
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to send new order email");
  }
  await emailCustomerAboutOrder(order, items, "received", siteUrl(req));

  res.status(201).json({ ...formatOrder(order, items), referral: await referralInfoFor(order) });
  } catch (err) {
    sendOrderError(res, err, "Order creation failed");
  }
});
router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureOrdersSchema();
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!(await canAccessOrder(req, order))) {
    res.status(401).json({ error: "Enter the phone number you used for this order to see it.", needsPhone: true });
    return;
  }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json({ ...formatOrder(order, items), referral: await referralInfoFor(order), paymentCheck: await paymentCheckFor(order) });
});

// A customer paid the till or paybill themselves and sends the M-Pesa code from their SMS (or the whole SMS).
// The owner is emailed to check it against their M-Pesa and confirm with "Mark paid".
router.post("/orders/:id/payment-code", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureOrdersSchema();
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!(await canAccessOrder(req, order))) {
    res.status(401).json({ error: "Open this order from your order link to send your M-Pesa code." });
    return;
  }
  if (order.paymentStatus === "paid") {
    res.status(409).json({ error: "This order is already paid. Thank you!" });
    return;
  }
  if (order.status === "cancelled") {
    res.status(409).json({ error: "This order was cancelled. Please WhatsApp us if that's unexpected." });
    return;
  }
  const code = extractMpesaCode(String(req.body?.code ?? ""));
  if (!code) {
    res.status(400).json({ error: "M-Pesa codes have 10 letters and numbers, like TJK3AB12CD. It's at the start of your M-Pesa SMS." });
    return;
  }

  const [usedElsewhere] = await db
    .select({ orderId: paymentsTable.orderId })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.mpesaReceiptNo, code), ne(paymentsTable.orderId, order.id), inArray(paymentsTable.status, ["reported", "completed"])))
    .limit(1);
  if (usedElsewhere) {
    res.status(409).json({ error: "That M-Pesa code is already used for another order. Check the code, or WhatsApp us." });
    return;
  }

  const current = await paymentCheckFor(order);
  if (!(current?.state === "checking" && current.code === code)) {
    const [{ recent }] = await db
      .select({ recent: sql<number>`count(*)::int` })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.orderId, order.id), eq(paymentsTable.method, CUSTOMER_CODE_METHOD), gt(paymentsTable.createdAt, new Date(Date.now() - 60 * 60_000))));
    if (recent >= 6) {
      res.status(429).json({ error: "You've sent several codes. Please WhatsApp us and we'll sort it out." });
      return;
    }
    // A corrected code replaces the one still waiting to be checked (kept as "replaced", which also counts
    // towards the limit above).
    await db.transaction(async (tx) => {
      await tx
        .update(paymentsTable)
        .set({ status: "replaced" })
        .where(and(eq(paymentsTable.orderId, order.id), eq(paymentsTable.method, CUSTOMER_CODE_METHOD), eq(paymentsTable.status, "reported")));
      await tx.insert(paymentsTable).values({ orderId: order.id, amount: order.total, method: CUSTOMER_CODE_METHOD, status: "reported", mpesaReceiptNo: code });
    });
    try {
      await sendPaymentCodeNotification(order, code, siteUrl(req));
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Payment code email to the owner failed");
    }
  }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json({ ...formatOrder(order, items), referral: await referralInfoFor(order), paymentCheck: await paymentCheckFor(order) });
});

// The owner couldn't find the customer's code in their M-Pesa: the customer is asked to check it.
router.post("/orders/:id/payment-code/not-found", requireAdmin, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureOrdersSchema();
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const rejected = await db
    .update(paymentsTable)
    .set({ status: "rejected" })
    .where(and(eq(paymentsTable.orderId, order.id), eq(paymentsTable.method, CUSTOMER_CODE_METHOD), eq(paymentsTable.status, "reported")))
    .returning({ code: paymentsTable.mpesaReceiptNo });
  if (rejected.length === 0) {
    res.status(409).json({ error: "There's no M-Pesa code waiting to be checked for this order." });
    return;
  }
  await emailCustomerPaymentCodeNotFound(order, rejected[0].code ?? "", siteUrl(req));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json({ ...formatOrder(order, items), paymentCheck: await paymentCheckFor(order) });
});

router.patch("/orders/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureOrdersSchema();
  const [before] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!before) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  let [order] = await db
    .update(ordersTable)
    .set({ status: parsed.data.status })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (order.status === "cancelled" && before.status !== "cancelled") {
    await undoRewardsForCancelledOrder(order);
    [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id));
  }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  if (order.status !== before.status) await emailCustomerAboutOrder(order, items, "status", siteUrl(req));
  res.json(formatOrder(order, items));
});

// Manually confirm a payment (e.g. customer paid the till by hand and the
// owner is reconciling from the M-Pesa SMS). Optionally records the receipt.
router.patch("/orders/:id/mark-paid", requireAdmin, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const receipt =
    typeof req.body?.mpesaReceiptNo === "string" ? req.body.mpesaReceiptNo.trim().toUpperCase() : "";

  await ensureOrdersSchema();
  const [before] = await db
    .select({ paymentStatus: ordersTable.paymentStatus, status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));
  if (!before) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // The payment the owner confirmed: the reported one with this M-Pesa code (or, without a code, the latest one
  // reported: the customer's code, or what M-Pesa reported) becomes the order's payment.
  const reported = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.orderId, params.data.id), eq(paymentsTable.status, "reported")))
    .orderBy(desc(paymentsTable.createdAt), desc(paymentsTable.id));
  const match = receipt ? reported.find((payment) => payment.mpesaReceiptNo?.toUpperCase() === receipt) : reported[0];
  const confirmedReceipt = receipt || match?.mpesaReceiptNo || "";

  const [order] = await db
    .update(ordersTable)
    .set({
      paymentStatus: "paid",
      // Confirmed, unless the order has already moved on (e.g. being made).
      status: before.status === "pending" ? "confirmed" : before.status,
      ...(confirmedReceipt ? { mpesaReceiptNo: confirmedReceipt } : {}),
    })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (match) {
    await db.update(paymentsTable).set({ status: "completed" }).where(eq(paymentsTable.id, match.id));
  } else if (before.paymentStatus !== "paid") {
    await db.insert(paymentsTable).values({
      orderId: order.id,
      amount: order.total,
      method: "mpesa",
      status: "completed",
      mpesaReceiptNo: confirmedReceipt || undefined,
    });
  }
  // A code the customer sent that the owner confirmed under another code was mistyped: it's closed.
  const mistyped = reported.filter((payment) => payment.id !== match?.id && payment.method === CUSTOMER_CODE_METHOD).map((payment) => payment.id);
  if (mistyped.length > 0) await db.update(paymentsTable).set({ status: "replaced" }).where(inArray(paymentsTable.id, mistyped));
  await rewardReferralForPaidOrder(order.id);

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  if (before?.paymentStatus !== "paid") await emailCustomerAboutOrder(order, items, "paid", siteUrl(req));
  res.json(formatOrder(order, items));
});

// Admin: record an order taken outside the shop (WhatsApp, phone, walk-in).
router.post("/orders/manual", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ManualOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }

  try {
    await ensureOrdersSchema();
    const { priced, subtotal } = await priceAdminItems(parsed.data.items);
    const discount = Math.min(parsed.data.discountAmount, subtotal);
    const customer = {
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone,
      email: cleanText(parsed.data.customerEmail, 200),
    };
    const customerId = (await resolveCustomer(customer)).id;
    const receipt = cleanText(parsed.data.mpesaReceiptNo, 40);

    const { order, items } = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(ordersTable)
        .values({
          customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          deliveryAddress: cleanText(parsed.data.deliveryAddress, 500),
          deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate + "T00:00:00Z") : null,
          notes: cleanText(parsed.data.notes, 2000),
          discountAmount: String(discount),
          total: String(subtotal - discount),
          status: parsed.data.status,
          paymentStatus: parsed.data.paid ? "paid" : "pending",
          mpesaReceiptNo: receipt,
          accessToken: newOrderAccessToken(),
        })
        .returning();
      const items = await tx
        .insert(orderItemsTable)
        .values(priced.map((item) => ({ ...item, orderId: order.id })))
        .returning();
      if (parsed.data.paid) {
        // Same record the "Mark paid" button keeps, so the Payments page lists it too.
        await tx.insert(paymentsTable).values({
          orderId: order.id,
          amount: order.total,
          method: receipt ? "mpesa" : "manual",
          status: "completed",
          mpesaReceiptNo: receipt ?? undefined,
        });
      }
      return { order, items };
    });

    logger.info({ orderId: order.id }, "Manual order created");
    await emailCustomerAboutOrder(order, items, "received", siteUrl(req));
    res.status(201).json(formatOrder(order, items));
  } catch (err) {
    sendOrderError(res, err, "Manual order creation failed");
  }
});

// Admin: change an order's customer details, delivery, cakes (size, flavours, message, quantity) and status.
// Payment is confirmed separately with "Mark paid".
router.put("/orders/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }

  try {
    await ensureOrdersSchema();
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const savedItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, existing.id));
    const { priced, subtotal } = await priceAdminItems(parsed.data.items, savedItems);
    const discount = Math.min(parsed.data.discountAmount, subtotal);
    const customer = {
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone,
      email: cleanText(parsed.data.customerEmail, 200),
    };
    const customerId = (await resolveCustomer(customer)).id;
    const creditUsed = parseFloat(existing.creditUsed);

    const { order, items } = await db.transaction(async (tx) => {
      const [order] = await tx
        .update(ordersTable)
        .set({
          customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          deliveryAddress: cleanText(parsed.data.deliveryAddress, 500),
          deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate + "T00:00:00Z") : null,
          notes: cleanText(parsed.data.notes, 2000),
          discountAmount: String(discount),
          total: String(Math.max(subtotal - discount - creditUsed, 0)),
          status: parsed.data.status,
        })
        .where(eq(ordersTable.id, existing.id))
        .returning();
      await tx.delete(orderItemsTable).where(eq(orderItemsTable.orderId, existing.id));
      const items = await tx
        .insert(orderItemsTable)
        .values(priced.map((item) => ({ ...item, orderId: existing.id })))
        .returning();
      return { order, items };
    });

    // Same as changing the status on its own: cancelling gives back referral credit, and the customer hears of it.
    let saved = order;
    if (saved.status === "cancelled" && existing.status !== "cancelled") {
      await undoRewardsForCancelledOrder(saved);
      [saved] = await db.select().from(ordersTable).where(eq(ordersTable.id, saved.id));
    }
    logger.info({ orderId: saved.id }, "Order edited in admin");
    if (saved.status !== existing.status) await emailCustomerAboutOrder(saved, items, "status", siteUrl(req));
    res.json(formatOrder(saved, items));
  } catch (err) {
    sendOrderError(res, err, "Order update failed");
  }
});

function formatOrder(
  order: typeof ordersTable.$inferSelect,
  items: (typeof orderItemsTable.$inferSelect)[]
) {
  return {
    id: order.id,
    customerId: order.customerId ?? null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail ?? null,
    deliveryAddress: order.deliveryAddress ?? null,
    deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString().split("T")[0] : null,
    notes: order.notes ?? null,
    promoCode: order.promoCode ?? null,
    discountAmount: parseFloat(order.discountAmount),
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: parseFloat(order.total),
    mpesaReceiptNo: order.mpesaReceiptNo ?? null,
    creditUsed: parseFloat(order.creditUsed),
    accessToken: order.accessToken ?? null,
    items: items.map((i) => ({
      id: i.id,
      cakeId: i.cakeId,
      cakeName: i.cakeName,
      cakeImage: normalizeSupabaseMediaUrl(i.cakeImage) ?? null,
      variantLabel: i.variantLabel ?? null,
      flavour: i.flavour ?? null,
      secondFlavour: i.secondFlavour ?? null,
      cakeMessage: i.cakeMessage ?? null,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unitPrice),
      subtotal: parseFloat(i.subtotal),
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

type PromotionView = {
  id: number;
  title: string;
  code: string | null;
  discountPct: number | null;
  discountAmount: number | null;
  minimumOrderAmount: number | null;
  applicableCakeSlugs: string[] | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  showInStrip: boolean;
};

type OrderPreviewItem = {
  cakeId: number;
  cakeSlug: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

function formatPromotion(promo: typeof promotionsTable.$inferSelect): PromotionView {
  return {
    id: promo.id,
    title: promo.title,
    code: promo.code ?? null,
    discountPct: promo.discountPct != null ? parseFloat(promo.discountPct) : null,
    discountAmount: promo.discountAmount != null ? parseFloat(promo.discountAmount) : null,
    minimumOrderAmount: promo.minimumOrderAmount != null ? parseFloat(promo.minimumOrderAmount) : null,
    applicableCakeSlugs: parseApplicableCakeSlugs(promo.applicableCakeSlugs),
    active: promo.active,
    startsAt: promo.startsAt?.toISOString() ?? null,
    endsAt: promo.endsAt?.toISOString() ?? null,
    showInStrip: promo.showInStrip,
  };
}

function isPromotionActive(promo: PromotionView) {
  const now = Date.now();
  if (!promo.active) return false;
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return false;
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now) return false;
  return true;
}

function isPromotionEligible(promo: PromotionView, items: OrderPreviewItem[], subtotal: number) {
  if (promo.minimumOrderAmount != null && subtotal < promo.minimumOrderAmount) return false;
  if (promo.applicableCakeSlugs && promo.applicableCakeSlugs.length > 0) {
    return items.some((item) => promo.applicableCakeSlugs?.includes(item.cakeSlug));
  }
  return true;
}

function calculateDiscount(promo: PromotionView, subtotal: number, items: OrderPreviewItem[]) {
  if (!isPromotionEligible(promo, items, subtotal)) return 0;
  const amount = promo.discountAmount ?? (promo.discountPct != null ? (subtotal * promo.discountPct) / 100 : 0);
  return Math.min(amount, subtotal);
}

function parseApplicableCakeSlugs(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === "string") : null;
  } catch {
    return value
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);
  }
}

// One customer record per phone number, however it was written (0712…, +254 712…); name and email follow
// their latest order.
async function resolveCustomer(customer: { name: string; phone: string; email: string | null }) {
  const existing =
    (await findCustomerByPhone(customer.phone)) ??
    (await db.select().from(customersTable).where(eq(customersTable.phone, customer.phone)).limit(1))[0];

  if (existing) {
    const [updated] = await db
      .update(customersTable)
      .set({
        name: customer.name,
        email: customer.email ?? existing.email,
      })
      .where(eq(customersTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(customersTable).values(customer).returning();
  return created;
}

// The customer's own code to share and their unspent reward credit, for their order page.
async function referralInfoFor(order: typeof ordersTable.$inferSelect) {
  try {
    const settings = await readReferralSettings();
    if (!settings.enabled || !order.customerId) return null;
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, order.customerId));
    if (!customer) return null;
    return {
      code: await ensureReferralCode(customer),
      friendDiscount: settings.friendDiscount,
      referrerReward: settings.referrerReward,
      creditBalance: parseFloat(customer.creditBalance),
    };
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Referral details unavailable");
    return null;
  }
}

export default router;
