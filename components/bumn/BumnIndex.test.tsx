// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { listBumn } from "@/lib/bumn/registry";
import { BumnIndex } from "./BumnIndex";

describe("BumnIndex (T2 / AC1)", () => {
  it("lists every registered BUMN with a link to its dashboard", () => {
    render(<BumnIndex />);
    for (const b of listBumn()) {
      const link = screen.getByRole("link", { name: new RegExp(b.name, "i") });
      expect(link).toHaveAttribute("href", `/bumn/${b.slug}`);
    }
  });

  it("links against a custom basePath for the /bumn-v2 option index (T17 / AC10)", () => {
    render(<BumnIndex basePath="/bumn-v2" />);
    for (const b of listBumn()) {
      const link = screen.getByRole("link", { name: new RegExp(b.name, "i") });
      expect(link).toHaveAttribute("href", `/bumn-v2/${b.slug}`);
    }
  });
});
