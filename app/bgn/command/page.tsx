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
 * the routes' `?mock=1` branches remain as the demo fallback seam. The `danantara`
 * scope key and `/api/v1/danantara/*` namespace are unchanged — only the URL and
 * visible branding are BGN.
 */
export default async function Page() {
  const cookieStore = await cookies();
  const mediaIntelligenceHref = (await hasOpengateSession(cookieStore, process.env.ATLAS_SSO_SECRET))
    ? OPENGATE_ORIGIN
    : undefined;

  return (
    <AppShell>
      <DanantaraCommandCenter mediaIntelligenceHref={mediaIntelligenceHref} brand="BGN" brandLogo="/bgn.png" />
    </AppShell>
  );
}
