"use client";

import { useMemo } from "react";
import { AlertTriangle, Bike, Car, ScanLine, Truck } from "lucide-react";
import type { CctvFeed } from "@/lib/jasamarga/types";
import { FLOW_COLORS, FLOW_LABEL } from "@/lib/jasamarga/ui";
import { cn } from "@/lib/utils";

const CV_CYAN = "oklch(0.85 0.13 200)";

/** Flags that signal trouble → rendered in alert (amber/red) styling. */
function isAlertFlag(flag: string): boolean {
  return /kecelakaan|antrean|genangan|banjir|bahu jalan|jarak pandang|menurun|tertutup|penutupan/i.test(flag);
}

/** Vehicle-class label the AI "detector" tags a box with (just for show). */
const VEH_CLASSES = ["mobil", "mobil", "mobil", "truk", "motor", "mobil"] as const;

interface Vehicle {
  /** horizontal lane position, 0 (left) … 1 (right) of the road trapezoid */
  lane: number;
  delay: number; // animation stagger (s)
  duration: number; // loop length (s)
  cls: (typeof VEH_CLASSES)[number];
  conf: number; // detector confidence for the box label
  boxed: boolean; // draw a CV bounding box on this one
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Base loop duration (s) for a vehicle, by congestion: lancar zips, lumpuh crawls. */
function vehDuration(status: CctvFeed["status"]): number {
  switch (status) {
    case "lancar":
      return 2.2;
    case "padat":
      return 3.8;
    case "macet":
      return 6;
    default:
      return 9;
  }
}

export function CameraScene({ cam, size = "sm" }: { cam: CctvFeed; size?: "sm" | "lg" }) {
  const lg = size === "lg";
  const accent = FLOW_COLORS[cam.status];

  // Deterministic vehicle layout derived from the feed so it stays stable across
  // re-renders (no flicker) but varies between cameras.
  const vehicles = useMemo<Vehicle[]>(() => {
    const n = clamp(Math.round(cam.vehicles.mobil / 6), 3, 9);
    const base = vehDuration(cam.status);
    // seed off the km number for per-camera variety
    const seed = parseInt(cam.km.replace(/\D/g, ""), 10) || 7;
    const rng = (i: number) => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
    return Array.from({ length: n }, (_, i) => {
      const r = rng(i);
      return {
        lane: 0.18 + ((i * 0.37 + r) % 1) * 0.64,
        delay: -(i / n) * base - r * 0.6,
        duration: +(base * (0.82 + r * 0.4)).toFixed(2),
        cls: VEH_CLASSES[i % VEH_CLASSES.length],
        conf: +(0.88 + r * 0.11).toFixed(2),
        boxed: i < 3, // bounding boxes on the ~3 frontmost
      };
    });
  }, [cam.vehicles.mobil, cam.status, cam.km]);

  return (
    <div className="flex h-full w-full flex-col gap-1.5">
      {/* ── Camera frame (16:9) ─────────────────────────────────────── */}
      <div
        className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md border border-white/10 bg-black"
        style={{
          background:
            "radial-gradient(ellipse at 50% 120%, oklch(0.26 0.01 250) 0%, oklch(0.16 0.01 250) 45%, oklch(0.09 0.005 250) 100%)",
        }}
      >
        {/* perspective road — trapezoid wider at the bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, oklch(0.20 0.01 250), oklch(0.13 0.008 250))",
            clipPath: "polygon(41% 0%, 59% 0%, 100% 100%, 0% 100%)",
          }}
        >
          {/* dashed center lane markings */}
          <div className="jm-cam-lane absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2" />
          {/* side lane edges */}
          <div className="absolute inset-y-0 left-[26%] w-px bg-white/10" />
          <div className="absolute inset-y-0 right-[26%] w-px bg-white/10" />
        </div>

        {/* moving vehicles + their CV bounding boxes */}
        {vehicles.map((v, i) => {
          const left = `${(v.lane * 100).toFixed(1)}%`;
          const style: React.CSSProperties = {
            left,
            top: 0,
            animationDuration: `${v.duration}s`,
            animationDelay: `${v.delay}s`,
          };
          const VehIcon = v.cls === "truk" ? Truck : v.cls === "motor" ? Bike : Car;
          return (
            <div key={i} className="jm-cam-veh absolute" style={style}>
              {/* the vehicle body */}
              <div
                className="relative rounded-[3px]"
                style={{
                  width: v.cls === "truk" ? 22 : v.cls === "motor" ? 9 : 16,
                  height: v.cls === "truk" ? 30 : v.cls === "motor" ? 14 : 22,
                  background:
                    v.cls === "truk"
                      ? "linear-gradient(180deg, oklch(0.74 0.08 80), oklch(0.5 0.05 80))"
                      : "linear-gradient(180deg, oklch(0.82 0.02 250), oklch(0.55 0.02 250))",
                  boxShadow: "0 6px 10px -2px oklch(0.85 0.16 85 / 0.45)",
                }}
              >
                <VehIcon className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 text-black/40" />
              </div>

              {/* AI bounding box (cyan bracket-corners) on the frontmost vehicles */}
              {v.boxed && (
                <>
                  <div
                    className="pointer-events-none absolute -inset-1.5 rounded-[2px]"
                    style={{
                      border: `1px solid ${CV_CYAN}`,
                      boxShadow: `0 0 6px ${CV_CYAN}, inset 0 0 4px oklch(0.85 0.13 200 / 0.3)`,
                      // bracket-corner mask via conic gradient is overkill; the
                      // glow + thin border reads as a CV box at this scale.
                    }}
                  />
                  <span
                    className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[2px] px-1 font-mono text-[8px] font-bold leading-tight"
                    style={{ background: "oklch(0.12 0.01 250 / 0.85)", color: CV_CYAN }}
                  >
                    {v.cls} {v.conf.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          );
        })}

        {/* vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: "inset 0 0 60px 18px oklch(0 0 0 / 0.55)" }}
        />

        {/* sweeping CV scanline */}
        <div
          className="jm-cam-scan pointer-events-none absolute inset-x-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${CV_CYAN}, transparent)` }}
        />

        {/* viewfinder corner brackets (all four corners) */}
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <span
            key={corner}
            className={cn(
              "pointer-events-none absolute h-3.5 w-3.5 border-white/40",
              corner === "tl" && "left-1.5 top-1.5 border-l-2 border-t-2",
              corner === "tr" && "right-1.5 top-1.5 border-r-2 border-t-2",
              corner === "bl" && "bottom-1.5 left-1.5 border-b-2 border-l-2",
              corner === "br" && "bottom-1.5 right-1.5 border-b-2 border-r-2",
            )}
          />
        ))}

        {/* HUD: top-left REC + cam id/km */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-wide text-white/80">
          <span className="jm-rec-blink inline-block h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_red]" />
          <span className="text-red-400">REC</span>
          <span className="text-white/90">{cam.id}</span>
          <span className="text-white/45">· {cam.km}</span>
        </div>

        {/* HUD: top-right AI VISION + confidence */}
        <div
          className="pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 font-mono text-[9px] font-bold"
          style={{ background: "oklch(0.12 0.01 250 / 0.7)", color: CV_CYAN, border: `1px solid ${CV_CYAN}` }}
        >
          <ScanLine className="h-2.5 w-2.5" />
          AI VISION · {Math.round(cam.confidence * 100)}%
        </div>

        {/* HUD: bottom-left status pill */}
        <div
          className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black"
          style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
        >
          {FLOW_LABEL[cam.status]}
        </div>
      </div>

      {/* ── Detection strip (below the frame) ───────────────────────── */}
      <div className="flex shrink-0 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Car className="h-3 w-3 text-foreground/70" /> {cam.vehicles.mobil}
            </span>
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3 w-3 text-foreground/70" /> {cam.vehicles.truk}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bike className="h-3 w-3 text-foreground/70" /> {cam.vehicles.motor}
            </span>
          </div>
          {lg && <span className="truncate text-[10px] text-muted-foreground/80">{cam.name}</span>}
        </div>

        <div className="flex flex-wrap gap-1">
          {(lg ? cam.flags : cam.flags.slice(0, 1)).map((flag) => {
            const alert = isAlertFlag(flag);
            return (
              <span
                key={flag}
                className={cn(
                  "inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold",
                  alert
                    ? "border border-destructive/40 bg-destructive/15 text-destructive"
                    : "border border-border/50 bg-background/40 text-muted-foreground",
                )}
              >
                {alert && <AlertTriangle className="h-2.5 w-2.5" />}
                {flag}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
