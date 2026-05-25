import { Zap } from "lucide-react";
import type { Prediction } from "@/lib/mbg/types";
import { ProbabilityMeter } from "./ProbabilityMeter";

/** Prediction widget body: a stack of probability meters + Nexorus AI attribution. */
export function PredictionMeters({
  predictions,
  updatedAt,
}: {
  predictions: Prediction[];
  updatedAt?: string;
}) {
  if (!predictions.length) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
        Prediction belum tersedia.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>Prediksi Nexorus AI</span>
        <span className="text-primary/80">{predictions.length} skenario</span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto scrollbar-thin">
        {predictions.map((p, i) => (
          <ProbabilityMeter key={`${p.question}-${i}`} prediction={p} updatedAt={updatedAt} />
        ))}
      </div>

      <div className="mt-2 shrink-0 border-t border-border/40 pt-2 text-center">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground/70">
          <Zap className="h-3 w-3 text-primary/70" /> powered by{" "}
          <span className="text-gradient font-bold">Nexorus AI</span>
        </span>
      </div>
    </div>
  );
}
