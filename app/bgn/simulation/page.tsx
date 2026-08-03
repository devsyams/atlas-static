import { AppShell } from "@/components/layout/AppShell";
import { SimulationConsole } from "@/components/danantara/sim/console/SimulationConsole";

/**
 * BGN Crisis Simulation Room (A15 v5.0) — the /bgn port of the shared world
 * builder at /danantara/simulation. Same `SimulationConsole`; the `bgn` prop
 * only swaps in BGN/MBG-themed reality-seed samples (samplesBgn in modes.ts).
 */
export default function Page() {
  return (
    <AppShell>
      <SimulationConsole bgn />
    </AppShell>
  );
}
