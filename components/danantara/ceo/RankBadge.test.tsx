// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RankBadge } from "./RankBadge";

describe("RankBadge (T8 / AC8)", () => {
  it("shows a green climb badge with positions gained", () => {
    render(<RankBadge delta={3} />);
    const badge = screen.getByTestId("rank-up");
    expect(badge.textContent).toContain("3");
    expect(badge.className).toContain("text-success");
  });

  it("shows a red drop badge with positions lost (absolute value)", () => {
    render(<RankBadge delta={-2} />);
    const badge = screen.getByTestId("rank-down");
    expect(badge.textContent).toContain("2");
    expect(badge.textContent).not.toContain("-");
    expect(badge.className).toContain("text-destructive");
  });

  it("renders nothing for an unchanged rank (AC8 v17.0)", () => {
    const { container } = render(<RankBadge delta={0} />);
    expect(screen.queryByTestId("rank-stay")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
