import { pgTable, text, serial, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  code: text("code").unique(),
  description: text("description"),
  bannerUrl: text("banner_url"),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  minimumOrderAmount: numeric("minimum_order_amount", { precision: 10, scale: 2 }),
  applicableCakeSlugs: text("applicable_cake_slugs"),
  showInStrip: boolean("show_in_strip").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotionsTable.$inferSelect;
