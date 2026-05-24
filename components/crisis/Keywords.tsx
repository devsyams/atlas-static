import type { Keyword } from "@/lib/mbg/types";
import { SideSection } from "./SideSection";

// Positive / unspecified terms cycle this cool, on-brand palette
// (violet / indigo / pink / sky / purple). Negative → red, neutral → gray.
const CLOUD_COLORS = [
  "oklch(0.74 0.17 292)",
  "oklch(0.71 0.14 262)",
  "oklch(0.76 0.18 340)",
  "oklch(0.78 0.12 232)",
  "oklch(0.72 0.16 312)",
];
const NEGATIVE = "oklch(0.70 0.20 25)";
const NEUTRAL = "oklch(0.70 0.03 265)";

/** Word color is sentiment-first; positive/unspecified keep the varied palette. */
function colorFor(k: Keyword): string {
  if (k.sentiment === "negative") return NEGATIVE;
  if (k.sentiment === "neutral") return NEUTRAL;
  return CLOUD_COLORS[hash(k.keyword) % CLOUD_COLORS.length];
}

const MIN_PX = 13;
const MAX_PX = 36;
const MAX_WORDS = 26;

/** Stable hash so display order / color are deterministic (no hydration drift). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Detected keywords as a frequency-scaled word cloud: bigger = more mentions.
 * Display order is shuffled deterministically so large and small terms mix.
 */
export function Keywords({ keywords, bare }: { keywords: Keyword[]; bare?: boolean }) {
  if (!keywords?.length) return null;

  const top = [...keywords].sort((a, b) => b.count - a.count).slice(0, MAX_WORDS);
  const max = Math.max(...top.map((k) => k.count));
  const min = Math.min(...top.map((k) => k.count));
  const span = Math.max(1, max - min);

  const display = [...top].sort((a, b) => hash(a.keyword) - hash(b.keyword));

  const body = (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {display.map((k) => {
        const t = (k.count - min) / span; // 0..1 importance
        const size = Math.round(MIN_PX + t * (MAX_PX - MIN_PX));
        const color = colorFor(k);
        const weight = t > 0.66 ? 800 : t > 0.33 ? 700 : 600;
        return (
          <span
            key={k.keyword}
            className="cursor-default leading-none transition-opacity hover:opacity-100"
            style={{ fontSize: `${size}px`, color, fontWeight: weight, opacity: 0.6 + t * 0.4 }}
            title={`${k.keyword} — disebut ${k.count}×`}
          >
            {k.keyword}
          </span>
        );
      })}
    </div>
  );

  if (bare) return body;
  return <SideSection label="Kata kunci terdeteksi">{body}</SideSection>;
}
