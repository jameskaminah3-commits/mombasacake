import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { adminsTable } from "./admins";

// 6-digit codes emailed to admins who forgot their password (stored hashed; a few tries each, then expired).
export const adminResetCodesTable = pgTable("admin_reset_codes", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => adminsTable.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminResetCode = typeof adminResetCodesTable.$inferSelect;
