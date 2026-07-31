"use client";

import type { ConsoleReport } from "@/lib/danantara/sim/console-types";

/**
 * The prediction report (A15 v3.0) — set in serif on white, deliberately unlike the
 * rest of the console's monospace chrome: it is meant to read as a **document** the
 * client could print, not as another dashboard panel.
 *
 * `written` is how many sections have been produced so far, so step 4 can reveal the
 * report section by section while later headings sit greyed out ahead of it.
 */
export function ReportDocument({
  report,
  written,
  reportId,
  showBadge = true,
}: {
  report: ConsoleReport;
  /** Sections completed; the next one shows a generating line. */
  written: number;
  reportId: string;
  showBadge?: boolean;
}) {
  return (
    <article data-testid="report-document" className="mx-auto max-w-3xl px-8 py-10">
      {showBadge && (
        <div className="mb-6 flex items-center gap-3">
          <span className="bg-black px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
            Prediction Report
          </span>
          <span className="font-mono text-[12px] text-black/40">ID: {reportId}</span>
        </div>
      )}

      <h1 data-testid="report-title" className="font-serif text-[38px] font-bold leading-[1.15] tracking-tight text-black">
        {report.title}
      </h1>
      <p data-testid="report-abstract" className="mt-6 font-serif text-[17px] italic leading-relaxed text-black/70">
        {report.abstract}
      </p>

      <hr className="my-9 border-black/10" />

      {report.sections.map((s, i) => {
        const done = i < written;
        const writing = i === written;
        return (
          <section key={s.heading} data-testid={`report-section-${i}`} className="mb-11">
            <div className="flex gap-4">
              <span className={`font-mono text-[15px] ${done ? "text-black/35" : "text-black/15"}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2
                className={`font-serif text-[25px] font-bold leading-snug tracking-tight ${
                  done ? "text-black" : "text-black/20"
                }`}
              >
                {s.heading}
              </h2>
            </div>

            {writing && (
              <div className="mt-4 flex items-start gap-3 pl-9">
                <span
                  className="mt-1.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-black/15 border-t-black/50"
                  aria-hidden
                />
                <p className="font-serif text-[15px] italic leading-relaxed text-black/45">Generating {s.heading}…</p>
              </div>
            )}

            {done && (
              <div className="mt-4 pl-9">
                {s.subheading && <h3 className="text-[15px] font-bold leading-snug text-black">{s.subheading}</h3>}
                {s.paragraphs.map((p, k) => (
                  <p key={k} className="mt-3.5 text-[15px] leading-[1.75] text-black/80">
                    {p}
                  </p>
                ))}
                {s.quote && (
                  <blockquote className="mt-5 border-l-2 border-black/15 pl-5 font-serif text-[15px] italic leading-relaxed text-black/60">
                    “{s.quote}”
                  </blockquote>
                )}
              </div>
            )}
          </section>
        );
      })}
    </article>
  );
}
