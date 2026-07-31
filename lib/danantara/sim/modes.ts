/**
 * The two use cases the console serves (A15 v4.0).
 *
 * Same engine, same five steps — but a policy team and a crisis-PR team are asking
 * genuinely different questions, so the framing, the samples and what the report leads
 * with all change with the mode. Keeping them as data rather than branching in the UI
 * means adding a third use case later is one entry, not a refactor.
 */

export type ModeKey = "policy" | "crisis";

export interface SimMode {
  key: ModeKey;
  /** Who this is for, shown as the eyebrow. */
  audience: string;
  /** The product name for this use case. */
  label: string;
  /** One line: what it answers. */
  blurb: string;
  /** The console's headline question, shown above the input. */
  question: string;
  /** Extra prompt framing appended to the system prompt. */
  framing: string[];
  /** What the report must lead with, injected into the report instructions. */
  reportFocus: string;
  /** Labels for the two simulated platforms in this mode. */
  platforms: { plaza: string; community: string };
  samples: { key: string; label: string; text: string }[];
}

const POLICY: SimMode = {
  key: "policy",
  audience: "Government / Think Tank",
  label: "Policy Opinion Forecasting",
  blurb: "Simulate public reaction before a policy is announced — opinion trends and risk points, group by group.",
  question: "What would public opinion look like if this policy were announced?",
  framing: [
    "MODE: PERAMALAN OPINI KEBIJAKAN (untuk pemerintah / lembaga kajian).",
    "Dokumen ini adalah kebijakan atau rencana kebijakan yang BELUM diumumkan.",
    "- Simulasikan reaksi publik SEANDAINYA kebijakan ini diumumkan apa adanya.",
    "- `agents` harus mewakili KELOMPOK KEPENTINGAN yang berbeda secara jelas",
    "  (mis. penerima manfaat, pihak terdampak biaya, pelaksana di lapangan, pengamat,",
    "  kelompok oposisi kebijakan), karena keluaran utamanya adalah perbedaan antar kelompok.",
    "- Tunjukkan di ronde mana dukungan atau penolakan mengeras pada tiap kelompok.",
  ],
  reportFocus:
    "Laporan harus memetakan TREN OPINI PER KELOMPOK dan TITIK RISIKO: kelompok mana yang menolak, kapan penolakan mengeras, bagian kebijakan mana yang paling memicu, dan opsi penyesuaian sebelum pengumuman.",
  platforms: { plaza: "Public Timeline", community: "Policy Forum" },
  samples: [
    {
      key: "kssk",
      label: "Danantara di KSSK",
      text: `Danantara Indonesia resmi dilibatkan dalam rapat Komite Stabilitas Sistem Keuangan (KSSK) atas arahan langsung Presiden. Menteri Keuangan menegaskan bahwa Danantara tidak memiliki hak suara dalam forum tersebut dan hanya berperan sebagai pemberi masukan terkait portofolio investasi negara.

Sejumlah ekonom mempertanyakan keputusan ini. Mereka menilai kehadiran pengelola aset negara dalam forum stabilitas keuangan berpotensi mengganggu independensi Bank Indonesia dan Otoritas Jasa Keuangan, serta memunculkan konflik kepentingan karena Danantara adalah pelaku investasi sekaligus pengelola aset milik negara.

Pemerintah menyatakan keterlibatan ini justru memperkuat koordinasi kebijakan fiskal, moneter, dan investasi. Publik dan pemerhati ekonomi meminta agar laporan keuangan Danantara yang telah diaudit segera dipublikasikan demi transparansi dan akuntabilitas pengelolaan dana besar negara.`,
    },
    {
      key: "subsidi",
      label: "Penyesuaian subsidi",
      text: `Rancangan kebijakan penyesuaian subsidi energi sedang difinalkan. Skema baru mengalihkan sebagian subsidi harga menjadi bantuan langsung tertarget kepada rumah tangga berpenghasilan rendah, dengan basis data penerima yang diperbarui.

Kementerian terkait menyatakan skema ini lebih tepat sasaran dan menghemat anggaran negara secara signifikan, yang dapat dialihkan ke program pendidikan dan kesehatan. Simulasi internal memperkirakan sekitar 20 juta rumah tangga menjadi penerima langsung.

Kelompok pengemudi transportasi daring dan pelaku usaha mikro mengkhawatirkan kenaikan biaya operasional harian. Sejumlah ekonom menilai keberhasilan skema ini sepenuhnya bergantung pada akurasi data penerima, yang pada program sebelumnya menjadi sumber utama keluhan publik.`,
    },
    {
      key: "digital",
      label: "Aturan platform digital",
      text: `Draf peraturan baru mewajibkan platform digital berbagi data lalu lintas informasi dengan regulator dan menurunkan konten yang dilaporkan dalam waktu 1x24 jam. Peraturan juga mengatur kewajiban verifikasi identitas untuk akun dengan jangkauan besar.

Pemerintah menyatakan aturan ini diperlukan untuk menekan penyebaran informasi palsu dan penipuan daring yang merugikan masyarakat. Asosiasi industri digital menilai tenggat 1x24 jam tidak realistis secara teknis dan berisiko menimbulkan penghapusan konten berlebihan.

Organisasi masyarakat sipil mengangkat kekhawatiran soal kebebasan berekspresi dan perlindungan data pribadi, khususnya pada kewajiban verifikasi identitas.`,
    },
  ],
};

const CRISIS: SimMode = {
  key: "crisis",
  audience: "Enterprise / PR",
  label: "Crisis PR Simulation",
  blurb: "Simulate how a crisis spreads, how sentiment evolves, and how KOLs react — to find the optimal response.",
  question: "How would this crisis spread, and what response contains it?",
  framing: [
    "MODE: SIMULASI KRISIS PR (untuk korporasi / agensi komunikasi).",
    "Dokumen ini adalah peristiwa krisis atau isu negatif yang sedang/akan berkembang.",
    "- Simulasikan bagaimana isu MENYEBAR, bukan sekadar siapa setuju atau tidak.",
    "- `agents` WAJIB memuat beberapa KOL/akun berpengaruh dengan jumlah pengikut besar",
    "  (tetap fiktif), karena reaksi KOL adalah penentu utama arah krisis.",
    "- Tunjukkan momen amplifikasi: ronde saat isu melompat dari komunitas kecil ke",
    "  linimasa luas, dan siapa yang memicunya.",
    "- Tunjukkan pula titik saat suara penyeimbang mulai efektif.",
  ],
  reportFocus:
    "Laporan harus memetakan JALUR PENYEBARAN dan EVOLUSI SENTIMEN: dari mana isu bermula, KOL mana yang mengamplifikasi, kapan puncaknya, dan RESPONS OPTIMAL — pesan apa, lewat kanal apa, pada ronde ke berapa.",
  platforms: { plaza: "Info Plaza", community: "Topic Community" },
  samples: [
    {
      key: "pensiun",
      label: "Dana pensiun & investasi",
      text: `Beredar kekhawatiran di media sosial bahwa dana pensiun karyawan BUMN ikut digunakan untuk membiayai proyek investasi berisiko yang dikelola Danantara. Kekhawatiran ini menyebar cepat setelah sebuah utas panjang membandingkan skema pendanaan tersebut dengan praktik pengelolaan dana yang gagal di masa lalu.

Manajemen menyatakan dana pensiun karyawan dikelola dalam entitas terpisah dengan tata kelola dan pengawasan tersendiri, serta tidak dicampur dengan dana investasi strategis. Namun keterangan tersebut dinilai belum cukup rinci oleh sebagian serikat pekerja, yang meminta audit independen dan publikasi hasilnya.

Beberapa analis menilai isu ini lebih merupakan persoalan komunikasi ketimbang persoalan teknis keuangan, karena tidak ada indikasi pelanggaran yang terverifikasi sejauh ini.`,
    },
    {
      key: "produk",
      label: "Penarikan produk",
      text: `Sebuah perusahaan consumer goods menarik satu batch produk dari peredaran setelah pengujian internal menemukan penyimpangan kualitas pada kemasan tertentu. Perusahaan menyatakan tidak ada laporan gangguan kesehatan yang terverifikasi dan penarikan dilakukan sebagai langkah kehati-hatian.

Sebuah video pendek yang memperlihatkan kondisi produk beredar luas dan ditonton jutaan kali dalam semalam. Beberapa akun berpengaruh di bidang kesehatan dan gaya hidup ikut mengomentari, sebagian meminta penjelasan lebih rinci soal cakupan batch yang ditarik.

Pengecer melaporkan lonjakan pertanyaan konsumen di gerai dan kanal layanan pelanggan. Perusahaan belum mengumumkan mekanisme penggantian bagi konsumen yang telanjur membeli.`,
    },
    {
      key: "phk",
      label: "Isu PHK massal",
      text: `Kabar rencana perampingan organisasi di sebuah perusahaan besar beredar setelah tangkapan layar memo internal dibagikan di forum karyawan. Memo tersebut menyebut restrukturisasi unit bisnis tanpa merinci jumlah posisi yang terdampak.

Manajemen belum memberikan keterangan resmi. Dalam kekosongan itu, beredar berbagai angka perkiraan yang saling bertentangan, sebagian menyebut ribuan posisi.

Serikat pekerja meminta dialog dan kepastian mengenai skema kompensasi. Beberapa akun berpengaruh di bidang ketenagakerjaan mulai mengangkat isu ini sebagai contoh buruknya komunikasi perusahaan kepada karyawan.`,
    },
  ],
};

export const MODES: SimMode[] = [POLICY, CRISIS];

export function modeByKey(key: string | undefined): SimMode {
  return MODES.find((m) => m.key === key) ?? POLICY;
}
