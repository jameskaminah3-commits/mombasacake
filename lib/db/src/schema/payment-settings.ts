import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentSettingsTable = pgTable("payment_settings", {
  id: serial("id").primaryKey(),
  settingsKey: text("settings_key").notNull().default("default"),
  provider: text("provider").notNull().default("mpesa"),
  displayName: text("display_name").notNull().default("MPesa"),
  businessShortCode: text("business_short_code").notNull().default("174379"),
  transactionType: text("transaction_type").notNull().default("CustomerPayBillOnline"),
  accountReferencePrefix: text("account_reference_prefix").notNull().default("Order"),
  instructions: text("instructions").notNull().default(
    "You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen."
  ),
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
