import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import type { DB } from "../db/types.gen";
import { createAdmin } from "./admin";

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://atlas:atlas@127.0.0.1:55432/atlas",
    }),
  }),
});

const EMAIL = `admin-test-${Date.now()}@example.com`;

afterAll(async () => {
  await db.deleteFrom("audit_log").where("target", "=", EMAIL).execute();
  await db.deleteFrom("users").where("email", "=", EMAIL).execute();
  await db.destroy();
});

describe("createAdmin", () => {
  it("provisions an admin, idempotently, and audits it", async () => {
    const id1 = await createAdmin(db, EMAIL, "first-pass");
    const id2 = await createAdmin(db, EMAIL, "second-pass");
    expect(id2).toBe(id1); // same user — no duplicate

    const count = await db
      .selectFrom("users")
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("email", "=", EMAIL)
      .executeTakeFirstOrThrow();
    expect(Number(count.c)).toBe(1);

    const user = await db
      .selectFrom("users")
      .select(["role", "status"])
      .where("id", "=", id1)
      .executeTakeFirstOrThrow();
    expect(user.role).toBe("admin");
    expect(user.status).toBe("active");

    const audits = await db
      .selectFrom("audit_log")
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("target", "=", EMAIL)
      .executeTakeFirstOrThrow();
    expect(Number(audits.c)).toBeGreaterThanOrEqual(2);
  });
});
