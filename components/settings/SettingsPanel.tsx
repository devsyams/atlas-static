"use client";

import { Brain, Coins, Radio } from "lucide-react";

import { isAiEnabled, setAiEnabled, useAiEnabled } from "@/lib/ai-settings";
import { cn } from "@/lib/utils";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        on ? "border-success/60 bg-success/30" : "border-border bg-muted/40",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full transition-all",
          on ? "left-[25px] bg-success" : "left-[3px] bg-muted-foreground",
        )}
      />
    </button>
  );
}

/**
 * A12 v2.0 (AC9) — the Nexorus AI kill switch.
 *
 * Off means the browser stops calling the LLM-backed routes entirely, so an
 * idle demo costs nothing. The dashboards keep working on their deterministic
 * path and badge themselves `Simulasi`.
 */
export function SettingsPanel() {
  const aiOn = useAiEnabled();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Nexorus ATLAS</p>
        <h1 className="mt-1 text-2xl font-extrabold">System Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kontrol biaya dan sumber data untuk sesi demo.
        </p>
      </header>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <Brain className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Nexorus AI (LLM)</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Menyalakan analisis dan prediksi berbasis model pada dashboard JasaMarga
                (<em>AI Ops Insight</em> dan <em>Prediksi Kemacetan</em>).{" "}
                <strong className="text-foreground/90">Saat dimatikan, tidak ada panggilan model sama sekali</strong> —
                nol token, nol biaya. Kedua widget kembali ke perhitungan deterministik dan
                menampilkan badge <code className="text-[11px]">Simulasi</code>.
              </p>
            </div>
          </div>
          <Toggle on={aiOn} onChange={setAiEnabled} label="Nexorus AI (LLM)" />
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3 text-[12px] text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
              aiOn ? "border-success/40 text-success" : "border-border text-muted-foreground",
            )}
          >
            <Radio className="h-3 w-3" /> {aiOn ? "Aktif" : "Nonaktif"}
          </span>
          <span>Preferensi ini tersimpan di peramban ini.</span>
        </div>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="flex gap-3">
          <Coins className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h2 className="text-sm font-bold">Cache & biaya</h2>
            <ul className="mt-1 space-y-1 text-[13px] leading-relaxed text-muted-foreground">
              <li>
                Hasil AI di-cache <strong className="text-foreground/90">1 jam per ruas tol</strong>, jadi dashboard
                yang dibiarkan terbuka seharian tetap maksimal 1 panggilan model per ruas per jam
                (bukan setiap kali polling 60 detik).
              </li>
              <li>
                Sentimen publik memakai <strong className="text-foreground/90">data nyata</strong> dari feed media
                intelligence (topik JasaMarga) — di-cache 6 jam, tanpa biaya LLM.
              </li>
              <li>Kunci API tetap di sisi server; tidak pernah dikirim ke peramban.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Exported for the tests — the panel's initial state comes straight from storage. */
export { isAiEnabled };
