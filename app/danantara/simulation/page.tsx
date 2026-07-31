import { AppShell } from "@/components/layout/AppShell";
import { SimulationConsole } from "@/components/danantara/sim/console/SimulationConsole";

export default function Page() {
  return (
    <AppShell>
      <SimulationConsole />
    </AppShell>
  );
}
