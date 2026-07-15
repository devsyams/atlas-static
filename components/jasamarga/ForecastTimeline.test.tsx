// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForecastTimeline } from "./ForecastTimeline";

const hours = [
  { hour: "15:00", load: 6.4, label: "Sekarang" },
  { hour: "16:00", load: 7.1 },
  { hour: "17:00", load: 8.8, label: "Puncak" },
];

/** T21 / AC21 — the Proyeksi Beban 6 Jam panel must be honest about provenance. */
describe("ForecastTimeline provenance badge", () => {
  it("badges an LLM-generated projection as model-generated", () => {
    render(<ForecastTimeline hours={hours} source="llm" />);
    expect(screen.getByText(/Nexorus AI · LLM/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Simulasi$/i)).not.toBeInTheDocument();
  });

  it("badges the deterministic fallback as Simulasi", () => {
    render(<ForecastTimeline hours={hours} source="scripted" />);
    expect(screen.getByText(/Simulasi/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nexorus AI · LLM/i)).not.toBeInTheDocument();
  });

  it("renders no provenance badge when source is omitted", () => {
    render(<ForecastTimeline hours={hours} />);
    expect(screen.queryByText(/Nexorus AI · LLM/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Simulasi$/i)).not.toBeInTheDocument();
  });

  it("renders the hour points and labels either way", () => {
    render(<ForecastTimeline hours={hours} source="llm" />);
    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByText("Puncak")).toBeInTheDocument();
  });

  it("keeps the deterministic empty state unchanged", () => {
    render(<ForecastTimeline hours={[]} source="llm" />);
    expect(screen.getByText(/Proyeksi belum tersedia/i)).toBeInTheDocument();
  });
});
