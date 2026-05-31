/**
 * YOLO11n inference for the JasaMarga live CCTV detector, running in the browser
 * via onnxruntime-web (WebGPU EP, wasm fallback).
 *
 * The model is served at /models/yolo11n.onnx. Input `images` is [1,3,640,640]
 * float32 RGB 0–1 NCHW; output [1,84,8400] channel-major (value for channel `c`,
 * anchor `i` lives at data[c*8400 + i]). 84 = 4 bbox (cxcywh, 640px space) + 80
 * already-sigmoid'd class scores.
 *
 * The pure decode/letterbox/iou/nms helpers are unit-tested in node; the runtime
 * (loadYolo/detectYolo) is client-only and dynamically imports ORT so nothing
 * touches the server bundle.
 */

/** COCO class names in model index order (0..79). */
export const COCO_CLASSES: string[] = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
  "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
  "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
  "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
  "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
  "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
  "toothbrush",
];

export interface Detection {
  /** [x, y, w, h] in source-video pixels. */
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

/**
 * COCO ids we surface in the traffic demo: person 0, bicycle 1, car 2,
 * motorcycle 3, bus 5, truck 7. (atcs.ts maps bicycle → "motor".)
 */
export const KEEP_CLASS_IDS: Set<number> = new Set([0, 1, 2, 3, 5, 7]);

export interface LetterboxMeta {
  scale: number;
  padX: number;
  padY: number;
}

/**
 * Letterbox geometry: the source frame is scaled by min(size/w, size/h) and
 * centered on a size×size canvas, leaving symmetric padding on one axis.
 */
export function letterboxMeta(srcW: number, srcH: number, size = 640): LetterboxMeta {
  const scale = Math.min(size / srcW, size / srcH);
  const padX = (size - srcW * scale) / 2;
  const padY = (size - srcH * scale) / 2;
  return { scale, padX, padY };
}

/** IoU of two [x, y, w, h] boxes. */
export function iou(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const ix1 = Math.max(ax, bx);
  const iy1 = Math.max(ay, by);
  const ix2 = Math.min(ax + aw, bx + bw);
  const iy2 = Math.min(ay + ah, by + bh);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (inter <= 0) return 0;
  const union = aw * ah + bw * bh - inter;
  return union <= 0 ? 0 : inter / union;
}

/**
 * Greedy NMS: sort by score desc, then keep a box only if it doesn't overlap any
 * already-kept (higher-score) box by more than `iouThres`.
 */
export function nms(dets: Detection[], iouThres = 0.45): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const d of sorted) {
    let suppressed = false;
    for (const k of kept) {
      if (iou(d.bbox, k.bbox) > iouThres) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(d);
  }
  return kept;
}

/**
 * Decode raw YOLO11 output [1,84,8400] (flat Float32Array, channel-major) into
 * source-video-pixel detections (pre-NMS). For each anchor we argmax the 80 class
 * scores, keep it if it clears `scoreThres` and is a class we care about, then
 * convert cxcywh(640 space) → xywh and undo the letterbox transform.
 */
export function decodeYolo(
  output: Float32Array,
  meta: LetterboxMeta,
  scoreThres: number,
  numAnchors = 8400,
): Detection[] {
  const { scale, padX, padY } = meta;
  const dets: Detection[] = [];
  const n = numAnchors;
  for (let i = 0; i < n; i++) {
    // argmax over the 80 class channels (channels 4..83).
    let bestId = -1;
    let bestScore = 0;
    for (let c = 0; c < 80; c++) {
      const s = output[(4 + c) * n + i];
      if (s > bestScore) {
        bestScore = s;
        bestId = c;
      }
    }
    if (bestId < 0 || bestScore < scoreThres || !KEEP_CLASS_IDS.has(bestId)) continue;

    const cx = output[0 * n + i];
    const cy = output[1 * n + i];
    const w = output[2 * n + i];
    const h = output[3 * n + i];

    // cxcywh (640 letterboxed space) → top-left xywh in source pixels.
    const x = (cx - w / 2 - padX) / scale;
    const y = (cy - h / 2 - padY) / scale;
    const sw = w / scale;
    const sh = h / scale;

    dets.push({ bbox: [x, y, sw, sh], class: COCO_CLASSES[bestId], score: bestScore });
  }
  return dets;
}

/* ------------------------------------------------------------------ */
/* Impure runtime — client-only, dynamic ORT import, cached session.   */
/* ------------------------------------------------------------------ */

const ORT_VERSION = "1.26.0";
const MODEL_SIZE = 640;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sessionPromise: Promise<any> | null = null;

// A single offscreen letterbox canvas, reused across frames (don't allocate per frame).
let lbCanvas: HTMLCanvasElement | null = null;
let lbCtx: CanvasRenderingContext2D | null = null;

function getLetterboxCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!lbCanvas) {
    lbCanvas = document.createElement("canvas");
    lbCanvas.width = MODEL_SIZE;
    lbCanvas.height = MODEL_SIZE;
  }
  if (!lbCtx) {
    lbCtx = lbCanvas.getContext("2d", { willReadFrequently: true })!;
  }
  return { canvas: lbCanvas, ctx: lbCtx };
}

/**
 * Load (and cache) the YOLO11n InferenceSession. Dynamically imports the WebGPU
 * build of onnxruntime-web (which also carries the wasm EP) and points the wasm
 * loader at the matching jsDelivr CDN. The promise is cached; on failure it is
 * dropped so a retry can re-attempt.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadYolo(): Promise<any> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const ort = await import("onnxruntime-web/webgpu");
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
    return ort.InferenceSession.create("/models/yolo11n.onnx", {
      executionProviders: ["webgpu", "wasm"],
    });
  })();
  sessionPromise.catch(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

/**
 * Run YOLO11n on the current video frame and return post-NMS detections in
 * source-video pixels (same {bbox,class,score} shape the COCO-SSD path emits).
 */
export async function detectYolo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  video: HTMLVideoElement,
  scoreThres: number,
): Promise<Detection[]> {
  const ort = await import("onnxruntime-web/webgpu");

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return [];

  const meta = letterboxMeta(vw, vh, MODEL_SIZE);
  const { ctx } = getLetterboxCanvas();

  // Fill black, then draw the frame scaled + centered.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  const dw = vw * meta.scale;
  const dh = vh * meta.scale;
  ctx.drawImage(video, meta.padX, meta.padY, dw, dh);

  const { data } = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const px = MODEL_SIZE * MODEL_SIZE;
  // NCHW RGB, /255: r plane, then g, then b.
  const input = new Float32Array(3 * px);
  for (let i = 0; i < px; i++) {
    input[i] = data[i * 4] / 255; // R
    input[px + i] = data[i * 4 + 1] / 255; // G
    input[2 * px + i] = data[i * 4 + 2] / 255; // B
  }

  const tensor = new ort.Tensor("float32", input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
  const result = await session.run({ [session.inputNames[0]]: tensor });
  const output = result[session.outputNames[0]].data as Float32Array;

  return nms(decodeYolo(output, meta, scoreThres), 0.45);
}
