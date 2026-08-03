import { AppShell } from "@/components/layout/AppShell";
import { CeoCommand } from "@/components/danantara/ceo/CeoCommand";

// `DANANTARA_DEMO_MOCK` is read per request below, so this page MUST render
// dynamically (A7 v52.1). Nothing here uses a dynamic API, so by default Next would
// statically prerender the page at BUILD time — freezing the flag to its build-time
// value (unset in the Docker builder) and making the runtime env var a no-op. That was
// the bug: editing the k8s secret had no effect because the shipped image already had
// `mock={false}` baked in. force-dynamic runs the component per request, so the flag is
// honoured at runtime. Cheap: the shell is thin and all real data is client-fetched.
export const dynamic = "force-dynamic";

export default function Page() {
  // Demo stopgap (A7 v50.1): while the live Danantara feed's opengate key is being
  // renewed, set DANANTARA_DEMO_MOCK=1 to serve the Issues + BUMN boards from the bundled
  // demo fixtures (`lib/danantara/mock`) via the topics/bumn-board routes' product-aware
  // `?mock=1` branch. Unset → the live path. Read server-side (never in the client
  // bundle); with force-dynamic above it's read per request, so toggling the env var
  // takes effect on the next request — no rebuild, and reverting is just clearing it.
  const demoMock = process.env.DANANTARA_DEMO_MOCK === "1";
  return (
    <AppShell>
      <CeoCommand mock={demoMock} />
    </AppShell>
  );
}
