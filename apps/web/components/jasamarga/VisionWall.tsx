"use client";

import { useState } from "react";
import { Maximize2, Radio } from "lucide-react";
import type { CctvFeed } from "@/lib/jasamarga/types";
import { CameraScene } from "./CameraScene";
import { LiveDetectModal } from "./LiveDetectModal";

export function VisionWall({ cctv, onOpen }: { cctv: CctvFeed[]; onOpen?: (cam: CctvFeed) => void }) {
  const [liveOpen, setLiveOpen] = useState(false);

  if (!cctv.length) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
        Memuat kamera…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          AI Vision · CCTV Koridor
        </div>
        <button
          type="button"
          onClick={() => setLiveOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/50 bg-cyan-400/15 px-2.5 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-400/25"
        >
          <Radio className="h-3.5 w-3.5" /> Deteksi Live (AI)
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        {cctv.slice(0, 4).map((cam) => (
          <button
            key={cam.id}
            type="button"
            onClick={() => onOpen?.(cam)}
            className="group relative overflow-hidden rounded-md border border-border/50 bg-background/30 p-1.5 text-left transition-colors hover:border-primary/50 hover:ring-1 hover:ring-primary/40"
          >
            <CameraScene cam={cam} size="sm" />
            {/* hover affordance — expand overlay */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-background/80 px-2.5 py-1.5 text-[11px] font-bold text-primary">
                <Maximize2 className="h-3.5 w-3.5" /> Perbesar
              </span>
            </span>
          </button>
        ))}
      </div>

      <LiveDetectModal open={liveOpen} onClose={() => setLiveOpen(false)} />
    </div>
  );
}
