import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { getDashboard } from "./dashboard.repo";
import type { DB } from "./db/types.gen";

// Reads the seeded local Postgres (P3 seed). Override with DATABASE_URL.
const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://atlas:atlas@127.0.0.1:55432/atlas",
    }),
  }),
});

afterAll(async () => {
  await db.destroy();
});

describe("getDashboard (assembles DashboardData from Postgres)", () => {
  it("returns the full dashboard shape sourced from the DB, not static JSON", async () => {
    const d = await getDashboard(db);

    // headline crisis index from the latest snapshot
    expect(d.score).toBeCloseTo(2.9, 1);
    expect(d.level).toBe("WASPADA");
    expect(d.article_count).toBe(1366);
    expect(d.high_crisis_count).toBe(11);
    expect(d.mapped_article_count).toBe(9);
    expect(d.unmapped_article_count).toBe(1);

    // collections match the seeded source counts
    expect(d.articles).toHaveLength(10);
    expect(d.predictions).toHaveLength(3);
    expect(d.top_keywords).toHaveLength(26);
    expect(d.market_ticker).toHaveLength(10);
    expect(d.top_cities.length).toBeGreaterThan(0);
    expect(d.actor_thread_analysis?.actors).toHaveLength(6);
    expect(d.leadership_sentiment?.leaders).toHaveLength(2);

    // shape spot-checks
    expect(d.insight?.title).toBeTruthy();
    expect(typeof d.articles[0].title).toBe("string");
    expect(d.articles[0].link).toContain("http");
    expect(typeof d.score).toBe("number");
    expect(d.market_ticker[0].value).toBeTypeOf("string");
  });
});
