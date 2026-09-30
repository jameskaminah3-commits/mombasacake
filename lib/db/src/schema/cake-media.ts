import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

// A cake's extra photos and videos, shown after its main image on the cake page, in `position` order.
export const cakeMediaTable = pgTable("cake_media", {
  id: serial("id").primaryKey(),
  cakeId: integer("cake_id").notNull(),
  position: integer("position").notNull().default(0),
  // "image" or "video"
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  // A still frame shown before a video plays.
  posterUrl: text("poster_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CakeMedia = typeof cakeMediaTable.$inferSelect;
