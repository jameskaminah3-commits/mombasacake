import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import { CreateCustomerBody, GetCustomerParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/customers", async (_req, res): Promise<void> => {
  const customers = await db
    .select()
    .from(customersTable)
    .orderBy(customersTable.createdAt);
  res.json(customers.map(formatCustomer));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json(formatCustomer(customer));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, params.data.id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(formatCustomer(customer));
});

function formatCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone,
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
