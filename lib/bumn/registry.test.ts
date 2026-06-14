import { describe, expect, it } from "vitest";
import { BUMN_REGISTRY, getBumn, isAllowedTopicCode, listBumn } from "./registry";

/** The 33-BUMN portfolio (v7.0), by slug. */
const ROSTER = [
  "mandiri", "pln", "telkom", "pertamina", "bni", "bri", "jasamarga",
  "bsi", "adhikarya", "hutamakarya", "pembangunanperumahan", "waskitakarya",
  "wijayakarya", "asabri", "askrindo", "askrindosyariah", "jamkrindo",
  "jamkrindosyariah", "asdpindonesia", "pelindo", "pelni",
  "posindonesia", "garudaindonesia", "citilink", "pelitaair",
  "injourney", "sarinah", "kimiafarma", "pertamina_rspp",
  "pegadaian", "manajemenaset", "galangankapal", "agrinaspalma",
];

describe("BUMN registry (T1 / AC1)", () => {
  it("registers the 33-BUMN portfolio (v7.0)", () => {
    expect(listBumn().map((b) => b.slug).sort()).toEqual([...ROSTER].sort());
  });

  it("maps each slug to its display name and danantara_<slug> topic code", () => {
    for (const b of BUMN_REGISTRY) {
      expect(b.topicCode).toBe(`danantara_${b.slug}`);
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.short.length).toBeGreaterThan(0);
    }
    expect(getBumn("pln")?.name).toBe("PLN");
    expect(getBumn("mandiri")?.topicCode).toBe("danantara_mandiri");
    expect(getBumn("pertamina_rspp")?.topicCode).toBe("danantara_pertamina_rspp");
  });

  it("has unique slugs and topic codes", () => {
    const slugs = BUMN_REGISTRY.map((b) => b.slug);
    const codes = BUMN_REGISTRY.map((b) => b.topicCode);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(codes).size).toBe(codes.length);
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
