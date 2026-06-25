/**
 * Executive-summary points for the Crisis Gate's top threat (A10) — pure helpers,
 * no I/O. The live topics feed gives one verbose AI `penjelasan` per topic; the
 * CEO read wants 2–3 *scannable* points instead. The AI path (server-only, see
 * `threat-summary-feed.ts`) condenses the prose; these helpers build its prompt,
 * parse its reply, and provide the deterministic fallback used whenever AI is off
 * or fails — so the panel always has short points, never the raw paragraph.
 */

const MAX_POINTS = 3;

/** Strip a leading list marker (•, -, "1.") and trailing punctuation/space. */
function clean(s: string): string {
  return s
    .replace(/^\s*(?:[-*•·–]|\d+[.)])\s*/, "")
    .replace(/[\s.;,]+$/, "")
    .trim();
}

/**
 * Reduce one sentence to a scannable point **without ever truncating mid-text**:
 * prefer its lead clause (before the first comma) when that stands on its own,
 * otherwise keep the whole sentence. The UI wraps a long point to the next line —
 * nothing is cut off, so the reader never loses the end of a thought.
 */
export function shortenPoint(sentence: string): string {
  const s = clean(sentence);
  if (!s) return s;
  const lead = s.split(",")[0].trim();
  return lead.split(/\s+/).length >= 4 ? lead : s;
}

/**
 * Deterministic fallback when AI summarisation is unavailable: split the one-line
 * AI read into sentence-level points and shorten each. Capped at `max` points.
 */
export function fallbackPoints(aiLine: string, max = MAX_POINTS): string[] {
  return (aiLine || "")
    .split(/(?<=[.;])\s+/)
    .map((s) => shortenPoint(s))
    .filter(Boolean)
    .slice(0, max);
}

/** System + user prompt to condense one threat's explanation into 3 short points. */
export function summaryPrompt(title: string, aiLine: string): { system: string; user: string } {
  const system =
    "Anda analis intelijen media yang menyiapkan ringkasan eksekutif untuk CEO (usia 40+). " +
    "Dari penjelasan sebuah topik, hasilkan TEPAT 3 poin ringkas berbahasa Indonesia. " +
    "Aturan: setiap poin maksimal 9 kata; padat dan langsung ke inti risiko atau temuan; " +
    "jangan menambah fakta baru di luar penjelasan; jangan beri penomoran, tanda hubung, atau markdown; " +
    "satu poin per baris.";
  const user = `Topik: ${title}\n\nPenjelasan:\n${aiLine}`;
  return { system, user };
}

/** Parse the model's reply (one point per line) into clean, capped points. */
export function parseSummaryPoints(raw: string, max = MAX_POINTS): string[] {
  return (raw || "")
    .split(/\r?\n/)
    .map((l) => clean(l))
    .filter(Boolean)
    .slice(0, max);
}
