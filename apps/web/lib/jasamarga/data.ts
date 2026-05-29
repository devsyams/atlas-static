import type { ForecastHour, IncidentItem, OpsInsight, OpsSnapshot, RouteSegment, RuasLoad } from "./types";
import { loadLevel, speedStatus } from "./ui";

/**
 * Snapshot of the Jakarta–Cikampek (Japek) corridor for the JasaMarga Ops
 * Command demo. Modelled entirely on PUBLIC / online sources (traffic APIs,
 * social, news, BMKG, official channels). When the API route supplies live
 * TomTom segments/incidents we use those and derive the insight/top-ruas from
 * them; otherwise everything is fabricated (jittered per read).
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

const SYNTHETIC_INCIDENTS: IncidentItem[] = [
  {
    id: "INC-2041",
    km: "KM 52",
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
    km: "KM 38",
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
    km: "KM 24",
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
];

const segLoad = (s: RouteSegment) => +clamp((80 - s.speed) / 8 + s.delay_min / 8, 0, 10).toFixed(1);

function incidentKm(inc: IncidentItem): number {
  return parseFloat(inc.km.replace(/[^0-9.]/g, "")) || -1;
}

function deriveTopRuas(segments: RouteSegment[], incidents: IncidentItem[]): RuasLoad[] {
  return segments
    .map((s) => {
      const onIt = incidents.some((inc) => {
        const km = incidentKm(inc);
        return km >= s.km_from && km <= s.km_to;
      });
      const dominant = onIt
        ? "Insiden dilaporkan"
        : s.speed < 20
          ? "Macet berat"
          : s.speed < 40
            ? "Antrean rambat"
            : "Volume tinggi";
      return {
        name: s.label,
        km_range: `KM ${s.km_from}–${s.km_to}`,
        load: segLoad(s),
        speed: s.speed,
        delay_min: s.delay_min,
        dominant,
      };
    })
    .sort((a, b) => b.load - a.load)
    .slice(0, 5);
}

function deriveInsight(
  segments: RouteSegment[],
  incidents: IncidentItem[],
  level: string,
  avgDelay: number,
  mentions: number,
): OpsInsight {
  const slowest = [...segments].sort((a, b) => a.speed - b.speed)[0];
  const worst = [...incidents].sort((a, b) => b.severity - a.severity)[0];
  const title =
    slowest.speed < 40
      ? `Kemacetan di ${slowest.label} (KM ${slowest.km_from}–${slowest.km_to})`
      : `Lalu lintas ${level} di koridor Jakarta–Cikampek`;
  const text =
    `Data lalu lintas publik menunjukkan kecepatan terendah ${slowest.speed} km/j di ${slowest.label}, dengan total tambahan waktu tempuh +${avgDelay} mnt ujung-ke-ujung. ` +
    (incidents.length
      ? `${incidents.length} insiden terpantau${worst ? `, terparah ${worst.type} di ${worst.km} (sumber ${worst.source})` : ""}. `
      : `Tidak ada insiden besar terdeteksi di koridor. `) +
    `Sebutan media sosial ${mentions.toLocaleString("id-ID")}/24 jam.`;
  const action =
    slowest.speed < 25
      ? `Prioritaskan ${slowest.label}; pertimbangkan rekayasa lalu lintas & imbauan alih jalur ke Layang MBZ.`
      : `Pantau ${slowest.label}; siapkan imbauan dini bila kecepatan turun di bawah 20 km/j.`;
  return { title, text, action };
}

export function buildSnapshot(liveSegments?: RouteSegment[], liveIncidents?: IncidentItem[]): OpsSnapshot {
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

  const incidents: IncidentItem[] = liveIncidents !== undefined ? liveIncidents : SYNTHETIC_INCIDENTS;

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

  const insight = deriveInsight(segments, incidents, level, avg_delay_min, mentions_24h);
  const top_ruas = deriveTopRuas(segments, incidents);

  return {
    corridor: "Jakarta–Cikampek (Japek)",
    updated_at,
    traffic_source: isLive ? "tomtom" : "synthetic",
    load_index,
    level,
    emoji,
    avg_speed,
    avg_delay_min,
    active_incidents: incidents.length,
    insight,

    conditions: [
      { label: "Libur panjang H-1", tone: "warn" },
      { label: "Hujan ringan Karawang", tone: "warn" },
      { label: "Layang MBZ normal", tone: "good" },
      { label: negativity >= 6 ? "Sentimen memburuk" : "Sentimen stabil", tone: negativity >= 6 ? "bad" : "good" },
    ],

    predictions: [
      {
        question: `Macet di ${slowest.label} meluas dalam 2 jam?`,
        probability: Math.round(jit(72, 5)),
        answer_label: "Mungkin",
        reasoning: "Tren kecepatan dari data publik melandai; inflow sore dari Jakarta belum memuncak.",
        timeframe: "2 jam",
        tone: "negative",
      },
      {
        question: "Lonjakan sebutan negatif > 5.000 malam ini?",
        probability: Math.round(jit(64, 4)),
        answer_label: "Mungkin",
        reasoning: "#MacetJapek naik 3,2 rb dalam 24 jam; akun berita besar mulai mengangkat kondisi koridor.",
        timeframe: "malam ini",
        tone: "negative",
      },
      {
        question: "Kecepatan rata-rata pulih > 50 km/j malam ini?",
        probability: Math.round(jit(48, 6)),
        answer_label: "Berimbang",
        reasoning: "Pola historis Google menunjukkan pemulihan setelah puncak sore, bergantung penanganan insiden.",
        timeframe: "malam ini",
        tone: "neutral",
      },
    ],

    ticker: [
      { label: "Kecepatan rata-rata", value: `${avg_speed} km/j`, delta: -12.4 },
      { label: "Tambahan waktu tempuh", value: `+${avg_delay_min} mnt`, delta: 18.0 },
      { label: "Insiden aktif", value: String(incidents.length), delta: 33.3 },
      { label: "Sentimen publik", value: `${Math.round(negativity * 10)}% negatif`, delta: 9.1 },
      { label: "Sebutan 24 jam", value: mentions_24h.toLocaleString("id-ID") },
      { label: "Tren teratas", value: "#MacetJapek" },
      { label: "Cuaca Karawang", value: "Hujan ringan" },
      { label: "Sumber aktif", value: isLive ? "TomTom live" : "7 feed" },
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

    incidents,
    top_ruas,

    interventions: [
      {
        id: "RKL-1",
        title: `Contraflow di sekitar ${slowest.label}`,
        segment: `KM ${slowest.km_from}–${slowest.km_to} arah Cikampek`,
        rationale: "Bila arah berlawanan lebih lengang, pinjam 1 lajur untuk membuka kapasitas di titik terlambat.",
        impact_time_pct: -38,
        impact_clear_min: 45,
        risk: "sedang",
        recommended: true,
        officially_announced: false,
      },
      {
        id: "RKL-2",
        title: "Alihkan Gol I ke Layang MBZ",
        segment: "KM 10–47",
        rationale: "Pindahkan kendaraan kecil ke jalan layang agar jalur bawah lebih lega.",
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
          text: "Hindari Japek arah Cikampek! Macet panjang dari KM 47, ada insiden di depan. Sudah lama belum gerak 😩 #MacetJapek",
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
          text: "Tarif naik tapi jalan masih sering macet & berlubang. Tolong dong @PTJASAMARGA",
          sentiment: "negative",
          engagement: 1530,
          time: "41 mnt lalu",
        },
      ],
    },

    official: [
      {
        time: "14:02",
        category: "Imbauan",
        title: "Pantau kondisi terkini via Travoy",
        body: "Pengguna jalan diimbau memantau lalu lintas dan CCTV melalui aplikasi Travoy sebelum berangkat; rekayasa lalu lintas situasional diberlakukan bila diperlukan.",
      },
      {
        time: "13:45",
        category: "Imbauan",
        title: "Manfaatkan Jalan Layang MBZ",
        body: "Kendaraan kecil (Gol I) diimbau memanfaatkan Jalan Layang MBZ untuk mengurangi kepadatan di jalur bawah.",
      },
      {
        time: "10:20",
        category: "Pemeliharaan",
        title: "Pekerjaan perkerasan KM 24 arah Jakarta",
        body: "Pemeliharaan jalan KM 24 dijadwalkan 22:00–05:00; satu lajur ditutup sementara.",
      },
    ],

    news: [
      { title: "Lalu lintas Tol Japek padat jelang libur panjang", source: "detik.com", time: "18 mnt lalu", sentiment: 7, summary: "Volume kendaraan meningkat; sejumlah titik tersendat ke arah Cikampek." },
      { title: "Jasa Marga siapkan rekayasa lalu lintas antisipasi lonjakan", source: "Kompas.com", time: "12 mnt lalu", sentiment: 4, summary: "Skema contraflow/one-way disiapkan situasional sesuai kepadatan." },
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
