/**
 * Real identities the world builder must never use as a **persona** (A15 v2.0 AC11).
 *
 * The simulation renders realistic-looking social posts about a real organisation.
 * Attributing one to a real person, outlet or official account is a defamation
 * exposure, not a demo detail — so the parser rejects any payload whose persona
 * handle or display name matches one of these, rather than rendering it.
 *
 * These are *names*, not opinions: it is entirely fine (and necessary) for a
 * simulated post to *mention* Danantara or a ministry — the document is about them.
 * The rule is only that they may not be the **author**.
 *
 * Matching is done on a lowercased, alphanumeric-only form, so `@Rosan_Roeslani`,
 * `Rosan Roeslani` and `rosanroeslani` all collapse to the same token. Entries must
 * therefore be lowercase and unpunctuated, and long enough not to fire on ordinary
 * Indonesian words — a short fragment here would silently reject good worlds.
 */
/** Max characters of pasted seed passed to the model. Keeps one call bounded. */
export const SEED_MAX = 6_000;

/** True when a string looks like it names a real public figure, outlet or org account. */
export function namesRealIdentity(value: string): boolean {
  const v = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!v) return false;
  return PUBLIC_FIGURE_PATTERNS.some((p) => v.includes(p));
}

export const PUBLIC_FIGURE_PATTERNS: readonly string[] = [
  // Officials and executives named across the Danantara / BUMN coverage.
  "prabowo",
  "gibran",
  "jokowi",
  "widodo",
  "rosanroeslani",
  "roeslani",
  "donyoskaria",
  "oskaria",
  "purbaya",
  "srimulyani",
  "erickthohir",
  "thohir",
  "agusharimurti",
  "yudhoyono",
  "pandjaitan",
  "luhut",

  // Officials named across the BGN / MBG coverage.
  "sudaryono",
  "dadanhindayana",
  "hindayana",

  // Media outlets — a persona must never impersonate a newsroom account.
  "kompas",
  "detikcom",
  "tempo",
  "cnbcindonesia",
  "cnnindonesia",
  "tribunnews",
  "antaranews",
  "bisnisindonesia",
  "katadata",
  "liputan6",
  "republika",
  "okezone",
  "kumparan",
  "reuters",
  "bloomberg",

  // Official institution accounts.
  "danantaraindonesia",
  "kemenkeu",
  "kementerianbumn",
  "bankindonesia",
  "ojkindonesia",
  "setkabgoid",
  "badangizinasional",
  "bgnri",
  "perumbulog",
] as const;
