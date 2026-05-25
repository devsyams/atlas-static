import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import type { DB } from "../db/types.gen";
import { writeAudit } from "./audit";

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://atlas:atlas@127.0.0.1:55432/atlas",
    }),
  }),
});

afterAll(async () => {
  await db.deleteFrom("audit_log").where("action", "like", "test.%").execute();
  await db.destroy();
});

describe("writeAudit", () => {
  it("appends a row with actor, action, target and jsonb meta", async () => {
    const action = `test.audit.${Date.now()}`;
    await writeAudit(db, { userId: null, action, target: "thing-1", meta: { reason: "spec" } });

    const row = await db
      .selectFrom("audit_log")
      .selectAll()
      .where("action", "=", action)
      .executeTakeFirstOrThrow();

    expect(row.action).toBe(action);
    expect(row.target).toBe("thing-1");
    expect(row.meta_jsonb).toEqual({ reason: "spec" });
    expect(row.created_at).toBeTruthy();
  });
});
