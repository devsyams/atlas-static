import type { Keyword } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";
import { SideSection } from "./SideSection";

export function Keywords({ keywords, bare }: { keywords: Keyword[]; bare?: boolean }) {
  if (!keywords?.length) return null;
  const body = (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map((k) => {
        const hot = k.count >= 2;
        return (
          <span
            key={k.keyword}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              hot
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-background/40 text-foreground/80",
            )}
          >
            {k.keyword} ×{k.count}
          </span>
        );
      })}
    </div>
  );

  if (bare) return body;
  return <SideSection label="Kata kunci terdeteksi">{body}</SideSection>;
}
