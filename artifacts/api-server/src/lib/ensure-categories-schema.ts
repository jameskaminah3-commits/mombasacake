import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

let ensureCategoriesSchemaPromise: Promise<void> | null = null;

export function ensureCategoriesSchema(): Promise<void> {
  if (!ensureCategoriesSchemaPromise) {
    ensureCategoriesSchemaPromise = (async () => {
      await db.execute(sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS description text`);
    })().catch((error) => {
      ensureCategoriesSchemaPromise = null;
      logger.error({ error }, "ensureCategoriesSchema failed");
      throw error;
    });
  }
  return ensureCategoriesSchemaPromise;
}
