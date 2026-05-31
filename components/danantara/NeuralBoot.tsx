"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

const STEPS = [
  "Menghubungkan ke Nexorus Engine",
  "Mengautentikasi sesi operator",
  "Menarik data pasar (IDX · valas)",
  "Menyapu sinyal media & sosial",
  "Mengkalibrasi model dampak & reputasi",
];

/**
 * One-shot "decrypt / boot" reveal shown while the dashboard mounts. Pure
 * gimmick — sells a sense of a heavy AI engine spinning up. Click to skip.
 */
export function NeuralBoot() {
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Play only once per browser session — a page refresh should NOT replay it.
    const alreadyBooted = typeof window !== "undefined" && sessionStorage.getItem("dn_booted") === "1";
    if (reduce || alreadyBooted) {
      setGone(true);
      return;
    }
    try {
      sessionStorage.setItem("dn_booted", "1");
    } catch {
      /* ignore */
    }
    const stepId = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length)), 320);
    const closeId = setTimeout(() => setClosing(true), 1750);
    const goneId = setTimeout(() => setGone(true), 2250);
    return () => {
      clearInterval(stepId);
      clearTimeout(closeId);
      clearTimeout(goneId);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden bg-background ${closing ? "dn-boot-out" : ""}`}
      onClick={() => setClosing(true)}
      style={{
        backgroundImage:
          "radial-gradient(ellipse 70% 50% at 50% 40%, oklch(0.40 0.15 270 / 0.30), transparent 60%)",
      }}
    >
      {/* scan line */}
      <span className="dn-scan pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/25 to-transparent" />

      <div className="relative flex w-full max-w-sm flex-col items-center px-6">
        {/* neural core */}
        <div className="relative h-24 w-24">
          <span className="syn-pulse absolute inset-0 rounded-full border border-primary/40" />
          <span className="syn-pulse-2 absolute inset-0 rounded-full border border-primary/30" />
          <div className="syn-ring absolute inset-0 rounded-full" />
          <div className="syn-ring-inner absolute inset-2 rounded-full" />
          <div className="syn-core absolute inset-[26px] flex items-center justify-center rounded-full bg-gradient-accent text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="text-gradient text-sm font-bold uppercase tracking-[0.28em]">Nexorus Engine</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Danantara Sovereign Command
          </div>
        </div>

        {/* boot steps */}
        <div className="mt-5 w-full space-y-1.5">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={label} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="flex h-3.5 w-3.5 items-center justify-center">
                  {done ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <span className={done ? "text-foreground/70" : active ? "text-foreground" : "text-muted-foreground/40"}>
                  {label}
                  {active ? "…" : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* progress */}
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="dn-boot-bar h-full rounded-full bg-gradient-accent" />
        </div>
        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/50">
          klik untuk lewati
        </div>
      </div>
    </div>
  );
}
