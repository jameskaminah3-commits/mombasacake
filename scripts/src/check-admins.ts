import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

async function checkAdmins() {
  const emailFilter = process.env.CHECK_ADMIN_EMAIL?.trim().toLowerCase();
  const passwordToCheck = process.env.CHECK_ADMIN_PASSWORD;

  const database = await pool.query<{
    current_database: string;
    current_user: string;
  }>("select current_database(), current_user");

  const admins = await pool.query<{
    id: number;
    email: string;
    name: string;
    password_hash: string;
  }>(
    emailFilter
      ? "select id, email, name, password_hash from admins where email = $1 order by id"
      : "select id, email, name, password_hash from admins order by id",
    emailFilter ? [emailFilter] : [],
  );

  console.log(
    JSON.stringify(
      {
        database: database.rows[0],
        adminCount: admins.rowCount,
        admins: await Promise.all(
          admins.rows.map(async (admin) => {
            const hash = String(admin.password_hash);
            return {
              id: admin.id,
              email: admin.email,
              name: admin.name,
              hashPrefix: hash.slice(0, 4),
              hashLength: hash.length,
              bcryptLike: /^\$2[aby]\$/.test(hash),
              passwordMatches: passwordToCheck
                ? await bcrypt.compare(passwordToCheck, hash)
                : undefined,
            };
          }),
        ),
      },
      null,
      2,
    ),
  );
}

checkAdmins()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
