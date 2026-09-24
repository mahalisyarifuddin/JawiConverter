[English](README.md) | **Bahasa Indonesia**

# JawiConverter
*Rumi ↔ Jawi, lebih sederhana.*

## Pendahuluan
JawiConverter adalah alat berbasis browser dalam satu file untuk mengonversi teks Melayu antara Rumi (Latin) dan Jawi. Konverter ini mengikuti **Pedoman Umum Ejaan Jawi Bahasa Melayu** dan menggabungkan aturan ejaan berbasis suku kata dengan kamus pengecualian kata.

Antarmuka tersedia dalam **Bahasa Inggris** dan **Bahasa Melayu**. Konversi berlangsung secara lokal di browser; `JawiConverter.html` tidak memiliki dependensi JavaScript eksternal atau kebutuhan jaringan saat dijalankan, sehingga dapat digunakan secara offline.

## Cara Kerja
- **Rumi → Jawi**: Menerapkan aturan huruf, suku kata, vokal, dan konsonan akhir, lalu menggunakan ejaan kata terverifikasi ketika aturan umum tidak cukup.
- **Jawi → Rumi**: Memeriksa ejaan balik yang persis, lalu bentuk tak ambigu dari daftar kata bawaan, dan terakhir menggunakan transliterasi per karakter. Karena vokal pendek sering tidak ditulis dalam Jawi, beberapa kata tetap ambigu tanpa konteks.
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

Snapshot evaluasi tingkat kata saat ini berisi **4.056 bentuk PRPM yang tidak null**. Pengujian terlebih dahulu menghapus seluruh entri EXC dan menjalankan 160 kasus aturan yang mencakup bagian 3–19 Pedoman. Pengoptimal baru dijalankan setelah semuanya lulus dan melindungi seluruh 169 kasus Pedoman pada setiap penambahan 50 entri PRPM:

| Entri EXC | Akurasi rata-rata |
| ---: | ---: |
| 0 | 83,91% |
| 50 | 85,32% |
| 100 | 86,65% |
| 150 | 87,94% |
| 200 | 89,19% |
| 250 | 90,42% |
| 300 | 91,68% |
| 350 | 92,91% |
| 400 | 94,14% |
| 450 | 94,83% |
| 500 | 95,51% |
| 550 | 96,13% |
| 600 | 96,76% |
| 650 | 97,37% |
| 700 | 97,99% |
| 750 | 98,59% |
| **800** | **99,21%** |

Pada 800 entri, skor per arah adalah **98,79%** Rumi → Jawi dan **99,63%** Jawi → Rumi. Ini adalah kelipatan 50 pertama yang mencapai target rata-rata 99%. Pengoptimal memaksimalkan pertambahan kecocokan gabungan, menggunakan frekuensi PRPM untuk memecahkan nilai seri, dan menolak kandidat yang bertentangan dengan bentuk Pedoman yang dilindungi. Karena entri dipilih dari snapshot PRPM yang sama, angka ini adalah benchmark dalam-korpus, bukan jaminan akurasi pada data terpisah. Unicode dinormalisasi ke NFC dan kontrol pemformatan tak terlihat diabaikan; ejaan lainnya dibandingkan secara persis.

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
