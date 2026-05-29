import type { ForecastHour, OpsSnapshot, RouteSegment } from "./types";
import { loadLevel, speedStatus } from "./ui";

/**
 * Synthetic snapshot of the Jakarta–Cikampek (Japek) corridor for the JasaMarga
 * Ops Command demo. Every field is modelled on data obtainable from PUBLIC /
 * online sources — traffic APIs (Google/Waze/TomTom), Waze crowd reports, social
 * media (X), online news, public CCTV (Travoy), BMKG weather, and JasaMarga's
 * official channels — NOT internal toll systems. Fabricated, and jittered per
 * read so "Perbarui" feels live.
 */

const jit = (base: number, spread: number) => base + (Math.random() - 0.5) * 2 * spread;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Corridor geometry — exported so the live TomTom connector reuses the same KM layout. */
export const BASE_SEGMENTS: Omit<RouteSegment, "status">[] = [
  { km_from: 0, km_to: 9, label: "Halim – Cikunir", speed: 68, delay_min: 2 },
  { km_from: 9, km_to: 17, label: "Cikunir – Bekasi Barat", speed: 74, delay_min: 1, elevated: true },
  { km_from: 17, km_to: 24, label: "Bekasi Timur – Cibitung", speed: 61, delay_min: 2, elevated: true },
  { km_from: 24, km_to: 31, label: "Cikarang Barat – Cikarang Utama", speed: 47, delay_min: 4, elevated: true },
  { km_from: 31, km_to: 37, label: "Cikarang Pusat – Karawang Barat", speed: 39, delay_min: 5, elevated: true },
  { km_from: 37, km_to: 47, label: "Karawang Barat – Karawang Timur", speed: 32, delay_min: 8, elevated: true },
  { km_from: 47, km_to: 52, label: "Karawang Timur – KM 52", speed: 17, delay_min: 12, incident: true },
  { km_from: 52, km_to: 62, label: "KM 52 – Dawuan", speed: 11, delay_min: 22, incident: true },
  { km_from: 62, km_to: 67, label: "Dawuan – Kalihurip", speed: 34, delay_min: 5 },
  { km_from: 67, km_to: 72, label: "Kalihurip – Cikampek Utama", speed: 53, delay_min: 2 },
];

export function buildSnapshot(liveSegments?: RouteSegment[]): OpsSnapshot {
  const now = new Date();
  const updated_at = now.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isLive = !!liveSegments && liveSegments.length > 0;
  const segments: RouteSegment[] = isLive
    ? liveSegments!
    : BASE_SEGMENTS.map((s) => {
        const speed = clamp(Math.round(jit(s.speed, 4)), 6, 90);
        const delay_min = Math.max(0, Math.round(jit(s.delay_min, 1.5)));
        return { ...s, speed, delay_min, status: speedStatus(speed) };
      });

  const avg_speed = Math.round(segments.reduce((a, s) => a + s.speed, 0) / segments.length);
  const avg_delay_min = Math.round(segments.reduce((a, s) => a + s.delay_min, 0));
  const slowest = [...segments].sort((a, b) => a.speed - b.speed)[0];
  const load_index = +clamp((80 - avg_speed) / 8 + avg_delay_min / 14, 0, 10).toFixed(1);
  const { label: level, emoji } = loadLevel(load_index);

  const mentions_24h = Math.round(jit(3214, 180));
  const negativity = +clamp(jit(7.2, 0.4), 0, 10).toFixed(1);

  // 6-hour projection from current congestion, shaped toward the evening peak.
  const baseHour = now.getHours();
  const offsets = [0, -0.9, -1.6, -0.6, 0.5, 1.0, -1.3];
  const forecast: ForecastHour[] = offsets.map((off, i) => ({
    hour: `${String((baseHour + i) % 24).padStart(2, "0")}:00`,
    load: +clamp(load_index + off + (Math.random() - 0.5) * 0.4, 0.5, 10).toFixed(1),
  }));
  const peakIdx = forecast.reduce((m, h, i, a) => (h.load > a[m].load ? i : m), 0);
  forecast[0].label = "Sekarang";
  if (peakIdx !== 0) forecast[peakIdx].label = "Puncak";

  return {
    corridor: "Jakarta–Cikampek (Japek)",
    updated_at,
    traffic_source: isLive ? "tomtom" : "synthetic",
    load_index,
    level,
    emoji,
    avg_speed,
    avg_delay_min,
    active_incidents: 4,

    insight: {
      title: "Kemacetan KM 47–62 arah Cikampek, dipicu kecelakaan KM 52",
      text: `Data lalu lintas publik (Google/Waze) menunjukkan kecepatan anjlok ke ${slowest.speed} km/j di KM 52–62 dengan tambahan waktu tempuh +${avg_delay_min} menit ujung-ke-ujung. Laporan @TMCPoldaMetro & Waze mengonfirmasi kecelakaan beruntun di KM 52+400 (2 lajur tertutup). Sebutan di media sosial melonjak ${mentions_24h.toLocaleString("id-ID")} dalam 24 jam — 72% negatif, #MacetJapek menjadi tren.`,
      action:
        "Contraflow KM 47–70 sudah diumumkan @PTJASAMARGA (14:00). Rekomendasi: perkuat imbauan alih jalur ke Layang MBZ; pantau sentimen kenaikan tarif yang ikut ramai.",
    },

    conditions: [
      { label: "Libur panjang H-1", tone: "warn" },
      { label: "Hujan ringan Karawang", tone: "warn" },
      { label: "Contraflow aktif KM 47–70", tone: "good" },
      { label: "Layang MBZ normal", tone: "good" },
      { label: "Sentimen memburuk", tone: "bad" },
    ],

    predictions: [
      {
        question: "Macet KM 52 meluas ke KM 31 dalam 2 jam?",
        probability: Math.round(jit(78, 4)),
        answer_label: "Sangat mungkin",
        reasoning: "Tren kecepatan Google turun 0,8 km/10 mnt; laporan Waze bertambah, inflow sore belum memuncak.",
        timeframe: "2 jam",
        tone: "negative",
      },
      {
        question: "Lonjakan sebutan negatif > 5.000 malam ini?",
        probability: Math.round(jit(66, 4)),
        answer_label: "Mungkin",
        reasoning: "#MacetJapek naik 3,2 rb dalam 24 jam; akun berita besar mulai mengangkat insiden KM 52.",
        timeframe: "malam ini",
        tone: "negative",
      },
      {
        question: "Contraflow urai antrean < 60 menit?",
        probability: Math.round(jit(54, 5)),
        answer_label: "Berimbang",
        reasoning: "Pola historis Google + jadwal contraflow resmi; bergantung kecepatan evakuasi kendaraan.",
        timeframe: "60 menit",
        tone: "neutral",
      },
    ],

    ticker: [
      { label: "Kecepatan rata-rata", value: `${avg_speed} km/j`, delta: -12.4 },
      { label: "Tambahan waktu tempuh", value: `+${avg_delay_min} mnt`, delta: 18.0 },
      { label: "Insiden aktif", value: "4", delta: 33.3 },
      { label: "Sentimen publik", value: `${Math.round(negativity * 10)}% negatif`, delta: 9.1 },
      { label: "Sebutan 24 jam", value: mentions_24h.toLocaleString("id-ID") },
      { label: "Tren teratas", value: "#MacetJapek" },
      { label: "Cuaca Karawang", value: "Hujan ringan" },
      { label: "Sumber aktif", value: "7 feed" },
    ],

    segments,

    landmarks: [
      { km: 2, name: "GT Halim Utama", kind: "gerbang" },
      { km: 11, name: "GT Bekasi Barat", kind: "gerbang" },
      { km: 19, name: "Rest Area KM 19", kind: "rest" },
      { km: 29, name: "GT Cikarang Utama", kind: "gerbang" },
      { km: 33, name: "Rest Area KM 33", kind: "rest" },
      { km: 39, name: "Rest Area KM 39", kind: "rest" },
      { km: 50, name: "Rest Area KM 50", kind: "rest" },
      { km: 57, name: "Rest Area KM 57", kind: "rest" },
      { km: 67, name: "Kalihurip JC", kind: "gerbang" },
      { km: 72, name: "GT Cikampek Utama", kind: "gerbang" },
    ],

    incidents: [
      {
        id: "INC-2041",
        km: "KM 52+400",
        direction: "arah Cikampek",
        type: "Kecelakaan beruntun",
        severity: 8.6,
        status: "Terkonfirmasi",
        source: "@TMCPoldaMetro",
        source_type: "medsos",
        reported: "23 mnt lalu",
        lanes_blocked: 2,
        detail:
          "Tabrakan beruntun 4 kendaraan + 1 truk terguling. 2 lajur kanan tertutup. Dikonfirmasi via X @TMCPoldaMetro dan laporan Waze; foto beredar di grup komunitas.",
      },
      {
        id: "INC-2043",
        km: "KM 38+200",
        direction: "arah Cikampek",
        type: "Kendaraan mogok",
        severity: 5.1,
        status: "Berlangsung",
        source: "Waze (crowdsourced)",
        source_type: "waze",
        reported: "8 mnt lalu",
        lanes_blocked: 1,
        detail: "Truk mogok di lajur 1 — 14 laporan Waze dalam 6 menit. Belum ada konfirmasi resmi.",
      },
      {
        id: "INC-2039",
        km: "KM 24+000",
        direction: "arah Jakarta",
        type: "Genangan air",
        severity: 4.0,
        status: "Dilaporkan",
        source: "@PTJASAMARGA",
        source_type: "resmi",
        reported: "31 mnt lalu",
        lanes_blocked: 1,
        detail: "Imbauan resmi @PTJASAMARGA: genangan akibat hujan, kurangi kecepatan. Petugas dikerahkan.",
      },
      {
        id: "INC-2044",
        km: "KM 72",
        direction: "arah Cikampek",
        type: "Antrean gerbang",
        severity: 3.4,
        status: "Berlangsung",
        source: "detik.com",
        source_type: "berita",
        reported: "12 mnt lalu",
        detail: "Berita online melaporkan antrean panjang di GT Cikampek Utama jelang libur panjang.",
      },
    ],

    top_ruas: [
      { name: "KM 52 – Dawuan", km_range: "KM 52–62", load: 9.4, speed: 11, delay_min: 22, dominant: "Kecelakaan KM 52" },
      { name: "Karawang Barat – Timur", km_range: "KM 37–47", load: 8.1, speed: 32, delay_min: 8, dominant: "Antrean rambat" },
      { name: "Cikarang Pusat – Karawang", km_range: "KM 31–37", load: 6.7, speed: 39, delay_min: 5, dominant: "Volume tinggi" },
      { name: "Cikarang Barat – Utama", km_range: "KM 24–31", load: 5.3, speed: 47, delay_min: 4, dominant: "Penyempitan" },
      { name: "Dawuan – Kalihurip", km_range: "KM 62–67", load: 4.2, speed: 34, delay_min: 5, dominant: "Limpahan dari KM 52" },
    ],

    interventions: [
      {
        id: "RKL-1",
        title: "Contraflow KM 47–70",
        segment: "KM 47–70 arah Cikampek",
        rationale: "Data Google menunjukkan arah Jakarta 42% lebih lengang — contraflow membuka kapasitas di titik macet.",
        impact_time_pct: -38,
        impact_clear_min: 45,
        risk: "sedang",
        recommended: true,
        officially_announced: true,
      },
      {
        id: "RKL-2",
        title: "Alihkan Gol I ke Layang MBZ",
        segment: "KM 10–47",
        rationale: "Pindahkan kendaraan kecil ke jalan layang agar jalur bawah lega untuk evakuasi.",
        impact_time_pct: -22,
        impact_clear_min: 30,
        risk: "rendah",
        recommended: false,
        officially_announced: false,
      },
      {
        id: "RKL-3",
        title: "Imbauan alih jalur (Pantura)",
        segment: "Keluar Karawang Barat",
        rationale: "Dorong sebagian kendaraan jarak jauh ke jalur arteri Pantura via medsos & VMS.",
        impact_time_pct: -15,
        impact_clear_min: 40,
        risk: "rendah",
        recommended: false,
        officially_announced: false,
      },
    ],

    social: {
      mentions_24h,
      negativity,
      trend: [
        { keyword: "#MacetJapek", count: 1240, sentiment: "negative" },
        { keyword: "KM 52", count: 680, sentiment: "negative" },
        { keyword: "kecelakaan", count: 510, sentiment: "negative" },
        { keyword: "tarif tol", count: 420, sentiment: "negative" },
        { keyword: "contraflow", count: 305, sentiment: "neutral" },
        { keyword: "mudik", count: 260, sentiment: "neutral" },
        { keyword: "lubang KM 38", count: 180, sentiment: "negative" },
        { keyword: "Travoy", count: 140, sentiment: "positive" },
      ],
      top_posts: [
        {
          handle: "@infomudik",
          platform: "X",
          text: "Hindari Japek arah Cikampek! Macet total dari KM 47, ada kecelakaan di KM 52. Sudah 1 jam belum gerak 😩 #MacetJapek",
          sentiment: "negative",
          engagement: 4200,
          time: "17 mnt lalu",
        },
        {
          handle: "@warga_bekasi",
          platform: "X",
          text: "Mending lewat Layang MBZ kalo mobil kecil, bawah parah banget. Info dari Travoy lumayan akurat.",
          sentiment: "neutral",
          engagement: 980,
          time: "24 mnt lalu",
        },
        {
          handle: "@sopirtruk_id",
          platform: "X",
          text: "Tarif naik tapi jalan masih sering macet & berlubang di KM 38. Tolong dong @PTJASAMARGA",
          sentiment: "negative",
          engagement: 1530,
          time: "41 mnt lalu",
        },
      ],
    },

    official: [
      {
        time: "14:02",
        category: "Rekayasa",
        title: "Contraflow KM 47–70 arah Cikampek diberlakukan",
        body: "Menyusul kecelakaan di KM 52, contraflow 1 lajur diberlakukan mulai 14:00 hingga situasi normal.",
      },
      {
        time: "13:45",
        category: "Imbauan",
        title: "Hindari KM 47–62, manfaatkan Layang MBZ",
        body: "Pengguna kendaraan kecil diimbau gunakan Jalan Layang MBZ; pantau kondisi via aplikasi Travoy.",
      },
      {
        time: "10:20",
        category: "Pemeliharaan",
        title: "Pekerjaan perkerasan KM 24 arah Jakarta",
        body: "Pemeliharaan jalan KM 24 dijadwalkan 22:00–05:00; satu lajur ditutup sementara.",
      },
    ],

    news: [
      { title: "Kecelakaan beruntun di Tol Japek KM 52, lalu lintas tersendat", source: "detik.com", time: "18 mnt lalu", sentiment: 8, summary: "Empat kendaraan terlibat, dua lajur ditutup, contraflow diberlakukan." },
      { title: "Jasa Marga berlakukan contraflow antisipasi lonjakan libur panjang", source: "Kompas.com", time: "12 mnt lalu", sentiment: 4, summary: "Rekayasa lalu lintas diberlakukan untuk mengurai kepadatan arah Cikampek." },
      { title: "Volume kendaraan Japek naik 12% jelang libur panjang", source: "Antara", time: "1 jam lalu", sentiment: 5, summary: "Peningkatan lalu lintas terpantau sejak pagi di sejumlah gerbang utama." },
      { title: "Pengguna keluhkan antrean Gerbang Cikampek Utama", source: "Tribunnews", time: "40 mnt lalu", sentiment: 7, summary: "Antrean panjang dilaporkan; pengguna minta penambahan gardu saat puncak." },
    ],

    forecast,

    travel_times: [
      { route: "Halim → Cikampek Utama", via: "Tol Japek (bawah)", minutes: 112, normal_minutes: 48, trend: "up" },
      { route: "Halim → Cikampek Utama", via: "Layang MBZ (Gol I)", minutes: 96, normal_minutes: 55, trend: "up", best: true },
      { route: "Halim → Karawang Barat", via: "Tol Japek", minutes: 58, normal_minutes: 36, trend: "up" },
      { route: "Cikarang → Cikampek", via: "Tol Japek", minutes: 41, normal_minutes: 23, trend: "flat" },
      { route: "Jakarta → Cikampek", via: "Arteri Pantura (alt.)", minutes: 135, normal_minutes: 120, trend: "flat" },
    ],

    weather: [
      { zone: "Jakarta – Bekasi", condition: "Cerah berawan", temp: 31, impact: "rendah" },
      { zone: "Cikarang – Karawang", condition: "Hujan ringan", temp: 27, impact: "sedang" },
      { zone: "Cikampek", condition: "Berawan", temp: 29, impact: "rendah" },
    ],

    sources: [
      { name: "Traffic Flow (TomTom/HERE)", type: "traffic", status: "live", items_24h: 1440, last_sync: "baru saja" },
      { name: "Insiden Lalu Lintas (TomTom)", type: "waze", status: "live", items_24h: 86, last_sync: "1 mnt" },
      { name: "Media Sosial (X API)", type: "medsos", status: "live", items_24h: mentions_24h, last_sync: "baru saja" },
      { name: "Berita Online (RSS)", type: "berita", status: "live", items_24h: 47, last_sync: "4 mnt" },
      { name: "BMKG Cuaca", type: "cuaca", status: "delay", items_24h: 24, last_sync: "18 mnt" },
      { name: "Kanal Resmi (@PTJASAMARGA)", type: "resmi", status: "live", items_24h: 9, last_sync: "8 mnt" },
    ],
  };
}
