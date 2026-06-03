import { describe, expect, it } from "vitest";
import { fmtCount } from "./format";

describe("fmtCount", () => {
  it("keeps small numbers as-is with id-ID grouping", () => {
    expect(fmtCount(890)).toBe("890");
  });
  it("formats thousands as 'rb'", () => {
    expect(fmtCount(4_200)).toBe("4,2 rb");
    expect(fmtCount(12_400)).toBe("12,4 rb");
  });
  it("formats millions as 'jt'", () => {
    expect(fmtCount(1_240_000)).toBe("1,2 jt");
    expect(fmtCount(52_000_000)).toBe("52 jt");
  });
  it("never shows a trailing ,0", () => {
    expect(fmtCount(5_000)).toBe("5 rb");
    expect(fmtCount(2_000_000)).toBe("2 jt");
  });
});
