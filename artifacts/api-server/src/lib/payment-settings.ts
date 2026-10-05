import { desc, eq } from "drizzle-orm";
import { db, paymentSettingsTable, type PaymentSettings } from "@workspace/db";
import { ensurePaymentSettingsSchema } from "./ensure-payment-settings-schema";

// Safaricom's public test paybill. It's only a placeholder, so customers are never asked to pay to it.
export const SANDBOX_SHORTCODE = "174379";
// What earlier versions saved as the note for customers. It describes the M-Pesa prompt, so it isn't shown now that
// customers pay from the M-Pesa menu (the payment card explains the steps itself).
const OLD_DEFAULT_INSTRUCTIONS =
  "You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen.";

// The M-Pesa prompt (STK push) needs the shop's Daraja keys on the server. MPESA_MOCK=1 fakes it for tests only.
export function darajaKeysConfigured() {
  if (process.env.MPESA_MOCK === "1") return true;
  return Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET);
}
export function stkConfigured() {
  return darajaKeysConfigured() && (process.env.MPESA_MOCK === "1" || Boolean(process.env.MPESA_PASSKEY));
}

export async function readPaymentSettings(): Promise<PaymentSettings> {
  await ensurePaymentSettingsSchema();
  const [settings] = await db
    .select()
    .from(paymentSettingsTable)
    .where(eq(paymentSettingsTable.settingsKey, "default"))
    .orderBy(desc(paymentSettingsTable.createdAt))
    .limit(1);
  if (settings) return settings;

  const [created] = await db
    .insert(paymentSettingsTable)
    .values({
      settingsKey: "default",
      provider: "mpesa",
      displayName: "M-Pesa",
      businessShortCode: process.env.MPESA_SHORTCODE || "",
      tillNumber: process.env.MPESA_TILL_NUMBER || "",
      transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerBuyGoodsOnline",
      accountReferencePrefix: "Order",
      instructions: "",
    })
    .returning();
  return created;
}

// A till, paybill or store number that's really the shop's (5–8 digits, not Safaricom's test number), or null.
export function shopNumber(value: string | null | undefined) {
  const number = value?.trim() ?? "";
  return /^\d{5,8}$/.test(number) && number !== SANDBOX_SHORTCODE ? number : null;
}

const noteForCustomers = (settings: PaymentSettings) =>
  settings.instructions?.trim() === OLD_DEFAULT_INSTRUCTIONS ? "" : (settings.instructions ?? "").trim();

// What customers see: where to pay from the M-Pesa menu (till or paybill), and whether the shop also sends M-Pesa
// prompts. `manual.number` is null until the owner has entered a real till or paybill number in Admin → Payments.
export function customerPaymentDetails(settings: PaymentSettings) {
  const isTill = settings.transactionType === "CustomerBuyGoodsOnline";
  return {
    displayName: settings.displayName,
    transactionType: settings.transactionType,
    instructions: noteForCustomers(settings),
    stkEnabled: settings.stkEnabled && stkConfigured(),
    manual: {
      method: isTill ? ("till" as const) : ("paybill" as const),
      number: shopNumber(isTill ? settings.tillNumber : settings.businessShortCode),
      accountReferencePrefix: settings.accountReferencePrefix || "Order",
    },
  };
}

// Admin → Payments: the saved settings (Safaricom's test number and the old prompt note left out, so they're not
// saved again), what customers see, the owner's prompt switch, and whether the server has the M-Pesa keys.
export function adminPaymentSettings(settings: PaymentSettings) {
  return {
    ...customerPaymentDetails(settings),
    businessShortCode: shopNumber(settings.businessShortCode) ?? "",
    tillNumber: settings.tillNumber === SANDBOX_SHORTCODE ? "" : (settings.tillNumber ?? ""),
    accountReferencePrefix: settings.accountReferencePrefix || "Order",
    stkSetting: settings.stkEnabled,
    stkConfigured: stkConfigured(),
    darajaKeys: darajaKeysConfigured(),
  };
}
