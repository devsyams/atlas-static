import { cookies } from "next/headers";
import { AppShell } from "../../../components/layout/AppShell";
import { DanantaraCommandCenter } from "../../../components/danantara/ceo/DanantaraCommandCenter";
import { OPENGATE_ORIGIN } from "../../../lib/host";
import { hasOpengateSession } from "../../../lib/opengate-session";

/**
 * BGN Command Center (A13 v4.0) — the one-page command view, renamed from
 * `/danantara/command` and rebranded to **Badan Gizi Nasional**. Its data is served
 * from the scoped BGN demo fixtures (`mock`) because the garudaperkasa upstream is
 * dead; the panes append `?mock=1` so this signal never leaks to any other page. The
 * `danantara` scope key and `/api/v1/danantara/*` namespace are unchanged — only the
 * URL and visible branding are BGN. Reversible: drop `mock` when the new feed lands.
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
        mock
      />
    </AppShell>
  );
}
