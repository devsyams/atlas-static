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
  // Launch set (A8 v1.0)
  { slug: "mandiri", name: "Bank Mandiri", short: "BMRI", sector: "perbankan", topicCode: "danantara_mandiri" },
  { slug: "pln", name: "PLN", short: "PLN", sector: "energi", topicCode: "danantara_pln" },
  { slug: "telkom", name: "Telkom Indonesia", short: "TLKM", sector: "telko", topicCode: "danantara_telkom" },
  { slug: "pertamina", name: "Pertamina", short: "Pertamina", sector: "energi", topicCode: "danantara_pertamina" },
  { slug: "bni", name: "Bank BNI", short: "BBNI", sector: "perbankan", topicCode: "danantara_bni" },
  { slug: "bri", name: "Bank BRI", short: "BBRI", sector: "perbankan", topicCode: "danantara_bri" },
  { slug: "jasamarga", name: "Jasa Marga", short: "JSMR", sector: "infrastruktur", topicCode: "danantara_jasamarga" },

  // Portfolio expansion (A8 v7.0) — financial services
  { slug: "bsi", name: "Bank Syariah Indonesia", short: "BRIS", sector: "perbankan", topicCode: "danantara_bsi" },
  { slug: "asabri", name: "ASABRI", short: "ASABRI", sector: "perbankan", topicCode: "danantara_asabri" },
  { slug: "askrindo", name: "Askrindo", short: "Askrindo", sector: "perbankan", topicCode: "danantara_askrindo" },
  { slug: "askrindosyariah", name: "Askrindo Syariah", short: "Askrindo Sy", sector: "perbankan", topicCode: "danantara_askrindosyariah" },
  { slug: "jamkrindo", name: "Jamkrindo", short: "Jamkrindo", sector: "perbankan", topicCode: "danantara_jamkrindo" },
  { slug: "jamkrindosyariah", name: "Jamkrindo Syariah", short: "Jamkrindo Sy", sector: "perbankan", topicCode: "danantara_jamkrindosyariah" },
  { slug: "pegadaian", name: "Pegadaian", short: "Pegadaian", sector: "perbankan", topicCode: "danantara_pegadaian" },
  { slug: "manajemenaset", name: "Danantara Manajemen Aset", short: "Aset", sector: "perbankan", topicCode: "danantara_manajemenaset" },

  // Construction & transport networks
  { slug: "adhikarya", name: "Adhi Karya", short: "ADHI", sector: "infrastruktur", topicCode: "danantara_adhikarya" },
  { slug: "hutamakarya", name: "Hutama Karya", short: "HK", sector: "infrastruktur", topicCode: "danantara_hutamakarya" },
  { slug: "pembangunanperumahan", name: "PT PP (Pembangunan Perumahan)", short: "PTPP", sector: "infrastruktur", topicCode: "danantara_pembangunanperumahan" },
  { slug: "waskitakarya", name: "Waskita Karya", short: "WSKT", sector: "infrastruktur", topicCode: "danantara_waskitakarya" },
  { slug: "wijayakarya", name: "Wijaya Karya", short: "WIKA", sector: "infrastruktur", topicCode: "danantara_wijayakarya" },
  { slug: "pelindo", name: "Pelindo", short: "Pelindo", sector: "infrastruktur", topicCode: "danantara_pelindo" },
  { slug: "asdpindonesia", name: "ASDP Indonesia Ferry", short: "ASDP", sector: "infrastruktur", topicCode: "danantara_asdpindonesia" },
  { slug: "pelni", name: "PELNI", short: "PELNI", sector: "infrastruktur", topicCode: "danantara_pelni" },

  // Industri & logistik
  { slug: "posindonesia", name: "Pos Indonesia", short: "Pos", sector: "industri", topicCode: "danantara_posindonesia" },
  { slug: "garudaindonesia", name: "Garuda Indonesia", short: "GIAA", sector: "industri", topicCode: "danantara_garudaindonesia" },
  { slug: "citilink", name: "Citilink", short: "Citilink", sector: "industri", topicCode: "danantara_citilink" },
  { slug: "pelitaair", name: "Pelita Air", short: "Pelita Air", sector: "industri", topicCode: "danantara_pelitaair" },
  { slug: "galangankapal", name: "Galangan Kapal", short: "Galangan", sector: "industri", topicCode: "danantara_galangankapal" },
  { slug: "kimiafarma", name: "Kimia Farma", short: "KAEF", sector: "industri", topicCode: "danantara_kimiafarma" },
  { slug: "pertamina_rspp", name: "RS Pusat Pertamina (RSPP)", short: "RSPP", sector: "industri", topicCode: "danantara_pertamina_rspp" },
  { slug: "injourney", name: "InJourney", short: "InJourney", sector: "industri", topicCode: "danantara_injourney" },

  // Pangan & konsumer
  { slug: "agrinaspalma", name: "AgriNas Palma", short: "AgriNas", sector: "pangan", topicCode: "danantara_agrinaspalma" },
  { slug: "sarinah", name: "Sarinah", short: "Sarinah", sector: "pangan", topicCode: "danantara_sarinah" },
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
