import type { OpsSnapshot, RouteSegment } from "./types";
import { loadLevel, speedStatus } from "./ui";

/**
 * Synthetic live snapshot of the Jakarta–Cikampek (Japek) corridor for the
 * JasaMarga Ops Command demo. Not wired to a real feed — it paints a credible,
 * deliberately tense afternoon (incident at KM 52) and jitters slightly on each
 * read so "Perbarui" feels live.
 */

const jit = (base: number, spread: number) => base + (Math.random() - 0.5) * 2 * spread;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Base corridor geometry — authentic Japek landmarks, KM 0 (Halim) → KM 72 (Cikampek Utama). */
const BASE_SEGMENTS: Omit<RouteSegment, "status">[] = [
  { km_from: 0, km_to: 9, label: "Halim – Cikunir", speed: 68, vcr: 0.72 },
  { km_from: 9, km_to: 17, label: "Cikunir – Bekasi Barat", speed: 74, vcr: 0.58, elevated: true },
  { km_from: 17, km_to: 24, label: "Bekasi Timur – Cibitung", speed: 61, vcr: 0.79, elevated: true },
  { km_from: 24, km_to: 31, label: "Cikarang Barat – Cikarang Utama", speed: 47, vcr: 0.89, elevated: true },
  { km_from: 31, km_to: 37, label: "Cikarang Pusat – Karawang Barat", speed: 39, vcr: 0.96, elevated: true },
  { km_from: 37, km_to: 47, label: "Karawang Barat – Karawang Timur", speed: 32, vcr: 1.06, elevated: true },
  { km_from: 47, km_to: 52, label: "Karawang Timur – KM 52", speed: 17, vcr: 1.18, incident: true },
  { km_from: 52, km_to: 62, label: "KM 52 – Dawuan", speed: 11, vcr: 1.27, incident: true },
  { km_from: 62, km_to: 67, label: "Dawuan – Kalihurip", speed: 34, vcr: 0.93 },
  { km_from: 67, km_to: 72, label: "Kalihurip – Cikampek Utama", speed: 53, vcr: 0.71 },
];

export function buildSnapshot(): OpsSnapshot {
  const now = new Date();
  const updated_at = now.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const segments: RouteSegment[] = BASE_SEGMENTS.map((s) => {
    const speed = clamp(Math.round(jit(s.speed, 4)), 6, 90);
    const vcr = +clamp(jit(s.vcr, 0.05), 0.3, 1.4).toFixed(2);
    return { ...s, speed, vcr, status: speedStatus(speed) };
  });

  const avg_speed = Math.round(segments.reduce((a, s) => a + s.speed, 0) / segments.length);
  const worstVcr = Math.max(...segments.map((s) => s.vcr));
  // Strain index: blend of how slow the network is and how over-capacity the worst stretch is.
  const load_index = +clamp((80 - avg_speed) / 8 + (worstVcr - 0.6) * 4, 0, 10).toFixed(1);
  const { label: level, emoji } = loadLevel(load_index);

  const vehicles_now = Math.round(jit(48_200, 1500));
  const lhr_today = Math.round(jit(168_400, 2000));
  const revenue_today = Math.round(jit(4.82e9, 6e7));
  const txnPerMin = Math.round(jit(1240, 60));

  return {
    corridor: "Jakarta–Cikampek (Japek)",
    updated_at,
    load_index,
    level,
    emoji,
    avg_speed,
    active_incidents: 4,
    vehicles_now,
    lhr_today,
    revenue_today,
    revenue_target: 5.1e9,
    spm_compliance: Math.round(jit(92, 1.5)),

    insight: {
      title: "Tekanan terkonsentrasi di KM 47–62 arah Cikampek",
      text: `Kecelakaan beruntun di KM 52+400 menutup 2 dari 4 lajur; VCR menembus ${worstVcr.toFixed(2)} dan kecepatan anjlok ke ${segments[7].speed} km/j. Antrean kini ±9,3 km dan merambat mundur ke KM 41. Tanpa rekayasa, kepadatan diproyeksikan mencapai KM 31 dalam 90 menit.`,
      action:
        "Terapkan contraflow KM 47–66 + alihkan Gol I ke Layang MBZ. Proyeksi: waktu tempuh −38%, antrean terurai ~45 menit.",
    },

    conditions: [
      { label: "Libur panjang H-1", tone: "warn" },
      { label: "Hujan ringan Karawang", tone: "warn" },
      { label: "Truk ODOL terdeteksi", tone: "bad" },
      { label: "Layang MBZ normal", tone: "good" },
      { label: "MLFF uji coba KM 0–24", tone: "good" },
    ],

    predictions: [
      {
        question: "Macet di KM 52 meluas ke KM 31 dalam 2 jam?",
        probability: Math.round(jit(78, 4)),
        answer_label: "Sangat mungkin",
        reasoning:
          "Laju antrean 0,8 km/10 menit dengan 2 lajur tertutup; inflow sore dari Jakarta belum memuncak.",
        timeframe: "2 jam",
        tone: "negative",
      },
      {
        question: "Antrean Gerbang Cikampek Utama > 2 km saat puncak sore?",
        probability: Math.round(jit(64, 4)),
        answer_label: "Mungkin",
        reasoning: "6 dari 12 gardu terbuka; transaksi 4,1 detik/kendaraan di atas standar 4 detik.",
        timeframe: "17:00–19:00",
        tone: "negative",
      },
      {
        question: "Insiden KM 52 tertangani < 45 menit?",
        probability: Math.round(jit(52, 5)),
        answer_label: "Berimbang",
        reasoning: "Derek 12 + Rescue 02 di lokasi; menunggu evakuasi 1 truk ODOL terguling.",
        timeframe: "45 menit",
        tone: "neutral",
      },
    ],

    ticker: [
      { label: "LHR Japek hari ini", value: `${lhr_today.toLocaleString("id-ID")} kend` },
      { label: "Kecepatan rata-rata", value: `${avg_speed} km/j`, delta: -12.4 },
      { label: "Insiden aktif", value: "4", delta: 33.3 },
      { label: "Kepatuhan SPM", value: "92%", delta: -1.2 },
      { label: "Transaksi/menit", value: txnPerMin.toLocaleString("id-ID") },
      { label: "VCR puncak KM 52", value: worstVcr.toFixed(2), delta: 8.7 },
      { label: "Okupansi RA KM 57", value: "118%", delta: 14.0 },
      { label: "Pendapatan hari ini", value: `Rp ${(revenue_today / 1e9).toFixed(2)} M`, delta: 3.2 },
    ],

    segments,

    gates: [
      { name: "GT Halim Utama", km: 2, txn_per_min: 210, avg_txn_sec: 3.4, queue_m: 120, open_lanes: 14, total_lanes: 16 },
      { name: "GT Bekasi Barat", km: 11, txn_per_min: 96, avg_txn_sec: 3.6, queue_m: 60, open_lanes: 6, total_lanes: 8 },
      { name: "GT Cikarang Utama", km: 29, txn_per_min: 134, avg_txn_sec: 3.9, queue_m: 240, open_lanes: 8, total_lanes: 10 },
      { name: "GT Karawang Barat", km: 38, txn_per_min: 72, avg_txn_sec: 3.7, queue_m: 90, open_lanes: 5, total_lanes: 6 },
      { name: "GT Cikampek Utama", km: 72, txn_per_min: 168, avg_txn_sec: 4.1, queue_m: 1850, open_lanes: 6, total_lanes: 12 },
    ],

    incidents: [
      {
        id: "INC-2041",
        km: "KM 52+400",
        direction: "arah Cikampek",
        type: "Kecelakaan beruntun",
        severity: 8.6,
        status: "Ditangani",
        unit: "PJR 4 · Derek 12 · Ambulans 3 · Rescue 02",
        eta_min: 35,
        lanes_blocked: 2,
        lanes_total: 4,
        reported: "23 mnt lalu",
        detail:
          "Tabrakan beruntun 4 kendaraan + 1 truk ODOL terguling. 2 lajur kanan tertutup, evakuasi alat berat dalam proses. Korban luka ringan dievakuasi ke RS Karawang.",
      },
      {
        id: "INC-2043",
        km: "KM 38+200",
        direction: "arah Cikampek",
        type: "Kendaraan mogok (ODOL)",
        severity: 5.1,
        status: "Dalam perjalanan",
        unit: "Derek 07",
        eta_min: 12,
        lanes_blocked: 1,
        lanes_total: 4,
        reported: "8 mnt lalu",
        detail: "Truk tronton kelebihan muatan mogok di lajur 1. Derek 07 menuju lokasi.",
      },
      {
        id: "INC-2039",
        km: "KM 24+000",
        direction: "arah Jakarta",
        type: "Genangan air",
        severity: 4.0,
        status: "Antre",
        unit: "Patroli 9",
        eta_min: 20,
        lanes_blocked: 1,
        lanes_total: 4,
        reported: "31 mnt lalu",
        detail: "Genangan ±20 cm akibat hujan; drainase dibersihkan. Imbau kurangi kecepatan.",
      },
      {
        id: "INC-2044",
        km: "KM 57+000",
        direction: "arah Cikampek",
        type: "Overflow rest area",
        severity: 3.2,
        status: "Dipantau",
        unit: "Patroli 6",
        eta_min: 0,
        lanes_blocked: 0,
        lanes_total: 4,
        reported: "5 mnt lalu",
        detail: "Okupansi Rest Area KM 57 menembus 118%. Antrean masuk meluber ke bahu jalan.",
      },
    ],

    rest_areas: [
      { km: 19, name: "Rest Area KM 19", type: "B", capacity: 220, occupancy: 142, status: "padat" },
      { km: 33, name: "Rest Area KM 33", type: "A", capacity: 480, occupancy: 360, status: "padat" },
      { km: 39, name: "Rest Area KM 39", type: "B", capacity: 260, occupancy: 168, status: "lancar" },
      { km: 50, name: "Rest Area KM 50", type: "A", capacity: 520, occupancy: 470, status: "macet" },
      { km: 57, name: "Rest Area KM 57", type: "A", capacity: 600, occupancy: 708, status: "lumpuh" },
      { km: 62, name: "Rest Area KM 62", type: "C", capacity: 120, occupancy: 64, status: "lancar" },
    ],

    fleet: [
      { id: "DRK-12", type: "Derek", call: "Derek 12", status: "Di lokasi", location_km: 52, assigned: "INC-2041", response_min: 9 },
      { id: "DRK-07", type: "Derek", call: "Derek 07", status: "Bergerak", location_km: 41, assigned: "INC-2043", response_min: 6 },
      { id: "AMB-03", type: "Ambulans", call: "Ambulans 3", status: "Di lokasi", location_km: 52, assigned: "INC-2041", response_min: 11 },
      { id: "PJR-04", type: "PJR", call: "PJR 4", status: "Di lokasi", location_km: 52, assigned: "INC-2041", response_min: 7 },
      { id: "RSC-02", type: "Rescue", call: "Rescue 02", status: "Di lokasi", location_km: 52, assigned: "INC-2041", response_min: 14 },
      { id: "PJR-09", type: "PJR", call: "Patroli 9", status: "Bergerak", location_km: 24, assigned: "INC-2039" },
      { id: "PJR-06", type: "PJR", call: "Patroli 6", status: "Di lokasi", location_km: 57, assigned: "INC-2044" },
      { id: "DRK-15", type: "Derek", call: "Derek 15", status: "Standby", location_km: 29 },
      { id: "AMB-05", type: "Ambulans", call: "Ambulans 5", status: "Standby", location_km: 67 },
    ],

    spm: [
      { category: "Kecepatan tempuh rata-rata", value: `${avg_speed} km/j`, standard: "≥ 1,8× kec. rencana", compliance: 71, ok: false },
      { category: "Waktu transaksi GTO", value: "4,1 dtk", standard: "≤ 4 dtk/kendaraan", compliance: 88, ok: false },
      { category: "Kecepatan patroli (response)", value: "24 mnt", standard: "≤ 30 mnt", compliance: 97, ok: true },
      { category: "Kecepatan derek (response)", value: "9 mnt", standard: "≤ 30 mnt", compliance: 99, ok: true },
      { category: "Kecepatan ambulans (response)", value: "11 mnt", standard: "≤ 30 mnt", compliance: 98, ok: true },
      { category: "Kondisi jalan (IRI / lubang)", value: "0 titik", standard: "0 lubang; IRI ≤ 4", compliance: 100, ok: true },
    ],

    top_ruas: [
      { name: "KM 52 – Dawuan", km_range: "KM 52–62", load: 9.4, speed: 11, volume: 5800, dominant: "Kecelakaan KM 52" },
      { name: "Karawang Barat – Timur", km_range: "KM 37–47", load: 8.1, speed: 32, volume: 6400, dominant: "Antrean rambat" },
      { name: "Cikarang Pusat – Karawang", km_range: "KM 31–37", load: 6.7, speed: 39, volume: 6100, dominant: "Volume tinggi" },
      { name: "GT Cikampek Utama", km_range: "KM 72", load: 6.2, speed: 0, volume: 0, dominant: "Antrean gardu 1,8 km" },
      { name: "Cikarang Barat – Utama", km_range: "KM 24–31", load: 5.3, speed: 47, volume: 5600, dominant: "Penyempitan" },
    ],

    interventions: [
      {
        id: "RKL-1",
        title: "Contraflow KM 47–66",
        segment: "KM 47–66 arah Cikampek",
        rationale: "Pinjam 1 lajur arah Jakarta (volume 42% lebih rendah) untuk membuka kapasitas di titik macet.",
        impact_time_pct: -38,
        impact_clear_min: 45,
        risk: "sedang",
        recommended: true,
      },
      {
        id: "RKL-2",
        title: "Alihkan Gol I ke Layang MBZ",
        segment: "KM 10–47",
        rationale: "Pindahkan kendaraan kecil ke jalan layang agar lajur bawah lega untuk evakuasi.",
        impact_time_pct: -22,
        impact_clear_min: 30,
        risk: "rendah",
        recommended: false,
      },
      {
        id: "RKL-3",
        title: "Buka bahu jalan KM 50–55",
        segment: "KM 50–55",
        rationale: "Aktifkan lajur darurat sementara di sekitar lokasi insiden.",
        impact_time_pct: -15,
        impact_clear_min: 25,
        risk: "rendah",
        recommended: false,
      },
      {
        id: "RKL-4",
        title: "Buka 6 gardu tambahan Cikampek Utama",
        segment: "GT Cikampek Utama",
        rationale: "Tambah kapasitas transaksi dari 6 → 12 gardu untuk meredam antrean balik.",
        impact_time_pct: -12,
        impact_clear_min: 20,
        risk: "rendah",
        recommended: false,
      },
    ],
  };
}
