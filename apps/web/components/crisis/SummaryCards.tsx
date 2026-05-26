import type { Insight, Prediction } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";

const LABEL = "text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground";

export function SummaryCards({
  insight,
  prediction,
  loading,
}: {
  insight: Insight | null;
  prediction: Prediction | null;
  loading: boolean;
}) {
  return (
    <section className="mb-4 grid gap-3 sm:grid-cols-2">
      <div className={cn("panel min-h-[150px] p-4", !loading && !insight && "border-destructive/40")}>
        <div className={LABEL}>Insight</div>
        <div className="mt-2 text-lg font-extrabold leading-tight">
          {loading ? "Menyusun insight…" : insight ? insight.title : "Insight belum tersedia"}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {loading
            ? "Analisis akan muncul setelah sinyal artikel dan sentimen siap."
            : insight
              ? insight.text
              : "Insight membutuhkan ringkasan AI dari berita dan sentimen. Saat ini sistem belum punya cukup sinyal untuk menyusunnya."}
        </p>
      </div>

      <div
        className={cn(
          "panel min-h-[150px] p-4",
          !loading && !prediction && "border-destructive/40",
        )}
      >
        <div className={LABEL}>Prediction</div>
        <div className="mt-2 text-lg font-extrabold leading-tight">
          {loading
            ? "Menyusun prediction…"
            : prediction
              ? prediction.question
              : "Prediction belum tersedia"}
        </div>
        <div className="mt-2.5 flex items-baseline gap-2.5">
          <span className="text-[42px] font-extrabold leading-none text-destructive">
            {prediction ? `${prediction.probability}%` : "--"}
          </span>
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-extrabold text-destructive">
            {prediction?.answer_label || "estimasi AI"}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {loading
            ? "Estimasi akan muncul setelah AI membaca sinyal berita dan sentimen."
            : prediction
              ? prediction.reasoning
              : "Prediction membutuhkan sinyal gabungan dari berita dan sentimen. Saat ini estimasi belum bisa dibentuk."}
        </p>
      </div>
    </section>
  );
}
