import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DB } from "../db/types.gen";
import { attemptLogin } from "./login";
import { hashPassword } from "./password";

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://atlas:atlas@127.0.0.1:55432/atlas",
    }),
  }),
});

const EMAIL = `login-test-${Date.now()}@example.com`;
const PW = "correct-horse-battery";
let userId: number;

beforeAll(async () => {
  const u = await db
    .insertInto("users")
    .values({ email: EMAIL, password_hash: await hashPassword(PW), role: "admin", status: "active" })
    .returning("id")
    .executeTakeFirstOrThrow();
  userId = u.id;
});

afterAll(async () => {
  await db.deleteFrom("sessions").where("user_id", "=", userId).execute();
  await db.deleteFrom("users").where("id", "=", userId).execute();
  await db.destroy();
});

describe("attemptLogin", () => {
  it("returns a token + user for correct credentials", async () => {
    const r = await attemptLogin(db, EMAIL, PW);
    expect(r?.user.role).toBe("admin");
    expect(r?.user.email).toBe(EMAIL);
    expect(r?.token).toBeTruthy();
  });

  it("returns null for a wrong password", async () => {
    expect(await attemptLogin(db, EMAIL, "wrong")).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    expect(await attemptLogin(db, `ghost-${Date.now()}@example.com`, PW)).toBeNull();
  });
});
