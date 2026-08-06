import { rankBumn, rankIssues, sentimentBreakdown, statusOf, velocity } from "@/lib/danantara/ceo/engine";
import type { BumnSentiment, CeoIssue } from "@/lib/danantara/ceo/types";
import type { TopicIntent } from "@/lib/danantara/ceo/topics-source";

type RawIssue = Omit<
  CeoIssue,
  "velocity" | "status" | "rankHistory" | "rankDelta" | "posMentions" | "negMentions"
> & {
  sentimentPct: { positive: number; neutral: number; negative: number };
};

type RawPolda = Omit<BumnSentiment, "rankHistory" | "rankDelta" | "posMentions" | "negMentions" | "posReach" | "negReach">;

const HISTORY = [0.82, 0.86, 0.91, 0.96, 1.03, 1.08];

function historyFrom(mentions: number): number[] {
  return HISTORY.map((factor) => Math.max(1, Math.round(mentions * factor)));
}

function issue(raw: Omit<RawIssue, "history">): RawIssue {
  return { ...raw, history: historyFrom(raw.mentions) };
}

function hydrateIssue(raw: RawIssue, rank: number): CeoIssue {
  const posMentions = Math.round(raw.mentions * (raw.sentimentPct.positive / 100));
  const negMentions = Math.round(raw.mentions * (raw.sentimentPct.negative / 100));
  const vel = velocity(raw.history);

  return {
    ...raw,
    velocity: vel,
    status: statusOf(vel, raw.reach, "normal"),
    rankHistory: [rank + 2, rank + 2, rank + 1, rank + 1, rank, rank],
    rankDelta: 1,
    posMentions,
    negMentions,
  };
}

function hydratePolda(raw: RawPolda, rank: number): BumnSentiment {
  const mentions = sentimentBreakdown(raw.sentiment, raw.mentions);
  const reach = sentimentBreakdown(raw.sentiment, raw.reach);

  return {
    ...raw,
    rankHistory: [rank + 1, rank + 1, rank, rank, rank, rank],
    rankDelta: 1,
    posMentions: mentions.pos,
    negMentions: mentions.neg,
    posReach: reach.pos,
    negReach: reach.neg,
  };
}

// Mock synthesis date: 2026-08-06. The topics below are manually shaped from
// publicly indexed news, official Polri releases, and accessible social snippets.
// They are realistic briefing fixtures, not live social-media API output.
const RAW_POLRI_ISSUES: RawIssue[] = [
  issue({
    id: "polri-korupsi-penegakan-hukum",
    title: "Publik mengawal kasus korupsi besar yang ditangani Kortastipidkor Polri",
    category: "tata-kelola",
    relatedBumn: [],
    mentions: 46_800,
    reach: 34_500_000,
    sentiment: -58,
    sentimentPct: { positive: 12, neutral: 28, negative: 60 },
    headlines: [
      { source: "Katadata", title: "Rangkaian perkara korupsi dan TPPU kembali menyeret perhatian publik ke Polri", time: "minggu ini" },
      { source: "Social", title: "Percakapan menuntut transparansi penyidikan dan pemulihan aset negara", time: "7 hari" },
    ],
    aiLine:
      "percakapan menyorot perkara korupsi besar yang dikaitkan dengan kerja Kortastipidkor Polri, termasuk tuntutan agar proses penyidikan, aset yang disita, dan aktor yang terlibat dibuka lebih jelas. publik menganggap kasus korupsi bernilai besar sebagai ujian akuntabilitas Polri; topik menyebar karena warganet membandingkan kecepatan penindakan dengan ekspektasi reformasi hukum.",
  }),
  issue({
    id: "polri-kriminalisasi-hukum",
    title: "Narasi hukum tidak boleh menjadi alat kriminalisasi kembali ramai",
    category: "kebijakan",
    relatedBumn: [],
    mentions: 39_200,
    reach: 29_100_000,
    sentiment: -52,
    sentimentPct: { positive: 14, neutral: 31, negative: 55 },
    headlines: [
      { source: "Katadata", title: "Komentar elite politik soal hukum dan aparat menjadi bahan diskusi publik", time: "minggu ini" },
      { source: "Social", title: "Kata kunci reformasi Polri, transparansi, dan keadilan sering muncul berulang", time: "7 hari" },
    ],
    aiLine:
      "narasi negatif berkembang dari kekhawatiran bahwa penegakan hukum bisa dipakai untuk menekan pihak tertentu, lalu dikaitkan dengan kebutuhan reformasi Polri dan transparansi proses perkara. isu ini mudah viral karena menyentuh pengalaman warga saat berurusan dengan aparat, pernyataan elite politik, dan kekhawatiran publik terhadap independensi hukum.",
  }),
  issue({
    id: "polri-bhayangkara-layanan-publik",
    title: "Kampanye Polri untuk Masyarakat menguat saat Hari Bhayangkara ke-80",
    category: "sosial",
    relatedBumn: [],
    mentions: 25_500,
    reach: 19_300_000,
    sentiment: 44,
    sentimentPct: { positive: 56, neutral: 29, negative: 15 },
    headlines: [
      { source: "Humas Polri", title: "Kegiatan Hari Bhayangkara menonjolkan layanan humanis dan bakti sosial", time: "minggu ini" },
      { source: "Social", title: "Konten bakti kesehatan, layanan SIM, dan kegiatan sosial dibagikan kanal resmi", time: "7 hari" },
    ],
    aiLine:
      "Kampanye Polri untuk Masyarakat menjadi sinyal positif nasional karena menggabungkan seremoni Hari Bhayangkara dengan layanan langsung seperti bakti kesehatan, bantuan sosial, dan edukasi keamanan. publik membicarakannya karena konten kegiatan mudah dibagikan, tetapi dampak reputasinya bergantung pada bukti layanan yang dirasakan warga setelah acara selesai.",
  }),
  issue({
    id: "polri-hoaks-cyber-patroli",
    title: "Respons Polri terhadap hoaks dan penipuan digital mendapat perhatian publik",
    category: "kebijakan",
    relatedBumn: [],
    mentions: 22_400,
    reach: 16_200_000,
    sentiment: 31,
    sentimentPct: { positive: 47, neutral: 34, negative: 19 },
    headlines: [
      { source: "Humas Polri", title: "Patroli siber dan edukasi anti-hoaks kembali dikomunikasikan ke publik", time: "minggu ini" },
      { source: "Social", title: "Warganet membagikan tangkapan layar penipuan online dan meminta respons cepat", time: "7 hari" },
    ],
    aiLine:
      "Patroli siber dan edukasi anti-hoaks menjadi topik positif nasional karena publik melihat kebutuhan perlindungan dari penipuan digital, deepfake, dan ujaran kebencian. percakapan naik karena korban penipuan sering membagikan bukti di media sosial; Polri dipersepsikan relevan bila mampu memberi klarifikasi cepat dan kanal pelaporan yang jelas.",
  }),
  issue({
    id: "polri-etle-tilang-elektronik",
    title: "Tilang elektronik nasional dinilai mengurangi pungli tetapi masih diperdebatkan",
    category: "kebijakan",
    relatedBumn: [],
    mentions: 20_900,
    reach: 14_600_000,
    sentiment: -8,
    sentimentPct: { positive: 33, neutral: 31, negative: 36 },
    headlines: [
      { source: "Korlantas", title: "Optimalisasi ETLE dan operasi kepatuhan lalu lintas terus disosialisasikan", time: "minggu ini" },
      { source: "Social", title: "Pengendara mendukung sistem elektronik namun meminta mekanisme banding jelas", time: "7 hari" },
    ],
    aiLine:
      "Tilang elektronik berada dalam percakapan nasional yang campuran: publik mendukung pengurangan interaksi langsung yang rawan pungli, tetapi tetap mempertanyakan akurasi kamera, surat konfirmasi, dan proses sanggah. warga membicarakannya karena dampaknya langsung ke aktivitas harian pengendara dan sering muncul lewat unggahan bukti tilang di media sosial.",
  }),
];

const RAW_POLDA_TOPICS: RawIssue[] = [
  issue({
    id: "metro-tppo-anak-bekasi",
    title: "Polda Metro Jaya bongkar TPPO dan eksploitasi seksual anak di Bekasi",
    category: "sosial",
    relatedBumn: ["metro-jaya"],
    mentions: 28_900,
    reach: 22_400_000,
    sentiment: 43,
    sentimentPct: { positive: 55, neutral: 25, negative: 20 },
    headlines: [
      { source: "Humas Polri", title: "Delapan anak korban eksploitasi diselamatkan dari jaringan kafe", time: "awal Juli 2026" },
      { source: "Social", title: "Apresiasi bercampur desakan agar jaringan pelindung dibuka", time: "7 hari" },
    ],
    aiLine:
      "Polda Metro Jaya menjadi sorotan setelah pengungkapan kasus TPPO dan eksploitasi seksual anak di Bekasi, dengan korban anak diselamatkan dari jaringan tempat hiburan. publik memberi apresiasi karena kasus menyangkut perlindungan anak, tetapi percakapan tetap tinggi karena warga menuntut pembongkaran jaringan pelindung, pemilik tempat, dan pengawasan izin usaha.",
  }),
  issue({
    id: "metro-narkoba-1745-ton",
    title: "Polda Metro Jaya sita 17,45 ton narkoba dan obat keras berbahaya",
    category: "sosial",
    relatedBumn: ["metro-jaya"],
    mentions: 33_600,
    reach: 25_800_000,
    sentiment: 61,
    sentimentPct: { positive: 66, neutral: 21, negative: 13 },
    headlines: [
      { source: "ANTARA", title: "Polda Metro Jaya paparkan enam kasus narkoba menonjol Januari-Juni 2026", time: "akhir Juni 2026" },
      { source: "Humas Polri", title: "Pengungkapan diklaim menyelamatkan jutaan jiwa dari ancaman narkoba", time: "akhir Juni 2026" },
    ],
    aiLine:
      "pengungkapan 17,45 ton narkoba dan obat keras oleh Polda Metro Jaya menjadi topik positif karena angka barang bukti sangat besar dan dikaitkan dengan jaringan lintas wilayah. isu narkoba punya daya sebar tinggi di media sosial karena menyangkut keselamatan keluarga dan anak muda; framing penyelamatan jutaan jiwa membuat publik mudah memahami dampaknya.",
  }),
  issue({
    id: "metro-curanmor-jakarta",
    title: "Keluhan curanmor dan begal di Jakarta menekan percakapan Polda Metro Jaya",
    category: "sosial",
    relatedBumn: ["metro-jaya"],
    mentions: 24_700,
    reach: 18_600_000,
    sentiment: -42,
    sentimentPct: { positive: 17, neutral: 34, negative: 49 },
    headlines: [
      { source: "Social", title: "Unggahan CCTV curanmor dan begal kembali ramai di akun komunitas Jakarta", time: "7 hari" },
      { source: "Media lokal", title: "Warga meminta patroli malam dan pengungkapan jaringan penadah", time: "minggu ini" },
    ],
    aiLine:
      "Keluhan curanmor, begal, dan keamanan lingkungan di Jakarta menjadi tekanan negatif khusus untuk Polda Metro Jaya karena warga membagikan rekaman CCTV, lokasi rawan, dan cerita korban. percakapan ramai karena isu ini dekat dengan rasa aman harian; publik ingin melihat patroli yang terlihat, pengungkapan penadah, dan respons cepat pada laporan warga.",
  }),
  issue({
    id: "metro-berantas-jaya-motor-kembali",
    title: "Operasi Berantas Jaya mengembalikan motor korban curanmor yang hampir dikirim ke luar daerah",
    category: "sosial",
    relatedBumn: ["metro-jaya"],
    mentions: 18_200,
    reach: 13_900_000,
    sentiment: 54,
    sentimentPct: { positive: 61, neutral: 27, negative: 12 },
    headlines: [
      { source: "Humas Polri", title: "Polda Metro Jaya mengembalikan motor korban yang nyaris dikirim ke Jambi", time: "8 Juli 2026" },
      { source: "Social", title: "Komentar warga menyorot proses pengembalian barang bukti tanpa pungutan", time: "7 hari" },
    ],
    aiLine:
      "Operasi Berantas Jaya menjadi bahan percakapan positif karena kasus curanmor tidak berhenti pada penangkapan pelaku, tetapi sampai pada pengembalian motor kepada korban. warga membicarakannya karena cerita pemulihan barang bukti terasa konkret dan dekat dengan pengalaman harian; narasi tanpa pungutan membantu memperkuat persepsi layanan kepolisian.",
  }),
  issue({
    id: "metro-patroli-3p-jaktim",
    title: "Patroli Perintis Presisi Jakarta Timur ungkap jaringan curanmor yang tersambung narkoba",
    category: "sosial",
    relatedBumn: ["metro-jaya"],
    mentions: 16_400,
    reach: 12_700_000,
    sentiment: -18,
    sentimentPct: { positive: 29, neutral: 34, negative: 37 },
    headlines: [
      { source: "Humas Polri", title: "Patroli 3P membongkar curanmor, obat keras, dan sabu dalam satu rangkaian operasi", time: "29 Mei 2026" },
      { source: "Social", title: "Warga mengaitkan temuan ini dengan titik rawan malam hari di Jakarta Timur", time: "7 hari" },
    ],
    aiLine:
      "Patroli Perintis Presisi Jakarta Timur memunculkan percakapan campuran karena pengungkapan menunjukkan polisi aktif berpatroli, tetapi juga memperlihatkan curanmor, obat keras, dan sabu terhubung dalam satu jaringan. publik membicarakannya karena isu ini menggabungkan rasa aman malam hari, kriminalitas jalanan, dan kekhawatiran peredaran narkoba di lingkungan permukiman.",
  }),
  issue({
    id: "jateng-ops-pekat-narkoba-miras",
    title: "Polda Jateng ungkap ribuan kasus narkoba dan miras lewat Ops Pekat II Candi",
    category: "sosial",
    relatedBumn: ["jateng"],
    mentions: 21_700,
    reach: 15_900_000,
    sentiment: 48,
    sentimentPct: { positive: 58, neutral: 25, negative: 17 },
    headlines: [
      { source: "Humas Polri", title: "Operasi 25 Juni-14 Juli disebut menyelamatkan 66 ribu jiwa", time: "22 Juli 2026" },
      { source: "Social", title: "Komentar publik mengaitkan operasi dengan keresahan miras dan narkoba lokal", time: "7 hari" },
    ],
    aiLine:
      "Polda Jateng mendapat percakapan positif dari Operasi Pekat II Candi yang mengungkap kasus narkoba, miras, dan penyakit masyarakat dalam skala besar. warga mengaitkan operasi ini dengan keresahan harian di lingkungan sekitar; apresiasi muncul karena polisi terlihat turun ke lapangan, tetapi publik juga ingin melihat tindak lanjut rehabilitasi dan pencegahan berulang.",
  }),
  issue({
    id: "jabar-hoaks-cooling-system",
    title: "Polda Jabar dorong humas menjadi cooling system untuk hoaks dan ujaran kebencian",
    category: "kebijakan",
    relatedBumn: ["jabar"],
    mentions: 17_800,
    reach: 12_200_000,
    sentiment: 32,
    sentimentPct: { positive: 46, neutral: 35, negative: 19 },
    headlines: [
      { source: "Tribratanews Jabar", title: "Kapolda Jabar instruksikan transformasi humas digital", time: "Mei 2026" },
      { source: "Social", title: "Percakapan publik menyorot kebutuhan klarifikasi cepat, bukan sekadar imbauan", time: "7 hari" },
    ],
    aiLine:
      "Polda Jabar mendorong fungsi humas sebagai cooling system untuk meredam hoaks, ujaran kebencian, dan eskalasi percakapan digital. publik Jawa Barat aktif di kanal lokal dan grup komunitas, sehingga isu klarifikasi cepat terasa relevan; dukungan muncul karena warga butuh rujukan resmi, tetapi efektivitasnya akan dinilai dari respons pada kasus viral.",
  }),
  issue({
    id: "jabar-pocong-ai-prank",
    title: "Polda Jabar soroti prank pocong AI yang meresahkan warga dan memicu ronda bersenjata",
    category: "sosial",
    relatedBumn: ["jabar"],
    mentions: 16_700,
    reach: 11_600_000,
    sentiment: -31,
    sentimentPct: { positive: 21, neutral: 34, negative: 45 },
    headlines: [
      { source: "Humas Polri", title: "Polda Jabar memperingatkan pembuat konten prank dan pocong AI", time: "26 Mei 2026" },
      { source: "Social", title: "Video horor lokal memicu kepanikan warga dan diskusi soal konten setingan", time: "7 hari" },
    ],
    aiLine:
      "Konten prank pocong dan rekayasa AI menjadi tekanan negatif bagi Polda Jabar karena hiburan digital berubah menjadi gangguan kamtibmas ketika warga panik dan melakukan ronda dengan alat berbahaya. percakapan naik karena publik memperdebatkan batas kreativitas konten, tanggung jawab kreator, dan peran polisi dalam meredam hoaks visual.",
  }),
  issue({
    id: "jabar-operasi-patuh-ditunda",
    title: "Penundaan Operasi Patuh Lodaya memicu pertanyaan soal kesiapan lalu lintas Jabar",
    category: "kebijakan",
    relatedBumn: ["jabar"],
    mentions: 19_300,
    reach: 13_700_000,
    sentiment: -34,
    sentimentPct: { positive: 18, neutral: 39, negative: 43 },
    headlines: [
      { source: "detikJabar", title: "Polda Jabar menunda Operasi Patuh Lodaya 2026 sampai pemberitahuan lanjutan", time: "Juni 2026" },
      { source: "Social", title: "Warganet mempertanyakan jadwal dan konsistensi sosialisasi tilang elektronik", time: "7 hari" },
    ],
    aiLine:
      "penundaan Operasi Patuh Lodaya membuat sebagian warga mempertanyakan jadwal penegakan lalu lintas, sosialisasi tilang elektronik, dan kesiapan petugas di Jawa Barat. operasi lalu lintas langsung memengaruhi aktivitas harian pengendara, sehingga perubahan jadwal cepat menyebar di grup warga; sentimen negatif muncul karena publik mencari kepastian aturan dan kanal update resmi.",
  }),
  issue({
    id: "jabar-jaran-lodaya-curanmor",
    title: "Operasi Jaran Lodaya menekan curanmor lintas wilayah di Sumedang, Purwakarta, dan Karawang",
    category: "sosial",
    relatedBumn: ["jabar"],
    mentions: 18_900,
    reach: 13_200_000,
    sentiment: 46,
    sentimentPct: { positive: 57, neutral: 28, negative: 15 },
    headlines: [
      { source: "Tribratanews Jabar", title: "Operasi Jaran Lodaya menangkap pelaku curanmor di sejumlah polres jajaran", time: "Juni 2026" },
      { source: "Social", title: "Akun komunitas membagikan informasi patroli malam dan titik rawan kendaraan", time: "7 hari" },
    ],
    aiLine:
      "Operasi Jaran Lodaya memberi dorongan positif bagi Polda Jabar karena sejumlah polres jajaran mengungkap jaringan curanmor dan penadah di wilayah berbeda. warga membicarakannya karena kehilangan motor menjadi keresahan berulang; apresiasi muncul ketika polisi menunjukkan rute patroli, barang bukti, dan pola jaringan lintas daerah.",
  }),
  issue({
    id: "jateng-pabrik-obat-keras-semarang",
    title: "Kasus pabrik pil berbahaya Semarang terseret dalam percakapan Polda Jateng",
    category: "sosial",
    relatedBumn: ["jateng"],
    mentions: 16_900,
    reach: 11_800_000,
    sentiment: -29,
    sentimentPct: { positive: 20, neutral: 40, negative: 40 },
    headlines: [
      { source: "X/Media Indonesia", title: "Unggahan soal pabrik carisoprodol Semarang dibagikan ulang dalam diskusi narkoba", time: "publik terindeks" },
      { source: "Social", title: "Percakapan mempertanyakan pengawasan bahan baku dan gudang terselubung", time: "7 hari" },
    ],
    aiLine:
      "percakapan tentang pabrik pil berbahaya di Semarang mengaitkan Polda Jateng dengan pengawasan produksi obat keras, distribusi bahan baku, dan jaringan pengedar. isu ini membuat warga khawatir karena lokasi produksi berada dekat dengan ruang publik lokal; apresiasi terhadap pengungkapan bercampur pertanyaan tentang bagaimana fasilitas seperti itu bisa beroperasi.",
  }),
  issue({
    id: "jateng-3c-juni-75-kasus",
    title: "Polda Jateng ungkap 75 kasus 3C selama Juni dengan 121 tersangka",
    category: "sosial",
    relatedBumn: ["jateng"],
    mentions: 17_600,
    reach: 12_400_000,
    sentiment: 39,
    sentimentPct: { positive: 51, neutral: 31, negative: 18 },
    headlines: [
      { source: "Humas Polri", title: "Ditreskrimum Polda Jateng paparkan 75 kasus curat, curas, dan curanmor", time: "30 Juni 2026" },
      { source: "Social", title: "Warga membahas curanmor, pembobolan rumah, dan lokasi rawan malam hari", time: "7 hari" },
    ],
    aiLine:
      "Pengungkapan 75 kasus 3C membuat Polda Jateng terlihat aktif menekan kejahatan jalanan dan pencurian kendaraan. publik membicarakannya karena angka kasus tinggi memberi dua pesan sekaligus: penegakan hukum berjalan, tetapi kerawanan curat, curas, dan curanmor masih terasa dekat bagi warga.",
  }),
  issue({
    id: "jateng-senpi-standar-berlapis",
    title: "Polda Jateng perketat standar penggunaan senjata api dinas untuk personel operasional",
    category: "tata-kelola",
    relatedBumn: ["jateng"],
    mentions: 11_900,
    reach: 8_100_000,
    sentiment: 28,
    sentimentPct: { positive: 44, neutral: 37, negative: 19 },
    headlines: [
      { source: "Humas Polri", title: "Polda Jateng menyiapkan standar berlapis legalitas dan kompetensi pengguna senpi", time: "4 Juli 2026" },
      { source: "Social", title: "Diskusi publik mengaitkan senpi dinas dengan profesionalisme aparat", time: "7 hari" },
    ],
    aiLine:
      "Standar berlapis penggunaan senjata api dinas memberi sinyal tata kelola positif karena Polda Jateng menekankan legalitas, kompetensi, dan pengawasan lintas fungsi. percakapan muncul karena isu senpi dinas selalu sensitif; publik ingin memastikan personel yang memegang senjata memiliki pelatihan, pemeriksaan psikologis, dan akuntabilitas yang jelas.",
  }),
  issue({
    id: "jatim-bhayangkara-kepercayaan",
    title: "Polda Jatim angkat tema Polri untuk Masyarakat pada Hari Bhayangkara ke-80",
    category: "sosial",
    relatedBumn: ["jatim"],
    mentions: 14_400,
    reach: 9_900_000,
    sentiment: 41,
    sentimentPct: { positive: 53, neutral: 31, negative: 16 },
    headlines: [
      { source: "Humas Polri", title: "Polda Jatim gelar upacara Hari Bhayangkara dan tekankan layanan humanis", time: "1 Juli 2026" },
      { source: "Social", title: "Narasi Jogo Jatim dan sinergi komunitas cenderung positif", time: "7 hari" },
    ],
    aiLine:
      "momentum Hari Bhayangkara ke-80 di Polda Jatim membawa narasi Polri untuk Masyarakat, layanan humanis, dan kolaborasi keamanan wilayah. konten seremoni, kegiatan sosial, dan pesan layanan publik banyak dibagikan kanal resmi serta komunitas lokal; sentimen positif muncul ketika pesan institusi dikaitkan dengan pengalaman warga yang merasa terbantu.",
  }),
  issue({
    id: "jatim-kamtibmas-komunitas",
    title: "Ekspektasi publik pada Sabuk Kamtibmas Jatim tinggi setelah pelibatan 186 ribu mitra",
    category: "sosial",
    relatedBumn: ["jatim"],
    mentions: 12_600,
    reach: 8_700_000,
    sentiment: -18,
    sentimentPct: { positive: 26, neutral: 39, negative: 35 },
    headlines: [
      { source: "Humas Polri", title: "Polda Jatim sebut Sabuk Kamtibmas melibatkan 186.784 mitra", time: "April 2026" },
      { source: "Social", title: "Komentar publik meminta program tidak berhenti di seremoni", time: "7 hari" },
    ],
    aiLine:
      "Sabuk Kamtibmas Jatim dipersepsikan sebagai program besar karena melibatkan ratusan ribu mitra keamanan masyarakat, dari tokoh lokal sampai komunitas warga. publik menaruh ekspektasi tinggi karena skala program besar; kritik muncul bukan karena menolak konsepnya, melainkan karena warga ingin bukti aktivitas lapangan, respons cepat, dan indikator penurunan gangguan kamtibmas.",
  }),
  issue({
    id: "jatim-narkoba-semester-3157",
    title: "Polda Jatim ungkap 3.157 kasus narkoba semester I dan klaim selamatkan 2,79 juta jiwa",
    category: "sosial",
    relatedBumn: ["jatim"],
    mentions: 22_800,
    reach: 16_500_000,
    sentiment: 52,
    sentimentPct: { positive: 62, neutral: 25, negative: 13 },
    headlines: [
      { source: "Humas Polri", title: "Polda Jatim mengungkap ribuan kasus narkoba dan menyita barang bukti besar", time: "24 Juni 2026" },
      { source: "Social", title: "Percakapan menyorot ancaman narkoba pada pelajar dan keluarga", time: "7 hari" },
    ],
    aiLine:
      "Pengungkapan 3.157 kasus narkoba menjadi topik positif kuat untuk Polda Jatim karena disertai angka tersangka, barang bukti, dan estimasi jiwa terselamatkan. publik membicarakannya karena narkoba dipandang sebagai ancaman langsung terhadap keluarga dan generasi muda; angka besar membuat capaian mudah dipahami sekaligus menimbulkan ekspektasi pencegahan lanjutan.",
  }),
  issue({
    id: "jatim-3c-juni-195-kasus",
    title: "Polda Jatim ungkap 195 kasus 3C selama Juni dan amankan 222 tersangka",
    category: "sosial",
    relatedBumn: ["jatim"],
    mentions: 19_700,
    reach: 14_100_000,
    sentiment: -22,
    sentimentPct: { positive: 27, neutral: 34, negative: 39 },
    headlines: [
      { source: "Humas Polri", title: "Ditreskrimum Polda Jatim memaparkan pengungkapan curat, curas, dan curanmor", time: "30 Juni 2026" },
      { source: "Social", title: "Warga membahas kejahatan jalanan, motor hilang, dan kebutuhan patroli terlihat", time: "7 hari" },
    ],
    aiLine:
      "Pengungkapan 195 kasus 3C memperlihatkan kerja penindakan Polda Jatim, namun percakapan bersih tetap tertekan karena volume kasus menunjukkan kejahatan jalanan masih tinggi. warga membicarakannya karena curanmor, curat, dan curas langsung memengaruhi rasa aman; publik ingin melihat peta rawan dan patroli pencegahan yang konsisten.",
  }),
  issue({
    id: "bali-patuh-agung-etle",
    title: "Polda Bali dorong Operasi Patuh Agung berbasis penegakan hukum elektronik",
    category: "kebijakan",
    relatedBumn: ["bali"],
    mentions: 13_500,
    reach: 9_200_000,
    sentiment: 37,
    sentimentPct: { positive: 49, neutral: 33, negative: 18 },
    headlines: [
      { source: "Humas Polri", title: "Latpraops Patuh Agung 2026 fokus pada optimalisasi ETLE", time: "Juni 2026" },
      { source: "Social", title: "Komentar mendukung tilang elektronik jika transparan dan minim pungli", time: "7 hari" },
    ],
    aiLine:
      "Polda Bali mengangkat Operasi Patuh Agung dengan penekanan pada ETLE dan penegakan hukum elektronik untuk mengatur kedisiplinan lalu lintas. Bali memiliki tekanan mobilitas wisata, warga lokal, dan kendaraan sewaan; publik mendukung ETLE karena dianggap mengurangi transaksi lapangan, tetapi tetap mempertanyakan akurasi kamera, mekanisme banding, dan sosialisasi bagi wisatawan.",
  }),
  issue({
    id: "bali-konser-poliponi",
    title: "Pengamanan konser besar di Bali dipuji, tetapi kemacetan tetap jadi keluhan",
    category: "sosial",
    relatedBumn: ["bali"],
    mentions: 15_100,
    reach: 10_300_000,
    sentiment: -12,
    sentimentPct: { positive: 31, neutral: 32, negative: 37 },
    headlines: [
      { source: "Humas Polri", title: "Polda Bali amankan konser POLIPONI dengan puluhan ribu penonton", time: "4 Juli 2026" },
      { source: "Social", title: "Apresiasi keamanan bercampur keluhan arus lalu lintas sekitar venue", time: "7 hari" },
    ],
    aiLine:
      "pengamanan konser besar di Bali menghasilkan percakapan campuran: keamanan acara dinilai tertib, tetapi arus lalu lintas dan akses menuju venue masih menjadi keluhan. acara besar cepat menyebar di media sosial lewat unggahan penonton; pengalaman macet, parkir, dan rekayasa lalu lintas membuat topik tetap ramai setelah acara selesai.",
  }),
  issue({
    id: "bali-antik-agung-narkoba",
    title: "Polda Bali ungkap 111 kasus Ops Antik Agung dan musnahkan barang bukti Rp13 miliar",
    category: "sosial",
    relatedBumn: ["bali"],
    mentions: 17_900,
    reach: 12_900_000,
    sentiment: 50,
    sentimentPct: { positive: 60, neutral: 27, negative: 13 },
    headlines: [
      { source: "Humas Polri", title: "Ops Antik Agung 2026 mengungkap 111 kasus dan 138 tersangka", time: "11 Juni 2026" },
      { source: "Social", title: "Percakapan mengaitkan narkoba Bali dengan pariwisata dan anak muda", time: "7 hari" },
    ],
    aiLine:
      "Ops Antik Agung menjadi penguat reputasi Polda Bali karena menyajikan angka kasus, tersangka, nilai barang bukti, dan estimasi jiwa terselamatkan. publik membicarakannya karena Bali adalah ruang wisata dan komunitas internasional; isu narkoba cepat viral ketika dikaitkan dengan keselamatan anak muda, pekerja hiburan, dan citra destinasi.",
  }),
  issue({
    id: "bali-demo-papua-humanis",
    title: "Pengamanan aksi mahasiswa Papua di Denpasar dinilai humanis namun tetap sensitif",
    category: "sosial",
    relatedBumn: ["bali"],
    mentions: 12_800,
    reach: 8_900_000,
    sentiment: -6,
    sentimentPct: { positive: 34, neutral: 28, negative: 38 },
    headlines: [
      { source: "Humas Polri", title: "Polda Bali mengamankan aksi mahasiswa Papua di Bundaran Plaza Renon", time: "1 Juli 2026" },
      { source: "Social", title: "Live streaming aksi membuat pengamanan demo cepat menjadi bahan komentar publik", time: "7 hari" },
    ],
    aiLine:
      "Pengamanan aksi mahasiswa Papua di Denpasar menjadi topik sensitif karena isu kebebasan berekspresi, pengelolaan massa, dan hak menyampaikan pendapat selalu memancing perhatian publik. Polda Bali mendapat kredit karena pengamanan disebut aman dan humanis, tetapi percakapan tetap rawan negatif karena aksi disiarkan langsung dan mudah dipotong menjadi narasi berbeda.",
  }),
];

const RAW_POLDAS: RawPolda[] = [
  {
    id: "metro-jaya",
    name: "Polda Metro Jaya",
    short: "Metro",
    sector: "infrastruktur",
    sentiment: -8,
    mentions: 91_600,
    reach: 58_500_000,
    trend: [-18, -16, -12, -10, -8, -8],
    topIssueId: "metro-curanmor-jakarta",
  },
  {
    id: "jabar",
    name: "Polda Jabar",
    short: "Jabar",
    sector: "pangan",
    sentiment: -6,
    mentions: 56_400,
    reach: 35_900_000,
    trend: [-12, -9, -7, -8, -6, -6],
    topIssueId: "polri-kriminalisasi-hukum",
  },
  {
    id: "jateng",
    name: "Polda Jateng",
    short: "Jateng",
    sector: "industri",
    sentiment: 11,
    mentions: 43_200,
    reach: 27_700_000,
    trend: [2, 5, 7, 10, 11, 11],
    topIssueId: "jateng-pabrik-obat-keras-semarang",
  },
  {
    id: "jatim",
    name: "Polda Jatim",
    short: "Jatim",
    sector: "energi",
    sentiment: 9,
    mentions: 38_800,
    reach: 24_600_000,
    trend: [1, 4, 8, 10, 9, 9],
    topIssueId: "jatim-kamtibmas-komunitas",
  },
  {
    id: "bali",
    name: "Polda Bali",
    short: "Bali",
    sector: "telko",
    sentiment: 6,
    mentions: 36_100,
    reach: 22_800_000,
    trend: [-2, 1, 4, 7, 6, 6],
    topIssueId: "bali-konser-poliponi",
  },
];

export const POLRI_ISSUES: CeoIssue[] = rankIssues(RAW_POLRI_ISSUES.map((raw, index) => hydrateIssue(raw, index + 1)));
export const POLDA_TOPICS: CeoIssue[] = rankIssues(RAW_POLDA_TOPICS.map((raw, index) => hydrateIssue(raw, index + 1)));
export const POLRI_TOPICS: CeoIssue[] = rankIssues([...POLRI_ISSUES, ...POLDA_TOPICS]);
export const POLRI_POLDAS: BumnSentiment[] = rankBumn(RAW_POLDAS.map((raw, index) => hydratePolda(raw, index + 1)));
export const POLRI_WEEKLY_STATE = { tickCount: 0, issues: POLRI_ISSUES, bumn: POLRI_POLDAS };
export const POLRI_DETAIL_STATE = { tickCount: 0, issues: POLRI_TOPICS, bumn: POLRI_POLDAS };

export interface PoldaBriefing {
  polda: BumnSentiment;
  topics: CeoIssue[];
  positive: CeoIssue | null;
  negative: CeoIssue | null;
  intent: TopicIntent[];
  recommendations: string[];
}

export function getPoldaBriefing(slug: string): PoldaBriefing | null {
  const polda = POLRI_POLDAS.find((row) => row.id === slug);
  if (!polda) return null;

  const topics = rankIssues(POLDA_TOPICS.filter((topic) => topic.relatedBumn.includes(slug)));
  const positive = topics.filter((topic) => topic.posMentions > topic.negMentions).sort((a, b) => b.reach - a.reach)[0] ?? null;
  const negative = topics.filter((topic) => topic.negMentions >= topic.posMentions).sort((a, b) => b.reach - a.reach)[0] ?? null;
  const totalMentions = topics.reduce((total, topic) => total + topic.mentions, 0) || 1;
  const buckets = [
    { intent: "enforcement", deskripsi: "Pengungkapan kasus, penindakan jaringan, dan barang bukti.", match: /ungkap|sita|operasi|patroli|tangkap|berantas/i },
    { intent: "complaint", deskripsi: "Keluhan warga, rasa aman, kemacetan, atau keresahan lokal.", match: /keluhan|resah|macet|bengal|begal|curanmor|ditunda/i },
    { intent: "public service", deskripsi: "Layanan, pengembalian barang bukti, pengamanan humanis, dan kegiatan masyarakat.", match: /kembali|humanis|bhayangkara|masyarakat|konser|pengamanan/i },
    { intent: "governance", deskripsi: "Transparansi, standar personel, ETLE, dan tata kelola operasional.", match: /ETLE|standar|senjata|humas|hoaks|AI|Patuh/i },
  ];
  const intent = buckets
    .map((bucket) => {
      const matched = topics.filter((topic) => bucket.match.test(`${topic.title} ${topic.aiLine}`));
      const impressions = matched.reduce((total, topic) => total + topic.mentions, 0);
      return {
        intent: bucket.intent,
        deskripsi: bucket.deskripsi,
        impressions,
        share_of_voice: (impressions / totalMentions) * 100,
      };
    })
    .filter((row) => row.impressions > 0)
    .sort((a, b) => b.share_of_voice - a.share_of_voice);

  return {
    polda,
    topics,
    positive,
    negative,
    intent,
    recommendations: [
      `Prioritaskan klarifikasi publik untuk ${negative?.title ?? "isu berisiko tertinggi"} dengan update kronologi, tindakan lapangan, dan kanal pengaduan resmi.`,
      `Angkat bukti kerja positif dari ${positive?.title ?? "program layanan publik"} melalui potongan data, foto kegiatan, dan pernyataan warga terdampak.`,
      `Sinkronkan narasi humas ${polda.name} di kanal resmi, media lokal, dan akun komunitas agar pesan tidak terpecah antarwilayah.`,
    ],
  };
}
