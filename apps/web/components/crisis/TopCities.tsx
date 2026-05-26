import type { TopCity } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";
import { SideSection } from "./SideSection";

export function TopCities({
  cities,
  selectedCityKey,
  onSelect,
  bare,
}: {
  cities: TopCity[];
  selectedCityKey: string | null;
  onSelect: (key: string) => void;
  bare?: boolean;
}) {
  const body = !cities.length ? (
    <div className="py-6 text-center text-[13px] text-muted-foreground">
      Belum ada kota yang cukup yakin untuk diranking.
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {cities.map((city, index) => {
        const active = !!selectedCityKey && city.city_key === selectedCityKey;
        return (
          <button
            key={city.city_key}
            type="button"
            onClick={() => onSelect(city.city_key)}
            className={cn(
              "flex items-start justify-between gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors",
              active
                ? "border-primary/40 bg-primary/10"
                : "border-border/50 bg-background/40 hover:border-border hover:bg-background/60",
            )}
          >
            <div className="flex gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-extrabold text-primary">
                {index + 1}
              </span>
              <div>
                <div className="text-xs font-bold">{city.city}</div>
                <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  {city.article_count} artikel · {city.province}
                </div>
              </div>
            </div>
            <span className="whitespace-nowrap rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive">
              {city.dominant_issue}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (bare) return body;
  return (
    <SideSection label="Kota teratas" note="Konsentrasi isu negatif">
      {body}
    </SideSection>
  );
}
