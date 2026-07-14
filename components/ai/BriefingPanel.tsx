"use client";

import { useEffect, useState } from "react";
import { Sparkles, Copy, Check, Printer, Loader2 } from "lucide-react";
import { isAiEnabled } from "@/lib/ai-settings";
import { cn } from "@/lib/utils";

/** Minimal markdown → React: ## / ### headings, - bullets, **bold**, paragraphs. */
function renderMarkdown(md: string) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="my-2 space-y-1 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground/85">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{inline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flushBullets();
      out.push(
        <h4 key={i} className="mt-3 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {line.replace(/^###\s+/, "")}
        </h4>,
      );
    } else if (/^##\s+/.test(line)) {
      flushBullets();
      out.push(
        <h3 key={i} className="mt-4 flex items-center gap-2 text-[14px] font-bold text-foreground first:mt-0">
          <span className="h-3 w-1 rounded-full bg-gradient-accent" />
          {line.replace(/^##\s+/, "")}
        </h3>,
      );
    } else if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, ""));
    } else if (line === "") {
      flushBullets();
    } else {
      flushBullets();
      out.push(
        <p key={i} className="my-1.5 text-[13px] leading-relaxed text-foreground/85">
          {inline(line)}
        </p>,
      );
    }
  });
  flushBullets();
  return out;
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-bold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

const DEFAULT_STAGES = [
  "Menarik sinyal lintas-wilayah",
  "Memetakan aktor & narasi",
  "Mengukur sentimen kepemimpinan",
  "Memproyeksikan trajektori risiko",
  "Mensintesis SITREP eksekutif",
];
const STEP_MS = 1100;

export interface BriefingPanelProps {
  open: boolean;
  onClose: () => void;
  /** POST endpoint returning `{ content, updated_at }`. */
  endpoint?: string;
  /** Orchestration pipeline stage labels shown during synthesis. */
  stages?: string[];
  title?: string;
  subtitle?: string;
  /** Heading + meta used for the printable report. */
  docTitle?: string;
  docMeta?: string;
}

export function BriefingPanel({
  open,
  onClose,
  endpoint = "/api/v1/ai/briefing",
  stages = DEFAULT_STAGES,
  title = "Executive Briefing",
  subtitle = "Nexorus AI Orchestration",
  docTitle = "Nexorus AI · Executive SITREP",
  docMeta = "Atlas MBG Crisis Dashboard",
}: BriefingPanelProps) {
  const STAGES = stages;
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stage, setStage] = useState(0);
  const [animDone, setAnimDone] = useState(false);

  const revealed = !loading && animDone;

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setContent("");
    setStage(0);
    setAnimDone(false);

    // A12 v2.0 (AC9) — with the AI switch off, ask the route for its scripted
    // path so the briefing still works but spends no tokens.
    fetch(isAiEnabled() ? endpoint : `${endpoint}?ai=0`, { method: "POST" })
      .then((r) => r.json())
      .then((d: { content: string; updated_at: string }) => {
        setContent(d.content);
        setUpdatedAt(d.updated_at);
      })
      .catch(() => setContent("Nexorus AI tidak dapat menyusun briefing saat ini."))
      .finally(() => setLoading(false));

    // March through the orchestration pipeline on a timer (independent of fetch).
    let s = 0;
    const id = setInterval(() => {
      s += 1;
      setStage(s);
      if (s >= STAGES.length) {
        clearInterval(id);
        setTimeout(() => setAnimDone(true), 480);
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [open, endpoint, STAGES.length]);

  const copy = async () => {
    await navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const print = () => {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    const safe = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
      .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
      .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n{2,}/g, "</p><p>");
    w.document.write(`<!doctype html><html><head><title>Nexorus AI SITREP</title>
      <style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;padding:0 24px;color:#16181d;line-height:1.6}
      h1{font-size:22px;border-bottom:2px solid #6d4aff;padding-bottom:8px}
      h2{font-size:16px;margin-top:24px;color:#3a2db5}h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#555}
      li{margin:4px 0}.meta{color:#888;font-size:12px;margin-bottom:24px}</style></head>
      <body><h1>${docTitle}</h1><div class="meta">${docMeta} · diperbarui ${updatedAt}</div>
      <p>${safe}</p></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-popover text-foreground shadow-[0_28px_70px_oklch(0.05_0.02_260/.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-bold">{title}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {subtitle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copy}
              disabled={!revealed}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Disalin" : "Salin"}
            </button>
            <button
              type="button"
              onClick={print}
              disabled={!revealed}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" /> Cetak
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-xl leading-none text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label="Tutup"
            >
              ×
            </button>
          </div>
        </div>

        {/* body */}
        <div className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!revealed ? (
            <Orchestrating stage={stage} loading={loading} stages={STAGES} subtitle={subtitle} />
          ) : (
            <>
              <span className="syn-flash pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-primary/25 via-transparent to-transparent" />
              <article className="syn-doc">{renderMarkdown(content)}</article>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Orchestrating({
  stage,
  loading,
  stages,
  subtitle,
}: {
  stage: number;
  loading: boolean;
  stages: string[];
  subtitle: string;
}) {
  const STAGES = stages;
  const len = STAGES.length;
  const waiting = stage >= len && loading;
  const allDone = stage >= len && !loading;
  const pct = allDone ? 100 : Math.min(96, Math.round(((Math.min(stage, len - 1) + 0.5) / len) * 100));

  const statusOf = (i: number): "done" | "active" | "pending" => {
    if (allDone) return "done";
    if (waiting) return i === len - 1 ? "active" : "done";
    if (i < stage) return "done";
    if (i === stage) return "active";
    return "pending";
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      {/* neural core */}
      <div className="relative h-28 w-28">
        <span className="syn-pulse absolute inset-0 rounded-full border border-primary/40" />
        <span className="syn-pulse-2 absolute inset-0 rounded-full border border-primary/30" />
        <div className="syn-ring absolute inset-0 rounded-full" />
        <div className="syn-ring-inner absolute inset-2 rounded-full" />
        <div className="syn-core absolute inset-[30px] flex items-center justify-center rounded-full bg-gradient-accent text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>

      {/* title */}
      <div className="text-center">
        <div className="text-gradient text-sm font-bold tracking-wide">{subtitle}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          Mensintesis intelijen dari seluruh widget…
        </div>
      </div>

      {/* pipeline */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border/60 bg-background/40 p-3">
        <span className="syn-scan pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-primary/25 to-transparent" />
        <div className="relative space-y-2">
          {STAGES.map((label, i) => {
            const st = statusOf(i);
            return (
              <div key={label} className="syn-stage flex items-center gap-2.5" style={{ animationDelay: `${i * 90}ms` }}>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {st === "done" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : st === "active" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-[12px] transition-colors",
                    st === "done" && "text-foreground/70",
                    st === "active" && "font-medium text-foreground",
                    st === "pending" && "text-muted-foreground/50",
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* progress */}
      <div className="w-full max-w-sm">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-accent transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
          <span className="syn-shimmer absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          <span>Orchestrating</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}
