import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cakesTable } from "@workspace/db";
import {
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  ListOrdersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/orders", async (req, res): Promise<void> => {
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
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Fetch cake prices
  let total = 0;
  const enrichedItems = await Promise.all(
    parsed.data.items.map(async (item) => {
      const [cake] = await db.select().from(cakesTable).where(eq(cakesTable.id, item.cakeId));
      if (!cake) throw new Error(`Cake ${item.cakeId} not found`);
      const unitPrice = parseFloat(cake.price);
      const subtotal = unitPrice * item.quantity;
      total += subtotal;
      return {
        cakeId: item.cakeId,
        cakeName: cake.name,
        cakeImage: cake.imageUrl,
        quantity: item.quantity,
        unitPrice: String(unitPrice),
        subtotal: String(subtotal),
      };
    })
  );

  const [order] = await db
    .insert(ordersTable)
    .values({
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail,
      deliveryAddress: parsed.data.deliveryAddress,
      notes: parsed.data.notes,
      total: String(total),
      status: "pending",
      paymentStatus: "pending",
    })
    .returning();

  const items = await db
    .insert(orderItemsTable)
    .values(enrichedItems.map((i) => ({ ...i, orderId: order.id })))
    .returning();

  res.status(201).json(formatOrder(order, items));
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

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
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
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: parseFloat(order.total),
    mpesaReceiptNo: order.mpesaReceiptNo ?? null,
    items: items.map((i) => ({
      id: i.id,
      cakeId: i.cakeId,
      cakeName: i.cakeName,
      cakeImage: i.cakeImage ?? null,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unitPrice),
      subtotal: parseFloat(i.subtotal),
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

export default router;
