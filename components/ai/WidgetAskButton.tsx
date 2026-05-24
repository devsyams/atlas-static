"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";

/** Renders **bold** spans; everything else plain. */
function rich(text: string) {
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

const MODES: { key: string; label: string }[] = [
  { key: "explain", label: "Jelaskan" },
  { key: "drivers", label: "Pendorong" },
  { key: "talking", label: "Poin bicara" },
];

export function WidgetAskButton({ widget, title }: { widget: string; title: string }) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  const ask = async (m: string) => {
    setMode(m);
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch("/api/v1/ai/widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widget, mode: m }),
      });
      const data = (await res.json()) as { answer: string };
      setAnswer(data.answer);
    } catch {
      setAnswer("Synapse tidak tersedia saat ini.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dropdown
      align="end"
      contentClassName="w-72 p-0"
      trigger={
        <span
          title="Tanya Synapse tentang widget ini"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      }
    >
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          Synapse · {title}
        </div>
        <div className="mt-2 flex gap-1.5">
          {MODES.map((mo) => (
            <button
              key={mo.key}
              type="button"
              onClick={() => ask(mo.key)}
              className={`rounded-md border px-2 py-1 text-[10px] font-bold transition-colors ${
                mode === mo.key
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {mo.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 py-2.5 text-[12px] leading-relaxed text-foreground/85">
        {loading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Menganalisis…
          </span>
        ) : answer ? (
          <span className="whitespace-pre-wrap">{rich(answer)}</span>
        ) : (
          <span className="text-muted-foreground">Pilih mode untuk insight singkat dari Synapse.</span>
        )}
      </div>
    </Dropdown>
  );
}
