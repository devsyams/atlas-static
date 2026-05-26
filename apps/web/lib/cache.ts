import Redis from "ioredis";

let client: Redis | null = null;

function redis(): Redis {
  if (client === null) {
    client = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6380", {
      maxRetriesPerRequest: 2,
    });
  }
  return client;
}

/**
 * Cache-aside helper (spec §6.1): return the cached JSON for `key` if present;
 * otherwise run `fn`, store the result with a TTL, and return it. Keeps the
 * dashboard payload off Postgres on every poll.
 */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const r = redis();
  const hit = await r.get(key);
  if (hit !== null) {
    return JSON.parse(hit) as T;
  }
  const value = await fn();
  await r.set(key, JSON.stringify(value), "EX", ttlSec);
  return value;
}

export async function invalidate(key: string): Promise<void> {
  await redis().del(key);
}

export async function closeCache(): Promise<void> {
  if (client !== null) {
    await client.quit();
    client = null;
  }
}
