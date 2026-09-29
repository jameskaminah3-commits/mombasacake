import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ensureStoreSettingsSchema } from "./ensure-store-settings-schema";

// Shop-wide settings edited in the admin panel. They live in the database because the app's own
// files are replaced on every deploy.
export async function readStoreSetting(key: string): Promise<unknown> {
  await ensureStoreSettingsSchema();
  const result = await db.execute(sql`SELECT value FROM store_settings WHERE key = ${key} LIMIT 1`);
  return result.rows[0]?.value;
}

export async function writeStoreSetting(key: string, value: unknown): Promise<void> {
  await ensureStoreSettingsSchema();
  await db.execute(sql`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `);
}
