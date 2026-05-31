"use client";

import { useEffect } from "react";
import { AlertTriangle, Bike, Car, ScanLine, Truck, Video, X } from "lucide-react";
import type { CctvFeed } from "@/lib/jasamarga/types";
import { FLOW_COLORS, FLOW_LABEL } from "@/lib/jasamarga/ui";
import { CameraScene } from "./CameraScene";

function isAlertFlag(flag: string): boolean {
  return /kecelakaan|antrean|genangan|banjir|bahu jalan|jarak pandang|menurun|tertutup|penutupan/i.test(flag);
}

export function CameraModal({ cam, onClose }: { cam: CctvFeed | null; onClose: () => void }) {
  useEffect(() => {
    if (!cam) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cam, onClose]);

  if (!cam) return null;
  const accent = FLOW_COLORS[cam.status];

  return (
    <div
      className="fixed inset-0 z-[1900] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-2xl lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header (mobile) / accent edge */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md border border-border bg-background/60 p-2 text-muted-foreground hover:text-foreground"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        {/* the big camera */}
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
            <Video className="h-3.5 w-3.5" /> AI Vision · CCTV Koridor
            <span className="text-muted-foreground/70">(simulasi)</span>
          </div>
          <CameraScene cam={cam} size="lg" />
        </div>

        {/* readout panel */}
        <div className="flex w-full shrink-0 flex-col gap-3 border-t border-border/40 bg-background/40 p-4 lg:w-72 lg:border-l lg:border-t-0">
          <div>
            <div className="font-mono text-sm font-bold text-foreground">{cam.id}</div>
            <div className="text-[12px] text-muted-foreground">
              {cam.km} · {cam.name}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black"
              style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
            >
              {FLOW_LABEL[cam.status]}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <ScanLine className="h-3 w-3" /> {Math.round(cam.confidence * 100)}% confidence
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { Icon: Car, label: "Mobil", value: cam.vehicles.mobil },
              { Icon: Truck, label: "Truk", value: cam.vehicles.truk },
              { Icon: Bike, label: "Motor", value: cam.vehicles.motor },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="rounded-md border border-border/50 bg-card/50 py-2">
                <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
                <div className="text-lg font-extrabold leading-none tabular-nums">{value}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Deteksi AI
            </div>
            <div className="flex flex-col gap-1.5">
              {cam.flags.map((flag) => {
                const alert = isAlertFlag(flag);
                return (
                  <div
                    key={flag}
                    className={
                      "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-semibold " +
                      (alert
                        ? "border border-destructive/40 bg-destructive/15 text-destructive"
                        : "border border-border/50 bg-card/50 text-foreground/80")
                    }
                  >
                    {alert && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                    {flag}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-auto text-[10px] leading-relaxed text-muted-foreground/70">
            Sumber: Nexorus Vision (CCTV AI) · demo. Overlay deteksi disimulasikan untuk peragaan.
          </p>
        </div>
      </div>
    </div>
  );
}
