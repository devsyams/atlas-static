import { describe, expect, it } from "vitest";
import { DEMO_USERS, homeForScope, parseScope, scopeAllowsPath } from "./auth";
import { listBumn } from "./bumn/registry";

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
