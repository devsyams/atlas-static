import type { Kysely } from "kysely";

import type { DB } from "../db/types.gen";
import { writeAudit } from "./audit";
import { hashPassword } from "./password";

/**
 * Provision (or reset) the first admin — used by the seed/CLI since there is no
 * Settings UI in this phase (spec §10, P6 AC4). Idempotent by email.
 */
export async function createAdmin(db: Kysely<DB>, email: string, password: string): Promise<number> {
  const password_hash = await hashPassword(password);
  const existing = await db
    .selectFrom("users")
    .select(["id"])
    .where("email", "=", email)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable("users")
      .set({ password_hash, role: "admin", status: "active" })
      .where("id", "=", existing.id)
      .execute();
    await writeAudit(db, {
      userId: existing.id,
      action: "user.updated",
      target: email,
      meta: { role: "admin" },
    });
    return existing.id;
  }

  const created = await db
    .insertInto("users")
    .values({ email, password_hash, role: "admin", status: "active" })
    .returning("id")
    .executeTakeFirstOrThrow();
  await writeAudit(db, {
    userId: created.id,
    action: "user.provisioned",
    target: email,
    meta: { role: "admin" },
  });
  return created.id;
}
