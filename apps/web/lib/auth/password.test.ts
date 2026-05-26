import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing (argon2id)", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const h = await hashPassword("s3cret-pass");
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(h, "s3cret-pass")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
  });

  it("returns false (not throw) for a malformed stored hash", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});
