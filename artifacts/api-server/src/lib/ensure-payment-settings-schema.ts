import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let ensurePaymentSettingsSchemaPromise: Promise<void> | null = null;

export function ensurePaymentSettingsSchema(): Promise<void> {
  if (!ensurePaymentSettingsSchemaPromise) {
    // New shops start with no till or paybill (the owner enters theirs in Admin → Payments).
    ensurePaymentSettingsSchemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS payment_settings (
          id serial PRIMARY KEY,
          settings_key text NOT NULL DEFAULT 'default',
          provider text NOT NULL DEFAULT 'mpesa',
          display_name text NOT NULL DEFAULT 'M-Pesa',
          business_short_code text NOT NULL DEFAULT '',
          till_number text NOT NULL DEFAULT '',
          transaction_type text NOT NULL DEFAULT 'CustomerBuyGoodsOnline',
          account_reference_prefix text NOT NULL DEFAULT 'Order',
          instructions text NOT NULL DEFAULT '',
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        )
      `);

      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS settings_key text NOT NULL DEFAULT 'default'`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mpesa'`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'M-Pesa'`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS business_short_code text NOT NULL DEFAULT ''`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS till_number text NOT NULL DEFAULT ''`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'CustomerBuyGoodsOnline'`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS account_reference_prefix text NOT NULL DEFAULT 'Order'`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT ''`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS stk_enabled boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
      await db.execute(sql`ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);

      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN settings_key SET DEFAULT 'default'`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN provider SET DEFAULT 'mpesa'`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN display_name SET DEFAULT 'M-Pesa'`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN business_short_code SET DEFAULT ''`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN till_number SET DEFAULT ''`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN transaction_type SET DEFAULT 'CustomerBuyGoodsOnline'`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN account_reference_prefix SET DEFAULT 'Order'`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN instructions SET DEFAULT ''`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN created_at SET DEFAULT now()`);
      await db.execute(sql`ALTER TABLE payment_settings ALTER COLUMN updated_at SET DEFAULT now()`);

      await db.execute(sql`
        INSERT INTO payment_settings (
          settings_key,
          provider,
          display_name,
          business_short_code,
          transaction_type,
          account_reference_prefix,
          instructions
        )
        SELECT
          'default',
          'mpesa',
          'M-Pesa',
          '',
          'CustomerBuyGoodsOnline',
          'Order',
          ''
        WHERE NOT EXISTS (
          SELECT 1 FROM payment_settings WHERE settings_key = 'default'
        )
      `);
    })().catch((error) => {
      ensurePaymentSettingsSchemaPromise = null;
      throw error;
    });
  }

  return ensurePaymentSettingsSchemaPromise;
}
