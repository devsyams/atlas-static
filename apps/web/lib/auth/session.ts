import { randomBytes } from "node:crypto";

import type { Kysely } from "kysely";

import type { DB } from "../db/types.gen";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  userId: number;
  email: string;
  role: string;
}

/** Create an opaque, server-side session row and return its token. */
export async function createSession(db: Kysely<DB>, userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db
    .insertInto("sessions")
    .values({ id: token, user_id: userId, expires_at: new Date(Date.now() + SESSION_TTL_MS) })
    .execute();
  return token;
}

/** Resolve a session token to its user, or null if missing/expired/inactive. */
export async function getSessionUser(
  db: Kysely<DB>,
  token: string | undefined | null,
): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await db
    .selectFrom("sessions as s")
    .innerJoin("users as u", "u.id", "s.user_id")
    .select([
      "s.expires_at as expires_at",
      "u.id as user_id",
      "u.email as email",
      "u.role as role",
      "u.status as status",
    ])
    .where("s.id", "=", token)
    .executeTakeFirst();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(db, token);
    return null;
  }
  if (row.status !== "active") return null;
  return { userId: row.user_id, email: row.email, role: row.role };
}

export async function destroySession(db: Kysely<DB>, token: string): Promise<void> {
  await db.deleteFrom("sessions").where("id", "=", token).execute();
}
