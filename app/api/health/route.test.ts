import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health (k8s probe)", () => {
  it("returns 200 with a static ok body", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
