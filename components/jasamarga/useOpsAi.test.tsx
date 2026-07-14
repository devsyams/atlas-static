// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAiEnabled } from "@/lib/ai-settings";
import { buildSnapshot } from "@/lib/jasamarga/data";
import { useOpsAi } from "./useOpsAi";

const LLM = {
  source: "llm",
  insight: { title: "Judul AI", text: "Analisis AI.", action: "Tindakan AI." },
  predictions: [1, 2, 3].map((n) => ({
    question: `Skenario ${n}?`,
    probability: 50,
    answer_label: "Mungkin",
    reasoning: "Alasan.",
  })),
};

function Probe() {
  const ai = useOpsAi(buildSnapshot("japek"));
  return <div data-testid="src">{ai.source}</div>;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ json: () => Promise.resolve(LLM) });
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

/** T15 / AC9 — an off switch must spend zero tokens, not merely hide the output. */
describe("useOpsAi — Nexorus AI kill switch", () => {
  it("calls the AI route when the switch is on (default)", async () => {
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("src")).toHaveTextContent("llm"));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/jasamarga-ai", expect.anything());
  });

  it("never calls the AI route when the switch is off", async () => {
    setAiEnabled(false);
    render(<Probe />);

    // Give the effect a chance to run, then assert it stayed silent.
    await waitFor(() => expect(screen.getByTestId("src")).toHaveTextContent("scripted"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
