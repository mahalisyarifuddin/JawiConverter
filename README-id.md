[English](README.md) | **Bahasa Indonesia**

# JawiConverter

Konverter Rumi (Latin) ↔ Jawi Melayu berbasis browser dalam satu file. Aplikasi menggabungkan aturan ejaan dan decoder balik berbobot dengan kamus berbasis korpus untuk kedua arah. Kamus aktif secara default dan dapat dimatikan di antarmuka.

## Mulai cepat

1. Unduh `JawiConverter.html` dan buka di browser modern. Tidak perlu instalasi, server, jaringan, atau skrip eksternal.
2. Pilih **Rumi → Jawi** atau **Jawi → Rumi**.
3. Ketik, tempel, atau unggah file `.txt`. Salin hasil atau gunakan **Tukar** untuk mengganti arah.
4. Hapus centang **Kamus** untuk memakai jalur konversi berbasis aturan tanpa kamus korpus.

Antarmuka mendukung Bahasa Melayu dan Inggris, konversi langsung, tema terang/gelap, serta tata letak desktop dan seluler.

## Cara kerja

- **Rumi → Jawi** menggunakan pemenggalan suku kata, aturan ejaan kontekstual, imbuhan, dan reduplikasi. Jika aktif, kamus juga menyediakan ejaan yang dipelajari untuk token yang memenuhi syarat; penanda pelafalan dan bentuk regresi yang dilindungi tetap diutamakan.
- **Jawi → Rumi** menggunakan pencarian keadaan hingga untuk memulihkan vokal yang dihilangkan dan menilai kandidat lengkap berdasarkan biaya fonotaktik dan konsistensi konversi maju. Jika aktif, bacaan kamus dan beberapa pemetaan konteks yang dipelajari melengkapi decoder aturan.
- Ketik **é** untuk memaksa taling dan **ě** atau **ê** untuk pepet. Tandai kedua vokal jika perlu: `sétém → سيتيم`; `sětěm/sêtêm → ستم`.
- Input Jawi dinormalisasi ke NFC. Hamzah tinggi `ٴ`, kaf Arab `ك`, gaf bertitik `ڬ`, dan peh lama `پ` diterima sebagai alias input.

Rumi tanpa tanda dan Jawi yang menghilangkan vokal memang ambigu. Aturan maupun kamus tidak menjamin ejaan atau pelafalan yang dimaksud; periksa hasil yang penting. Lihat [desain mesin](docs/RULE_ENGINE.md) dan [audit Pedoman](docs/PEDOMAN_AUDIT.md).

## Pengujian dan pengembangan

```sh
node tests/run_tests.js
```

Pengujian luring menggunakan modul bawaan Node.js dan memeriksa 179 bentuk Pedoman deterministik, penanganan aman 57 contoh yang belum dapat ditentukan, aturan konversi dan alias, API browser dan Node, seluruh 48 pengujian pada HTML, evaluasi korpus, dan perilaku tuner.

`JawiConverter.html` adalah satu-satunya sumber mesin produksi. `tools/app_engine.js` mengekstrak skrip inline bertanda ke direktori sementara untuk alat Node; tidak ada file JavaScript mesin duplikat.

## Evaluasi korpus

Alat evaluasi menggunakan [dataset kalimat Jawi Utusan](https://huggingface.co/datasets/mahalisyarifuddin/utusan-jawi-sentences) eksternal, dengan kolom selaras `text` (Jawi) dan `latin_text` (Rumi). Teks korpus **tidak disertakan**. Patuhi kartu dataset dan hak cipta/ketentuan Utusan; jangan memasukkan korpus unduhan atau laporan kesalahan kalimat ke Git.

```sh
# Input Parquet memerlukan Python dan pyarrow; JSONL, JSON, dan CSV juga didukung.
python3 -m pip install --user pyarrow
node tests/evaluate_corpus.js --corpus /path/to/utusan/test.parquet \
  --direction jl --output artifacts/test-metrics.json
```

Untuk tuning, berikan data train dan validation secara terpisah; tuner memilih berdasarkan train dan menerima perubahan berdasarkan validation. Jalankan test hanya setelah konfigurasi dibekukan. Secara default alat mengevaluasi dengan kamus bawaan aktif. Lihat [protokol evaluasi dan hasil historis](docs/EVALUATION.md) untuk perintah, keterbatasan, dan riwayat tolok ukur. Skor v18 yang tercatat **tidak** menggambarkan hybrid v19 saat ini; tidak ada klaim WER untuk versi saat ini di sini.

## Privasi dan kontribusi

Konversi berlangsung lokal di browser; teks tidak diunggah. Evaluasi membaca korpus yang diberikan pengembang. `artifacts/`, `corpus/`, dan file Parquet diabaikan Git.

Proyek ini berlisensi [MIT](LICENSE). Issue, koreksi, dan pull request dipersilakan. Untuk perubahan konversi, sertakan pengujian regresi dan, jika relevan, evaluasi train/validation; dokumentasikan kasus ambigu tanpa mengklaim jawaban tunggal.
