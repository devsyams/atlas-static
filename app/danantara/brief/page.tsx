import { AppShell } from "@/components/layout/AppShell";
import { DanantaraBrief } from "@/components/danantara/brief/DanantaraBrief";

// `DANANTARA_DEMO_MOCK` is read per request below, so this page MUST render
// dynamically (mirrors /danantara A7 v52.1 & /danantara/krisis A10 v11.2). Nothing here
// uses a dynamic API, so by default Next would statically prerender the page at BUILD
// time — freezing the flag to its build-time value (unset in the Docker builder) and
// making the runtime env var a no-op. That would leave the "View briefing" link a
// dead-end (live feed 502s while the key is dead) even with the demo flag on.
// force-dynamic runs the component per request, so the flag is honoured at runtime.
// Cheap: the shell is thin and all real data is client-fetched.
export const dynamic = "force-dynamic";

export default function Page() {
  // Demo stopgap (A10 v11.2): while the live Danantara feed's opengate key is being
  // renewed, set DANANTARA_DEMO_MOCK=1 to serve the Executive Briefing from the same
  // bundled demo fixture (`MOCK_DANANTARA_TOPICS`) that powers /danantara and
  // /danantara/krisis, via the topics route's product-aware `?mock=1` branch — so the
  // /krisis "View briefing" link lands on a fully-populated, story-consistent briefing
  // instead of "Data unavailable". Unset → the live path. Read server-side (never in the
  // client bundle); with force-dynamic above it's read per request, so toggling the env
  // var takes effect on the next request — no rebuild, and reverting is just clearing it.
  // /bgn/briefing is the BGN product (live feed) and never sets this.
  const demoMock = process.env.DANANTARA_DEMO_MOCK === "1";
  return (
    <AppShell>
      <DanantaraBrief mock={demoMock} />
    </AppShell>
  );
}
