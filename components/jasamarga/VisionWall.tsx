"use client";

import { useState } from "react";
import { Cctv, Radio } from "lucide-react";

import { ATCS_CAMERAS } from "@/lib/jasamarga/atcs";
import { cn } from "@/lib/utils";
import { LiveDetectCamera } from "./LiveDetectCamera";
import { LiveDetectModal } from "./LiveDetectModal";

/**
 * AI Vision wall (A12 v4.0) — REAL CCTV, real in-browser detection.
 *
 * Was a 2×2 of hand-drawn `CameraScene` fakes with invented bounding boxes and
 * invented confidence scores. It now runs a genuine public ATCS HLS stream through
 * the same YOLO11n / COCO-SSD detector as the "Deteksi Live" modal, so the boxes
 * and the counts are actual detections on actual traffic.
 *
 * **One camera at a time, by design.** A 2×2 of live tiles means four HLS streams
 * and four detector loops competing for one GPU — it pegs the browser. The operator
 * picks the camera; only the selected one streams and infers.
 *
 * Provenance note (deliberate, and stated in the UI): these are **public city ATCS
 * cameras**, not JasaMarga's own toll cameras — Travoy's feeds need a login. What's
 * demonstrated is that the vision pipeline is real; pointing it at JasaMarga's
 * cameras is a credentials change, not an engineering one.
 */
export function VisionWall() {
  const [liveOpen, setLiveOpen] = useState(false);
  const [cameraId, setCameraId] = useState(ATCS_CAMERAS[0].id);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            AI Vision · CCTV Live
          </div>
          <div className="truncate text-[10px] text-muted-foreground/80">
            ATCS publik · deteksi on-device (YOLO11n / COCO-SSD)
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLiveOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-cyan-400/50 bg-cyan-400/15 px-2.5 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-400/25"
        >
          <Radio className="h-3.5 w-3.5" /> Perbesar
        </button>
      </div>

      {/* The one live feed. Keyed by camera so a switch tears the old stream down. */}
      <div className="min-h-0 flex-1">
        <LiveDetectCamera key={cameraId} cameraId={cameraId} compact />
      </div>

      {/* Camera picker — switching swaps the single running stream + detector. */}
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {ATCS_CAMERAS.map((cam) => {
          const active = cam.id === cameraId;
          return (
            <button
              key={cam.id}
              type="button"
              onClick={() => setCameraId(cam.id)}
              title={`${cam.name} · ${cam.city}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors",
                active
                  ? "border-cyan-400/60 bg-cyan-400/20 text-cyan-100"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {active && <Cctv className="h-3 w-3" />}
              <span className="max-w-[120px] truncate">{cam.name}</span>
            </button>
          );
        })}
      </div>

      <LiveDetectModal open={liveOpen} onClose={() => setLiveOpen(false)} />
    </div>
  );
}
