import type { ReactNode } from "react";

export function SideSection({
  label,
  note,
  children,
}: {
  label: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </div>
        {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
      </div>
      {children}
    </div>
  );
}
