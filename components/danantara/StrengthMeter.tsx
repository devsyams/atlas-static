"use client";

import { useEffect, useRef } from "react";
import { ShieldHalf, TrendingDown, TrendingUp, Minus, FlaskConical } from "lucide-react";
import { CountUp } from "@/components/crisis/CountUp";
import { strengthColor } from "@/lib/danantara/ui";
import type { StrengthIndex } from "@/lib/danantara/types";

const W = 280;
const H = 150;

/** Animated semicircular 0–100 gauge that sweeps to the score on mount/change. */
function Gauge({ score }: { score: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    let raf = 0;
    const start = performance.now();
    const duration = reduce ? 0 : 900;

    const draw = (value: number) => {
      const cx = W / 2;
      const cy = 132;
      const r = 96;
      const lw = 16;
      ctx.clearRect(0, 0, W, H);
      const a0 = Math.PI;
      const pct = Math.max(0, Math.min(1, value / 100));
      // track
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, 2 * Math.PI);
      ctx.lineWidth = lw;
      ctx.strokeStyle = "oklch(0.32 0.03 265 / 0.45)";
      ctx.lineCap = "round";
      ctx.stroke();
      // value arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + pct * Math.PI);
      ctx.lineWidth = lw;
      ctx.strokeStyle = strengthColor(value);
      ctx.lineCap = "round";
      ctx.shadowBlur = 18;
      ctx.shadowColor = strengthColor(value);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // needle
      const ang = a0 + pct * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (r - lw) * Math.cos(ang), cy + (r - lw) * Math.sin(ang));
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "oklch(0.92 0.02 240)";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "oklch(0.92 0.02 240)";
      ctx.fill();
    };

    if (duration === 0) {
      draw(score);
      fromRef.current = score;
      return;
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      draw(from + (score - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = score;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return <canvas ref={ref} className="block" />;
}

function TrendIcon({ trend }: { trend: StrengthIndex["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function StrengthMeter({ strength, stressed }: { strength: StrengthIndex; stressed: boolean }) {
  const color = strengthColor(strength.score);
  const maxPenalty = Math.max(1, ...strength.factors.map((f) => f.penalty));

  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden p-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <ShieldHalf className="h-3.5 w-3.5 text-primary" /> Sovereign Resilience Index
      </div>

      <div className="relative mt-1">
        <Gauge score={strength.score} />
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
          <div className="text-[44px] font-extrabold leading-none tabular-nums" style={{ color }}>
            <CountUp value={strength.score} />
          </div>
          <div className="text-[10px] font-semibold text-muted-foreground">/ 100</div>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-sm font-bold"
          style={{ color, background: "color-mix(in oklab, currentColor 14%, transparent)" }}
        >
          {strength.emoji} {strength.level}
        </span>
        {stressed ? (
          <span className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning">
            <FlaskConical className="h-3 w-3" /> mode stres
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <TrendIcon trend={strength.trend} />
            {strength.delta > 0 ? `+${strength.delta}` : strength.delta} vs sesi lalu
          </span>
        )}
      </div>

      <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">{strength.narrative}</p>

      <div className="mt-2 w-full space-y-1">
        {strength.factors.map((f) => (
          <div key={f.key} className="flex items-center gap-2 text-[10px]">
            <span className="w-28 shrink-0 truncate text-muted-foreground">{f.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${(f.penalty / maxPenalty) * 100}%`, background: strengthColor(100 - f.penalty * 4) }}
              />
            </div>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">−{f.penalty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
