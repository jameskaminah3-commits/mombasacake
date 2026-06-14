import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { ensureOrdersSchema } from "../lib/ensure-orders-schema";
import { db, ordersTable, orderItemsTable, cakesTable, promotionsTable, customersTable } from "@workspace/db";
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

const router: IRouter = Router();

router.get("/orders", requireAdmin, async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

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

  // Fetch cake prices
  let orderSubtotal = 0;
  const enrichedItems = await Promise.all(
    parsed.data.items.map(async (item) => {
      const [cake] = await db.select().from(cakesTable).where(eq(cakesTable.id, item.cakeId));
      if (!cake) throw new Error(`Cake ${item.cakeId} not found`);
      const unitPrice = parseFloat(cake.price);
      const lineSubtotal = unitPrice * item.quantity;
      orderSubtotal += lineSubtotal;
      return {
        cakeId: item.cakeId,
        cakeSlug: cake.slug,
        cakeName: cake.name,
        cakeImage: normalizeSupabaseMediaUrl(cake.imageUrl),
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
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Order creation failed");
    res.status(500).json({ error: message });
  }
});
router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
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
