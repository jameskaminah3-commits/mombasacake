import { Router, type IRouter, type Response } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { ensureOrdersSchema } from "../lib/ensure-orders-schema";
import { db, ordersTable, orderItemsTable, cakesTable, promotionsTable, customersTable, paymentsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { sendNewOrderNotification } from "../lib/order-notifications";
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
  if (err instanceof OrderInputError) {
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

  const result = await Promise.all(orders.map(async (order) => {
    const items = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));
    return formatOrder(order, items);
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

  const requestedCode = parsed.data.promoCode?.trim() || null;
  const appliedPromotion = requestedCode
    ? eligiblePromotions.find((promo) => promo.code?.toLowerCase() === requestedCode.toLowerCase())
    : eligiblePromotions
        .filter((promo) => !promo.code)
        .sort((a, b) => calculateDiscount(b, orderSubtotal, enrichedItems) - calculateDiscount(a, orderSubtotal, enrichedItems))[0] ?? null;

  if (requestedCode && !appliedPromotion) {
    res.status(400).json({ error: "That promo code is invalid or not eligible for this order" });
    return;
  }

  const discountAmount = appliedPromotion ? calculateDiscount(appliedPromotion, orderSubtotal, enrichedItems) : 0;
  const total = Math.max(orderSubtotal - discountAmount, 0);
  const customerPayload = {
    name: parsed.data.customerName.trim(),
    phone: parsed.data.customerPhone.trim(),
    email: parsed.data.customerEmail?.trim() || null,
  };
  const customerId = await resolveCustomerId(customerPayload);

  const [order] = await db
    .insert(ordersTable)
    .values({
      customerId,
      customerName: customerPayload.name,
      customerPhone: customerPayload.phone,
      customerEmail: customerPayload.email,
      deliveryAddress: parsed.data.deliveryAddress,
      deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate + "T00:00:00Z") : null,
      notes: parsed.data.notes,
      promoCode: appliedPromotion?.code ?? requestedCode,
      discountAmount: String(discountAmount),
      total: String(total),
      status: "pending",
      paymentStatus: "pending",
    })
    .returning();

  const items = await db
    .insert(orderItemsTable)
    .values(enrichedItems.map((i) => ({ ...i, orderId: order.id })))
    .returning();

  try {
    await sendNewOrderNotification(order, items);
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to send new order email");
  }

  res.status(201).json(formatOrder(order, items));
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
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order, items));
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
  const [order] = await db
    .update(ordersTable)
    .set({ status: parsed.data.status })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
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
    typeof req.body?.mpesaReceiptNo === "string" ? req.body.mpesaReceiptNo.trim() : "";

  const setValues: { paymentStatus: string; status: string; mpesaReceiptNo?: string } = {
    paymentStatus: "paid",
    status: "confirmed",
  };
  if (receipt) setValues.mpesaReceiptNo = receipt;

  await ensureOrdersSchema();
  const [order] = await db
    .update(ordersTable)
    .set(setValues)
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  await db.insert(paymentsTable).values({
    orderId: order.id,
    amount: order.total,
    method: "mpesa",
    status: "completed",
    mpesaReceiptNo: receipt || undefined,
  });

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
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
    const customerId = await resolveCustomerId(customer);
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
    const customerId = await resolveCustomerId(customer);

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
          total: String(subtotal - discount),
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

    logger.info({ orderId: order.id }, "Order edited in admin");
    res.json(formatOrder(order, items));
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

async function resolveCustomerId(customer: { name: string; phone: string; email: string | null }) {
  const [existing] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.phone, customer.phone))
    .orderBy(desc(customersTable.createdAt))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(customersTable)
      .set({
        name: customer.name,
        email: customer.email,
      })
      .where(eq(customersTable.id, existing.id))
      .returning();
    return updated.id;
  }

  const [created] = await db.insert(customersTable).values(customer).returning();
  return created.id;
}

export default router;
