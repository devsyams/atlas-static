import { headers } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import { DanantaraCommandCenter } from "@/components/danantara/ceo/DanantaraCommandCenter";
import { isOpengateRequest, OPENGATE_ORIGIN } from "@/lib/host";

export default async function Page() {
  const requestHeaders = await headers();
  const mediaIntelligenceHref = isOpengateRequest(requestHeaders) ? OPENGATE_ORIGIN : undefined;

  return (
    <AppShell>
      <DanantaraCommandCenter mediaIntelligenceHref={mediaIntelligenceHref} />
    </AppShell>
  );
}
