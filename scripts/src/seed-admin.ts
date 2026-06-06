import bcrypt from "bcryptjs";
import { adminsTable, db } from "@workspace/db";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "jameskaminah3@gmail.com";
  const password = process.env.ADMIN_PASSWORD || "James@Channah";
  const name = process.env.ADMIN_NAME || "James";

  console.log(`Creating admin row: ${email}`);
  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .insert(adminsTable)
    .values({ email: email.trim().toLowerCase(), name, passwordHash })
    .onConflictDoUpdate({
      target: adminsTable.email,
      set: { passwordHash, name },
    });

  console.log(`Admin row ready: ${email}`);
  console.log("Password reset is handled through the admin login page.");
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
