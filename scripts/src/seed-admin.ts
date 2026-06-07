import bcrypt from "bcryptjs";
import { adminsTable, db } from "@workspace/db";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set to seed an admin account.`);
  }

  return value;
}

async function seedAdmin() {
  const email = requireEnv("SEED_ADMIN_EMAIL");
  const password = requireEnv("SEED_ADMIN_PASSWORD");
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Admin";

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
