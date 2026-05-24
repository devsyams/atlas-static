import { Hash, Zap } from "lucide-react";
import type { DashboardData } from "@/lib/mbg/types";
import { scoreColor } from "@/lib/mbg/colors";
import { Keywords } from "./Keywords";

/** Insert an alpha channel into an `oklch(L C H)` string. */
function withAlpha(oklch: string, a: number): string {
  return oklch.replace(/\)\s*$/, ` / ${a})`);
}

/** Dramatic Insight widget: severity-tinted hero headline + a keyword cloud. */
export function InsightPanel({ data }: { data: DashboardData | null }) {
  const accent = data ? scoreColor(data.score) : "oklch(0.78 0.16 80)";
  const title = data
    ? data.insight?.title ?? "Insight belum tersedia"
    : "Menyusun insight…";
  const text = data
    ? data.insight?.text ?? "Belum cukup sinyal untuk menyusun insight."
    : "Analisis akan muncul setelah sinyal artikel dan sentimen siap.";
  const keywords = data?.top_keywords ?? [];
  const action = data?.insight?.action;

  return (
    <div className="relative h-full p-3.5 pl-4">
      {/* severity glow + accent rail */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(130% 110% at 0% 0%, ${withAlpha(accent, 0.16)}, transparent 58%)` }}
      />
      <div
        className="pointer-events-none absolute left-0 top-0 h-full w-[3px]"
        style={{ background: accent, boxShadow: `0 0 16px ${withAlpha(accent, 0.9)}` }}
      />

      <div className="relative z-[1] flex h-full flex-col">
        {/* kicker + severity ribbon */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ background: accent }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: accent }}
              />
            </span>
            <span className="text-gradient text-[10px] font-bold uppercase tracking-[0.18em]">
              Analisis Nexorus AI
            </span>
          </span>
          {data && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-current/30 bg-current/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
              style={{ color: accent }}
            >
              {data.emoji} {data.level}
            </span>
          )}
        </div>

        {/* hero headline */}
        <h3 className="mt-2.5 text-lg font-extrabold leading-[1.15] text-foreground sm:text-xl">
          {title}
        </h3>

        {/* analysis body */}
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{text}</p>

        {/* recommended action — the "so what / now what" callout */}
        {action && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              <Zap className="h-3.5 w-3.5" />
              Tindakan Disarankan
            </div>
            <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-foreground/90">
              {action}
            </p>
          </div>
        )}

        {/* detected keywords — a frequency-scaled cloud filling the remaining space */}
        {keywords.length > 0 && (
          <div className="mt-3.5 flex min-h-0 flex-1 flex-col pt-1">
            <div className="mb-1 flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-foreground/75">
                <Hash className="h-4 w-4 text-primary" />
                Kata Kunci Terdeteksi
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
            </div>
            <div className="flex flex-1 items-center justify-center overflow-hidden py-1">
              <Keywords bare keywords={keywords} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
