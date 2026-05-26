import { createAdmin } from "../lib/auth/admin";
import { getDb } from "../lib/db/client";

/**
 * Provision the first admin (no Settings UI this phase — spec §10, P6 AC4).
 * Usage: DATABASE_URL=... pnpm --filter web create-admin <email> <password>
 */
async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: create-admin <email> <password>");
    process.exit(1);
  }
  const id = await createAdmin(getDb(), email, password);
  console.log(`Admin provisioned: ${email} (id=${id})`);
  process.exit(0);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
