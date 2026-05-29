"use client";

import { useEffect, useState } from "react";
import { Cctv, X } from "lucide-react";
import { ATCS_CAMERAS } from "@/lib/jasamarga/atcs";
import { cn } from "@/lib/utils";
import { LiveDetectCamera } from "./LiveDetectCamera";

export function LiveDetectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cameraId, setCameraId] = useState<string>(ATCS_CAMERAS[0].id);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1950] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md border border-border bg-background/60 p-2 text-muted-foreground hover:text-foreground"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto p-4 sm:p-5">
          {/* header */}
          <div className="mb-3 flex items-center gap-2 pr-10">
            <Cctv className="h-4 w-4 shrink-0 text-cyan-300" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">Deteksi Kendaraan Live · AI</div>
              <div className="text-[11px] leading-snug text-muted-foreground">
                CCTV ATCS publik (Tasikmalaya) · deteksi on-device (COCO-SSD), bukan rekayasa
              </div>
            </div>
          </div>

          {/* camera picker */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ATCS_CAMERAS.map((c) => {
              const active = c.id === cameraId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCameraId(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
                    active
                      ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-cyan-400/40 hover:text-foreground",
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          <LiveDetectCamera cameraId={cameraId} />
        </div>
      </div>
    </div>
  );
}
