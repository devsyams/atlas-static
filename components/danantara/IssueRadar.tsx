import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { NarrativeIssue } from "@/lib/danantara/types";
import { toneColor } from "@/lib/danantara/ui";
import { cn } from "@/lib/utils";

const SIZE = 230;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 84;

function pt(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

function TrendIcon({ t }: { t: NarrativeIssue["trend"] }) {
  if (t === "up") return <TrendingUp className="h-3 w-3 text-destructive" />;
  if (t === "down") return <TrendingDown className="h-3 w-3 text-success" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

/** Narrative/issue radar — salience as a spider polygon, sentiment in the list. */
export function IssueRadar({ issues }: { issues: NarrativeIssue[] }) {
  const n = issues.length;
  const step = 360 / n;
  const rings = [0.25, 0.5, 0.75, 1];

  const poly = issues
    .map((iss, i) => {
      const p = pt(i * step, (iss.salience / 100) * R);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex h-full flex-col gap-2 lg:flex-row">
      {/* Radar */}
      <div className="relative shrink-0 self-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {rings.map((rr) => (
            <polygon
              key={rr}
              points={issues.map((_, i) => {
                const p = pt(i * step, rr * R);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              }).join(" ")}
              fill="none"
              stroke="oklch(0.32 0.03 265 / 0.4)"
              strokeWidth={0.8}
            />
          ))}
          {issues.map((_, i) => {
            const p = pt(i * step, R);
            return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="oklch(0.32 0.03 265 / 0.35)" strokeWidth={0.8} />;
          })}
          <polygon points={poly} fill="oklch(0.78 0.14 230 / 0.18)" stroke="oklch(0.78 0.14 230)" strokeWidth={1.8} />
          {issues.map((iss, i) => {
            const p = pt(i * step, (iss.salience / 100) * R);
            return <circle key={iss.key} cx={p.x} cy={p.y} r={3} fill={toneColor(iss.sentiment)} stroke="oklch(0.16 0.02 260)" strokeWidth={1} />;
          })}
          {issues.map((iss, i) => {
            const p = pt(i * step, R + 13);
            const anchor = p.x < CX - 8 ? "end" : p.x > CX + 8 ? "start" : "middle";
            const short = iss.label.split(/[ &]/)[0];
            return (
              <text key={iss.key} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" className="fill-muted-foreground text-[8px] font-semibold">
                {short}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Issue list */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto scrollbar-thin">
        {[...issues]
          .sort((a, b) => b.salience - a.salience)
          .map((iss) => (
            <div key={iss.key} className="rounded-md border border-border/40 bg-background/30 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toneColor(iss.sentiment) }} />
                  <span className="truncate text-[11px] font-semibold">{iss.label}</span>
                </span>
                <span className={cn("flex shrink-0 items-center gap-0.5 text-[10px] font-bold tabular-nums", iss.delta >= 0 ? "text-destructive" : "text-success")}>
                  <TrendIcon t={iss.trend} />
                  {iss.delta >= 0 ? "+" : ""}
                  {iss.delta}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                  <div className="h-full rounded-full" style={{ width: `${iss.salience}%`, background: toneColor(iss.sentiment) }} />
                </div>
                <span className="w-9 shrink-0 text-right text-[9px] text-muted-foreground">{iss.share_pct}%</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
