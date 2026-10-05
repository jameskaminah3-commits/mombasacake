import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, paymentSettingsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth-middleware";
import { SANDBOX_SHORTCODE, adminPaymentSettings, customerPaymentDetails, readPaymentSettings } from "../lib/payment-settings";

const router: IRouter = Router();

const digits = z.string().trim().max(20).optional().default("");

const PaymentSettingsSchema = z
  .object({
    provider: z.literal("mpesa").optional(),
    displayName: z.string().trim().min(2),
    // The paybill number, or for a till the store / head office number the M-Pesa prompt signs with.
    businessShortCode: digits,
    tillNumber: digits,
    transactionType: z.enum(["CustomerBuyGoodsOnline", "CustomerPayBillOnline"]),
    accountReferencePrefix: z.string().trim().min(1).max(20),
    instructions: z.string().trim().max(1000).optional().default(""),
    stkEnabled: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const isTill = value.transactionType === "CustomerBuyGoodsOnline";
    const [field, number, name] = isTill
      ? (["tillNumber", value.tillNumber, "till"] as const)
      : (["businessShortCode", value.businessShortCode, "paybill"] as const);
    if (!/^\d{5,8}$/.test(number)) {
      ctx.addIssue({ code: "custom", path: [field], message: `Enter the ${name} number customers pay to (5–8 digits)` });
    } else if (number === SANDBOX_SHORTCODE) {
      ctx.addIssue({ code: "custom", path: [field], message: `${SANDBOX_SHORTCODE} is Safaricom's test number. Enter your own ${name} number.` });
    }
  });

// Public: what checkout and order pages show customers.
router.get("/payment-details", async (_req: Request, res: Response): Promise<void> => {
  res.json(customerPaymentDetails(await readPaymentSettings()));
});

// Admin: the saved settings, plus whether the owner switched the M-Pesa prompt on and whether the server's keys allow it.
router.get("/payment-settings", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  res.json(adminPaymentSettings(await readPaymentSettings()));
});

router.put("/payment-settings", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = PaymentSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the payment settings" });
    return;
  }

  const existing = await readPaymentSettings();
  const [settings] = await db
    .update(paymentSettingsTable)
    .set({
      provider: "mpesa",
      displayName: parsed.data.displayName,
      // A till's store number is only for the M-Pesa prompt; Safaricom's test number is never kept.
      businessShortCode: parsed.data.businessShortCode === SANDBOX_SHORTCODE ? "" : parsed.data.businessShortCode,
      tillNumber: parsed.data.tillNumber,
      transactionType: parsed.data.transactionType,
      accountReferencePrefix: parsed.data.accountReferencePrefix,
      instructions: parsed.data.instructions,
      stkEnabled: parsed.data.stkEnabled ?? existing.stkEnabled,
    })
    .where(eq(paymentSettingsTable.id, existing.id))
    .returning();

  res.json(adminPaymentSettings(settings));
});

export default router;
