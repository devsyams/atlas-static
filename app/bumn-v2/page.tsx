import { AppShell } from "@/components/layout/AppShell";
import { BumnIndex } from "@/components/bumn/BumnIndex";

export default function Page() {
  return (
    <AppShell>
      <BumnIndex basePath="/bumn-v2" />
    </AppShell>
  );
}
