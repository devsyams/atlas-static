import { afterAll, describe, expect, it } from "vitest";

import { cached, closeCache, invalidate } from "./cache";

afterAll(async () => {
  await closeCache();
});

describe("cached (Redis cache-aside)", () => {
  it("runs fn once, then serves repeat calls within the TTL from cache", async () => {
    const key = `test:cache:${Date.now()}`;
    await invalidate(key);
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return { value: 42 };
    };

    const first = await cached(key, 30, fn);
    const second = await cached(key, 30, fn);

    expect(first).toEqual({ value: 42 });
    expect(second).toEqual({ value: 42 });
    expect(calls).toBe(1); // second call hit Redis; fn (the DB query) did not re-run

    await invalidate(key);
  });
});
