import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cakesTable = pgTable("cakes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  available: boolean("available").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  categoryId: integer("category_id"),
  variants: text("variants"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCakeSchema = createInsertSchema(cakesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCake = z.infer<typeof insertCakeSchema>;
export type Cake = typeof cakesTable.$inferSelect;
