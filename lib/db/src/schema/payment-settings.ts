import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentSettingsTable = pgTable("payment_settings", {
  id: serial("id").primaryKey(),
  settingsKey: text("settings_key").notNull().default("default"),
  provider: text("provider").notNull().default("mpesa"),
  displayName: text("display_name").notNull().default("M-Pesa"),
  // The paybill number, or for a till the store / head office number (only needed for the M-Pesa prompt).
  businessShortCode: text("business_short_code").notNull().default(""),
  tillNumber: text("till_number").notNull().default(""),
  transactionType: text("transaction_type").notNull().default("CustomerBuyGoodsOnline"),
  accountReferencePrefix: text("account_reference_prefix").notNull().default("Order"),
  // Send an M-Pesa prompt to the customer's phone at checkout (STK push). Off until the M-Pesa keys are set up;
  // customers then pay with the till or paybill and send their M-Pesa code.
  stkEnabled: boolean("stk_enabled").notNull().default(false),
  // An optional note shown to customers under the payment details.
  instructions: text("instructions").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSettingsSchema = createInsertSchema(paymentSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentSettings = z.infer<typeof insertPaymentSettingsSchema>;
export type PaymentSettings = typeof paymentSettingsTable.$inferSelect;
