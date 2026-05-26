import type { ReactNode } from "react";

interface PageHeaderProps {
  title?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:-mt-6 sm:px-6">
      {title && (
        <h1 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
          {title}
        </h1>
      )}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel p-4 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            {title && <div className="text-sm font-semibold">{title}</div>}
            {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
