import { describe, expect, it } from "vitest";
import { BUMN_REGISTRY, getBumn, isAllowedTopicCode, listBumn } from "./registry";

describe("BUMN registry (T1 / AC1)", () => {
  it("registers the 7 launch BUMN", () => {
    expect(listBumn().map((b) => b.slug).sort()).toEqual(
      ["bni", "bri", "jasamarga", "mandiri", "pertamina", "pln", "telkom"],
    );
  });

  it("maps each slug to its display name and danantara_<slug> topic code", () => {
    for (const b of BUMN_REGISTRY) {
      expect(b.topicCode).toBe(`danantara_${b.slug}`);
      expect(b.name.length).toBeGreaterThan(0);
    }
    expect(getBumn("pln")?.name).toBe("PLN");
    expect(getBumn("mandiri")?.topicCode).toBe("danantara_mandiri");
  });

  it("returns undefined for an unknown slug (page should 404)", () => {
    expect(getBumn("nope")).toBeUndefined();
  });
});

describe("isAllowedTopicCode (T3 / AC2 — allowlist, no open proxy)", () => {
  it("allows every registered BUMN code plus danantara_main", () => {
    expect(isAllowedTopicCode("danantara_main")).toBe(true);
    expect(isAllowedTopicCode("danantara_pln")).toBe(true);
    expect(isAllowedTopicCode("danantara_jasamarga")).toBe(true);
  });

  it("rejects unknown / arbitrary codes", () => {
    expect(isAllowedTopicCode("danantara_evil")).toBe(false);
    expect(isAllowedTopicCode("../../etc/passwd")).toBe(false);
    expect(isAllowedTopicCode("")).toBe(false);
  });
});
