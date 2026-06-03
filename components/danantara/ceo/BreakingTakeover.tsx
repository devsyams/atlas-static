"use client";

import { Siren } from "lucide-react";
import type { CeoIssue } from "@/lib/danantara/ceo/types";

/** Full-screen breaking-news interrupt. Fires on a status transition to "escalating". */
export function BreakingTakeover({ issue }: { issue: CeoIssue }) {
  return (
    <div
      data-testid="ceo-takeover"
      className="ceo-takeover fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm"
    >
      <div className="ceo-siren flex items-center gap-3 rounded-full border-2 border-destructive bg-destructive/15 px-6 py-2">
        <Siren className="h-6 w-6 text-destructive" />
        <span className="text-lg font-black uppercase tracking-[0.3em] text-destructive">Isu Tereskalasi</span>
        <Siren className="h-6 w-6 text-destructive" />
      </div>

      <h1 className="max-w-4xl px-8 text-center text-4xl font-bold leading-tight">{issue.title}</h1>

      <div className="flex items-center gap-10 font-mono tabular-nums">
        <Stat label="Lonjakan 2 jam" value={`+${Math.round(issue.velocity)}%`} accent />
        <Stat label="Jangkauan" value={`${(issue.reach / 1_000_000).toFixed(1)} jt`} />
        <Stat label="Sebutan" value={issue.mentions.toLocaleString("id-ID")} />
      </div>

      <p className="max-w-2xl px-8 text-center text-sm text-muted-foreground">{issue.aiLine}</p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${accent ? "text-destructive" : ""}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
    </div>
  );
}
