import { BadgeCheck } from "lucide-react";
import type { OfficialPost } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

const CAT_CLASS: Record<string, string> = {
  Rekayasa: "border-primary/40 text-primary",
  Imbauan: "border-warning/40 text-warning",
  Pemeliharaan: "border-muted-foreground/40 text-muted-foreground",
  Tarif: "border-destructive/40 text-destructive",
};

/** Scraped official announcements from @PTJASAMARGA / Travoy. */
export function OfficialFeed({ posts }: { posts: OfficialPost[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5 text-primary" />
        Sumber: <span className="font-semibold text-foreground/80">@PTJASAMARGA · Travoy</span>
      </div>
      {posts.map((p, i) => (
        <div key={i} className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("rounded-full border bg-background/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", CAT_CLASS[p.category] ?? "border-border text-muted-foreground")}>
              {p.category}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{p.time}</span>
          </div>
          <div className="mt-1 text-xs font-semibold leading-snug">{p.title}</div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.body}</p>
        </div>
      ))}
    </div>
  );
}
