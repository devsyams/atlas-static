import { describe, expect, it } from "vitest";
import { decodeYolo, iou, letterboxMeta, nms, type Detection } from "./yolo";

describe("letterboxMeta", () => {
  it("landscape 1920x1080 → scale by width, pad on Y only", () => {
    const m = letterboxMeta(1920, 1080);
    const scale = 640 / 1920;
    expect(m.scale).toBeCloseTo(scale, 10);
    expect(m.padX).toBeCloseTo(0, 10);
    expect(m.padY).toBeCloseTo((640 - 1080 * scale) / 2, 10);
  });

  it("portrait 720x1280 → scale by height, pad on X only", () => {
    const m = letterboxMeta(720, 1280);
    const scale = 640 / 1280;
    expect(m.scale).toBeCloseTo(scale, 10);
    expect(m.padY).toBeCloseTo(0, 10);
    expect(m.padX).toBeCloseTo((640 - 720 * scale) / 2, 10);
  });
});

describe("iou", () => {
  it("identical boxes → 1", () => {
    expect(iou([10, 10, 20, 20], [10, 10, 20, 20])).toBeCloseTo(1, 10);
  });

  it("disjoint boxes → 0", () => {
    expect(iou([0, 0, 10, 10], [100, 100, 10, 10])).toBe(0);
  });

  it("partial overlap → in (0,1)", () => {
    // Two 10x10 boxes overlapping in a 5x5 corner: inter=25, union=175 → 1/7.
    const v = iou([0, 0, 10, 10], [5, 5, 10, 10]);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
    expect(v).toBeCloseTo(25 / 175, 10);
  });
});

describe("nms", () => {
  it("keeps only the higher-score box among heavy overlaps (IoU>0.45)", () => {
    const a: Detection = { bbox: [0, 0, 10, 10], class: "car", score: 0.9 };
    const b: Detection = { bbox: [1, 1, 10, 10], class: "car", score: 0.6 }; // IoU ~0.68
    const kept = nms([b, a], 0.45);
    expect(kept).toHaveLength(1);
    expect(kept[0].score).toBe(0.9);
  });

  it("keeps both far-apart boxes", () => {
    const a: Detection = { bbox: [0, 0, 10, 10], class: "car", score: 0.9 };
    const b: Detection = { bbox: [100, 100, 10, 10], class: "car", score: 0.8 };
    const kept = nms([a, b], 0.45);
    expect(kept).toHaveLength(2);
  });
});

describe("decodeYolo", () => {
  it("decodes a high-score car anchor and maps the box back through the letterbox", () => {
    const N = 2;
    const data = new Float32Array(84 * N);

    // Anchor 0: car (class id 2), high score, centered box in 640 space.
    // cx=320, cy=320, w=64, h=64
    data[0 * N + 0] = 320; // cx
    data[1 * N + 0] = 320; // cy
    data[2 * N + 0] = 64; // w
    data[3 * N + 0] = 64; // h
    data[(4 + 2) * N + 0] = 0.95; // car score

    // Anchor 1: a person (class id 0) but below threshold.
    data[0 * N + 1] = 100;
    data[1 * N + 1] = 100;
    data[2 * N + 1] = 20;
    data[3 * N + 1] = 20;
    data[(4 + 0) * N + 1] = 0.1; // below threshold

    // Known letterbox: 1280x720 source → scale 0.5, padY=140, padX=0.
    const meta = letterboxMeta(1280, 720);
    expect(meta.scale).toBeCloseTo(0.5, 10);
    expect(meta.padX).toBeCloseTo(0, 10);
    expect(meta.padY).toBeCloseTo(140, 10);

    const dets = decodeYolo(data, meta, 0.33, N);
    expect(dets).toHaveLength(1);
    const d = dets[0];
    expect(d.class).toBe("car");
    expect(d.score).toBeCloseTo(0.95, 5);

    // box: x=(320-32-0)/0.5=576, y=(320-32-140)/0.5=296, w=64/0.5=128, h=128
    expect(d.bbox[0]).toBeCloseTo(576, 6);
    expect(d.bbox[1]).toBeCloseTo(296, 6);
    expect(d.bbox[2]).toBeCloseTo(128, 6);
    expect(d.bbox[3]).toBeCloseTo(128, 6);
  });
});
