import { describe, expect, it } from "vitest";
import { scopeAllowsPath } from "./auth";

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
