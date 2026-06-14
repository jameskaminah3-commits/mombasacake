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
    })().catch((error) => {
      ensureOrdersSchemaPromise = null;
      logger.error({ error }, "ensureOrdersSchema failed");
      throw error;
    });
  }
  return ensureOrdersSchemaPromise;
}
