import { pool } from "@workspace/db";

async function checkDb() {
  const result = await pool.query<{
    current_database: string;
    current_user: string;
  }>("select current_database(), current_user");

  const [row] = result.rows;
  console.log(`Connected to ${row.current_database} as ${row.current_user}`);
  await pool.end();
}

checkDb().catch(async (err) => {
  console.error("Database connection failed:");
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
