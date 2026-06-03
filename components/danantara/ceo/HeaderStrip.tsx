"use client";

import { Landmark, Radio, Siren } from "lucide-react";
import { useEffect, useState } from "react";
import type { CeoState } from "@/lib/danantara/ceo/types";

/** Headline strip: identity, LIVE badge, totals, alert count, Jakarta clock. Zero-click. */
export function HeaderStrip({ state }: { state: CeoState }) {
  const totalMentions = state.issues.reduce((a, i) => a + i.mentions, 0);
  const netSentiment = Math.round(state.bumn.reduce((a, b) => a + b.sentiment, 0) / Math.max(1, state.bumn.length));
  const alerts = state.issues.filter((i) => i.status !== "normal").length;
  const escalating = state.issues.some((i) => i.status === "escalating");

  const [clock, setClock] = useState("");
  useEffect(() => {
    const update = () =>
      setClock(
        new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" }),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div data-testid="ceo-header" className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-primary" />
        <div>
          <div className="text-sm font-semibold leading-tight">Danantara — CEO Command</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Intelijen Media &amp; Sentimen BUMN</div>
        </div>
      </div>

      <span className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-success">
        <Radio className="h-3 w-3 animate-pulse" /> Live
      </span>

      <Metric label="Total Sebutan" value={totalMentions.toLocaleString("id-ID")} />
      <Metric
        label="Sentimen Bersih BUMN"
        value={`${netSentiment > 0 ? "+" : ""}${netSentiment}`}
        tone={netSentiment >= 10 ? "text-success" : netSentiment <= -10 ? "text-destructive" : "text-warning"}
      />
      <div className={escalating ? "ceo-siren rounded-md" : undefined}>
        <Metric
          label="Peringatan Aktif"
          value={String(alerts)}
          tone={escalating ? "text-destructive" : alerts > 0 ? "text-warning" : "text-success"}
          icon={escalating ? <Siren className="h-4 w-4 text-destructive" /> : undefined}
        />
      </div>

      <div className="ml-auto text-right">
        <div className="font-mono text-lg tabular-nums leading-tight">{clock || "--:--:--"}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">WIB · Jakarta</div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2">
      {icon}
      <div>
        <div className={`font-mono text-lg font-semibold tabular-nums leading-tight ${tone ?? ""}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
