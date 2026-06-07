/**
 * Per-BUMN dashboard registry (A8). One row per BUMN: the URL slug, the display
 * name, and the live-feed topic code. Single source of truth — adding a BUMN is
 * one row here (+ one scoped login derived from it in `lib/auth`).
 *
 * Plain TS (no React / Node APIs) so it can be imported by the Edge middleware,
 * the BFF route, and client components alike.
 */

import type { SectorKey } from "@/lib/danantara/types";

export interface Bumn {
  /** URL slug — `/bumn/<slug>`. Also the logo key (`/public/bumn/<slug>.png`). */
  slug: string;
  /** Display name shown in the dashboard header. */
  name: string;
  /** Short ticker/nickname for the CEO-wall BUMN board. */
  short: string;
  /** Sector key (drives the monogram color + sector label on the board). */
  sector: SectorKey;
  /** garudaperkasa topic code for this BUMN. */
  topicCode: string;
}

export const BUMN_REGISTRY: Bumn[] = [
  { slug: "mandiri", name: "Bank Mandiri", short: "BMRI", sector: "perbankan", topicCode: "danantara_mandiri" },
  { slug: "pln", name: "PLN", short: "PLN", sector: "energi", topicCode: "danantara_pln" },
  { slug: "telkom", name: "Telkom Indonesia", short: "TLKM", sector: "telko", topicCode: "danantara_telkom" },
  { slug: "pertamina", name: "Pertamina", short: "Pertamina", sector: "energi", topicCode: "danantara_pertamina" },
  { slug: "bni", name: "Bank BNI", short: "BBNI", sector: "perbankan", topicCode: "danantara_bni" },
  { slug: "bri", name: "Bank BRI", short: "BBRI", sector: "perbankan", topicCode: "danantara_bri" },
  { slug: "jasamarga", name: "Jasa Marga", short: "JSMR", sector: "infrastruktur", topicCode: "danantara_jasamarga" },
];

/** The Danantara-wide code served by the CEO command wall (A7). */
export const DANANTARA_MAIN_CODE = "danantara_main";

export function listBumn(): Bumn[] {
  return BUMN_REGISTRY;
}

export function getBumn(slug: string): Bumn | undefined {
  return BUMN_REGISTRY.find((b) => b.slug === slug);
}

/**
 * Allowlist guard for the BFF `?code=` param: only the registered BUMN codes and
 * `danantara_main` may be proxied — never an arbitrary upstream topic.
 */
export function isAllowedTopicCode(code: string): boolean {
  if (code === DANANTARA_MAIN_CODE) return true;
  return BUMN_REGISTRY.some((b) => b.topicCode === code);
}
