// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PolriPoldaBriefing } from "./PolriPoldaBriefing";

describe("PolriPoldaBriefing", () => {
  it("renders a scoped Polda executive briefing with only that Polda's topics", () => {
    render(<PolriPoldaBriefing slug="metro-jaya" />);

    expect(screen.getByRole("heading", { name: "Executive Briefing" })).toBeInTheDocument();
    expect(screen.getByText("Polda Metro Jaya · Media Briefing")).toBeInTheDocument();
    expect(screen.getByAltText("Polda Metro Jaya logo")).toBeInTheDocument();
    expect(screen.getByTestId("brief-back-link")).toHaveAttribute("href", "/polri");
    expect(screen.getByTestId("brief-verdict")).toHaveTextContent("Public sentiment toward Polda Metro Jaya is");
    expect(screen.getByText("What's driving it")).toBeInTheDocument();
    expect(screen.getByTestId("brief-driver-concern")).toHaveTextContent("Keluhan curanmor dan begal");
    expect(screen.getByTestId("brief-driver-win")).toHaveTextContent("Polda Metro Jaya sita 17,45 ton");
    expect(screen.getByText("Share of voice")).toBeInTheDocument();
    expect(screen.getByTestId("intent-share")).toHaveTextContent("enforcement");
    expect(screen.getByTestId("brief-topics")).toHaveTextContent("All topics (5)");
    expect(screen.getByTestId("brief-topics")).not.toHaveTextContent("Polda Jabar");
    expect(screen.queryByText("Executive response")).not.toBeInTheDocument();
    expect(screen.queryByTestId("polda-brief-recommendations")).not.toBeInTheDocument();
  });

  it("opens topic details from the briefing topic list", () => {
    render(<PolriPoldaBriefing slug="metro-jaya" />);

    fireEvent.click(screen.getByTestId("brief-topic-metro-curanmor-jakarta"));

    const modal = screen.getByTestId("ceo-detail-issue");
    expect(within(modal).getByRole("heading", { name: /Keluhan curanmor dan begal/i })).toBeInTheDocument();
    expect(screen.getByTestId("issue-description")).toHaveTextContent("rasa aman harian");
  });
});
