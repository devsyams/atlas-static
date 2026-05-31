import { Newspaper } from "lucide-react";
import type { NewsArticle } from "@/lib/jasamarga/types";
import { cn } from "@/lib/utils";

function sevClass(s: number): string {
  if (s >= 6) return "bg-destructive/15 text-destructive";
  if (s >= 3) return "bg-warning/15 text-warning";
  return "bg-success/15 text-success";
}

/** Recent online news coverage of the corridor. */
export function NewsCoverage({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="flex flex-col gap-2">
      {articles.map((a, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2">
          <span className={cn("mt-0.5 min-w-[26px] shrink-0 rounded-md px-1 py-1 text-center text-[11px] font-extrabold", sevClass(a.sentiment))}>
            {a.sentiment}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold leading-snug">{a.title}</div>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{a.summary}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/80">
              <Newspaper className="h-2.5 w-2.5" /> {a.source} · {a.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
