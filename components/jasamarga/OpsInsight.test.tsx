// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpsInsight } from "./OpsInsight";

const insight = { title: "Judul", text: "Analisis.", action: "Tindakan." };

/** T9 / AC5 — the widget must be honest about where its words came from. */
describe("OpsInsight provenance badge", () => {
  it("badges LLM output as model-generated", () => {
    render(<OpsInsight insight={insight} conditions={[]} loadIndex={5} level="Padat" aiSource="llm" />);
    expect(screen.getByText(/Nexorus AI · LLM/i)).toBeInTheDocument();
    expect(screen.queryByText(/Simulasi/i)).not.toBeInTheDocument();
  });

  it("badges the deterministic fallback as Simulasi", () => {
    render(<OpsInsight insight={insight} conditions={[]} loadIndex={5} level="Padat" aiSource="scripted" />);
    expect(screen.getByText(/Simulasi/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nexorus AI · LLM/i)).not.toBeInTheDocument();
  });

  it("renders the insight body either way", () => {
    render(<OpsInsight insight={insight} conditions={[]} loadIndex={5} level="Padat" aiSource="llm" />);
    expect(screen.getByText("Judul")).toBeInTheDocument();
    expect(screen.getByText("Tindakan.")).toBeInTheDocument();
  });
});
