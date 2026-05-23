"use client";

import { useEffect, useRef } from "react";
import { scoreColor } from "@/lib/mbg/colors";

const W = 260;
const H = 130;

export function ScoreGauge({ score }: { score: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawGauge(ctx, score);
  }, [score]);

  return <canvas ref={ref} className="block" />;
}

function drawGauge(ctx: CanvasRenderingContext2D, score: number) {
  const cx = 130;
  const cy = 120;
  const r = 90;
  const lw = 14;

  ctx.clearRect(0, 0, W, H);

  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const pct = Math.max(0, Math.min(1, score / 10));

  // track
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.lineWidth = lw;
  ctx.strokeStyle = "oklch(0.32 0.03 265 / 0.45)";
  ctx.lineCap = "round";
  ctx.stroke();

  // value arc
  const arcEnd = startAngle + pct * Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, arcEnd);
  ctx.lineWidth = lw;
  ctx.strokeStyle = scoreColor(score);
  ctx.lineCap = "round";
  ctx.stroke();

  // needle
  const angle = startAngle + pct * Math.PI;
  const nx = cx + (r - lw) * Math.cos(angle);
  const ny = cy + (r - lw) * Math.sin(angle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "oklch(0.92 0.02 240)";
  ctx.lineCap = "round";
  ctx.stroke();

  // hub
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "oklch(0.92 0.02 240)";
  ctx.fill();
}
