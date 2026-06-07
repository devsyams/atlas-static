import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { listBumn } from "@/lib/bumn/registry";

/** Super-admin index of all per-BUMN dashboards (gated to the `all` scope by middleware). */
export function BumnIndex() {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-base font-bold uppercase tracking-[0.08em] text-primary">Danantara · Portfolio</div>
        <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">BUMN Dashboards</h1>
        <p className="mt-1.5 text-base text-muted-foreground">Open a BUMN to see its public sentiment &amp; topics.</p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {listBumn().map((b) => (
          <li key={b.slug}>
            <Link
              href={`/bumn/${b.slug}`}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3.5 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Building2 className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xl font-semibold">{b.name}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
