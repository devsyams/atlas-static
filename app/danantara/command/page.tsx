import { cookies } from "next/headers";
import { AppShell } from "../../../components/layout/AppShell";
import { DanantaraCommandCenter } from "../../../components/danantara/ceo/DanantaraCommandCenter";
import { OPENGATE_ORIGIN } from "../../../lib/host";
import { hasOpengateSession } from "../../../lib/opengate-session";

export default async function Page() {
  const cookieStore = await cookies();
  const mediaIntelligenceHref = (await hasOpengateSession(cookieStore, process.env.ATLAS_SSO_SECRET))
    ? OPENGATE_ORIGIN
    : undefined;

  return (
    <AppShell>
      <DanantaraCommandCenter mediaIntelligenceHref={mediaIntelligenceHref} />
    </AppShell>
  );
}
