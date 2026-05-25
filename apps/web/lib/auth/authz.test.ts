import { describe, expect, it } from "vitest";

import { roleAtLeast } from "./authz";

describe("roleAtLeast (RBAC hierarchy)", () => {
  it("admin satisfies every required role", () => {
    expect(roleAtLeast("admin", "viewer")).toBe(true);
    expect(roleAtLeast("admin", "analyst")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
  });

  it("analyst satisfies viewer/analyst but not admin", () => {
    expect(roleAtLeast("analyst", "viewer")).toBe(true);
    expect(roleAtLeast("analyst", "analyst")).toBe(true);
    expect(roleAtLeast("analyst", "admin")).toBe(false);
  });

  it("viewer satisfies only viewer", () => {
    expect(roleAtLeast("viewer", "viewer")).toBe(true);
    expect(roleAtLeast("viewer", "analyst")).toBe(false);
    expect(roleAtLeast("viewer", "admin")).toBe(false);
  });

  it("unknown role satisfies nothing", () => {
    expect(roleAtLeast("ghost", "viewer")).toBe(false);
  });
});
