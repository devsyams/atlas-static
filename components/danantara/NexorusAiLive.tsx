"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { SovereignSnapshot } from "@/lib/danantara/types";
import { cn } from "@/lib/utils";

type Tone = "good" | "warn" | "bad" | "info";

interface Observation {
  text: string;
  tone: Tone;
}

const TONE: Record<Tone, { border: string; text: string; dot: string }> = {
  good: { border: "border-success/50", text: "text-success", dot: "bg-success" },
  warn: { border: "border-warning/50", text: "text-warning", dot: "bg-warning" },
  bad: { border: "border-destructive/50", text: "text-destructive", dot: "bg-destructive" },
  info: { border: "border-primary/50", text: "text-primary", dot: "bg-primary" },
};

/** Derive a rotating set of live AI observations from the actual snapshot. */
function buildObservations(d: SovereignSnapshot): Observation[] {
  const m = d.media;
  const topMover = [...d.holdings].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))[0];
  const topIssue = [...m.issues].sort((a, b) => b.sentiment * b.salience - a.sentiment * a.salience)[0];
  const crisis = [...m.crisis].sort((a, b) => b.severity - a.severity)[0];
  const hoax = m.hoaxes[0];
  const pred = d.predictions[0];

  const obs: Observation[] = [
    { text: `Indeks Reputasi ${m.reputation.score}/100 — ${m.reputation.level}. ${m.reputation.trend === "down" ? "Tren melemah, pantau." : "Persepsi terjaga."}`, tone: m.reputation.score >= 65 ? "good" : m.reputation.score >= 50 ? "warn" : "bad" },
    { text: `Sinyal dini: "${crisis.title}" di ${crisis.entity} melonjak +${crisis.velocity}% — status ${crisis.status}.`, tone: crisis.severity >= 6 ? "bad" : "warn" },
    { text: `Isu memanas: "${topIssue.label}" (${topIssue.delta >= 0 ? "+" : ""}${topIssue.delta} salience). Siapkan narasi tandingan.`, tone: "warn" },
    { text: `Sentimen net ${m.totals.net_sentiment >= 0 ? "+" : ""}${m.totals.net_sentiment} · ${m.totals.mentions_24h.toLocaleString("id-ID")} sebutan/24 jam · jangkauan ${(m.totals.reach / 1e6).toFixed(0)} jt.`, tone: m.totals.net_sentiment >= 0 ? "good" : "bad" },
    { text: `Penggerak portofolio: ${topMover.short} ${topMover.change_pct >= 0 ? "+" : ""}${topMover.change_pct}% hari ini.`, tone: topMover.change_pct >= 0 ? "good" : "bad" },
    { text: `Hoaks terpantau: "${hoax.claim.replace(/"/g, "")}" — ${hoax.status} (jangkauan ${(hoax.reach / 1e6).toFixed(1)} jt).`, tone: hoax.status === "Terbantahkan" ? "good" : "bad" },
    { text: `Prediksi AI: ${pred.question} → ${pred.probability}% ${pred.answer_label}.`, tone: "info" },
    { text: `Dividen YTD ${d.dividend_ytd_t.toLocaleString("id-ID")} T · imbal hasil ${d.ytd_return_pct >= 0 ? "+" : ""}${d.ytd_return_pct}% — arus kas negara solid.`, tone: "good" },
  ];
  return obs;
}

const PERIOD = 9000;

/**
 * "Nexorus AI Live" — an ambient neural orb that streams real-time AI observations
 * derived from the live snapshot (typewriter effect). Pure gimmick: makes the
 * dashboard feel continuously, intelligently monitored. Pauses on hover.
 */
export function NexorusAiLive({ data }: { data: SovereignSnapshot | null }) {
  const observations = useMemo(() => (data ? buildObservations(data) : []), [data]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState(true);

  // Advance to the next observation on a fixed cadence (paused on hover).
  useEffect(() => {
    if (paused || observations.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % observations.length), PERIOD);
    return () => clearInterval(id);
  }, [paused, observations.length]);

  // Typewriter for the current observation.
  useEffect(() => {
    const full = observations[idx % Math.max(1, observations.length)]?.text ?? "";
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [idx, observations]);

  if (!data || !observations.length || !open) return null;
  const ob = observations[idx % observations.length];
  const tone = TONE[ob.tone];

  return (
    <div
      className={cn("dn-slide-in fixed bottom-10 right-4 z-[60] w-[320px] overflow-hidden rounded-xl border bg-popover/95 shadow-[0_18px_50px_oklch(0.05_0.02_260/.6)] backdrop-blur-xl", tone.border)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-start gap-2.5 p-3">
        {/* neural orb */}
        <div className="relative mt-0.5 h-9 w-9 shrink-0">
          <span className="syn-pulse absolute inset-0 rounded-full border border-primary/40" />
          <span className="syn-ring absolute inset-0 rounded-full" />
          <div className="syn-core absolute inset-[7px] flex items-center justify-center rounded-full bg-gradient-accent text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", tone.dot)} />
            <span className="text-gradient text-[10px] font-extrabold uppercase tracking-[0.16em]">Nexorus AI · Live</span>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-foreground/90">
            {typed}
            <span className={cn("dn-caret", tone.text)} />
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Tutup"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* cadence progress bar (restarts each observation) */}
      <div className="h-0.5 w-full bg-white/5">
        <div
          key={idx}
          className="dn-progress h-full bg-gradient-accent"
          style={{ animationDuration: `${PERIOD}ms`, animationPlayState: paused ? "paused" : "running" }}
        />
      </div>
    </div>
  );
}
