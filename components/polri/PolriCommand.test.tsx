// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PolriCommand } from "./PolriCommand";

describe("PolriCommand", () => {
  it("renders each Polda with its provided logo asset", () => {
    render(<PolriCommand />);

    const expected = [
      ["Polda Metro Jaya logo", "metro-jaya.png"],
      ["Polda Jabar logo", "jabar.png"],
      ["Polda Jateng logo", "jateng.png"],
      ["Polda Jatim logo", "jatim.png"],
      ["Polda Bali logo", "bali.png"],
    ];

    for (const [alt, file] of expected) {
      const image = screen.getByAltText(alt) as HTMLImageElement;
      expect(decodeURIComponent(image.src)).toContain(`/polri/polda/${file}`);
    }
  });

  it("links each Polda logo to its executive briefing page", () => {
    render(<PolriCommand />);

    expect(screen.getByTestId("btn-bumn-tile-metro-jaya")).toHaveAttribute("href", "/polri/polda/metro-jaya");
    expect(screen.getByTestId("btn-bumn-tile-jabar")).toHaveAttribute("href", "/polri/polda/jabar");
    expect(screen.getByTestId("btn-bumn-tile-jateng")).toHaveAttribute("href", "/polri/polda/jateng");
    expect(screen.getByTestId("btn-bumn-tile-jatim")).toHaveAttribute("href", "/polri/polda/jatim");
    expect(screen.getByTestId("btn-bumn-tile-bali")).toHaveAttribute("href", "/polri/polda/bali");
  });

  it("does not show rank movement badges beside Polda names", () => {
    render(<PolriCommand />);

    expect(screen.queryAllByTestId("rank-up")).toHaveLength(0);
    expect(screen.queryAllByTestId("rank-down")).toHaveLength(0);
  });

  it("opens a topic detail modal from the Polri issue board", () => {
    render(<PolriCommand />);

    fireEvent.click(screen.getByTestId("btn-issue-row-polri-korupsi-penegakan-hukum"));

    const modal = screen.getByTestId("ceo-detail-issue");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByRole("heading", { name: /Publik mengawal kasus korupsi besar/i })).toBeInTheDocument();
    expect(screen.getByTestId("issue-description")).not.toHaveTextContent("Ringkasan:");
    expect(screen.getByTestId("issue-description")).not.toHaveTextContent("Mengapa dibicarakan:");
    expect(screen.getByTestId("issue-description")).toHaveTextContent("publik");
  });

  it("opens a topic detail modal from a Polda topic cell", () => {
    render(<PolriCommand />);

    const metro = screen.getByTestId("bumn-tile-metro-jaya");
    fireEvent.click(metro.querySelector("[data-testid='bumn-topic-positive']") as HTMLElement);

    const modal = screen.getByTestId("ceo-detail-issue");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByRole("heading", { name: /Polda Metro Jaya sita 17,45 ton narkoba/i })).toBeInTheDocument();
    expect(screen.getByTestId("issue-description")).not.toHaveTextContent("Ringkasan:");
    expect(screen.getByTestId("issue-description")).not.toHaveTextContent("Mengapa dibicarakan:");
    expect(screen.getByTestId("issue-description")).toHaveTextContent("media sosial");
  });

  it("does not mix national Polri topics into the Polda board", () => {
    render(<PolriCommand />);

    const poldaBoard = screen.getByTestId("ceo-bumn");
    expect(poldaBoard).not.toHaveTextContent("Kortastipidkor Polri");
    expect(poldaBoard).not.toHaveTextContent("kriminalisasi");
    expect(screen.getByTestId("ceo-issues")).toHaveTextContent("Kortastipidkor Polri");
  });
});
