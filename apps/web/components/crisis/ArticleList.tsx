import type { Article } from "@/lib/mbg/types";
import { badgeClass, cityKeyFromLocation } from "@/lib/mbg/colors";
import { cn } from "@/lib/utils";
import { SideSection } from "./SideSection";

export function ArticleList({
  articles,
  selectedCityKey,
  filterNote,
  onOpen,
  bare,
}: {
  articles: Article[];
  selectedCityKey: string | null;
  filterNote: string;
  onOpen: (index: number) => void;
  bare?: boolean;
}) {
  const body = !articles.length ? (
    <div className="py-6 text-center text-[13px] text-muted-foreground">
      {selectedCityKey
        ? "Tidak ada artikel untuk lokasi yang dipilih."
        : "Belum ada artikel terdeteksi."}
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {articles.map((article, index) => {
        const active =
          !!selectedCityKey && cityKeyFromLocation(article.location) === selectedCityKey;
        const place = article.location
          ? `${article.location.city}, ${article.location.province}`
          : "Lokasi AI belum tersedia";
        const issue = article.dominant_issue ? ` · isu ${article.dominant_issue}` : "";
        return (
          <button
            key={`${article.link}-${index}`}
            type="button"
            title="Klik untuk detail"
            onClick={() => onOpen(index)}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors",
              active
                ? "border-primary/40 bg-primary/10"
                : "border-border/50 bg-background/40 hover:border-border hover:bg-background/60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 min-w-[30px] shrink-0 rounded-md px-1.5 py-1 text-center text-[11px] font-extrabold",
                badgeClass(article.score),
              )}
            >
              {article.score}
            </span>
            <div>
              <div className="text-xs font-semibold leading-snug">{article.title}</div>
              <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                {article.source} · {place}
                {issue} · {(article.date || "").slice(0, 16)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  if (bare) return body;
  return (
    <SideSection label="Berita terkini" note={filterNote}>
      {body}
    </SideSection>
  );
}
