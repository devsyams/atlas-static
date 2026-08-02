import { AppShell } from "@/components/layout/AppShell";
import { CeoCommand } from "@/components/danantara/ceo/CeoCommand";

export default function Page() {
  // Demo stopgap (A7 v50.1): while the live Danantara feed's opengate key is being
  // renewed, set DANANTARA_DEMO_MOCK=1 to serve the Issues board from the bundled demo
  // fixture (`lib/danantara/mock`) via the topics route's product-aware `?mock=1` branch.
  // Unset → the live path, byte-identical. Read server-side, so it never hits the client
  // bundle. Reverts by clearing the env var (no code change).
  const demoMock = process.env.DANANTARA_DEMO_MOCK === "1";
  return (
    <AppShell>
      <CeoCommand mock={demoMock} />
    </AppShell>
  );
}
