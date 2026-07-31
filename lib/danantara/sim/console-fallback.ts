/**
 * Deterministic console world (A15 v5.0) — now the **primary** path, not a fallback.
 *
 * v4.0 generated this world with a live model and kept a thin deterministic version for
 * when the model was off or refused. That inverted: the model is off by default (it cost
 * real money per unique document, and a demo re-runs the same document all day), so this
 * module now carries the whole world and has been enlarged to match — a knowledge graph
 * dense enough to be worth zooming into, sixteen agents, and a six-round feed.
 *
 * It still builds everything from the presenter's own text, so pasting a different
 * document genuinely produces a different world. It must complete **all five steps** from
 * that text alone: a dead step mid-pitch is worse than a plainer world.
 *
 * Determinism is the other hard requirement — the same paste must draw the same picture
 * every time, or a rehearsed demo rearranges itself on stage.
 */

import { seedFromString } from "@/lib/danantara/ceo/crisis-sim";
import { mulberry32 } from "@/lib/danantara/ceo/engine";
import {
  CONSOLE_ROUNDS,
  POSTS_PER_ROUND,
  type AgentProfile,
  type ConsolePost,
  type ConsoleRound,
  type ConsoleWorld,
  type GraphEdge,
  type GraphNode,
  type Stance,
} from "./console-types";
import { agentEntityType } from "./sim-config";

/**
 * The generated type system. Twelve types rather than seven: the legend is a big part of
 * what makes the graph read as "a GraphRAG build produced this" rather than "someone drew
 * a network", and each type below earns its place by having its own wiring rules.
 */
const ENTITY_TYPES = [
  "Topic",
  "Claim",
  "Institution",
  "Regulator",
  "GovernmentAgency",
  "MediaOutlet",
  "Journalist",
  "Analyst",
  "Citizen",
  "Community",
  "Event",
  "Platform",
];

const RELATION_TYPES = [
  "RELATES_TO",
  "CRITICIZES",
  "REPORTS_ON",
  "ISSUES_STATEMENT_ON",
  "RESPONDS_TO",
  "AFFILIATED_WITH",
  "AMPLIFIES",
  "MENTIONS",
  "REGULATES",
  "MEMBER_OF",
  "TRIGGERS",
  "REFUTES",
  "CITES",
  "ESCALATES_TO",
];

/**
 * Invented archetypes — deliberately generic roles, never names, so a persona can never
 * collide with a real account. The numeric suffix reads like a handle without being one.
 */
const ARCHETYPES: Omit<AgentProfile, "followers">[] = [
  { id: "pengamat_kebijakan_publik_204", displayName: "Pengamat Kebijakan", role: "Pengamat Kebijakan Publik", bio: "Menyoroti proses pengambilan keputusan dan dasar hukumnya.", topics: ["Tata Kelola", "Kebijakan Publik"], stance: "skeptical" },
  { id: "warga_pemantau_anggaran_871", displayName: "Warga Pemantau", role: "Warga Pemantau Anggaran", bio: "Warga biasa yang rutin mengikuti isu penggunaan dana publik.", topics: ["Anggaran", "Transparansi"], stance: "hostile" },
  { id: "analis_pasar_independen_356", displayName: "Analis Pasar", role: "Analis Pasar Independen", bio: "Menilai dampak kebijakan terhadap pasar tanpa memihak.", topics: ["Pasar Modal", "Risiko"], stance: "neutral" },
  { id: "pegawai_sektor_terdampak_512", displayName: "Pegawai Sektor Terdampak", role: "Pegawai Sektor Terdampak", bio: "Bekerja di sektor yang langsung terkena kebijakan ini.", topics: ["Ketenagakerjaan", "Operasional"], stance: "supportive" },
  { id: "jurnalis_data_ekonomi_733", displayName: "Jurnalis Data", role: "Jurnalis Data Ekonomi", bio: "Mencatat kronologi dan memverifikasi angka yang beredar.", topics: ["Verifikasi", "Ekonomi"], stance: "neutral" },
  { id: "penggerak_komunitas_warga_628", displayName: "Penggerak Komunitas", role: "Penggerak Komunitas Warga", bio: "Menyuarakan keresahan warga di lingkungannya.", topics: ["Advokasi", "Komunitas"], stance: "hostile" },
  { id: "akademisi_tata_kelola_190", displayName: "Akademisi Tata Kelola", role: "Akademisi Tata Kelola", bio: "Meneliti tata kelola lembaga dan akuntabilitas publik.", topics: ["Akademik", "Akuntabilitas"], stance: "skeptical" },
  { id: "pelaku_usaha_lokal_445", displayName: "Pelaku Usaha Lokal", role: "Pelaku Usaha Lokal", bio: "Melihat peluang dan risiko kebijakan bagi usaha kecil.", topics: ["UMKM", "Investasi"], stance: "supportive" },
  { id: "pengacara_publik_331", displayName: "Pengacara Publik", role: "Pengacara Kepentingan Publik", bio: "Menguji dasar hukum kebijakan dan hak warga atas informasi.", topics: ["Hukum", "Hak Informasi"], stance: "skeptical" },
  { id: "mahasiswa_organisatoris_907", displayName: "Mahasiswa Organisatoris", role: "Mahasiswa Organisatoris", bio: "Menggerakkan diskusi kampus dan aksi solidaritas.", topics: ["Gerakan Mahasiswa", "Isu Publik"], stance: "hostile" },
  { id: "ekonom_lembaga_kajian_268", displayName: "Ekonom Kajian", role: "Ekonom Lembaga Kajian", bio: "Menerbitkan catatan singkat tentang dampak makro kebijakan.", topics: ["Makroekonomi", "Fiskal"], stance: "neutral" },
  { id: "pensiunan_birokrat_154", displayName: "Pensiunan Birokrat", role: "Pensiunan Birokrat", bio: "Menjelaskan bagaimana prosedur ini biasanya berjalan di dalam.", topics: ["Birokrasi", "Prosedur"], stance: "supportive" },
  { id: "buruh_serikat_klaster_682", displayName: "Perwakilan Serikat", role: "Perwakilan Serikat Pekerja", bio: "Menyuarakan dampak kebijakan pada pekerja di lapangan.", topics: ["Ketenagakerjaan", "Upah"], stance: "hostile" },
  { id: "influencer_edukasi_finansial_519", displayName: "Edukator Finansial", role: "Edukator Finansial Daring", bio: "Menerjemahkan isu teknis jadi penjelasan ringkas untuk awam.", topics: ["Literasi Keuangan", "Edukasi"], stance: "neutral" },
  { id: "pemantau_pemilu_daerah_477", displayName: "Pemantau Daerah", role: "Pemantau Kebijakan Daerah", bio: "Melihat bagaimana kebijakan pusat mendarat di daerah.", topics: ["Otonomi Daerah", "Implementasi"], stance: "skeptical" },
  { id: "praktisi_humas_korporat_836", displayName: "Praktisi Humas", role: "Praktisi Humas Korporat", bio: "Menilai kualitas komunikasi krisis dari sisi praktisi.", topics: ["Komunikasi Krisis", "Reputasi"], stance: "supportive" },
];

/** Invented, descriptive outlet labels — categories, not brands, so none can be mistaken for a real newsroom. */
const MEDIA_LABELS = [
  "Media Daring Nasional",
  "Kanal Berita Ekonomi",
  "Portal Warta Daerah",
  "Buletin Investigasi",
  "Kanal Video Ringkas",
  "Agregator Berita Publik",
];

const INSTITUTION_LABELS = ["Lembaga Pengelola", "Direktorat Teknis", "Sekretariat Kebijakan", "Unit Kepatuhan"];
const REGULATOR_LABELS = ["Otoritas Pengawas", "Badan Pemeriksa"];
const AGENCY_LABELS = ["Kementerian Terkait", "Kantor Koordinasi", "Satuan Tugas Sektor"];
const COMMUNITY_LABELS = [
  "Forum Warga Terdampak",
  "Grup Diskusi Kebijakan",
  "Komunitas Pelaku Usaha",
  "Jaringan Akademik",
  "Kanal Serikat Pekerja",
];
const PLATFORM_LABELS = ["Info Plaza", "Topic Community"];

const EVENT_LABELS = [
  "Unggahan Pemicu",
  "Liputan Susulan",
  "Permintaan Klarifikasi",
  "Pernyataan Resmi",
  "Bantahan Balik",
  "Rangkuman Mingguan",
];

const ROUND_HEADLINES = [
  "Reaksi pertama muncul",
  "Percakapan menyebar ke komunitas lain",
  "Isu naik ke linimasa yang lebih luas",
  "Muncul permintaan klarifikasi",
  "Suara penyeimbang mulai terdengar",
  "Percakapan mengendap",
];

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 240);
}

function keyPhrases(text: string): string[] {
  const found = text.match(/\b[A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+){0,3}\b/gu) ?? [];
  const counts = new Map<string, number>();
  for (const raw of found) {
    const p = raw.trim();
    if (p.length < 4) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p);
}

/** Short, headline-ish fragment of a sentence — used for `Claim` node labels. */
function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

export function fallbackConsoleWorld(seedText: string): ConsoleWorld {
  const text = seedText.trim();
  const rand = mulberry32(seedFromString(text));

  const phrases = keyPhrases(text);
  const lines = sentences(text);
  const subject = phrases[0] ?? "dokumen ini";
  const first = lines[0] ?? (text.slice(0, 200) || "Dokumen sumber tanpa kalimat panjang.");

  /**
   * Topics per agent = its archetype's own beats plus a couple lifted from the document.
   * That is what "related topics from the reality seeds" means, and it's what makes the
   * Related Topics figure scale with the world instead of sitting at 2× the agent count.
   */
  const topicsFor = (base: string[], i: number): string[] => {
    const seeded = phrases.slice(1).filter((p) => p.length <= 28);
    const picked = [base[0], base[1], seeded[i % Math.max(1, seeded.length)], seeded[(i + 3) % Math.max(1, seeded.length)], seeded[(i + 7) % Math.max(1, seeded.length)]];
    return [...new Set(picked.filter(Boolean))].slice(0, 5);
  };

  /**
   * Every organisation in the world also gets a human voice attached to it — a newsroom
   * gets a reporter, a community gets an organiser, an institution gets a spokesperson.
   *
   * This is the rule the reference console uses ("a complete agent profile for each
   * entity"), and it matters beyond the headline number: a fixed roster of sixteen makes
   * the same faces repeat every round, whereas deriving from entities means the cast
   * grows with the document and the feed stops looking like a loop.
   */
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const derived: Omit<AgentProfile, "followers">[] = [
    ...MEDIA_LABELS.map((label, i) => ({
      id: `${slug(label)}_peliput_${310 + i * 7}`,
      displayName: `Peliput ${label.split(" ").slice(-2).join(" ")}`,
      role: `Jurnalis ${label}`,
      bio: `Meliput isu ini untuk ${label} dan memverifikasi angka yang beredar sebelum menaikkan berita.`,
      topics: ["Liputan", "Verifikasi"],
      stance: (i % 2 === 0 ? "neutral" : "skeptical") as Stance,
    })),
    ...COMMUNITY_LABELS.map((label, i) => ({
      id: `${slug(label)}_penggerak_${520 + i * 11}`,
      displayName: `Penggerak ${label.split(" ").slice(-2).join(" ")}`,
      role: `Penggerak ${label}`,
      bio: `Mengorganisir percakapan di ${label} dan meneruskan keluhan anggotanya ke ruang yang lebih luas.`,
      topics: ["Advokasi", "Komunitas"],
      stance: (i % 3 === 0 ? "hostile" : "skeptical") as Stance,
    })),
    ...[...INSTITUTION_LABELS, ...REGULATOR_LABELS, ...AGENCY_LABELS].map((label, i) => ({
      id: `${slug(label)}_jubir_${730 + i * 13}`,
      displayName: `Jubir ${label.split(" ").slice(-2).join(" ")}`,
      role: `Juru Bicara ${label}`,
      bio: `Menyampaikan posisi resmi ${label} dan menjawab pertanyaan yang masuk lewat kanal publik.`,
      topics: ["Keterbukaan", "Prosedur"],
      stance: (i % 2 === 0 ? "supportive" : "neutral") as Stance,
    })),
  ];

  const agents: AgentProfile[] = [...ARCHETYPES, ...derived].map((a, i) => ({
    ...a,
    topics: topicsFor(a.topics, i),
    followers: 400 + Math.floor(rand() * 40_000),
  }));

  // ---- Graph -------------------------------------------------------------------
  // Built in families, each with its own wiring rule. A flat "hub plus ring" (what
  // v4.0 did) draws as a star and reads as decoration; wiring by family produces
  // genuine clusters — media citing claims, agents inside communities, regulators
  // over institutions — which is what survives being zoomed into on a projector.
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let seq = 0;
  const add = (label: string, type: string): string => {
    const id = `n${seq++}`;
    nodes.push({ id, label, type });
    return id;
  };
  const link = (s: string, t: string, label: string) => {
    if (s !== t) edges.push({ s, t, label });
  };
  /** Deterministic pick from a list. */
  const pick = <T,>(xs: T[], i: number): T => xs[i % xs.length];

  const topicHub = add(clip(subject, 26), "Topic");

  // Sub-topics: the document's own recurring capitalised phrases.
  const subTopics = phrases.slice(1, 13).map((p) => add(clip(p, 24), "Topic"));
  for (const t of subTopics) link(topicHub, t, "RELATES_TO");
  // Cross-links between neighbouring sub-topics so the topic cluster isn't a fan.
  for (let i = 0; i + 2 < subTopics.length; i += 2) link(subTopics[i], subTopics[i + 2], "MENTIONS");

  // Claims: actual sentences from the document, the evidence the report later cites.
  const claims = lines.slice(0, 10).map((l) => add(clip(l, 30), "Claim"));
  claims.forEach((c, i) => {
    link(c, subTopics.length ? pick(subTopics, i) : topicHub, "CITES");
    if (i % 3 === 0) link(c, topicHub, "RELATES_TO");
  });

  const institutions = INSTITUTION_LABELS.map((l) => add(l, "Institution"));
  const regulators = REGULATOR_LABELS.map((l) => add(l, "Regulator"));
  const agencies = AGENCY_LABELS.map((l) => add(l, "GovernmentAgency"));
  const media = MEDIA_LABELS.map((l) => add(l, "MediaOutlet"));
  const communities = COMMUNITY_LABELS.map((l) => add(l, "Community"));
  const platforms = PLATFORM_LABELS.map((l) => add(l, "Platform"));

  for (const i of institutions) link(i, topicHub, "ISSUES_STATEMENT_ON");
  regulators.forEach((r, i) => {
    link(r, pick(institutions, i), "REGULATES");
    link(r, pick(institutions, i + 1), "REGULATES");
  });
  agencies.forEach((a, i) => {
    link(a, pick(institutions, i), "AFFILIATED_WITH");
    link(a, topicHub, "ISSUES_STATEMENT_ON");
  });

  // Media report on claims and sub-topics — this is what makes the media cluster dense.
  media.forEach((m, i) => {
    link(m, topicHub, "REPORTS_ON");
    if (claims.length) link(m, pick(claims, i), "REPORTS_ON");
    if (claims.length) link(m, pick(claims, i + 3), "CITES");
    if (subTopics.length) link(m, pick(subTopics, i + 1), "REPORTS_ON");
  });

  // One node per agent, typed by what the archetype actually is.
  // Shared with the runtime-config table so a persona is the same kind of thing in both.
  const agentNode = new Map<string, string>();
  agents.forEach((a) => agentNode.set(a.id, add(a.displayName, agentEntityType(a))));

  agents.forEach((a, i) => {
    const an = agentNode.get(a.id)!;
    link(an, pick(communities, i), "MEMBER_OF");
    link(an, pick(platforms, i), "AFFILIATED_WITH");
    // Stance decides how an agent attaches to the subject — the graph should show
    // the argument, not just the participation.
    const rel = a.stance === "hostile" ? "CRITICIZES" : a.stance === "supportive" ? "RESPONDS_TO" : "MENTIONS";
    link(an, subTopics.length ? pick(subTopics, i) : topicHub, rel);
    if (claims.length) link(an, pick(claims, i + 1), a.stance === "hostile" ? "REFUTES" : "CITES");
    if (a.stance === "skeptical") link(an, pick(institutions, i), "CRITICIZES");
    if (agentEntityType(a) === "Journalist") link(an, pick(media, i), "AFFILIATED_WITH");
    // A sparse amplification web between agents — every third pair, so hubs emerge.
    if (i % 3 === 0) link(an, agentNode.get(agents[(i + 5) % agents.length].id)!, "AMPLIFIES");
    if (i % 4 === 1) link(an, agentNode.get(agents[(i + 2) % agents.length].id)!, "RESPONDS_TO");
  });

  /**
   * Events are added **last**, after the agent nodes, and that ordering is load-bearing.
   *
   * The console reveals the graph by node index as the run progresses, so the array order
   * is the order the graph grows in: ontology first (step 1, graph build), then agents
   * (step 2, as profiles are generated), then events (step 3, as rounds play). Move these
   * earlier and the graph stops telling the story of the run.
   */
  const events = EVENT_LABELS.map((l) => add(l, "Event"));

  // Events chain the rounds together and give the graph a spine of causality.
  events.forEach((e, i) => {
    link(e, topicHub, "TRIGGERS");
    if (i + 1 < events.length) link(e, events[i + 1], "ESCALATES_TO");
    link(e, pick(media, i), "REPORTS_ON");
    link(e, agentNode.get(agents[(i * 3) % agents.length].id)!, "MENTIONS");
    if (communities.length) link(e, pick(communities, i), "RELATES_TO");
  });

  for (const p of platforms) link(p, topicHub, "RELATES_TO");
  communities.forEach((c, i) => link(c, pick(platforms, i), "AFFILIATED_WITH"));

  // ---- Feed --------------------------------------------------------------------
  const rounds: ConsoleRound[] = Array.from({ length: CONSOLE_ROUNDS }, (_, r) => {
    const posts: ConsolePost[] = [];
    for (let k = 0; k < POSTS_PER_ROUND; k++) {
      const a = agents[(r * POSTS_PER_ROUND + k * 3) % agents.length];
      const quote = lines[(r + k) % Math.max(1, lines.length)] ?? first;
      posts.push({
        agentId: a.id,
        platform: k % 2 === 0 ? "plaza" : "community",
        text: postFor(a.stance, subject, quote),
        engagement: 40 + Math.floor(rand() * 3_000) * (r + 1),
        stance: a.stance,
        replyTo: k > 1 ? agents[(r * POSTS_PER_ROUND + (k - 1) * 3) % agents.length].id : undefined,
      });
    }
    return { round: r, headline: ROUND_HEADLINES[r] ?? `Ronde ${r}`, posts };
  });

  return {
    ontology: {
      summary: first.length > 220 ? `${first.slice(0, 217)}…` : first,
      entityTypes: ENTITY_TYPES,
      relationTypes: RELATION_TYPES,
      tensions: [
        `Transparansi seputar ${subject}`,
        `Dampak ${subject} bagi publik`,
        `Kewenangan dan pengawasan atas ${subject}`,
      ],
      anchors: lines.slice(0, 4),
      // No model read available — assume a materially hostile document, the
      // conservative assumption for a crisis tool.
      volatility: 62,
      nodes,
      edges,
    },
    agents,
    rounds,
    report: {
      title: `Proyeksi Perkembangan Opini Publik: ${subject}`,
      abstract: `Simulasi menunjukkan percakapan seputar ${subject} berkembang dari keresahan awal di komunitas kecil menjadi tuntutan klarifikasi yang lebih luas, dengan fokus bergeser dari peristiwa ke pertanyaan tata kelola.`,
      sections: [
        {
          heading: "Gelombang Pertama: Keresahan Terlokalisasi",
          subheading: "Percakapan dimulai di komunitas yang paling terdampak",
          paragraphs: [
            `Reaksi awal terhadap ${subject} muncul dari kelompok yang merasa paling berkepentingan. Pada tahap ini percakapan masih berupa pertanyaan, bukan tuduhan.`,
            "Ketiadaan keterangan resmi pada jam-jam pertama membuat ruang interpretasi terbuka lebar, dan interpretasi paling keras cenderung menyebar paling cepat.",
          ],
          quote: first,
        },
        {
          heading: "Jalur Penyebaran: Siapa Membawa Isu Ke Mana",
          subheading: "Perpindahan antar komunitas menentukan kecepatan",
          paragraphs: [
            "Isu tidak menyebar merata. Simulasi memperlihatkan beberapa akun berperan sebagai jembatan antar komunitas: jumlah pengikutnya tidak besar, tetapi merekalah yang memindahkan percakapan dari satu kelompok tertutup ke kelompok berikutnya.",
            "Selama isu masih berputar di satu komunitas, biaya penanganannya rendah. Begitu melewati jembatan pertama, jumlah pihak yang harus diyakinkan bertambah berlipat.",
          ],
        },
        {
          heading: "Titik Balik: Dari Peristiwa ke Tata Kelola",
          subheading: "Fokus berpindah dari kasus ke prosedur",
          paragraphs: [
            "Ketika percakapan menyentuh linimasa yang lebih luas, pertanyaan berubah bentuk: bukan lagi soal apa yang terjadi, melainkan soal bagaimana keputusan diambil dan siapa yang mengawasinya.",
            "Pergeseran ini penting karena pertanyaan tata kelola jauh lebih sulit ditutup dengan satu klarifikasi.",
          ],
        },
        {
          heading: "Suara Penyeimbang dan Batasnya",
          subheading: "Dukungan muncul, tetapi terlambat dan terlalu terpusat",
          paragraphs: [
            "Suara yang menempatkan isu dalam konteks memang muncul, namun baru setelah tuntutan klarifikasi menguat, dan sebagian besar datang dari pihak yang mudah dibaca sebagai berkepentingan.",
            "Akibatnya penyeimbangan berjalan lambat: audiens menilai sumbernya sebelum menilai isinya.",
          ],
        },
        {
          heading: "Implikasi Komunikasi",
          subheading: "Apa yang menentukan arah berikutnya",
          paragraphs: [
            "Simulasi menunjukkan suara penyeimbang baru muncul setelah tuntutan klarifikasi menguat. Semakin lama jeda itu, semakin mahal biaya pemulihannya.",
            "Rekomendasi: terbitkan klarifikasi berbasis data lebih awal, lalu perkuat lewat kanal resmi dan mitra yang mencantumkan keterbukaan.",
          ],
        },
      ],
      memories: lines.slice(0, 8).length > 0 ? lines.slice(0, 8) : [first],
    },
  };
}

function postFor(stance: Stance, subject: string, quote: string): string {
  const snippet = quote.length > 130 ? `${quote.slice(0, 127)}…` : quote;
  const t: Record<Stance, string> = {
    hostile: `Soal ${subject} ini makin tidak jelas. "${snippet}" — publik berhak tahu dasarnya apa.`,
    skeptical: `Ada yang sudah baca detail ${subject}? Bagian ini yang bikin saya bertanya: "${snippet}"`,
    neutral: `Konteks ${subject}, apa adanya: "${snippet}" Saya tunggu keterangan resminya dulu.`,
    supportive: `Menurut saya ${subject} perlu dibaca utuh. "${snippet}" Jangan buru-buru menyimpulkan.`,
  };
  return t[stance];
}
