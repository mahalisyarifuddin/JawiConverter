[English](README.md) | **Bahasa Indonesia**

# JawiConverter
*Rumi ↔ Jawi, lebih sederhana.*

JawiConverter adalah alat satu file untuk mengonversi teks Melayu antara Rumi (Latin) dan Jawi. Mesin yang dirancang ulang ini **murni algoritmik dan berbasis aturan**: tidak ada inventaris kata, tabel pencarian balik, atau kamus pengecualian.

## Mulai cepat

1. Unduh `JawiConverter.html`.
2. Buka di browser modern. Tidak perlu instalasi, server, jaringan, atau skrip eksternal.
3. Pilih **Rumi → Jawi** atau **Jawi → Rumi**.
4. Ketik, tempel, atau unggah file `.txt`. Salin hasil atau gunakan **Tukar** untuk mengganti arah.

Antarmuka mendukung Bahasa Melayu dan Inggris, konversi langsung, tema terang/gelap, serta tata letak desktop dan seluler.

## Cara kerja

- **Rumi → Jawi** menggunakan segmentasi suku kata dengan onset maksimal, digraf konsonan Melayu, aturan alif dan vokal kontekstual, imbuhan dan klitika produktif, reduplikasi, akronim, serta kaf/qaf akhir.
- **Jawi → Rumi** menggunakan pencarian keadaan hingga yang deterministik untuk memulihkan vokal yang dihilangkan. Biaya fonotaktik dan konsistensi konversi maju menilai hanya kandidat lengkap, tanpa leksikon.
- Ketik **é** untuk memaksa taling dan **ě** atau **ê** untuk pepet. Tandai kedua vokal bila keduanya perlu ditentukan: `sétém → سيتيم`; `sětěm/sêtêm → ستم`.
- Input Jawi dinormalisasi ke NFC. Hamzah tinggi `ٴ`, kaf Arab `ك`, gaf bertitik `ڬ`, dan peh lama `پ` diterima sebagai alias input.

Rumi tanpa tanda dan Jawi yang menghilangkan vokal memang dapat ambigu. Huruf sumber Arab seperti `ع`, `ء`, `ى`, dan `ة`, sebagian homograf pepet/taling, batas gabungan kata historis, dan pelafalan akronim tidak selalu dapat dipulihkan dari bentuk luarnya. Mesin memakai aturan umum, bukan menyembunyikan jawaban kata dalam tabel. Lihat [audit Pedoman](docs/PEDOMAN_AUDIT.md).

## Pengujian

```sh
node tests/run_tests.js
```

Pengujian luring hanya memakai modul bawaan Node.js dan mencakup:

- 178 bentuk Pedoman deterministik serta penanganan aman atas 58 contoh audit yang secara eksplisit ditandai belum dapat ditentukan;
- akhiran produktif, qaf akhir sebelum akhiran, batas imbuhan, penanda, reduplikasi, dan alias Unicode;
- kandidat decoder balik yang lengkap serta kompatibilitas API browser/Node;
- seluruh 48 pengujian yang ditampilkan HTML;
- perhitungan WER, pembacaan korpus, dan isolasi split test pada tuner.

`JawiConverter.html` adalah satu-satunya sumber mesin produksi. `tools/app_engine.js` mengekstrak skrip inline ke direktori sementara untuk pengujian Node; tidak ada file JavaScript mesin duplikat.

## WER kalimat Utusan

Alat evaluasi menggunakan [`mahalisyarifuddin/utusan-jawi-sentences`](https://huggingface.co/datasets/mahalisyarifuddin/utusan-jawi-sentences) dengan kolom selaras `text` (Jawi) dan `latin_text` (Rumi). Teks korpus **tidak disertakan**. Patuhi kartu dataset dan hak cipta/ketentuan Utusan; jangan memasukkan korpus unduhan atau laporan kesalahan kalimat ke Git.

Evaluasi file Parquet test resmi (memerlukan Python dan `pyarrow`):

```sh
python3 -m pip install --user pyarrow
node tests/evaluate_corpus.js \
  --corpus /path/to/utusan/test.parquet \
  --direction jl \
  --output artifacts/test-metrics.json
```

Tuning hanya pada train, penerimaan berdasarkan validation, lalu evaluasi test:

```sh
node tools/tune_rules.js \
  --train /path/to/utusan/train.parquet \
  --validation /path/to/utusan/validation.parquet \
  --direction jl --passes 3 \
  --train-limit 0 --validation-limit 0 \
  --write

node tests/evaluate_corpus.js \
  --corpus /path/to/utusan/test.parquet \
  --direction jl \
  --output artifacts/test-after-tuning.json
```

Nilai `0` berarti seluruh split. Batas yang lebih kecil berguna selama pengembangan. JSONL, JSON, dan CSV juga didukung. Tuner tidak memiliki opsi split test dan hanya menulis parameter jika validation membaik dan seluruh regresi luring lulus.

**Hasil Jawi → Rumi terukur** pada seluruh split resmi:

| Mesin | WER train | WER validation | WER test |
| --- | ---: | ---: | ---: |
| Pra-tuning, koreksi tanda baca | — | 57,15% | 58,10% |
| **`2026-11-09-rule-based-2` hasil tuning** | **53,35%** | **52,62%** | **53,80%** |

Hasil test akhir adalah **20.618 edit / 38.326 kata referensi = 53,7964% WER**. WER test turun **4,30 poin persentase**, dan kalimat test yang cocok persis naik dari 11 menjadi 59. Empat tahap coordinate descent yang diterima memakai 200 kalimat train dan validation dengan jarak merata, disusul verifikasi validation penuh; tahap kelima tidak menemukan perbaikan dan ditolak. Test tidak digunakan sampai mesin dibekukan. Hasil ini adalah perbaikan lokal terverifikasi, bukan klaim minimum global atas semua aturan yang mungkin. Baca [docs/EVALUATION.md](docs/EVALUATION.md) untuk jumlah dan protokol reproduksi.

## Privasi

Konversi berlangsung lokal di browser dan teks tidak diunggah. Evaluasi hanya membaca korpus yang secara eksplisit diberikan pengembang. `artifacts/`, `corpus/`, dan file Parquet diabaikan Git.

## Lisensi dan kontribusi

Proyek ini berlisensi [MIT](LICENSE). Issue, koreksi, dan pull request dipersilakan. Untuk perubahan aturan, sertakan kasus regresi deterministik atau jelaskan mengapa input ambigu, lalu jalankan pengujian luring dan WER train/validation. Jangan menambahkan kamus pengecualian.
