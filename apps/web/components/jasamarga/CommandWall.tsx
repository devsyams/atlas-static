"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Radio, X } from "lucide-react";
import type { OpsSnapshot } from "@/lib/jasamarga/types";
import { loadColor } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";

const SLIDE_MS = 7000;

interface Slide {
  label: string;
  render: () => ReactNode;
}

function fmt(n: number): string {
  return n.toLocaleString("id-ID");
}

function buildSlides(d: OpsSnapshot): Slide[] {
  const slides: Slide[] = [];
  const accent = loadColor(d.load_index);

  slides.push({
    label: "Indeks Beban",
    render: () => (
      <div className="text-center">
        <div className="text-[7rem] leading-none">{d.emoji}</div>
        <div className="mt-2 text-[8rem] font-extrabold leading-none tabular-nums" style={{ color: accent }}>
          {d.load_index.toFixed(1)}
          <span className="text-5xl text-muted-foreground">/10</span>
        </div>
        <div className="mt-2 text-4xl font-bold uppercase tracking-wide" style={{ color: accent }}>
          {d.level}
        </div>
        <div className="mt-6 text-xl text-muted-foreground">
          {d.corridor} · {d.avg_speed} km/j rata-rata · {d.active_incidents} insiden aktif · {fmt(d.vehicles_now)} kendaraan
        </div>
      </div>
    ),
  });

  slides.push({
    label: "Insight Utama",
    render: () => (
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-5xl font-extrabold leading-tight text-foreground">{d.insight.title}</h2>
        <p className="mx-auto mt-6 max-w-3xl text-2xl leading-relaxed text-muted-foreground">{d.insight.text}</p>
        {d.insight.action && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/30 bg-primary/10 px-6 py-5">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Rekayasa Disarankan</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{d.insight.action}</div>
          </div>
        )}
      </div>
    ),
  });

  const p = d.predictions[0];
  if (p) {
    const col = loadColor(p.tone === "negative" ? 9 : p.tone === "neutral" ? 5 : 1);
    slides.push({
      label: "Proyeksi Prioritas",
      render: () => (
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold leading-tight text-foreground">{p.question}</h2>
          <div className="mt-8 text-[9rem] font-extrabold leading-none tabular-nums" style={{ color: col }}>
            {p.probability}%
          </div>
          <div className="mt-2 text-3xl font-bold" style={{ color: col }}>
            {p.answer_label}
            {p.timeframe ? <span className="text-muted-foreground"> · {p.timeframe}</span> : null}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-muted-foreground">{p.reasoning}</p>
        </div>
      ),
    });
  }

  const incidents = [...d.incidents].sort((a, b) => b.severity - a.severity).slice(0, 4);
  if (incidents.length) {
    slides.push({
      label: "Insiden Prioritas",
      render: () => (
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="mb-8 text-center text-4xl font-extrabold text-foreground">Insiden Prioritas</h2>
          <div className="space-y-3">
            {incidents.map((c) => (
              <div key={c.id} className="flex items-center gap-5 rounded-xl border border-border/60 bg-card/40 px-6 py-4">
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: loadColor(c.severity) }}>
                  {c.severity.toFixed(1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl font-bold text-foreground">
                    {c.type} <span className="text-lg font-medium text-muted-foreground">· {c.km}</span>
                  </div>
                  <div className="text-base text-muted-foreground">
                    {c.lanes_blocked}/{c.lanes_total} lajur · {c.status} · {c.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  const ruas = [...d.top_ruas].sort((a, b) => b.load - a.load).slice(0, 5);
  if (ruas.length) {
    slides.push({
      label: "Titik Beban",
      render: () => (
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="mb-8 text-center text-4xl font-extrabold text-foreground">Titik Beban Teratas</h2>
          <div className="space-y-3">
            {ruas.map((c, i) => (
              <div key={c.name} className="flex items-center gap-5 rounded-xl border border-border/60 bg-card/40 px-6 py-4">
                <span className="text-3xl font-extrabold text-muted-foreground/60">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl font-bold text-foreground">
                    {c.name} <span className="text-lg font-medium text-muted-foreground">· {c.km_range}</span>
                  </div>
                  <div className="text-base text-muted-foreground">
                    {c.speed} km/j · {c.dominant}
                  </div>
                </div>
                <span className="text-3xl font-extrabold tabular-nums" style={{ color: loadColor(c.load) }}>
                  {c.load.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  return slides;
}

export function CommandWall({ open, onClose, data }: { open: boolean; onClose: () => void; data: OpsSnapshot | null }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState("");

  const slides = data ? buildSlides(data) : [];
  const count = slides.length;

  const next = useCallback(() => setIndex((i) => (count ? (i + 1) % count : 0)), [count]);
  const prev = useCallback(() => setIndex((i) => (count ? (i - 1 + count) % count : 0)), [count]);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setPaused(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const tick = () => setClock(new Date().toLocaleTimeString("id-ID"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, next, prev]);

  useEffect(() => {
    if (!open || paused || count <= 1) return;
    const id = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(id);
  }, [open, paused, index, count, next]);

  if (!open || !count) return null;
  const slide = slides[index];

  return (
    <div className="fixed inset-0 z-[1800] flex flex-col bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.05_270),oklch(0.12_0.02_260)_60%)] text-foreground">
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-accent text-primary-foreground">
            <Radio className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-gradient text-sm font-bold tracking-wide">JMTC · COMMAND WALL</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{slide.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-sm tabular-nums text-muted-foreground sm:block">{clock}</span>
          <span className="text-sm text-muted-foreground">
            {index + 1} / {count}
          </span>
          <button type="button" onClick={() => setPaused((v) => !v)} className="rounded-md border border-border bg-background/40 p-2 text-muted-foreground hover:text-foreground" aria-label={paused ? "Lanjutkan" : "Jeda"}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-background/40 p-2 text-muted-foreground hover:text-foreground" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-10">
        <button type="button" onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/40 p-3 text-muted-foreground hover:text-foreground" aria-label="Sebelumnya">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div key={index} className="war-slide w-full">
          {slide.render()}
        </div>
        <button type="button" onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/40 p-3 text-muted-foreground hover:text-foreground" aria-label="Berikutnya">
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="shrink-0 px-6 pb-5">
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          {!paused && <div key={index} className="war-progress-bar h-full rounded-full bg-gradient-accent" style={{ animationDuration: `${SLIDE_MS}ms` }} />}
        </div>
        <div className="flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button key={s.label} type="button" onClick={() => setIndex(i)} aria-label={s.label} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-8 bg-primary" : "w-1.5 bg-white/20 hover:bg-white/40")} />
          ))}
        </div>
      </div>
    </div>
  );
}
