"use client";

import { Landmark, Radio, RotateCw, Siren } from "lucide-react";
import { useEffect, useState } from "react";
import type { CeoState } from "@/lib/danantara/ceo/types";

/**
 * Headline strip: identity, LIVE badge, totals, alert count, Jakarta clock.
 * Zero-click. Type sizes follow the CEO readability scale (AC15).
 */
export function HeaderStrip({
  state,
  source = "live",
  onRefresh,
  refreshing = false,
}: {
  state: CeoState;
  source?: "live" | "fallback";
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
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
      <div className="flex items-center gap-2.5">
        <Landmark className="h-7 w-7 text-primary" />
        <div>
          <div className="text-xl font-semibold leading-tight">Danantara — CEO Command</div>
          <div className="text-base uppercase tracking-[0.2em] text-muted-foreground">Media Intelligence &amp; BUMN Sentiment</div>
        </div>
      </div>

      {source === "live" ? (
        <span className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-base font-semibold uppercase tracking-widest text-success">
          <Radio className="h-4 w-4 animate-pulse" /> Live
        </span>
      ) : (
        <span className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-base font-semibold uppercase tracking-widest text-warning">
          <Radio className="h-4 w-4" /> Sample data
        </span>
      )}

      {onRefresh && (
        <button
          type="button"
          data-testid="ceo-refresh"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh — re-fetch the latest topics from the live feed"
          className="flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      )}

      <Metric label="Total Mentions" value={totalMentions.toLocaleString("en-US")} />
      <Metric
        label="Net BUMN Sentiment"
        value={`${netSentiment > 0 ? "+" : ""}${netSentiment}`}
        tone={netSentiment >= 10 ? "text-success" : netSentiment <= -10 ? "text-destructive" : "text-warning"}
      />
      <div className={escalating ? "ceo-siren rounded-md" : undefined}>
        <Metric
          label="Active Alerts"
          value={String(alerts)}
          tone={escalating ? "text-destructive" : alerts > 0 ? "text-warning" : "text-success"}
          icon={escalating ? <Siren className="h-5 w-5 text-destructive" /> : undefined}
        />
      </div>

      <div className="ml-auto text-right">
        <div data-testid="metric-value" className="font-mono text-2xl tabular-nums leading-tight">{clock || "--:--:--"}</div>
        <div className="text-base uppercase tracking-[0.2em] text-muted-foreground">WIB · Jakarta</div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2">
      {icon}
      <div>
        <div data-testid="metric-value" className={`font-mono text-2xl font-semibold tabular-nums leading-tight ${tone ?? ""}`}>{value}</div>
        <div className="text-base uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
