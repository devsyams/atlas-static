// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { listBumn } from "@/lib/bumn/registry";
import { BumnIndex } from "./BumnIndex";

describe("BumnIndex (T2 / AC1)", () => {
  /** name → href for every rendered link (one a11y-tree pass, not one per BUMN). */
  const hrefByName = () =>
    new Map(
      screen.getAllByRole("link").map((l) => [l.textContent?.trim() ?? "", l.getAttribute("href")]),
    );

  it("lists every registered BUMN with a link to its dashboard", () => {
    render(<BumnIndex />);
    const links = hrefByName();
    for (const b of listBumn()) {
      expect(links.get(b.name)).toBe(`/bumn/${b.slug}`);
    }
  });

  it("links against a custom basePath for the /bumn-v2 option index (T17 / AC10)", () => {
    render(<BumnIndex basePath="/bumn-v2" />);
    const links = hrefByName();
    for (const b of listBumn()) {
      expect(links.get(b.name)).toBe(`/bumn-v2/${b.slug}`);
    }
  });
});
