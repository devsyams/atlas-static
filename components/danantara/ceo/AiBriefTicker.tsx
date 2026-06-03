"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { briefLines } from "@/lib/danantara/ceo/engine";
import type { CeoState } from "@/lib/danantara/ceo/types";

const LINE_MS = 6_000;

/**
 * Broadcast-style narration strip — deterministic scripted lines from the live
 * state (no LLM). Type sizes follow the CEO readability scale (AC15).
 */
export function AiBriefTicker({ state }: { state: CeoState }) {
  const lines = briefLines(state);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((v) => v + 1), LINE_MS);
    return () => clearInterval(id);
  }, []);

  const line = lines[idx % lines.length] ?? "";
  const isWarning = line.startsWith("⚠");

  return (
    <div
      data-testid="ceo-ticker"
      className={`panel flex items-center gap-3 px-4 py-2.5 ${isWarning ? "border-destructive/50 bg-destructive/10" : ""}`}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-base font-semibold uppercase tracking-[0.2em] text-primary">
        <Sparkles className="h-5 w-5" /> Nexorus AI
      </span>
      <p key={idx} className={`ceo-ticker-line min-w-0 flex-1 truncate text-xl ${isWarning ? "font-semibold text-destructive" : ""}`}>
        {line}
      </p>
    </div>
  );
}
