import { AppShell } from "@/components/layout/AppShell";
import { OpsGlance } from "@/components/jasamarga/OpsGlance";

// PROTOTYPE — Tier-1 "Glance" redesign of /jasamarga. Reuses the same data + components,
// arranged calm-by-default with the dense panels behind a drill tab row. The live
// /jasamarga page is untouched; compare them side by side.
export default function Page() {
  return (
    <AppShell>
      <OpsGlance />
    </AppShell>
  );
}
