import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "./middleware";

/** Build a NextRequest for `path` carrying the given cookies. */
const req = (path: string, cookies: Record<string, string>) =>
  new NextRequest(`http://localhost${path}`, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    },
  });

/** Redirect Location as a pathname (relative or absolute). */
const locationPath = (res: Response) =>
  new URL(res.headers.get("location") ?? "", "http://localhost").pathname;

describe("middleware — bgn-sim scope lock (A16 / AC3 / T6)", () => {
  it("bounces a bgn-sim user off any other page back to /bgn/simulation", () => {
    const res = middleware(req("/bgn/command", { atlas_auth: "1", atlas_scope: "bgn-sim" }));
    expect(res.headers.get("location")).not.toBeNull();
    expect(locationPath(res)).toBe("/bgn/simulation");
  });

  it("lets a bgn-sim user reach /bgn/simulation itself (no redirect)", () => {
    const res = middleware(req("/bgn/simulation", { atlas_auth: "1", atlas_scope: "bgn-sim" }));
    // NextResponse.next() carries no Location redirect.
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends an already-authed bgn-sim user off /login to /bgn/simulation (AC4)", () => {
    const res = middleware(req("/login", { atlas_auth: "1", atlas_scope: "bgn-sim" }));
    expect(res.headers.get("location")).not.toBeNull();
    expect(locationPath(res)).toBe("/bgn/simulation");
  });
});
