export type Article = {
    id: string;
    category: string;
    title: string;
    content: string;
    date: string;
    image: string;
    is_generated?: boolean;
};

export const ARTICLE_BANK: Omit<Article, 'id' | 'date'>[] = [
    {
        category: "Tips Kesehatan",
        title: "5 Gerakan Peregangan Ringan untuk Pekerja Kantoran",
        content: "Duduk terlalu lama dapat menyebabkan kekakuan otot leher dan punggung. Cobalah rutin melakukan peregangan setiap 2 jam: 1) Putar leher perlahan, 2) Tarik lengan ke samping, 3) Berdiri dan jinjit selama 10 detik. Gerakan sederhana ini melancarkan peredaran darah dan menjaga fokus tetap tajam sepanjang hari.",
        image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop"
    },
    {
        category: "Produktivitas",
        title: "Teknik Pomodoro: Cara Fokus Maksimal dalam 25 Menit",
        content: "Teknik Pomodoro adalah metode manajemen waktu yang membagi kerja menjadi interval 25 menit, dipisahkan istirahat pendek 5 menit. Cara ini mencegah kelelahan mental (burnout) dan menjaga otak tetap segar. Gunakan timer HP Anda dan cobalah hari ini; Anda akan terkejut betapa banyak pekerjaan selesai tanpa rasa lelah berlebih.",
        image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=400&fit=crop"
    },
    {
        category: "Motivasi",
        title: "Mengapa 'Istirahat' adalah Bagian dari Pekerjaan",
        content: "Banyak yang mengira produktivitas berarti bekerja non-stop. Padahal, otak manusia butuh mode 'diffuse' untuk memproses informasi dan menemukan ide kreatif. Berhenti sejenak untuk minum kopi atau berjalan kaki bukan membuang waktu, melainkan 'mengasah gergaji' agar potongan berikutnya lebih tajam dan cepat.",
        image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&h=400&fit=crop"
    },
    {
        category: "Teknologi",
        title: "AI Tools yang Wajib Dicoba Tahun Ini",
        content: "Kehadiran AI seperti ChatGPT dan Perplexity mengubah cara kita bekerja. Gunakan AI untuk: merangkum dokumen panjang, membuat draft email sulit, atau brainstorming ide awal. Jangan takut digantikan, tapi jadilah pekerja yang 'diperkuat' oleh AI untuk hasil kerja 10x lebih cepat.",
        image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=400&fit=crop"
    },
    {
        category: "Work Life Balance",
        title: "Menetapkan Batasan: Kapan Harus Bilang 'Tidak'",
        content: "Menolak tugas tambahan saat piring Anda sudah penuh bukanlah tanda kemalasan, melainkan profesionalisme. Sampaikan dengan sopan: 'Saya ingin membantu, tapi saat ini prioritas saya adalah proyek A agar selesai tepat waktu'. Rekan kerja akan lebih menghargai kejujuran kapasitas Anda daripada janji manis yang terbengkalai.",
        image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop"
    },
    {
        category: "Karir",
        title: "Pentingnya Soft Skill di Era Digital",
        content: "Di dunia yang serba otomatis, kemampuan manusiawi menjadi nilai jual utama. Empati, komunikasi persuasif, dan kepemimpinan adalah skill yang tidak bisa ditiru robot. Mulailah berlatih menjadi pendengar yang baik di rapat dan pemberi solusi yang tenang saat krisis melanda tim.",
        image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=400&fit=crop"
    },
    {
        category: "Keuangan",
        title: "Tips Mengelola Gaji untuk Milenial",
        content: "Rumus 50/30/20 bisa jadi panduan simpel: 50% untuk kebutuhan, 30% untuk keinginan, dan 20% tabungan/investasi. Jangan remehkan kekuatan dana darurat. Mulailah menyisihkan uang receh otomatis ke reksadana pasar uang segera setelah gajian sebelum tergoda checkout belanja online.",
        image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=400&fit=crop"
    },
    {
        category: "Gaya Hidup",
        title: "Manfaat Minum Air Putih yang Cukup di Kantor",
        content: "AC kantor seringkali membuat kulit kering dan tubuh dehidrasi tanpa disadari. Gejalanya seringkali berupa sakit kepala ringan atau sulit konsentrasi di sore hari. Sediakan botol 1 liter di meja. Targetkan habis sebelum jam makan siang, dan isi ulang untuk sesi sore. Fokus Anda akan meningkat drastis.",
        image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=400&fit=crop"
    },
    {
        category: "Teamwork",
        title: "Seni Memberikan Feedback yang Membangun",
        content: "Metode 'Sandwich' (Pujian-Kritik-Pujian) masih ampuh. Mulai dengan apresiasi usaha mereka, sampaikan poin perbaikan secara spesifik (bukan menyerang pribadi), dan tutup dengan dorongan semangat. Feedback yang baik membuat penerimanya merasa 'dibantu', bukan 'dihakimi'.",
        image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=400&fit=crop"
    },
    {
        category: "Lingkungan Kerja",
        title: "Menata Meja Kerja Minimalis untuk Pikiran Jernih",
        content: "Visual noise (gangguan visual) di meja bisa memecah fokus. Simpan dokumen yang tidak dikerjakan saat ini ke laci. Sisakan hanya laptop, air minum, dan satu buku catatan. Meja yang bersih mengirim sinyal ke otak bahwa 'situasi terkendali', menurunkan kadar stres secara instan.",
        image: "https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?w=400&h=400&fit=crop"
    }
];

export function getDailyArticles(): Article[] {
    // Use simple hashing of the date to allow rotation
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);

    // Select 2-3 articles based on the day
    const startIndex = dayOfYear % ARTICLE_BANK.length;
    const count = 3;

    const selected: Article[] = [];
    for (let i = 0; i < count; i++) {
        const item = ARTICLE_BANK[(startIndex + i) % ARTICLE_BANK.length];
        selected.push({
            id: `gen-${startIndex + i}`,
            ...item,
            date: 'Hari Ini', // Or format(new Date(), 'dd MMM')
            is_generated: true
        });
    }

    return selected;
}
