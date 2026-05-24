"use client";

import { useEffect, useState } from "react";
import { Sparkles, Copy, Check, Printer, Loader2 } from "lucide-react";

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

export function BriefingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
    fetch("/api/v1/ai/briefing", { method: "POST" })
      .then((r) => r.json())
      .then((d: { content: string; updated_at: string }) => {
        setContent(d.content);
        setUpdatedAt(d.updated_at);
      })
      .catch(() => setContent("Synapse tidak dapat menyusun briefing saat ini."))
      .finally(() => setLoading(false));
  }, [open]);

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
    w.document.write(`<!doctype html><html><head><title>Synapse SITREP</title>
      <style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;padding:0 24px;color:#16181d;line-height:1.6}
      h1{font-size:22px;border-bottom:2px solid #6d4aff;padding-bottom:8px}
      h2{font-size:16px;margin-top:24px;color:#3a2db5}h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#555}
      li{margin:4px 0}.meta{color:#888;font-size:12px;margin-bottom:24px}</style></head>
      <body><h1>Synapse · Executive SITREP</h1><div class="meta">Atlas MBG Crisis Dashboard · diperbarui ${updatedAt}</div>
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
              <div className="text-[15px] font-bold">Executive Briefing</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Disusun oleh Synapse
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copy}
              disabled={loading || !content}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Disalin" : "Salin"}
            </button>
            <button
              type="button"
              onClick={print}
              disabled={loading || !content}
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
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="text-[13px]">Synapse sedang menyusun SITREP dari seluruh widget…</div>
            </div>
          ) : (
            <article>{renderMarkdown(content)}</article>
          )}
        </div>
      </div>
    </div>
  );
}
