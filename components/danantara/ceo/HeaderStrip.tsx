"use client";

import Image from "next/image";
import { Radio, RotateCw } from "lucide-react";
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
  source?: "live" | "loading" | "offline";
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const totalMentions = state.issues.reduce((a, i) => a + i.mentions, 0);

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
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/95 p-1 shadow-sm">
          <Image src="/danantara.png" alt="Danantara" width={36} height={36} priority className="h-full w-full object-contain" />
        </span>
        <div>
          <div className="text-xl font-semibold leading-tight">Danantara — CEO Command</div>
          <div className="text-base uppercase tracking-[0.2em] text-muted-foreground">Media Intelligence &amp; BUMN Sentiment</div>
        </div>
      </div>

      {source === "live" ? (
        <span className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-base font-semibold uppercase tracking-widest text-success">
          <Radio className="h-4 w-4 animate-pulse" /> Live
        </span>
      ) : source === "offline" ? (
        <span className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-base font-semibold uppercase tracking-widest text-destructive">
          <Radio className="h-4 w-4" /> Offline
        </span>
      ) : (
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1 text-base font-semibold uppercase tracking-widest text-muted-foreground">
          <Radio className="h-4 w-4" /> Loading
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
