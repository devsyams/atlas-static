"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Radio, ShieldCheck, Sparkles } from "lucide-react";
import { BumnHeatboard } from "@/components/danantara/ceo/BumnHeatboard";
import { DetailModal, type DetailSelection } from "@/components/danantara/ceo/DetailModal";
import { IssueBoard } from "@/components/danantara/ceo/IssueBoard";
import { fmtCount } from "@/lib/danantara/ceo/format";
import { POLDA_TOPICS, POLRI_DETAIL_STATE, POLRI_WEEKLY_STATE } from "@/lib/polri/mock";

function PolriHeader() {
  const totalMentions = POLRI_WEEKLY_STATE.issues.reduce((total, issue) => total + issue.mentions, 0);
  const avgSentiment = Math.round(
    POLRI_WEEKLY_STATE.issues.reduce((total, issue) => total + issue.sentiment, 0) / POLRI_WEEKLY_STATE.issues.length,
  );

  return (
    <div data-testid="polri-header" className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/95 p-1 shadow-sm">
          <Image src="/polri/polri.png" alt="Polri" width={42} height={42} priority className="h-full w-full object-contain" />
        </span>
        <div>
          <div className="text-xl font-semibold leading-tight">Polri - Executive Command</div>
          <div className="text-base uppercase tracking-[0.2em] text-muted-foreground">Public Sentiment &amp; Polda Intelligence</div>
        </div>
      </div>

      <span className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-base font-semibold uppercase tracking-widest text-warning">
        <Radio className="h-4 w-4" /> Mock Intelligence
      </span>

      <Metric label="Weekly Mentions" value={fmtCount(totalMentions)} />
      <Metric label="Net Sentiment" value={`${avgSentiment > 0 ? "+" : ""}${avgSentiment}`} tone={avgSentiment >= 0 ? "text-success" : "text-destructive"} />
    </div>
  );
}

function PolriTicker() {
  const topNegative = POLRI_WEEKLY_STATE.issues.find((issue) => issue.negMentions >= issue.posMentions);
  const topPositive = POLRI_WEEKLY_STATE.issues.find((issue) => issue.posMentions > issue.negMentions);

  return (
    <div data-testid="polri-ticker" className="panel flex items-center gap-3 px-4 py-2.5">
      <span className="flex shrink-0 items-center gap-1.5 text-base font-semibold uppercase tracking-[0.2em] text-primary">
        <Sparkles className="h-5 w-5" /> Nexorus AI
      </span>
      <p className="min-w-0 flex-1 truncate text-xl">
        Highest negative pressure: {topNegative?.title}. Positive counter-signal: {topPositive?.title}.
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center gap-2 px-2">
      <ShieldCheck className="h-5 w-5 text-primary/70" />
      <div>
        <div data-testid="metric-value" className={`font-mono text-2xl font-semibold tabular-nums leading-tight ${tone ?? ""}`}>
          {value}
        </div>
        <div className="text-base uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function PolriCommand() {
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const detailState = useMemo(() => POLRI_DETAIL_STATE, []);

  return (
    <div className="flex flex-col gap-3 xl:h-full">
      <PolriHeader />
      <PolriTicker />

      <div data-testid="polri-wall" className="grid grid-cols-1 gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-2">
        <div className="min-h-0">
          <IssueBoard
            issues={POLRI_WEEKLY_STATE.issues}
            brand="POLRI"
            boardTitle="POLRI ISSUE"
            onSelect={(id) => setDetail({ type: "issue", id })}
          />
        </div>
        <div className="min-h-0">
          <BumnHeatboard
            rows={POLRI_WEEKLY_STATE.bumn}
            issues={POLDA_TOPICS}
            boardTitle="Polda Sentiment"
            entityLabel="POLDA"
            entityPathBase="/polri/polda"
            logoPathBase="/polri/polda"
            showRankMovement={false}
            onSelectTopic={(id) => setDetail({ type: "issue", id })}
          />
        </div>
      </div>

      {detail && (
        <DetailModal
          selection={detail}
          state={detailState}
          onClose={() => setDetail(null)}
          onNavigate={setDetail}
          showRelatedDashboards={false}
        />
      )}
    </div>
  );
}
