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
- **Pengecualian terverifikasi**: 650 entri PRPM yang dipilih ulang dari EXC kosong dalam 13 langkah, masing-masing 50 entri.
- **Konversi langsung** dengan contoh, salin/tempel, unggah `.txt`, dan pertukaran arah.
- **Antarmuka Bahasa Inggris dan Bahasa Melayu**, dengan pilihan tema otomatis, terang, dan gelap.
- **Tata letak responsif** untuk desktop dan perangkat seluler.

## Evaluasi Akurasi
Jalankan pengujian dan benchmark cache PRPM dengan:

```sh
node tests/run_tests.js
```

Snapshot evaluasi tingkat kata saat ini berisi **4.056 bentuk PRPM yang tidak null**. Pengoptimalan dimulai dari **EXC kosong** dan menghitung rata-rata kecocokan persis Rumi → Jawi dan Jawi → Rumi pada setiap penambahan 50 entri:

| Entri EXC | Akurasi rata-rata |
| ---: | ---: |
| 0 | 81,30% |
| 50 | 82,74% |
| 100 | 84,01% |
| 150 | 85,33% |
| 200 | 86,61% |
| 250 | 87,87% |
| 300 | 89,13% |
| 350 | 90,36% |
| 400 | 91,59% |
| 450 | 92,85% |
| 500 | 93,58% |
| 550 | 94,26% |
| 600 | 94,92% |
| **650** | **95,55%** |

Pada 650 entri, skor per arah adalah **91,62%** Rumi → Jawi dan **99,48%** Jawi → Rumi. Ini adalah kelipatan 50 pertama yang mencapai target rata-rata 95%. Rata-rata merupakan mean aritmetika kedua skor. Pengoptimal secara greedy memaksimalkan pertambahan kecocokan persis gabungan, menggunakan frekuensi kata PRPM untuk memecahkan nilai seri, dan mempertahankan kasus regresi golden yang memiliki rujukan PRPM. Karena entri dipilih menggunakan snapshot PRPM yang sama, angka ini adalah benchmark dalam-korpus, bukan jaminan akurasi pada data uji terpisah. Unicode dinormalisasi ke NFC dan kontrol pemformatan tak terlihat diabaikan; ejaan lainnya dibandingkan secara persis.

Untuk membangun ulang EXC dari nol dengan langkah 50 entri, jalankan simulasi terlebih dahulu, lalu terapkan hasil yang dioptimalkan:

```sh
node tools/optimize_exceptions.js          # simulasi; menampilkan setiap langkah 50 entri
node tools/optimize_exceptions.js --write  # menulis ulang batch dan menyinkronkan HTML mandiri
```

Untuk menyinkronkan mesin yang disematkan setelah mengedit `jawi_converter.js` secara manual:

```sh
python tools/embed_engine.py
python tools/embed_engine.py --check
```

## Privasi & Data
Semua konversi berlangsung di browser. Teks tidak diunggah atau dikirim ke server. Bentuk PRPM di `tools/prpm_cache.json` digunakan untuk pengembangan dan evaluasi; aplikasi tidak mengambil data dari PRPM atau layanan lain saat digunakan.

## Lisensi
Repositori ini belum menyertakan file `LICENSE`; ketentuan penggunaan ulang belum ditetapkan.

## Kontribusi
Issue, koreksi, dan pull request dipersilakan. Untuk perubahan aturan ejaan, sertakan kasus regresi dan jalankan evaluasi PRPM agar dampaknya pada kedua arah dapat diketahui.

## Umpan Balik
Silakan gunakan bagian Issues pada repositori untuk pertanyaan, koreksi, dan saran.
