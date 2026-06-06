import { pool } from "./index";

let ensureReviewsSchemaPromise: Promise<void> | null = null;

export function ensureReviewsSchema(): Promise<void> {
  if (!ensureReviewsSchemaPromise) {
    ensureReviewsSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
          id serial PRIMARY KEY,
          cake_id integer NOT NULL,
          order_id integer,
          author_name text NOT NULL,
          rating integer NOT NULL,
          body text NOT NULL,
          approved integer NOT NULL DEFAULT 1,
          created_at timestamp with time zone NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_id integer`);
      await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS approved integer NOT NULL DEFAULT 1`);
      await pool.query(`ALTER TABLE reviews ALTER COLUMN approved SET DEFAULT 1`);
    })().catch((error) => {
      ensureReviewsSchemaPromise = null;
      throw error;
    });
  }

  return ensureReviewsSchemaPromise;
}
