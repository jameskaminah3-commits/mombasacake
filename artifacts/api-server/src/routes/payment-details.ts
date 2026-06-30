import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, paymentSettingsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { ensurePaymentSettingsSchema } from "../lib/ensure-payment-settings-schema";

const router: IRouter = Router();

const PaymentSettingsSchema = z.object({
  provider: z.literal("mpesa").optional(),
  displayName: z.string().min(2),
  businessShortCode: z.string().min(3),
  tillNumber: z.string().optional().default(""),
  transactionType: z.string().min(3),
  accountReferencePrefix: z.string().min(1),
  instructions: z.string().min(10),
});

router.get("/payment-details", async (_req: Request, res: Response): Promise<void> => {
  const settings = await readPaymentSettings();
  res.json(toPaymentDetails(settings));
});

router.get("/payment-settings", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const settings = await readPaymentSettings();
  res.json(toPaymentDetails(settings));
});

router.put("/payment-settings", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = PaymentSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensurePaymentSettingsSchema();

  const [existing] = await db
    .select()
    .from(paymentSettingsTable)
    .where(eq(paymentSettingsTable.settingsKey, "default"))
    .orderBy(desc(paymentSettingsTable.createdAt))
    .limit(1);
  const updateValues = {
    settingsKey: "default",
    provider: "mpesa",
    displayName: parsed.data.displayName.trim(),
    businessShortCode: parsed.data.businessShortCode.trim(),
    tillNumber: parsed.data.tillNumber.trim(),
    transactionType: parsed.data.transactionType.trim(),
    accountReferencePrefix: parsed.data.accountReferencePrefix.trim(),
    instructions: parsed.data.instructions.trim(),
  };

  const [settings] = existing
    ? await db
        .update(paymentSettingsTable)
        .set(updateValues)
        .where(eq(paymentSettingsTable.id, existing.id))
        .returning()
    : await db.insert(paymentSettingsTable).values(updateValues).returning();

  res.json(toPaymentDetails(settings));
});

export default router;

async function readPaymentSettings() {
  await ensurePaymentSettingsSchema();

  const [settings] = await db
    .select()
    .from(paymentSettingsTable)
    .where(eq(paymentSettingsTable.settingsKey, "default"))
    .orderBy(desc(paymentSettingsTable.createdAt))
    .limit(1);

  if (settings) {
    return settings;
  }

  const [created] = await db.insert(paymentSettingsTable).values({
    settingsKey: "default",
    provider: "mpesa",
    displayName: "MPesa",
    businessShortCode: process.env.MPESA_SHORTCODE || "174379",
    tillNumber: process.env.MPESA_TILL_NUMBER || "",
    transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
    accountReferencePrefix: "Order",
    instructions:
      "You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen.",
  }).returning();

  return created;
}

function toPaymentDetails(settings: typeof paymentSettingsTable.$inferSelect) {
  return {
    provider: settings.provider || "mpesa",
    displayName: settings.displayName,
    businessShortCode: settings.businessShortCode,
    tillNumber: settings.tillNumber ?? "",
    transactionType: settings.transactionType,
    accountReferencePrefix: settings.accountReferencePrefix,
    instructions: settings.instructions,
  };
}
