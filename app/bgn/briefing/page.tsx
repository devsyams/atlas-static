import { AppShell } from "../../../components/layout/AppShell";
import { DanantaraBrief } from "../../../components/danantara/brief/DanantaraBrief";

/**
 * BGN Executive Briefing (A11 v3.0) — the /bgn home of the shared briefing, opened
 * from /bgn/command's "View briefing" (A10 v9.3 / A13 v6.2). Same `DanantaraBrief`
 * as the legacy /danantara/brief; only the back arrow differs, returning to
 * /bgn/command so the BGN flow never leaves /bgn/*.
 */
export default function Page() {
  return (
    <AppShell>
      <DanantaraBrief backHref="/bgn/command" />
    </AppShell>
  );
}
