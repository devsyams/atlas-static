import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DB } from "../db/types.gen";
import { createSession, destroySession, getSessionUser } from "./session";

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://atlas:atlas@127.0.0.1:55432/atlas",
    }),
  }),
});

const EMAIL = `sess-test-${Date.now()}@example.com`;
let userId: number;

beforeAll(async () => {
  const u = await db
    .insertInto("users")
    .values({ email: EMAIL, password_hash: "x", role: "analyst", status: "active" })
    .returning("id")
    .executeTakeFirstOrThrow();
  userId = u.id;
});

afterAll(async () => {
  await db.deleteFrom("sessions").where("user_id", "=", userId).execute();
  await db.deleteFrom("users").where("id", "=", userId).execute();
  await db.destroy();
});

describe("server-side sessions", () => {
  it("creates a session that resolves to the user, and destroys it", async () => {
    const token = await createSession(db, userId);
    const u = await getSessionUser(db, token);
    expect(u?.userId).toBe(userId);
    expect(u?.role).toBe("analyst");

    await destroySession(db, token);
    expect(await getSessionUser(db, token)).toBeNull();
  });

  it("rejects an expired session", async () => {
    const token = `expired-${Date.now()}`;
    await db
      .insertInto("sessions")
      .values({ id: token, user_id: userId, expires_at: new Date(Date.now() - 1000) })
      .execute();
    expect(await getSessionUser(db, token)).toBeNull();
  });

  it("returns null for a missing token", async () => {
    expect(await getSessionUser(db, undefined)).toBeNull();
  });
});
