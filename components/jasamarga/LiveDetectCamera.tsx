"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bike, Car, Loader2, Truck, Users } from "lucide-react";
import { classifyCoco, getAtcsCamera, tallyDetections, type DetectionTally } from "@/lib/jasamarga/atcs";
import { detectYolo, loadYolo } from "@/lib/jasamarga/yolo";
import { cn } from "@/lib/utils";

/* The detector libs are large + WebGPU/WebGL/WASM-only — they are imported
 * dynamically inside effects/module functions so they never run on the server.
 * Models are cached at module scope as single promises so switching cameras (or
 * re-mounting) never reloads them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cocoPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadCoco(): Promise<any> {
  if (cocoPromise) return cocoPromise;
  cocoPromise = (async () => {
    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    // mobilenet_v2 (default) is markedly more accurate than lite_mobilenet_v2 on
    // small/distant CCTV objects (motorbikes), at a modest speed cost the 450ms
    // throttle absorbs.
    return cocoSsd.load({ base: "mobilenet_v2" });
  })();
  // If the load fails, drop the cached promise so a retry can try again.
  cocoPromise.catch(() => {
    cocoPromise = null;
  });
  return cocoPromise;
}

/* The detector abstraction: try YOLO11n first (onnxruntime-web, WebGPU→wasm), and
 * fall back to COCO-SSD if the YOLO session can't be created (e.g. model fetch /
 * EP init fails). Cached at module scope so it's resolved once per page load. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Detector = { kind: "yolo"; session: any } | { kind: "coco"; model: any };

let detectorPromise: Promise<Detector> | null = null;

function loadDetector(): Promise<Detector> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async (): Promise<Detector> => {
    try {
      const session = await loadYolo();
      return { kind: "yolo", session };
    } catch {
      const model = await loadCoco();
      return { kind: "coco", model };
    }
  })();
  detectorPromise.catch(() => {
    detectorPromise = null;
  });
  return detectorPromise;
}

const DETECT_INTERVAL_MS = 450;
const SCORE_THRESHOLD = 0.33; // coco-ssd's internal default is 0.5 — lower it to catch small/distant vehicles
const MAX_BOXES = 40; // dense traffic scenes exceed the default cap of 20
const EMPTY_TALLY: DetectionTally = { mobil: 0, motor: 0, bus: 0, truk: 0, orang: 0, lainnya: 0, total: 0 };

type Prediction = { bbox: [number, number, number, number]; class: string; score: number };

export function LiveDetectCamera({
  cameraId,
  compact = false,
  detectIntervalMs,
}: {
  cameraId: string;
  /** Wall tile: drop the counts strip for a compact in-frame tally (A12 v4.0). */
  compact?: boolean;
  /** Override the detect throttle — the wall runs several tiles at once, so it detects less often. */
  detectIntervalMs?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const modelRef = useRef<Detector | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);

  const [modelReady, setModelReady] = useState(false);
  const [detectorKind, setDetectorKind] = useState<Detector["kind"] | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<DetectionTally>(EMPTY_TALLY);
  const [attempt, setAttempt] = useState(0);

  // Read inside the rAF loop so changing the throttle never restarts the detector.
  const intervalRef = useRef(DETECT_INTERVAL_MS);
  useEffect(() => {
    intervalRef.current = detectIntervalMs ?? DETECT_INTERVAL_MS;
  }, [detectIntervalMs]);

  const cam = getAtcsCamera(cameraId);

  const retry = useCallback(() => {
    setError(null);
    setModelReady(false);
    setStreamReady(false);
    setCounts(EMPTY_TALLY);
    setAttempt((n) => n + 1);
  }, []);

  /* ---- Model load (cached singleton) ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    loadDetector()
      .then((detector) => {
        if (cancelled) return;
        modelRef.current = detector;
        setDetectorKind(detector.kind);
        setModelReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError("model");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /* ---- HLS load (keyed on camera) ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;
    const url = `/api/v1/cctv/playlist?cam=${encodeURIComponent(cameraId)}`;

    const onLoadedData = () => {
      if (!destroyed) setStreamReady(true);
    };
    const onVideoError = () => {
      if (!destroyed) setError("stream");
    };
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("error", onVideoError);

    const startPlay = () => {
      // Autoplay may be rejected (no user gesture) — that's fine, ignore it.
      video.play().catch(() => {});
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / native HLS.
      video.src = url;
      startPlay();
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (Hls.isSupported()) {
            const hls = new Hls();
            hlsRef.current = hls;
            hls.on(Hls.Events.ERROR, (_evt: unknown, data: { fatal?: boolean }) => {
              if (data?.fatal && !destroyed) setError("stream");
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            startPlay();
          } else {
            setError("stream");
          }
        })
        .catch(() => {
          if (!destroyed) setError("stream");
        });
    }

    return () => {
      destroyed = true;
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("error", onVideoError);
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          /* noop */
        }
        hlsRef.current = null;
      }
      try {
        video.pause();
      } catch {
        /* noop */
      }
      video.removeAttribute("src");
      video.load();
      // Reset readiness for the next camera/attempt (cleanup-phase setState is allowed).
      setStreamReady(false);
    };
  }, [cameraId, attempt]);

  /* ---- Detect loop ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!modelReady || !streamReady || error) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = modelRef.current;
    if (!video || !canvas || !detector) return;

    let stopped = false;
    lastDetectRef.current = 0;

    const drawBox = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      label: string,
      isPerson: boolean,
    ) => {
      const color = isPerson ? "#fbbf24" : "#22d3ee"; // amber / cyan
      const r = Math.min(10, w / 4, h / 4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.stroke();

      // label chip
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      const padX = 5;
      const textW = ctx.measureText(label).width;
      const chipH = 17;
      const chipY = y - chipH >= 0 ? y - chipH : y;
      ctx.fillStyle = color;
      ctx.fillRect(x, chipY, textW + padX * 2, chipH);
      ctx.fillStyle = "#04121a";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + padX, chipY + chipH / 2 + 0.5);
    };

    const tick = async (ts: number) => {
      if (stopped) return;
      if (video.readyState >= 2 && ts - lastDetectRef.current >= intervalRef.current) {
        lastDetectRef.current = ts;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw && vh) {
          let preds: Prediction[] = [];
          try {
            // Both paths return {bbox:[x,y,w,h], class, score}[] in source pixels.
            // For COCO-SSD: (img, maxNumBoxes, minScore) — pass our lower minScore
            // so it returns sub-0.5 detections instead of discarding them.
            preds =
              detector.kind === "yolo"
                ? await detectYolo(detector.session, video, SCORE_THRESHOLD)
                : ((await detector.model.detect(video, MAX_BOXES, SCORE_THRESHOLD)) as Prediction[]);
          } catch {
            // A transient detect failure shouldn't kill the loop; skip this frame.
            preds = [];
          }
          if (stopped) return;
          preds = preds.filter((p) => p.score >= SCORE_THRESHOLD);

          if (canvas.width !== vw) canvas.width = vw;
          if (canvas.height !== vh) canvas.height = vh;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, vw, vh);
            for (const p of preds) {
              const [x, y, w, h] = p.bbox;
              const klass = classifyCoco(p.class);
              const isPerson = klass === "orang";
              drawBox(ctx, x, y, w, h, `${klass} ${(p.score * 100) | 0}%`, isPerson);
            }
          }
          setCounts(tallyDetections(preds));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [modelReady, streamReady, error, cameraId]);

  /* ---- Fallback panel ---- */
  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border border-border/60 bg-background/40 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <div className="text-sm font-bold text-foreground">Aliran CCTV/Model tidak tersedia</div>
        <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground">
          Deteksi AI memerlukan koneksi ke CCTV publik &amp; WebGL.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-1 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-[12px] font-bold text-primary transition-colors hover:bg-primary/25"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const loading = !modelReady || !streamReady;

  return (
    <div className="flex flex-col gap-2">
      {/* 16:9 frame */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />

        {/* HUD: LIVE + name (top-left) */}
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            <span className="jm-rec-blink inline-block h-2 w-2 rounded-full bg-red-500" />
            LIVE
          </span>
          <span className="rounded bg-black/55 px-2 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
            {cam.name} · {cam.city}
          </span>
        </div>

        {/* HUD: AI badge (top-right) */}
        <div className="pointer-events-none absolute right-2 top-2">
          <span className="inline-flex items-center gap-1.5 rounded border border-cyan-400/40 bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-300 backdrop-blur-sm">
            AI · {detectorKind === "yolo" ? "YOLO11n" : "COCO-SSD"}
          </span>
        </div>

        {/* Compact (wall tile): the tally rides inside the frame instead of a strip below it. */}
        {compact && !loading && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-[10px] font-bold text-white/90 backdrop-blur-sm">
              <span className="inline-flex items-center gap-1">
                <Car className="h-3 w-3 text-cyan-300" /> {counts.mobil}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bike className="h-3 w-3 text-cyan-300" /> {counts.motor}
              </span>
              <span className="inline-flex items-center gap-1">
                <Truck className="h-3 w-3 text-cyan-300" /> {counts.truk}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3 text-amber-300" /> {counts.orang}
              </span>
            </span>
            <span className="rounded bg-cyan-400/20 px-2 py-1 text-[10px] font-extrabold tabular-nums text-cyan-200 backdrop-blur-sm">
              {counts.total} objek
            </span>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center">
            <Loader2 className={cn("animate-spin text-cyan-300", compact ? "h-5 w-5" : "h-7 w-7")} />
            <div className={cn("font-semibold text-white/90", compact ? "text-[10px]" : "text-[12px]")}>
              {!modelReady ? "Memuat model AI…" : "Menyambungkan CCTV…"}
            </div>
          </div>
        )}
      </div>

      {!compact && (
        <>
          {/* Counts strip */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            <CountChip Icon={Car} label="Mobil" value={counts.mobil} prominent />
            <CountChip Icon={Bike} label="Motor" value={counts.motor} prominent />
            <CountChip label="BUS" value={counts.bus} prominent />
            <CountChip Icon={Truck} label="Truk" value={counts.truk} prominent />
            <CountChip Icon={Users} label="Orang" value={counts.orang} />
          </div>
          <div className="text-center text-[11px] text-muted-foreground">
            <span className="font-bold tabular-nums text-foreground">{counts.total}</span> total kendaraan terdeteksi
          </div>
        </>
      )}
    </div>
  );
}

function CountChip({
  Icon,
  label,
  value,
  prominent,
}: {
  Icon?: typeof Car;
  label: string;
  value: number;
  prominent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card/50 px-2.5 py-1.5",
        prominent ? "border-cyan-400/30" : "border-border/50",
      )}
    >
      {Icon ? (
        <Icon className={cn("h-4 w-4 shrink-0", prominent ? "text-cyan-300" : "text-muted-foreground")} />
      ) : (
        <span
          className={cn(
            "shrink-0 text-[10px] font-extrabold leading-none",
            prominent ? "text-cyan-300" : "text-muted-foreground",
          )}
        >
          BUS
        </span>
      )}
      <div className="min-w-0">
        <div className={cn("text-lg font-extrabold leading-none tabular-nums", prominent && "text-foreground")}>
          {value}
        </div>
        {Icon && <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>}
      </div>
    </div>
  );
}
