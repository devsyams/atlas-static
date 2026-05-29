"use client";

import { Maximize2 } from "lucide-react";
import type { CctvFeed } from "@/lib/jasamarga/types";
import { CameraScene } from "./CameraScene";

export function VisionWall({ cctv, onOpen }: { cctv: CctvFeed[]; onOpen?: (cam: CctvFeed) => void }) {
  if (!cctv.length) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
        Memuat kamera…
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-2 gap-2">
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
  );
}
