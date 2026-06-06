import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { adminsTable } from "./admins";

export const adminPasswordResetsTable = pgTable("admin_password_resets", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => adminsTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminPasswordReset = typeof adminPasswordResetsTable.$inferSelect;
