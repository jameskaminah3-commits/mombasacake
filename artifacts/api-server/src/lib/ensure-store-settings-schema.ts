import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let ensureStoreSettingsSchemaPromise: Promise<void> | null = null;

// Small key/value table for storefront settings edited in the admin panel (e.g. the cake flavour list).
export function ensureStoreSettingsSchema(): Promise<void> {
  if (!ensureStoreSettingsSchemaPromise) {
    ensureStoreSettingsSchemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS store_settings (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        )
      `);
    })().catch((error) => {
      ensureStoreSettingsSchemaPromise = null;
      throw error;
    });
  }

  return ensureStoreSettingsSchemaPromise;
}
