import { describe, expect, it } from "vitest";

import { feedQuery } from "./feed-query";

/**
 * The Danantara feed panes take two independent client flags — `fresh` (bypass the
 * cache) and `mock` (the A13 v4.0 scoped-mock signal /bgn/command sends). This helper
 * builds the query suffix so a component never hand-concatenates `?fresh=1?mock=1`.
 */
describe("feedQuery", () => {
  it("is empty when neither flag is set", () => {
    expect(feedQuery({})).toBe("");
    expect(feedQuery({ fresh: false, mock: false })).toBe("");
  });

  it("emits a single flag", () => {
    expect(feedQuery({ fresh: true })).toBe("?fresh=1");
    expect(feedQuery({ mock: true })).toBe("?mock=1");
  });

  it("joins both flags with & under one leading ?", () => {
    expect(feedQuery({ fresh: true, mock: true })).toBe("?fresh=1&mock=1");
  });

  it("emits bgn=1 for the BGN-product signal (A13 v6.3)", () => {
    expect(feedQuery({ bgn: true })).toBe("?bgn=1");
  });

  it("joins bgn with the other flags under one leading ?", () => {
    expect(feedQuery({ fresh: true, mock: true, days: 7, bgn: true })).toBe("?fresh=1&mock=1&days=7&bgn=1");
  });
});
