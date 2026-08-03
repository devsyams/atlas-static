import { cookies } from "next/headers";
import { AppShell } from "../../../components/layout/AppShell";
import { DanantaraCommandCenter } from "../../../components/danantara/ceo/DanantaraCommandCenter";
import { OPENGATE_ORIGIN } from "../../../lib/host";
import { hasOpengateSession } from "../../../lib/opengate-session";

/**
 * BGN Command Center (A13 v5.0) — the one-page command view, renamed from
 * `/danantara/command` and rebranded to **Badan Gizi Nasional**. Live since v5.0:
 * the TrawlDeck facade serves the feeds (keyword-group 1 = BGN), so the v4.0
 * `mock` prop is dropped per the spec's reversibility clause — the fixtures and
 * the routes' `?mock=1` branches remain as the demo fallback seam. v6.3: while
 * TrawlDeck's actor enrichment is off, `staticActors` opts the gate's Aktor
 * Penggerak column onto the captured OpenGate roster (`?static=1`, A10 v10.0)
 * with per-actor detail popups; drop the prop when enrichment lands. v7.0: `showWarRoom={false}`
 * hides the A14 Counter-Narrative War Room (and its nested "Recommended Counter-Posts" cards) on
 * this page per client request — the section is not rendered and its feeds are never fetched;
 * drop the prop to bring it back. The `danantara` scope key and `/api/v1/danantara/*` namespace
 * are unchanged — only the URL and visible branding are BGN.
 */
export default async function Page() {
  const cookieStore = await cookies();
  const mediaIntelligenceHref = (await hasOpengateSession(cookieStore, process.env.ATLAS_SSO_SECRET))
    ? OPENGATE_ORIGIN
    : undefined;

  return (
    <AppShell>
      <DanantaraCommandCenter
        mediaIntelligenceHref={mediaIntelligenceHref}
        brand="BGN"
        brandLogo="/bgn.png"
        briefingHref="/bgn/briefing"
        bgn
        staticActors
        showWarRoom={false}
      />
    </AppShell>
  );
}
