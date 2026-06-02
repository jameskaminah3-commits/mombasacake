import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@cremeandco.ke";
  const password = process.env.ADMIN_PASSWORD || "cremeandco2024";
  const name = process.env.ADMIN_NAME || "Admin";

  console.log(`Creating admin: ${email}`);
  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .insert(adminsTable)
    .values({ email, name, passwordHash })
    .onConflictDoUpdate({
      target: adminsTable.email,
      set: { passwordHash, name },
    });

  console.log(`Admin created: ${email} / ${password}`);
  console.log("Change this password immediately after first login.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
