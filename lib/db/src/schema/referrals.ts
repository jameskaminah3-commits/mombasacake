import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";

// A friend's order placed with a customer's referral code. The referrer is rewarded once that order is paid.
export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  referrerCustomerId: integer("referrer_customer_id").notNull(),
  referredOrderId: integer("referred_order_id").notNull().unique(),
  friendDiscount: numeric("friend_discount", { precision: 10, scale: 2 }).notNull(),
  referrerReward: numeric("referrer_reward", { precision: 10, scale: 2 }).notNull(),
  // pending → rewarded once the friend's order is paid, or cancelled with the order
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
});

export type Referral = typeof referralsTable.$inferSelect;
