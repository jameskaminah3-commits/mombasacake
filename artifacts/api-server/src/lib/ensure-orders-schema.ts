import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

let ensureOrdersSchemaPromise: Promise<void> | null = null;

export function ensureOrdersSchema(): Promise<void> {
  if (!ensureOrdersSchemaPromise) {
    ensureOrdersSchemaPromise = (async () => {
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_receipt_no text`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address text`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes text`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code text`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date timestamp with time zone`);
      await db.execute(sql`ALTER TABLE cakes ADD COLUMN IF NOT EXISTS variants text`);
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label text`);
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS flavour text`);
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS second_flavour text`);
      await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cake_message text`);
      // Private order links, referral rewards and optional customer sign-in
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token text`);
      await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_used numeric(10,2) NOT NULL DEFAULT 0`);
      await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code text`);
      await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_balance numeric(10,2) NOT NULL DEFAULT 0`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS customers_referral_code_key ON customers (referral_code)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS referrals (
          id serial PRIMARY KEY,
          code text NOT NULL,
          referrer_customer_id integer NOT NULL,
          referred_order_id integer NOT NULL UNIQUE,
          friend_discount numeric(10,2) NOT NULL,
          referrer_reward numeric(10,2) NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          rewarded_at timestamp with time zone
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS customer_accounts (
          id serial PRIMARY KEY,
          email text NOT NULL UNIQUE,
          name text,
          phone text,
          address text,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS customer_login_codes (
          id serial PRIMARY KEY,
          email text NOT NULL,
          code_hash text NOT NULL,
          attempts integer NOT NULL DEFAULT 0,
          expires_at timestamp with time zone NOT NULL,
          used_at timestamp with time zone,
          created_at timestamp with time zone NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS customer_login_codes_email_idx ON customer_login_codes (email)`);
    })().catch((error) => {
      ensureOrdersSchemaPromise = null;
      logger.error({ error }, "ensureOrdersSchema failed");
      throw error;
    });
  }
  return ensureOrdersSchemaPromise;
}
