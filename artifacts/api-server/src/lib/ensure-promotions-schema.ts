import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let ensurePromotionsSchemaPromise: Promise<void> | null = null;

export function ensurePromotionsSchema(): Promise<void> {
  if (!ensurePromotionsSchemaPromise) {
    ensurePromotionsSchemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS promotions (
          id serial PRIMARY KEY,
          title text NOT NULL,
          code text UNIQUE,
          description text,
          banner_url text,
          discount_pct numeric(5, 2),
          discount_amount numeric(10, 2),
          active boolean NOT NULL DEFAULT true,
          starts_at timestamp with time zone,
          ends_at timestamp with time zone,
          minimum_order_amount numeric(10, 2),
          applicable_cake_slugs text,
          show_in_strip boolean NOT NULL DEFAULT true,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        )
      `);

      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS code text`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS description text`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS banner_url text`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_pct numeric(5, 2)`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2)`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS starts_at timestamp with time zone`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS ends_at timestamp with time zone`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS minimum_order_amount numeric(10, 2)`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS applicable_cake_slugs text`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS show_in_strip boolean NOT NULL DEFAULT true`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
      await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);

      await db.execute(sql`ALTER TABLE promotions ALTER COLUMN active SET DEFAULT true`);
      await db.execute(sql`ALTER TABLE promotions ALTER COLUMN show_in_strip SET DEFAULT true`);
      await db.execute(sql`ALTER TABLE promotions ALTER COLUMN created_at SET DEFAULT now()`);
      await db.execute(sql`ALTER TABLE promotions ALTER COLUMN updated_at SET DEFAULT now()`);

      await db.execute(sql`UPDATE promotions SET active = true WHERE active IS NULL`);
      await db.execute(sql`UPDATE promotions SET show_in_strip = true WHERE show_in_strip IS NULL`);

      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS promotions_code_unique ON promotions(code)`);
    })().catch((error) => {
      ensurePromotionsSchemaPromise = null;
      throw error;
    });
  }

  return ensurePromotionsSchemaPromise;
}
