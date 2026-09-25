[English](README.md) | **Bahasa Indonesia**

# JawiConverter
*Rumi ↔ Jawi, lebih sederhana.*

## Pendahuluan
JawiConverter adalah alat berbasis browser dalam satu file untuk mengonversi teks Melayu antara Rumi (Latin) dan Jawi. Konverter ini mengikuti **Pedoman Umum Ejaan Jawi Bahasa Melayu** dan menggabungkan aturan ejaan berbasis suku kata dengan kamus pengecualian kata.

Antarmuka tersedia dalam **Bahasa Inggris** dan **Bahasa Melayu**. Konversi berlangsung secara lokal di browser; `JawiConverter.html` tidak memiliki dependensi JavaScript eksternal atau kebutuhan jaringan saat dijalankan, sehingga dapat digunakan secara offline.

## Cara Kerja
- **Rumi → Jawi**: Menerapkan aturan huruf, suku kata, vokal, dan konsonan akhir, lalu menggunakan ejaan kata terverifikasi ketika aturan umum tidak cukup.
- **Jawi → Rumi**: Memeriksa ejaan balik yang persis, lalu bentuk tak ambigu dari daftar kata bawaan, dan terakhir menggunakan transliterasi per karakter. Karena vokal pendek sering tidak ditulis dalam Jawi, beberapa kata tetap ambigu tanpa konteks.
- Jawi yang ditempel dinormalisasi sebelum pencarian: hamzah tinggi **ٴ** (U+0674) yang dipakai sebagian sumber Jawi sebagai ganti hamzah disatukan dengan hamzah standar **ء** (U+0621), sehingga kedua ejaan menghasilkan konversi yang sama.
- Aplikasi mempertahankan spasi biasa dan tanda baca umum, serta mendukung bentuk bertanda hubung dan reduplikasi yang tersedia di kamus.
- Ketik **é** untuk menandai vokal taling secara eksplisit; **e** tanpa aksen diproses dengan aturan pepet/taling pada mesin konversi.

## Mulai Cepat
1. Unduh `JawiConverter.html` dari repositori.
2. Buka file di browser modern (Chrome, Edge, Firefox, atau Safari). Tidak perlu instalasi.
3. Pilih **Rumi → Jawi** atau **Jawi → Rumi**.
4. Ketik atau tempel teks ke panel sumber. Konversi berjalan langsung; Anda juga dapat mengunggah file `.txt`.
5. Salin hasilnya, atau gunakan **Tukar** untuk mengganti arah dan memindahkan hasil ke panel sumber.

## Fitur Utama
- **Konversi dua arah**: transliterasi Rumi ↔ Jawi.
- **Satu file HTML**: Mesin konversi disematkan di `JawiConverter.html`; aplikasi dapat berjalan offline tanpa memuat skrip eksternal.
- **Transliterasi berbasis aturan**: segmentasi suku kata, penanganan vokal, digraf konsonan, morfologi, serta aturan kaf/qaf akhir.
- **Pengecualian terverifikasi**: 800 entri PRPM yang dipilih setelah seluruh uji aturan Pedoman lulus, dalam 16 langkah masing-masing 50 entri.
- **Konversi langsung** dengan contoh, salin/tempel, unggah `.txt`, dan pertukaran arah.
- **Antarmuka Bahasa Inggris dan Bahasa Melayu**, dengan pilihan tema otomatis, terang, dan gelap.
- **Tata letak responsif** untuk desktop dan perangkat seluler.

## Evaluasi Akurasi
Jalankan pengujian dan benchmark cache PRPM dengan:

```sh
node tests/run_tests.js
```

Snapshot evaluasi tingkat kata saat ini berisi **4.067 bentuk PRPM yang tidak null**. Pengujian terlebih dahulu menghapus seluruh entri EXC dan menjalankan 223 kasus aturan yang mencakup bagian 3–19 Pedoman. Pengoptimal baru dijalankan setelah semuanya lulus dan melindungi seluruh 236 kasus Pedoman pada setiap penambahan 50 entri PRPM:

| Entri EXC | Akurasi rata-rata |
| ---: | ---: |
| 0 | 84,63% |
| 50 | 86,01% |
| 100 | 87,34% |
| 150 | 88,66% |
| 200 | 89,89% |
| 250 | 91,15% |
| 300 | 92,38% |
| 350 | 93,59% |
| 400 | 94,55% |
| 450 | 95,24% |
| 500 | 95,88% |
| 550 | 96,51% |
| 600 | 97,11% |
| 650 | 97,74% |
| 700 | 98,34% |
| 750 | 98,97% |
| **800** | **99,55%** |

Pada 800 entri, skor per arah adalah **99,46%** Rumi → Jawi dan **99,63%** Jawi → Rumi. Ini adalah kelipatan 50 pertama yang mencapai target rata-rata 99%. Pengoptimal memaksimalkan pertambahan kecocokan gabungan, menggunakan frekuensi PRPM untuk memecahkan nilai seri, dan menolak kandidat yang bertentangan dengan bentuk Pedoman yang dilindungi. Karena entri dipilih dari snapshot PRPM yang sama, angka ini adalah benchmark dalam-korpus, bukan jaminan akurasi pada data terpisah. Unicode dinormalisasi ke NFC dan kontrol pemformatan tak terlihat diabaikan; ejaan lainnya dibandingkan secara persis.

“Aturan saja” berarti batch EXC PRPM dinonaktifkan, bukan konversi tanpa kamus: metadata pelafalan/akar, kelas leksikal tetap Pedoman, dan tabel pencarian balik tetap digunakan. Contoh regresi tidak membuktikan ketepatan setiap kata atau konteks. Lihat [audit Pedoman](docs/PEDOMAN_AUDIT.md) untuk cakupan dan batasannya.

Pengoptimal memeriksa ulang **semua keluaran yang dilindungi setelah setiap batch**, termasuk kata turunan yang dipengaruhi pengecualian akar. Setelah penulisan, seluruh pengujian dijalankan; mesin sebelumnya dipulihkan jika validasi gagal.

`JawiConverter.html` adalah satu-satunya sumber mesin. Alat Node dan pengujian memakai `tools/app_engine.js` untuk menyalin mesin inline ke direktori sementara sistem operasi, memuatnya, lalu menghapus salinan tersebut. Tidak ada berkas JavaScript mesin duplikat yang dikirim.

Untuk membangun ulang EXC dari nol dalam langkah 50 entri, jalankan simulasi lalu terapkan hasil langsung ke aplikasi:

```sh
node tools/optimize_exceptions.js          # simulasi; menampilkan setiap langkah 50 entri
node tools/optimize_exceptions.js --write  # menulis batch inline dalam JawiConverter.html
```

## Privasi & Data
Semua konversi berlangsung di browser. Teks tidak diunggah atau dikirim ke server. Bentuk PRPM di `tools/prpm_cache.json` digunakan untuk pengembangan dan evaluasi; aplikasi tidak mengambil data dari PRPM atau layanan lain saat digunakan.

## Lisensi
Proyek ini berlisensi [MIT License](LICENSE).

## Kontribusi
Issue, koreksi, dan pull request dipersilakan. Untuk perubahan aturan ejaan, sertakan kasus regresi dan jalankan evaluasi PRPM agar dampaknya pada kedua arah dapat diketahui.

## Umpan Balik
Silakan gunakan bagian Issues pada repositori untuk pertanyaan, koreksi, dan saran.
