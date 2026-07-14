import type { CctvFeed, CorridorPulse, ForecastHour, IncidentItem, OpsInsight, OpsSnapshot, RouteSegment, RuasLoad, SocialPulse, WeatherZone } from "./types";
import { loadLevel, speedStatus } from "./ui";
import { computeSafety } from "./safety";
import { kmToLatLng } from "./geo";
import { type Corridor, getCorridor } from "./corridors";

/** Parse a leading KM number out of an incident label ("KM 52+400" → 52). */
function kmOf(label: string): number {
  const m = label.match(/(\d+)/);
  return m ? +m[1] : 0;
}

/** Ensure every incident carries a map coordinate (live ones already do). */
function withCoords(c: Corridor, incidents: IncidentItem[]): IncidentItem[] {
  return incidents.map((inc) => {
    if (inc.lat != null && inc.lng != null) return inc;
    const [lat, lng] = kmToLatLng(c, kmOf(inc.km));
    return { ...inc, lat, lng };
  });
}

/** Last computed safety score per corridor, kept in-process so the trend arrow is meaningful. */
const lastSafetyScore = new Map<string, number>();

/**
 * Snapshot of a JasaMarga toll corridor for the Ops Command demo. Modelled
 * entirely on PUBLIC / online sources (traffic APIs, social, news, BMKG,
 * official channels) and driven by the corridor registry (`corridors.ts`).
 * When the API route supplies live TomTom segments/incidents we use those and
 * derive the insight/top-ruas from them; otherwise everything is fabricated
 * (jittered per read).
 */

const jit = (base: number, spread: number) => base + (Math.random() - 0.5) * 2 * spread;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const segLoad = (s: RouteSegment) => +clamp((80 - s.speed) / 8 + s.delay_min / 8, 0, 10).toFixed(1);

function incidentKm(inc: IncidentItem): number {
  return parseFloat(inc.km.replace(/[^0-9.]/g, "")) || -1;
}

/** The two endpoint city names of a corridor, inferred from its first/last segment labels. */
function endpointNames(c: Corridor): { from: string; to: string } {
  const first = c.segments[0].label;
  const last = c.segments[c.segments.length - 1].label;
  const from = first.split("–")[0].trim();
  const parts = last.split("–");
  const to = parts[parts.length - 1].trim();
  return { from, to };
}

const INC_TYPES = ["Kecelakaan", "Kendaraan mogok", "Genangan air", "Antrean gerbang", "Proyek pemeliharaan"];
const INC_SOURCES: { source: string; source_type: IncidentItem["source_type"] }[] = [
  { source: "@TMCPoldaMetro", source_type: "medsos" },
  { source: "Waze (crowdsourced)", source_type: "waze" },
  { source: "@PTJASAMARGA", source_type: "resmi" },
  { source: "detik.com", source_type: "berita" },
];
const INC_STATUS = ["Terkonfirmasi", "Berlangsung", "Dilaporkan"];

/**
 * Build 3–4 plausible incidents placed on the corridor: the 3 slowest segments
 * plus one mid segment. Severity scales with how loaded the segment is. The
 * worst one gets 2 lanes blocked. Deterministic-ish (light jitter only).
 */
function genIncidents(c: Corridor, segments: RouteSegment[]): IncidentItem[] {
  const byLoad = [...segments].sort((a, b) => segLoad(b) - segLoad(a));
  const slowest = byLoad.slice(0, 3);
  const mid = segments[Math.floor(segments.length / 2)];
  const chosen = [...slowest];
  if (!chosen.includes(mid)) chosen.push(mid);

  return chosen.map((seg, i) => {
    const km = Math.round((seg.km_from + seg.km_to) / 2);
    const load = segLoad(seg);
    const severity = +clamp(3 + (load / 10) * 6 + (Math.random() - 0.5) * 0.6, 3, 9).toFixed(1);
    const src = INC_SOURCES[i % INC_SOURCES.length];
    const type = INC_TYPES[i % INC_TYPES.length];
    const inc: IncidentItem = {
      id: `INC-${c.id.slice(0, 3).toUpperCase()}-${20 + i}`,
      km: `KM ${km}`,
      direction: `arah ${endpointNames(c).to}`,
      type,
      severity,
      status: INC_STATUS[i % INC_STATUS.length],
      source: src.source,
      source_type: src.source_type,
      reported: `${Math.round(jit(15, 8))} mnt lalu`,
      detail: `${type} dilaporkan di ${seg.label} (sekitar KM ${km}) koridor ${c.short}; lalu lintas tersendat, petugas dipantau via ${src.source}.`,
    };
    if (i === 0) inc.lanes_blocked = 2;
    return inc;
  });
}

const WEATHER_RANK = { rendah: 0, sedang: 1, tinggi: 2 } as const;

/**
 * Simulated AI-vision CCTV feeds for the four busiest hotspots. Vehicle counts
 * scale with congestion; event flags come from the segment status, any incident
 * on it, and corridor weather. Synthetic — the "detector" reads public-style
 * signals, no real video. Coordinates let the map open a segment's camera.
 */
function genCctv(c: Corridor, segments: RouteSegment[], incidents: IncidentItem[]): CctvFeed[] {
  const cams = [...segments].sort((a, b) => segLoad(b) - segLoad(a)).slice(0, 4);
  const worstWeather = [...c.weather].sort((a, b) => WEATHER_RANK[b.impact] - WEATHER_RANK[a.impact])[0];
  return cams.map((seg) => {
    const km = Math.round((seg.km_from + seg.km_to) / 2);
    const density = clamp((92 - seg.speed) / 92, 0.12, 1); // higher when slower
    const mobil = Math.max(3, Math.round(8 + density * 48 + jit(0, 3)));
    const truk = Math.max(0, Math.round(mobil * 0.16 + jit(0, 1)));
    const motor = Math.max(0, Math.round(mobil * 0.35 + jit(0, 2)));

    const flags: string[] = [];
    if (seg.status === "lumpuh") flags.push("Antrean panjang (>1 km)");
    else if (seg.status === "macet") flags.push("Antrean terdeteksi");
    const onInc = incidents.find((inc) => {
      const k = incidentKm(inc);
      return k >= seg.km_from && k <= seg.km_to;
    });
    if (onInc) {
      flags.push(
        onInc.type.includes("Kecelakaan")
          ? "Kecelakaan terdeteksi"
          : onInc.type.includes("mogok")
            ? "Kendaraan di bahu jalan"
            : onInc.type.includes("Genangan")
              ? "Genangan air terdeteksi"
              : `${onInc.type} terdeteksi`,
      );
    }
    if (worstWeather.impact === "tinggi") flags.push("Jarak pandang menurun");
    if (!flags.length) flags.push(seg.status === "lancar" ? "Arus lancar" : "Volume normal");

    const confidence = +clamp(0.9 + Math.random() * 0.09, 0.9, 0.99).toFixed(2);
    const [lat, lng] = kmToLatLng(c, km);
    return {
      id: `CAM-${c.id.slice(0, 3).toUpperCase()}-${km}`,
      km: `KM ${km}`,
      name: seg.label,
      status: seg.status,
      vehicles: { mobil, truk, motor },
      flags,
      confidence,
      lat,
      lng,
    };
  });
}

/**
 * Project current segments to a forecast congestion level for the time-machine
 * scrubber: scale each segment's speed by the current→target load ratio (higher
 * target load ⇒ slower, worse status; lower ⇒ faster). Pure.
 */
export function projectSegments(segments: RouteSegment[], currentLoad: number, targetLoad: number): RouteSegment[] {
  const ratio = (targetLoad + 1) / (currentLoad + 1);
  return segments.map((s) => {
    const speed = clamp(Math.round(s.speed / ratio), 5, 95);
    const delay_min = Math.max(0, Math.round(s.delay_min * ratio));
    return { ...s, speed, delay_min, status: speedStatus(speed) };
  });
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
  c: Corridor,
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
      : `Lalu lintas ${level} di koridor ${c.short}`;
  const text =
    `Data lalu lintas publik menunjukkan kecepatan terendah ${slowest.speed} km/j di ${slowest.label}, dengan total tambahan waktu tempuh +${avgDelay} mnt ujung-ke-ujung. ` +
    (incidents.length
      ? `${incidents.length} insiden terpantau${worst ? `, terparah ${worst.type} di ${worst.km} (sumber ${worst.source})` : ""}. `
      : `Tidak ada insiden besar terdeteksi di koridor. `) +
    `Volume percakapan publik ${mentions.toLocaleString("id-ID")} (${c.hashtag}).`;
  const divertTo = c.elevatedName ?? c.altRoute;
  const action =
    slowest.speed < 25
      ? `Prioritaskan ${slowest.label}; pertimbangkan rekayasa lalu lintas & imbauan alih jalur ke ${divertTo}.`
      : `Pantau ${slowest.label}; siapkan imbauan dini bila kecepatan turun di bawah 20 km/j.`;
  return { title, text, action };
}

/**
 * Lightweight per-corridor pulse for the route-selector status dots. Computes the
 * current Safe Meter the same way `buildSnapshot` does (same jitter, same incidents,
 * same load_index) but WITHOUT a prior score and WITHOUT touching the trend Map — so
 * polling pulses never pollutes the per-corridor trend arrow.
 */
export function buildCorridorPulse(corridorId: string): CorridorPulse {
  const c = getCorridor(corridorId);

  const segments: RouteSegment[] = c.segments.map((s) => {
    const speed = clamp(Math.round(jit(s.speed, 4)), 6, 90);
    const delay_min = Math.max(0, Math.round(jit(s.delay_min, 1.5)));
    return { ...s, speed, delay_min, status: speedStatus(speed) };
  });

  const incidents = genIncidents(c, segments);

  const avg_speed = Math.round(segments.reduce((a, s) => a + s.speed, 0) / segments.length);
  const avg_delay_min = Math.round(segments.reduce((a, s) => a + s.delay_min, 0));
  const load_index = +clamp((80 - avg_speed) / 8 + avg_delay_min / 14, 0, 10).toFixed(1);

  const negativity = +clamp(jit(7.2, 0.4), 0, 10).toFixed(1);
  const safety = computeSafety(segments, incidents, c.weather, negativity);

  return {
    id: c.id,
    short: c.short,
    name: c.name,
    score: safety.score,
    level: safety.level,
    emoji: safety.emoji,
    load_index,
  };
}

export function buildSnapshot(
  corridorId?: string,
  liveSegments?: RouteSegment[],
  liveIncidents?: IncidentItem[],
  /** A12 v2.0 — real public sentiment from the media-intelligence feed. Synthetic when absent. */
  liveSocial?: SocialPulse | null,
): OpsSnapshot {
  const c = getCorridor(corridorId);
  const { from: cityFrom, to: cityTo } = endpointNames(c);

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
    : c.segments.map((s) => {
        const speed = clamp(Math.round(jit(s.speed, 4)), 6, 90);
        const delay_min = Math.max(0, Math.round(jit(s.delay_min, 1.5)));
        return { ...s, speed, delay_min, status: speedStatus(speed) };
      });

  const incidents: IncidentItem[] = withCoords(
    c,
    liveIncidents !== undefined ? liveIncidents : genIncidents(c, segments),
  );

  const avg_speed = Math.round(segments.reduce((a, s) => a + s.speed, 0) / segments.length);
  const avg_delay_min = Math.round(segments.reduce((a, s) => a + s.delay_min, 0));
  const slowest = [...segments].sort((a, b) => a.speed - b.speed)[0];
  const load_index = +clamp((80 - avg_speed) / 8 + avg_delay_min / 14, 0, 10).toFixed(1);
  const { label: level, emoji } = loadLevel(load_index);

  // A12 v2.0 — when the real media-intelligence feed is attached, the WHOLE
  // dashboard reads from it: the header KPI, the Safe Meter's sentiment penalty
  // and the condition chip, not just the Sentimen Publik widget. Otherwise the
  // widget would say 36% negative while the header said 74%.
  const mentions_24h = liveSocial?.mentions_24h ?? Math.round(jit(3214, 180));
  const negativity = liveSocial?.negativity ?? +clamp(jit(7.2, 0.4), 0, 10).toFixed(1);

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

  const weather: WeatherZone[] = c.weather;
  const worstWeather = [...weather].sort(
    (a, b) => ({ rendah: 0, sedang: 1, tinggi: 2 })[b.impact] - ({ rendah: 0, sedang: 1, tinggi: 2 })[a.impact],
  )[0];

  const prev = lastSafetyScore.get(c.id);
  const safety = computeSafety(segments, incidents, weather, negativity, prev);
  lastSafetyScore.set(c.id, safety.score);

  const insight = deriveInsight(c, segments, incidents, level, avg_delay_min, mentions_24h);
  const top_ruas = deriveTopRuas(segments, incidents);

  // Travel-time board derived from corridor geometry/speeds.
  const maxKm = c.segments[c.segments.length - 1].km_to;
  const fullNormal = Math.round((maxKm / 80) * 60);
  const fullNow = Math.round(fullNormal + avg_delay_min);
  const halfSeg = c.segments[Math.floor(c.segments.length / 2)];
  const halfKm = halfSeg.km_to;
  const halfNormal = Math.round((halfKm / 80) * 60);
  const halfNow = Math.round(
    halfNormal + segments.slice(0, Math.floor(c.segments.length / 2) + 1).reduce((a, s) => a + s.delay_min, 0),
  );
  const elevatedNow = c.elevatedName ? Math.round(fullNow * 0.85) : null;
  const altNormal = Math.round(fullNormal * 1.9);
  const altNow = Math.round(altNormal * 1.05);
  const fastest = Math.min(fullNow, elevatedNow ?? Infinity, altNow);

  const interventions: OpsSnapshot["interventions"] = [
    {
      id: "RKL-1",
      title: `Contraflow di sekitar ${slowest.label}`,
      segment: `KM ${slowest.km_from}–${slowest.km_to} arah ${cityTo}`,
      rationale: "Bila arah berlawanan lebih lengang, pinjam 1 lajur untuk membuka kapasitas di titik terlambat.",
      impact_time_pct: -38,
      impact_clear_min: 45,
      risk: "sedang",
      recommended: true,
      officially_announced: false,
    },
    {
      id: "RKL-2",
      title: `Imbauan alih jalur (${c.altRoute})`,
      segment: `Keluar ${cityFrom}`,
      rationale: `Dorong sebagian kendaraan jarak jauh ke jalur arteri ${c.altRoute} via medsos & VMS.`,
      impact_time_pct: -15,
      impact_clear_min: 40,
      risk: "rendah",
      recommended: false,
      officially_announced: false,
    },
  ];
  if (c.elevatedName) {
    interventions.push({
      id: "RKL-3",
      title: `Alihkan Gol I ke ${c.elevatedName}`,
      segment: `KM ${c.segments[1]?.km_from ?? 10}–${slowest.km_to}`,
      rationale: `Pindahkan kendaraan kecil ke ${c.elevatedName} agar jalur bawah lebih lega.`,
      impact_time_pct: -22,
      impact_clear_min: 30,
      risk: "rendah",
      recommended: false,
      officially_announced: false,
    });
  }

  return {
    corridor: c.name,
    updated_at,
    traffic_source: isLive ? "tomtom" : "synthetic",
    load_index,
    level,
    emoji,
    avg_speed,
    avg_delay_min,
    active_incidents: incidents.length,
    safety,
    insight,

    conditions: [
      { label: "Libur panjang H-1", tone: "warn" },
      { label: `${worstWeather.condition} ${worstWeather.zone.split("–").pop()?.trim() ?? ""}`.trim(), tone: worstWeather.impact === "tinggi" ? "bad" : "warn" },
      { label: c.elevatedName ? `${c.elevatedName} normal` : `${c.altRoute} tersedia`, tone: "good" },
      { label: negativity >= 6 ? "Sentimen memburuk" : "Sentimen stabil", tone: negativity >= 6 ? "bad" : "good" },
    ],

    predictions: [
      {
        question: `Macet di ${slowest.label} meluas dalam 2 jam?`,
        probability: Math.round(jit(72, 5)),
        answer_label: "Mungkin",
        reasoning: "Tren kecepatan dari data publik melandai; inflow sore belum memuncak.",
        timeframe: "2 jam",
        tone: "negative",
      },
      {
        question: "Lonjakan sebutan negatif > 5.000 malam ini?",
        probability: Math.round(jit(64, 4)),
        answer_label: "Mungkin",
        reasoning: `${c.hashtag} naik 3,2 rb dalam 24 jam; akun berita besar mulai mengangkat kondisi koridor ${c.short}.`,
        timeframe: "malam ini",
        tone: "negative",
      },
      {
        question: "Kecepatan rata-rata pulih > 50 km/j malam ini?",
        probability: Math.round(jit(48, 6)),
        answer_label: "Berimbang",
        reasoning: "Pola historis menunjukkan pemulihan setelah puncak sore, bergantung penanganan insiden.",
        timeframe: "malam ini",
        tone: "neutral",
      },
    ],

    ticker: [
      { label: "Kecepatan rata-rata", value: `${avg_speed} km/j`, delta: -12.4 },
      { label: "Tambahan waktu tempuh", value: `+${avg_delay_min} mnt`, delta: 18.0 },
      { label: "Insiden aktif", value: String(incidents.length), delta: 33.3 },
      { label: "Sentimen publik", value: `${Math.round(negativity * 10)}% negatif`, delta: 9.1 },
      // The live feed counts impressions, not 24 h mentions — label it honestly.
      {
        label: liveSocial ? "Impresi (media intel)" : "Sebutan 24 jam",
        value: mentions_24h.toLocaleString("id-ID"),
      },
      { label: "Tren teratas", value: c.hashtag },
      { label: `Cuaca ${worstWeather.zone.split("–").pop()?.trim() ?? ""}`.trim(), value: worstWeather.condition },
      // Kept in step with the `sources` list below: TomTom flow + TomTom incidents
      // + media intelligence are live; Nexorus Vision is the only demo feed left.
      {
        label: "Sumber",
        value: (() => {
          const n = (isLive ? 2 : 0) + (liveSocial ? 1 : 0) + 1; // +1 = Nexorus Vision (ATCS)
          return n === 0 ? "mode demo" : `${n} live · ${4 - n} demo`;
        })(),
      },
    ],

    segments,

    landmarks: c.landmarks,

    incidents,
    top_ruas,

    interventions,

    social: liveSocial ?? {
      mentions_24h,
      negativity,
      source: "demo",
      trend: [
        { keyword: c.hashtag, count: 1240, sentiment: "negative" },
        { keyword: slowest.label.split("–")[0].trim(), count: 680, sentiment: "negative" },
        { keyword: "kecelakaan", count: 510, sentiment: "negative" },
        { keyword: "tarif tol", count: 420, sentiment: "negative" },
        { keyword: "contraflow", count: 305, sentiment: "neutral" },
        { keyword: "mudik", count: 260, sentiment: "neutral" },
        { keyword: c.altRoute, count: 180, sentiment: "neutral" },
        { keyword: "Travoy", count: 140, sentiment: "positive" },
      ],
      top_posts: [
        {
          handle: "@infomudik",
          platform: "X",
          text: `Hindari ${c.short} arah ${cityTo}! Macet panjang, ada insiden di depan. Sudah lama belum gerak 😩 ${c.hashtag}`,
          sentiment: "negative",
          engagement: 4200,
          time: "17 mnt lalu",
        },
        {
          handle: "@warga_lokal",
          platform: "X",
          text: c.elevatedName
            ? `Mending lewat ${c.elevatedName} kalo mobil kecil, bawah parah banget. Info dari Travoy lumayan akurat.`
            : `Mending lewat ${c.altRoute} kalo nggak buru-buru, tol ${c.short} parah banget. Info dari Travoy lumayan akurat.`,
          sentiment: "neutral",
          engagement: 980,
          time: "24 mnt lalu",
        },
        {
          handle: "@sopirtruk_id",
          platform: "X",
          text: `Tarif naik tapi ${c.short} masih sering macet & berlubang. Tolong dong @PTJASAMARGA`,
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
        body: `Pengguna jalan di koridor ${c.short} diimbau memantau lalu lintas dan CCTV melalui aplikasi Travoy sebelum berangkat; rekayasa lalu lintas situasional diberlakukan bila diperlukan.`,
      },
      {
        time: "13:45",
        category: "Imbauan",
        title: c.elevatedName ? `Manfaatkan ${c.elevatedName}` : `Pertimbangkan jalur ${c.altRoute}`,
        body: c.elevatedName
          ? `Kendaraan kecil (Gol I) diimbau memanfaatkan ${c.elevatedName} untuk mengurangi kepadatan di jalur bawah.`
          : `Pengguna jarak jauh dapat mempertimbangkan ${c.altRoute} untuk mengurangi kepadatan di tol ${c.short}.`,
      },
      {
        time: "10:20",
        category: "Pemeliharaan",
        title: `Pekerjaan perkerasan ${slowest.label}`,
        body: `Pemeliharaan jalan di ${slowest.label} dijadwalkan 22:00–05:00; satu lajur ditutup sementara.`,
      },
    ],

    news: [
      { title: `Lalu lintas Tol ${c.short} padat jelang libur panjang`, source: "detik.com", time: "18 mnt lalu", sentiment: 7, summary: `Volume kendaraan meningkat; sejumlah titik tersendat ke arah ${cityTo}.` },
      { title: `Jasa Marga siapkan rekayasa lalu lintas di koridor ${c.short}`, source: "Kompas.com", time: "12 mnt lalu", sentiment: 4, summary: "Skema contraflow/one-way disiapkan situasional sesuai kepadatan." },
      { title: `Volume kendaraan ${c.short} naik 12% jelang libur panjang`, source: "Antara", time: "1 jam lalu", sentiment: 5, summary: "Peningkatan lalu lintas terpantau sejak pagi di sejumlah gerbang utama." },
      { title: `Pengguna keluhkan antrean gerbang di koridor ${c.short}`, source: "Tribunnews", time: "40 mnt lalu", sentiment: 7, summary: "Antrean panjang dilaporkan; pengguna minta penambahan gardu saat puncak." },
    ],

    forecast,

    travel_times: [
      { route: `${cityFrom} → ${cityTo}`, via: `Tol ${c.short}`, minutes: fullNow, normal_minutes: fullNormal, trend: "up", best: fullNow === fastest },
      ...(elevatedNow != null
        ? [{ route: `${cityFrom} → ${cityTo}`, via: `${c.elevatedName} (Gol I)`, minutes: elevatedNow, normal_minutes: Math.round(fullNormal * 1.1), trend: "up" as const, best: elevatedNow === fastest }]
        : []),
      { route: `${cityFrom} → ${halfSeg.label.split("–").pop()?.trim() ?? cityTo}`, via: `Tol ${c.short}`, minutes: halfNow, normal_minutes: halfNormal, trend: "up" },
      { route: `${cityFrom} → ${cityTo}`, via: `${c.altRoute} (alt.)`, minutes: altNow, normal_minutes: altNormal, trend: "flat", best: altNow === fastest },
    ],

    weather,

    // Honest provenance: only Traffic + Incidents are actually wired (to TomTom).
    // The rest are sourceable from public APIs but fabricated in this build → "demo".
    sources: [
      { name: "Traffic Flow (TomTom)", type: "traffic", status: isLive ? "live" : "demo", items_24h: 1440, last_sync: isLive ? "baru saja" : "—" },
      { name: "Insiden Lalu Lintas (TomTom)", type: "waze", status: isLive ? "live" : "demo", items_24h: incidents.length, last_sync: isLive ? "1 mnt" : "—" },
      // A12 v3.0 — the source list only advertises feeds we actually consume.
      // Media Intelligence is the client's own `danantara_jasamarga` topic feed
      // (the OpenGate/Nexorus feed behind /bumn-v2/jasamarga), live when attached.
      {
        name: "Media Intelligence (Nexorus)",
        type: "medsos",
        status: liveSocial ? "live" : "demo",
        items_24h: mentions_24h,
        last_sync: liveSocial ? "baru saja" : "—",
      },
      // A12 v4.0 — the vision wall now runs real public ATCS HLS feeds through an
      // on-device detector (YOLO11n / COCO-SSD), so this is genuinely live.
      { name: "Nexorus Vision (CCTV AI · ATCS)", type: "traffic", status: "live", items_24h: 4, last_sync: "baru saja" },
    ],

    cctv: genCctv(c, segments, incidents),
  };
}
