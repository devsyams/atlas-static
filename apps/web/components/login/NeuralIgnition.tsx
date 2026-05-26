"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { scoreColor } from "@/lib/mbg/colors";
import type { DashboardData } from "@/lib/mbg/types";

const TOTAL = 3500;
const PROG_DUR = 3000;

// Boot steps wired to the live crisis dataset.
function makeSteps(data: DashboardData | null) {
  const articles = data?.article_count ?? 0;
  const mapped = data?.mapped_article_count ?? 0;
  const topCity = data?.top_cities?.[0]?.city ?? "—";
  const level = data?.level ?? "—";
  const score = data?.score ?? 0;
  const actors = data?.actor_thread_analysis?.actors.length ?? 0;
  return [
    { label: "AUTHENTICATING OPERATOR", at: 8 },
    { label: "ESTABLISHING SECURE UPLINK", at: 19 },
    { label: `INGESTING ${articles.toLocaleString()} ARTICLES`, at: 31 },
    { label: `GEO-MAPPING ${mapped} INCIDENTS`, at: 45 },
    { label: `RANKING HOTSPOTS · ${topCity.toUpperCase()}`, at: 59 },
    { label: `PROFILING ${actors} ACTORS`, at: 72 },
    { label: "CALIBRATING AI ENGINE", at: 86 },
    { label: `CRISIS INDEX · ${level} ${score.toFixed(1)}`, at: 100 },
  ];
}

// --- palette (raw oklch for canvas) ---
const C_PRIMARY = "oklch(0.80 0.15 230)";
const C_ACCENT = "oklch(0.64 0.20 288)";
const C_BRIGHT = "oklch(0.96 0.06 220)";
const oklcha = (base: string, a: number) => base.replace(")", ` / ${a})`);

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Node {
  x: number;
  y: number;
  dist: number;
  size: number;
  hub: boolean;
  accent: boolean;
  tw: number;
}
interface Edge {
  a: number;
  b: number;
  born: number;
}
interface Pulse {
  e: number;
  speed: number;
  offset: number;
}
interface Scene {
  cx: number;
  cy: number;
  maxDist: number;
  nodes: Node[];
  edges: Edge[];
  pulses: Pulse[];
}

function buildScene(W: number, H: number): Scene {
  const cx = W / 2;
  const cy = H / 2;
  const maxDist = Math.hypot(cx, cy);
  const N = clamp(Math.round((W * H) / 24000), 50, 96);
  const nodes: Node[] = [];

  for (let i = 0; i < N; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.pow(Math.random(), 0.7) * maxDist;
    const x = clamp(cx + Math.cos(ang) * rr * (0.9 + Math.random() * 0.4), 12, W - 12);
    const y = clamp(cy + Math.sin(ang) * rr * (0.7 + Math.random() * 0.5), 12, H - 12);
    const hub = Math.random() < 0.12;
    nodes.push({
      x,
      y,
      dist: Math.hypot(x - cx, y - cy),
      size: hub ? 3 + Math.random() * 2 : 1.2 + Math.random() * 1.6,
      hub,
      accent: Math.random() < 0.22,
      tw: Math.random() * Math.PI * 2,
    });
  }

  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < N; i++) {
    const near: [number, number][] = [];
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      near.push([Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y), j]);
    }
    near.sort((p, q) => p[0] - q[0]);
    const k = nodes[i].hub ? 4 : 2;
    for (let n = 0; n < k && n < near.length; n++) {
      const [d, j] = near[n];
      if (d > 270) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: i, b: j, born: Math.max(nodes[i].dist, nodes[j].dist) });
    }
  }

  const pulses: Pulse[] = [];
  edges.forEach((_, e) => {
    if (Math.random() < 0.22)
      pulses.push({ e, speed: 0.0006 + Math.random() * 0.001, offset: Math.random() });
  });

  return { cx, cy, maxDist, nodes, edges, pulses };
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  s: Scene,
  W: number,
  H: number,
  elapsed: number,
) {
  const { cx, cy, maxDist, nodes, edges, pulses } = s;
  ctx.clearRect(0, 0, W, H);

  const front = easeOutCubic(clamp((elapsed - 260) / 1700, 0, 1)) * maxDist * 1.08;
  const coreA = clamp(elapsed / 420, 0, 1);

  // core (additive)
  const pulse = 1 + 0.08 * Math.sin(elapsed * 0.006);
  const R = 130 * pulse * (0.4 + 0.6 * coreA);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, oklcha(C_BRIGHT, 0.95 * coreA));
  g.addColorStop(0.25, oklcha(C_PRIMARY, 0.55 * coreA));
  g.addColorStop(0.6, oklcha(C_ACCENT, 0.22 * coreA));
  g.addColorStop(1, oklcha(C_ACCENT, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // scan rings
  for (const startMs of [1500, 2400]) {
    const t = (elapsed - startMs) / 1500;
    if (t < 0 || t > 1) continue;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.32;
    ctx.strokeStyle = C_PRIMARY;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, easeOutCubic(t) * maxDist * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // edges
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C_PRIMARY;
  for (const edge of edges) {
    const ea = clamp((front - edge.born) / 80, 0, 1);
    if (ea <= 0) continue;
    const A = nodes[edge.a];
    const B = nodes[edge.b];
    ctx.globalAlpha = ea * 0.16;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  }
  ctx.restore();

  // nodes
  ctx.save();
  for (const node of nodes) {
    const na = clamp((front - node.dist) / 60, 0, 1);
    if (na <= 0) continue;
    const tw = (Math.sin(node.tw + elapsed * 0.004) + 1) / 2;
    const col = node.accent ? C_ACCENT : C_PRIMARY;
    ctx.globalAlpha = na * (0.5 + 0.5 * tw);
    ctx.shadowBlur = node.hub ? 16 : 8;
    ctx.shadowColor = col;
    ctx.fillStyle = node.hub ? C_BRIGHT : col;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.size * (0.6 + 0.4 * na), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // travelling pulses
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = C_BRIGHT;
  ctx.fillStyle = C_BRIGHT;
  for (const p of pulses) {
    const edge = edges[p.e];
    const ea = clamp((front - edge.born) / 80, 0, 1);
    if (ea < 0.6) continue;
    const A = nodes[edge.a];
    const B = nodes[edge.b];
    const u = (elapsed * p.speed + p.offset) % 1;
    ctx.globalAlpha = ea;
    ctx.beginPath();
    ctx.arc(A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // bright center spark
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 24;
  ctx.shadowColor = C_PRIMARY;
  ctx.fillStyle = oklcha(C_BRIGHT, coreA);
  ctx.beginPath();
  ctx.arc(cx, cy, 3.6 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // end bloom
  if (elapsed > 2700) {
    const b = clamp((elapsed - 2700) / 700, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist * 1.2);
    bg.addColorStop(0, oklcha(C_BRIGHT, 0.5 * b));
    bg.addColorStop(0.5, oklcha(C_PRIMARY, 0.18 * b));
    bg.addColorStop(1, oklcha(C_PRIMARY, 0));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

export function NeuralIgnition({
  onComplete,
  data,
}: {
  onComplete: () => void;
  data: DashboardData | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [granted, setGranted] = useState(false);
  const [flash, setFlash] = useState(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setProgress(100);
    setGranted(true);
    setFlash(true);
    setTimeout(onComplete, 280);
  }, [onComplete]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setProgress(100);
      setGranted(true);
      const id = setTimeout(onComplete, 600);
      return () => clearTimeout(id);
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const scene = buildScene(W, H);
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      drawScene(ctx, scene, W, H, elapsed);
      setProgress(Math.round(easeInOutCubic(clamp(elapsed / PROG_DUR, 0, 1)) * 100));
      if (elapsed >= PROG_DUR) setGranted(true);
      if (elapsed >= 3120) setFlash(true);
      if (elapsed >= TOTAL) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [finish, onComplete]);

  const steps = useMemo(() => makeSteps(data), [data]);
  const firstPending = steps.findIndex((s) => progress < s.at);
  const currentLabel = firstPending === -1 ? "NEXORUS AI ONLINE" : steps[firstPending].label;

  const score = data?.score ?? 0;
  const level = data?.level ?? "—";
  const articleCount = data?.article_count ?? 0;
  const mappedCount = data?.mapped_article_count ?? 0;
  const liveArticles = Math.round((progress / 100) * articleCount);
  const liveMapped = Math.round((progress / 100) * mappedCount);
  const liveScore = (progress / 100) * score;

  const R = 120;
  const CIRC = 2 * Math.PI * R;

  return (
    <div
      className="ig-backdrop fixed inset-0 z-[2000] cursor-pointer overflow-hidden"
      onClick={finish}
      role="presentation"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.22_0.08_270/.55),transparent_60%),radial-gradient(ellipse_at_bottom,oklch(0.18_0.10_240/.45),transparent_60%)]" />
      <div className="absolute inset-0 bg-background/40" />

      {/* neural network */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 font-mono">
        {/* brand */}
        <div className="ig-rise absolute left-6 top-6 flex items-center gap-2.5" style={{ animationDelay: "0.1s" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-accent shadow-[var(--shadow-glow)]">
            <Image src="/nexorus-icon.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </span>
          <div className="leading-tight">
            <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Nexorus</div>
            <div className="text-gradient text-xs font-bold tracking-[0.12em]">NEXORUS AI CORE</div>
          </div>
        </div>

        {/* telemetry */}
        <div
          className="ig-rise absolute right-6 top-6 space-y-1 text-right text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
          style={{ animationDelay: "0.22s" }}
        >
          <div>
            FEED ▸{" "}
            <span className="text-primary">
              {progress < 6 ? "———" : `${liveArticles.toLocaleString()} art`}
            </span>
          </div>
          <div>
            INCIDENTS ▸{" "}
            <span className="text-primary">
              {liveMapped}/{mappedCount}
            </span>
          </div>
          <div>
            INDEX ▸ <span style={{ color: scoreColor(score) }}>{liveScore.toFixed(1)}/10</span>
          </div>
        </div>

        {/* core ring */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className="relative h-[300px] w-[300px]">
            <svg width="300" height="300" viewBox="0 0 300 300" className="block">
              <defs>
                <linearGradient id="ig-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.15 230)" />
                  <stop offset="100%" stopColor="oklch(0.64 0.20 288)" />
                </linearGradient>
              </defs>
              <circle cx="150" cy="150" r={R} fill="none" stroke="oklch(0.32 0.03 265 / 0.5)" strokeWidth="2" />
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke="url(#ig-grad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress / 100)}
                transform="rotate(-90 150 150)"
                style={{
                  transition: "stroke-dashoffset 0.12s linear",
                  filter: "drop-shadow(0 0 6px oklch(0.78 0.14 230 / 0.7))",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {granted ? (
                <>
                  <div className="ig-granted text-gradient text-xl font-extrabold uppercase tracking-[0.18em]">
                    Access Granted
                  </div>
                  <div
                    className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.26em]"
                    style={{ color: scoreColor(score) }}
                  >
                    {level} · INDEX {score.toFixed(1)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-5xl font-bold tabular-nums tracking-tight text-foreground">
                    {progress}
                    <span className="ml-0.5 text-2xl text-muted-foreground">%</span>
                  </div>
                  <div className="mt-2 text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                    Initializing
                  </div>
                </>
              )}
            </div>
          </div>
          {!granted && (
            <div className="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-primary">
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-primary/40 border-t-primary" />
              {currentLabel}
            </div>
          )}
        </div>

        {/* boot log */}
        <div
          className="ig-rise absolute bottom-8 left-1/2 w-[min(92vw,420px)] -translate-x-1/2 rounded-lg border border-border/60 bg-background/30 p-3 backdrop-blur-md"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>Boot Sequence</span>
            <span className="text-primary">SYS / {String(progress).padStart(3, "0")}</span>
          </div>
          <div className="space-y-1.5">
            {steps.map((s, i) => {
              const status = progress >= s.at ? "done" : i === firstPending ? "active" : "pending";
              return (
                <div key={s.label} className="flex items-center gap-2 text-[10px]">
                  <span className="flex w-3 justify-center">
                    {status === "done" ? (
                      <span className="text-primary">✓</span>
                    ) : status === "active" ? (
                      <span className="inline-block h-2 w-2 animate-spin rounded-full border border-primary/40 border-t-primary" />
                    ) : (
                      <span className="text-muted-foreground/40">·</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "tracking-[0.08em]",
                      status === "pending"
                        ? "text-muted-foreground/45"
                        : status === "active"
                          ? "text-foreground"
                          : "text-foreground/70",
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="h-px flex-1 border-b border-dashed border-border/40" />
                  <span
                    className={cn(
                      "tabular-nums",
                      status === "done"
                        ? "text-primary"
                        : status === "active"
                          ? "text-muted-foreground"
                          : "text-transparent",
                    )}
                  >
                    {status === "done" ? "OK" : status === "active" ? "···" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* skip hint */}
        <div
          className="ig-rise absolute bottom-3 right-6 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60"
          style={{ animationDelay: "1s" }}
        >
          click anywhere to skip
        </div>
      </div>

      {/* flash to reveal */}
      <div
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.97 0.05 220), oklch(0.85 0.12 240) 42%, transparent 78%)",
          opacity: flash ? 1 : 0,
          transition: "opacity 0.28s ease-in",
        }}
      />
    </div>
  );
}
