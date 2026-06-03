import { describe, expect, it } from "vitest";
import { fmtCount } from "./format";

describe("fmtCount", () => {
  it("keeps small numbers as-is", () => {
    expect(fmtCount(890)).toBe("890");
  });
  it("formats thousands as 'K'", () => {
    expect(fmtCount(4_200)).toBe("4.2K");
    expect(fmtCount(12_400)).toBe("12.4K");
  });
  it("formats millions as 'M'", () => {
    expect(fmtCount(1_240_000)).toBe("1.2M");
    expect(fmtCount(52_000_000)).toBe("52M");
  });
  it("never shows a trailing .0", () => {
    expect(fmtCount(5_000)).toBe("5K");
    expect(fmtCount(2_000_000)).toBe("2M");
  });
});
