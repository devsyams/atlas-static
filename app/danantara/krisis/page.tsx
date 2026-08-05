import { AppShell } from "@/components/layout/AppShell";
import { CrisisGate } from "@/components/danantara/ceo/CrisisGate";

// `DANANTARA_DEMO_MOCK` is read per request below, so this page MUST render
// dynamically (mirrors A7 v52.1 on /danantara). Nothing here uses a dynamic API, so by
// default Next would statically prerender the page at BUILD time — freezing the flag to
// its build-time value (unset in the Docker builder) and making the runtime env var a
// no-op. force-dynamic runs the component per request, so the flag is honoured at
// runtime. Cheap: the shell is thin and all real data is client-fetched.
export const dynamic = "force-dynamic";

export default function Page() {
  // Demo stopgap (A10 v11.2): while the live Danantara feeds' opengate key is being
  // renewed, set DANANTARA_DEMO_MOCK=1 to serve the Crisis Gate's three columns (Indeks
  // Ancaman, Ancaman Utama, Aktor Penggerak) from the bundled demo fixtures
  // (`lib/danantara/mock`) via the topics/threats/actor-intelligence routes' product-aware
  // `?mock=1` branch. Unset → the live path. Read server-side (never in the client bundle);
  // with force-dynamic above it's read per request, so toggling the env var takes effect on
  // the next request — no rebuild, and reverting is just clearing it.
  const demoMock = process.env.DANANTARA_DEMO_MOCK === "1";
  return (
    <AppShell>
      <CrisisGate mock={demoMock} />
    </AppShell>
  );
}
