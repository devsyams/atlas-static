"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import type { Prediction } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";

type Band = "high" | "mid" | "low";

const BAND: Record<Band, { bar: string; text: string }> = {
  high: { bar: "bg-destructive", text: "text-destructive" },
  mid: { bar: "bg-warning", text: "text-warning" },
  low: { bar: "bg-success", text: "text-success" },
};

/** Color band from explicit tone, falling back to probability magnitude. */
function bandOf(p: Prediction): Band {
  if (p.tone === "negative") return "high";
  if (p.tone === "neutral") return "mid";
  if (p.tone === "positive") return "low";
  if (p.probability >= 67) return "high";
  if (p.probability >= 34) return "mid";
  return "low";
}

/** One prediction as a forecast card: probability, meter, and an expandable rationale. */
export function ProbabilityMeter({
  prediction,
  updatedAt,
}: {
  prediction: Prediction;
  updatedAt?: string;
}) {
  const [open, setOpen] = useState(false);
  const s = BAND[bandOf(prediction)];
  const pct = Math.max(0, Math.min(100, prediction.probability));

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3.5 py-3">
      <div className="text-[13px] font-bold leading-snug text-foreground">
        {prediction.question}
      </div>

      {/* probability + horizon */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-[26px] font-extrabold leading-none tabular-nums", s.text)}>
          {prediction.probability}%
        </span>
        <span className="text-[11px] text-muted-foreground">
          <span className={cn("font-bold", s.text)}>{prediction.answer_label}</span>
          {prediction.timeframe ? ` · ${prediction.timeframe}` : ""}
        </span>
      </div>

      {/* meter */}
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", s.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* updated + why-this-forecast toggle */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
        <span className="truncate">{updatedAt ? `Diperbarui ${updatedAt}` : ""}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex shrink-0 items-center gap-1 font-medium transition-colors hover:text-foreground"
        >
          <Info className="h-3 w-3" />
          Mengapa prediksi ini?
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {/* rationale */}
      {open && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {prediction.reasoning}
        </p>
      )}
    </div>
  );
}
