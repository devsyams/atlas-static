import type { DashboardData } from "@/lib/mbg/types";
import { cn } from "@/lib/utils";

export function AiStatusCard({ data }: { data: DashboardData | null }) {
  let title: string;
  let copy: string;
  let tone: string;

  if (!data) {
    tone = "border-border/60 bg-card/40";
    title = "Memeriksa AI engine…";
    copy = "Lokasi kota dan isu dominan akan diisi setelah analisis AI siap.";
  } else if (data.ai_status === "ready") {
    tone = "border-success/40 bg-success/5";
    title = "AI engine aktif untuk kota dan isu";
    copy = `${data.mapped_article_count || 0} artikel berhasil dipetakan ke kota. Heatmap dan ranking kota memakai analisis AI ini.`;
  } else if (data.ai_status === "partial") {
    tone = "border-warning/40 bg-warning/5";
    title = "AI engine hanya memetakan sebagian artikel";
    copy = `${data.mapped_article_count || 0} artikel berhasil dipetakan, ${data.unmapped_article_count || 0} masih belum cukup yakin untuk dipakai di peta.`;
  } else {
    tone = "border-destructive/40 bg-destructive/5";
    title = "AI engine belum tersedia untuk heatmap";
    copy =
      "Widget tetap menampilkan skor krisis dan berita, tetapi peta kota serta ranking kota dinonaktifkan sampai AI engine siap.";
  }

  return (
    <div className={cn("rounded-lg border p-3.5", tone)}>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        AI status
      </div>
      <div className="text-xs font-extrabold">{title}</div>
      <div className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{copy}</div>
    </div>
  );
}
