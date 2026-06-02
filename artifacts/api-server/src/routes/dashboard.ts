import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { db, ordersTable, customersTable, orderItemsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [stats] = await db
    .select({
      totalRevenue: sql<number>`coalesce(sum(case when ${ordersTable.paymentStatus} = 'paid' then ${ordersTable.total}::numeric else 0 end), 0)`,
      totalOrders: sql<number>`count(*)::int`,
      pendingOrders: sql<number>`count(case when ${ordersTable.status} = 'pending' then 1 end)::int`,
      todayRevenue: sql<number>`coalesce(sum(case when ${ordersTable.paymentStatus} = 'paid' and ${ordersTable.createdAt} >= ${todayStart.toISOString()} then ${ordersTable.total}::numeric else 0 end), 0)`,
      todayOrders: sql<number>`count(case when ${ordersTable.createdAt} >= ${todayStart.toISOString()} then 1 end)::int`,
    })
    .from(ordersTable);

  const [customerCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customersTable);

  res.json({
    totalRevenue: parseFloat(String(stats.totalRevenue)),
    totalOrders: stats.totalOrders,
    totalCustomers: customerCount.count,
    pendingOrders: stats.pendingOrders,
    todayRevenue: parseFloat(String(stats.todayRevenue)),
    todayOrders: stats.todayOrders,
  });
});

router.get("/dashboard/recent-orders", async (_req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(10);

  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));
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
    })
  );

  res.json(result);
});

router.get("/dashboard/revenue-chart", async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${ordersTable.createdAt})::date::text`,
      revenue: sql<number>`coalesce(sum(case when ${ordersTable.paymentStatus} = 'paid' then ${ordersTable.total}::numeric else 0 end), 0)`,
      orders: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, thirtyDaysAgo))
    .groupBy(sql`date_trunc('day', ${ordersTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${ordersTable.createdAt})`);

  res.json(
    rows.map((r) => ({
      date: r.date,
      revenue: parseFloat(String(r.revenue)),
      orders: r.orders,
    }))
  );
});

export default router;
