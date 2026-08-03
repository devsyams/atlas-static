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
  /** BGN-flavored samples, shown instead of `samples` when the console runs at /bgn/simulation. */
  samplesBgn?: { key: string; label: string; text: string }[];
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
  samplesBgn: [
    {
      key: "mk-pemisahan-anggaran",
      label: "Putusan MK: anggaran MBG",
      text: `Mahkamah Konstitusi mengabulkan sebagian gugatan uji materi terkait skema pendanaan Program Makan Bergizi Gratis (MBG), dengan menetapkan bahwa anggaran program tersebut harus dipisahkan dari anggaran fungsi pendidikan selambat-lambatnya pada APBN 2028. Putusan menegaskan bahwa MBG penting untuk penanganan stunting, namun pembiayaannya tidak boleh dibebankan pada pos anggaran pendidikan.

Badan Gizi Nasional menyatakan siap menjalankan kebijakan anggaran sesuai putusan tersebut dan tengah menyinkronkan data dengan kementerian terkait untuk mempercepat penyaluran ke wilayah dengan prevalensi stunting tinggi yang belum terlayani. Sejumlah anggota Komisi terkait di DPR menilai putusan ini menjadi momentum bagi BGN untuk merancang ulang skema pendanaan program secara lebih berkelanjutan.

Sejumlah pengamat kebijakan mempertanyakan kesiapan fiskal pemerintah untuk menyediakan pos anggaran tersendiri dalam waktu kurang dari dua tahun, mengingat skala program yang menyasar puluhan juta penerima manfaat.`,
    },
    {
      key: "prioritas-stunting",
      label: "Prioritas wilayah stunting",
      text: `Badan Gizi Nasional tengah menyusun basis data penerima manfaat MBG yang diperbarui, dengan fokus mengalihkan prioritas penyaluran ke wilayah dengan prevalensi stunting tertinggi dan daerah tertinggal, terdepan, dan terluar (3T) yang belum sepenuhnya terlayani program. Kebijakan ini merupakan penyesuaian dari pola penyaluran sebelumnya yang dinilai lebih merata namun belum sepenuhnya berbasis data kebutuhan gizi.

Pemerintah menyebut pendekatan berbasis data ini akan membuat program lebih tepat sasaran dan berdampak lebih besar pada penurunan angka stunting nasional. Sejumlah pemerintah daerah di wilayah yang sebelumnya menjadi prioritas awal mengkhawatirkan kemungkinan pengurangan alokasi penerima di wilayah mereka apabila skema prioritas baru diterapkan.

Organisasi masyarakat sipil di bidang gizi anak meminta agar kriteria dan data yang menjadi dasar penentuan wilayah prioritas dipublikasikan secara terbuka agar proses realokasi dapat diawasi publik.`,
    },
    {
      key: "bulog-pangan-lokal",
      label: "Pangan lokal & buffer Bulog",
      text: `Badan Gizi Nasional menyatakan akan memprioritaskan penggunaan bahan pangan dari produsen lokal untuk dapur-dapur Satuan Pelayanan Pemenuhan Gizi (SPPG), dengan Perum Bulog diposisikan sebagai penyangga pasokan beras apabila terjadi kelangkaan di tingkat daerah. Kebijakan ini belum sepenuhnya diberlakukan secara nasional dan masih dalam tahap penyusunan mekanisme pengadaan.

Pemerintah menilai skema ini akan memperkuat ekonomi petani dan produsen pangan lokal sekaligus menjaga stabilitas pasokan dapur MBG. Sejumlah asosiasi pengusaha katering dan penyedia bahan baku non-beras mempertanyakan apakah penekanan pada Bulog dan produsen lokal akan mempersempit ruang bagi pemasok swasta yang selama ini menjadi mitra SPPG.

Pengamat pangan menilai keberhasilan skema ini bergantung pada kesiapan rantai pasok lokal di luar Jawa, yang selama ini menjadi titik lemah program penyediaan pangan skala nasional.`,
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
  samplesBgn: [
    {
      key: "keracunan-semarang",
      label: "Dugaan keracunan MBG Semarang",
      text: `Sebanyak 707 orang, terdiri atas 693 siswa dan 14 guru SMK Negeri 6 Kota Semarang, diduga mengalami keracunan setelah menyantap menu Makanan Bergizi Gratis (MBG) yang dimasak di Satuan Pelayanan Pemenuhan Gizi (SPPG) Karangturi. Para korban mengalami gejala gangguan pencernaan berupa mual, muntah, dan diare tak lama setelah makan siang.

Badan Gizi Nasional menghentikan sementara operasional SPPG Karangturi sambil menunggu hasil investigasi dan pemeriksaan laboratorium untuk memastikan penyebab insiden. Kepala BGN turun langsung meninjau korban di rumah sakit dan menyatakan sikap tanpa toleransi terhadap pelanggaran keamanan pangan dalam program MBG. Dugaan sementara mengarah pada beberapa bahan makanan dalam menu, termasuk daun singkong dan bumbu rendang.

Video dan unggahan warganet tentang kejadian ini menyebar cepat di media sosial, memicu kekhawatiran publik yang lebih luas terhadap standar keamanan pangan di ribuan dapur SPPG lain di seluruh Indonesia. Sejumlah orang tua murid di daerah lain mempertanyakan apakah dapur di sekolah anak mereka menjalani pengawasan yang sama ketatnya.`,
    },
    {
      key: "hoaks-dana-sppg",
      label: "Hoaks penghentian dana SPPG",
      text: `Sebuah kabar yang menyebut penyaluran dana operasional ke Satuan Pelayanan Pemenuhan Gizi (SPPG) di seluruh Indonesia dihentikan beredar luas di media sosial dan grup percakapan, memicu kekhawatiran di kalangan pengelola dapur dan mitra penyedia bahan pangan program Makan Bergizi Gratis (MBG).

Badan Gizi Nasional menegaskan kabar tersebut adalah hoaks dan bahwa layanan MBG serta penyaluran dana ke SPPG tetap berjalan normal sesuai jadwal. Namun sejumlah pengelola SPPG di daerah mengaku sempat menunda pembelian bahan baku karena khawatir tidak mendapat penggantian, sehingga sebagian dapur sempat mengurangi porsi menu pada hari kabar tersebut beredar.

Pengamat komunikasi krisis menilai lambatnya respons resmi di jam-jam awal penyebaran kabar membuat narasi keliru sempat mendominasi percakapan publik sebelum klarifikasi resmi menjangkau kelompok yang paling terdampak, yakni pengelola dapur dan pemasok kecil di daerah.`,
    },
    {
      key: "efisiensi-anggaran",
      label: "Efisiensi & pengembalian anggaran",
      text: `Badan Gizi Nasional mengumumkan telah mengembalikan lebih dari Rp311 miliar sisa anggaran program Makan Bergizi Gratis (MBG) ke kas negara, sebagai bagian dari langkah efisiensi anggaran dan penguatan tata kelola program. Pengembalian ini disampaikan bersamaan dengan penataan ulang skema operasional MBG untuk meningkatkan efektivitas penyaluran.

Pemerintah menyebut langkah ini menunjukkan disiplin anggaran dan komitmen menghindari pemborosan dalam program berskala besar yang menyasar puluhan juta penerima manfaat. Namun sejumlah warganet dan pengamat anggaran publik mempertanyakan mengapa dana yang cukup besar tidak terserap, dan mengaitkannya dengan pertanyaan lama soal kesiapan implementasi program di lapangan.

Beberapa anggota parlemen meminta penjelasan lebih rinci mengenai pos mana saja yang menyumbang sisa anggaran tersebut, agar publik tidak menafsirkan pengembalian dana sebagai indikasi program berjalan di bawah target.`,
    },
  ],
};

export const MODES: SimMode[] = [POLICY, CRISIS];

export function modeByKey(key: string | undefined): SimMode {
  return MODES.find((m) => m.key === key) ?? POLICY;
}

/** The reality-seed samples to show for a mode — BGN-flavored when `bgn` is set, else default. */
export function samplesFor(mode: SimMode, bgn: boolean): SimMode["samples"] {
  return (bgn && mode.samplesBgn) || mode.samples;
}
