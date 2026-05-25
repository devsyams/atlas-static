import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { getArticleDetail } from "./article.repo";
import type { DB } from "./db/types.gen";

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

describe("getArticleDetail (reads stored enrichment)", () => {
  it("builds ArticleDetail from the DB article + enrichment", async () => {
    const row = await db
      .selectFrom("articles as a")
      .innerJoin("article_enrichment as e", "e.article_id", "a.id")
      .select(["a.url as url", "e.dominant_issue as issue", "e.score as score"])
      .orderBy("e.score", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();

    const detail = await getArticleDetail(db, new URLSearchParams({ url: row.url }));

    expect(detail.url).toBe(row.url);
    expect(detail.score).toBe(Number(row.score));
    expect(detail.category).toBe(row.issue);
    expect(detail.forecast.trend).toBe("up"); // top-scored article is high crisis (>=6)
    expect(detail.signals).toHaveLength(3);
    expect(detail.summary.length).toBeGreaterThan(0);
  });

  it("falls back gracefully for an unknown url", async () => {
    const detail = await getArticleDetail(
      db,
      new URLSearchParams({ url: "https://nope.example/missing" }),
    );
    expect(detail.title).toBeTruthy();
    expect(detail.signals).toHaveLength(3);
    expect(detail.forecast.timeframe).toBe("7 hari");
  });
});
