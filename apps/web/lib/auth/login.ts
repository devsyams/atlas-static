import type { Kysely } from "kysely";

import type { DB } from "../db/types.gen";
import { hashPassword, verifyPassword } from "./password";
import { createSession, type SessionUser } from "./session";

// Verify even when the user is missing, to keep timing uniform (no enumeration).
let dummyHash: string | null = null;
async function dummy(): Promise<string> {
  dummyHash ??= await hashPassword("invalid-placeholder");
  return dummyHash;
}

/**
 * Validate credentials and, on success, create a server-side session.
 * Returns null on any failure (unknown user, bad password, inactive account).
 */
export async function attemptLogin(
  db: Kysely<DB>,
  email: string,
  password: string,
): Promise<{ token: string; user: SessionUser } | null> {
  const user = await db
    .selectFrom("users")
    .select(["id", "email", "role", "password_hash", "status"])
    .where("email", "=", email)
    .executeTakeFirst();

  const ok = await verifyPassword(user?.password_hash ?? (await dummy()), password);
  if (!user || !ok || user.status !== "active") return null;

  const token = await createSession(db, user.id);
  await db.updateTable("users").set({ last_login_at: new Date() }).where("id", "=", user.id).execute();
  return { token, user: { userId: user.id, email: user.email, role: user.role } };
}
