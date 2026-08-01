import { describe, expect, it } from "vitest";
import { DEMO_USERS, findUser, homeForScope, parseScope, scopeAllowsPath } from "./auth";
import { listBumn } from "./bumn/registry";

describe("Danantara demo login", () => {
  it("signs in as `danantara` / danantara2026 and lands on the crisis gate", () => {
    const user = findUser("danantara", "danantara2026");
    expect(user).not.toBeNull();
    expect(user?.scope).toBe("danantara");
    expect(user?.home).toBe("/danantara/krisis");
  });

  it("is reachable for a danantara-scoped user (crisis gate is under /danantara)", () => {
    expect(scopeAllowsPath("danantara", "/danantara/krisis")).toBe(true);
  });

  it("routes the danantara scope home to the BGN command center — the SSO handoff landing", () => {
    // homeForScope is the /api/v1/sso success target (and the middleware bounce
    // target). A13 v4.0 renamed the one-page Command Center to /bgn/command.
    // NB: the direct demo login above still lands on the /krisis fear gate via its
    // own DEMO_USERS.home — a deliberately separate flow, left unchanged.
    expect(homeForScope("danantara")).toBe("/bgn/command");
  });
});

describe("scopeAllowsPath", () => {
  it("allows everything for the all scope", () => {
    expect(scopeAllowsPath("all", "/")).toBe(true);
    expect(scopeAllowsPath("all", "/jasamarga")).toBe(true);
    expect(scopeAllowsPath("all", "/danantara")).toBe(true);
  });

  it("allows danantara-scoped users into /danantara and /danantara-v2", () => {
    expect(scopeAllowsPath("danantara", "/danantara")).toBe(true);
    expect(scopeAllowsPath("danantara", "/danantara/anything")).toBe(true);
    expect(scopeAllowsPath("danantara", "/danantara-v2")).toBe(true);
  });

  it("allows danantara-scoped users into /bgn/command — the renamed home they land on", () => {
    // homeForScope("danantara") is /bgn/command; if the scope gate didn't allow it
    // the middleware would bounce to the same path and redirect-loop.
    expect(scopeAllowsPath("danantara", "/bgn/command")).toBe(true);
    expect(scopeAllowsPath("danantara", "/bgn")).toBe(true);
  });

  it("blocks danantara-scoped users from other dashboards", () => {
    expect(scopeAllowsPath("danantara", "/")).toBe(false);
    expect(scopeAllowsPath("danantara", "/jasamarga")).toBe(false);
    expect(scopeAllowsPath("danantara", "/login")).toBe(false);
  });
});

describe("BUMN scopes (T10 / AC7)", () => {
  it("lets a bumn-scoped user reach only its own dashboard", () => {
    expect(scopeAllowsPath("bumn:pln", "/bumn/pln")).toBe(true);
    expect(scopeAllowsPath("bumn:pln", "/bumn/pln/anything")).toBe(true);
  });

  it("blocks a bumn-scoped user from other BUMN, the index, and Danantara", () => {
    expect(scopeAllowsPath("bumn:pln", "/bumn/bri")).toBe(false);
    expect(scopeAllowsPath("bumn:pln", "/bumn")).toBe(false);
    expect(scopeAllowsPath("bumn:pln", "/danantara")).toBe(false);
    expect(scopeAllowsPath("bumn:pln", "/")).toBe(false);
  });

  it("lets the all super-admin reach the BUMN index and any BUMN", () => {
    expect(scopeAllowsPath("all", "/bumn")).toBe(true);
    expect(scopeAllowsPath("all", "/bumn/telkom")).toBe(true);
  });

  it("lets a bumn-scoped user reach only its own /bumn-v2 option page (T17 / AC10)", () => {
    expect(scopeAllowsPath("bumn:pln", "/bumn-v2/pln")).toBe(true);
    expect(scopeAllowsPath("bumn:pln", "/bumn-v2/pln/anything")).toBe(true);
    expect(scopeAllowsPath("bumn:pln", "/bumn-v2/bri")).toBe(false);
    expect(scopeAllowsPath("bumn:pln", "/bumn-v2")).toBe(false);
    expect(scopeAllowsPath("all", "/bumn-v2")).toBe(true);
  });

  it("parses and routes home for a bumn scope (valid slug only)", () => {
    expect(parseScope("bumn:pln")).toBe("bumn:pln");
    expect(homeForScope("bumn:pln")).toBe("/bumn/pln");
    // Unknown slug is not a real scope → falls back to all.
    expect(parseScope("bumn:ghost")).toBe("all");
  });
});

describe("BUMN demo logins (T11 / AC7)", () => {
  it("has one scoped login per registered BUMN, landing on its dashboard", () => {
    for (const b of listBumn()) {
      const user = DEMO_USERS.find((u) => u.scope === `bumn:${b.slug}`);
      expect(user).toBeDefined();
      expect(user?.home).toBe(`/bumn/${b.slug}`);
      expect(user?.email).toBe(`${b.slug}@nexorus.io`);
    }
  });
});
