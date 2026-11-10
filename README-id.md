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
| `2026-11-09-rule-based-2` hasil tuning | 53,35% | 52,62% | 53,80% |
| `2026-11-09-rule-based-3` hasil penyempurnaan | 48,90% | 48,08% | 49,14% |
| `2026-11-09-rule-based-4` hasil tuning seluruh train | 46,63% | 45,89% | 46,99% |
| `2026-11-09-rule-based-5` hasil penyempurnaan | 44,51% | 43,66% | 44,43% |
| `2026-11-09-rule-based-6` hasil penyempurnaan | 44,22% | 43,46% | 44,04% |
| `2026-11-09-rule-based-7` hasil penyempurnaan | 43,74% | 42,94% | 43,56% |
| `2026-11-09-rule-based-8` hasil penyempurnaan | 43,29% | 42,31% | 43,11% |
| **`2026-11-09-rule-based-9` hasil penyempurnaan** | **42,34%** | **41,37%** | **42,07%** |

Hasil rule-based-9 saat ini adalah **16.123 edit / 38.326 kata referensi = 42,0680% WER test**, dengan 81 kalimat test yang cocok persis. Dibanding rule-based-2, WER test turun **11,7284 poin persentase**; dibanding baseline dengan koreksi tanda baca, penurunannya **16,0283 poin**. Pada seluruh split validation, WER turun menjadi **41,3702%**, yaitu **0,9410 poin** lebih baik daripada rule-based-8.

Rule-based-9 menambahkan dua pembacaan rangkaian vokal yang sebelumnya tidak dapat dihasilkan. Rangkaian `اء` sebelum konsonan menulis `/aa/` panjang (`kerajaan`, `berkenaan`), tetapi alif hanya dibaca satu `a` dan hamzah dibuang sehingga vokal kedua hilang; hamzah tinggi `ٴ` yang dipakai korpus sebagai pembawa tersebut dinormalkan menjadi `ء`. `ي` di akhir kata sesudah konsonan juga dapat menulis `/ia/` (`berusia`), memperluas pembacaan `ia` rule-based-8 di luar kasus sebelum konsonan. Rule-based-8 menutup celah pembangkitan kandidat dan memperlebar pencarian. `ي` di tengah kata sebelum konsonan hanya dapat dibaca `i`, `e`, atau `y`, sehingga kata ber-`/ia/` (`kejadian`, `ujian`, `perisian` — 5.806 kata referensi) tidak pernah dapat dihasilkan; pembacaan `ia` kini dibangkitkan tanpa biaya. Berkas pencarian juga diperlebar dari 250 menjadi 1.000 kandidat dan daftar pendek yang dinilai dari 40 menjadi 80, karena berkas lama memangkas pembacaan yang benar seperti `ditempatkan` sebelum dinilai. Rule-based-7 menambahkan **aturan bukti vokal akhir**: selepas huruf konsonan `ن ه ف س ر ل ڠ م` rujukan hampir selalu berakhir tanpa vokal (ن 92,5%, ه 97,1%, س 82,1%, م 75,1% daripada kasus sejajar), tidak seperti `د`/`ک` yang mengutamakan `a` dan `ي` yang mengutamakan `i`. Nilai `yaE=0,75`, `finalE=0,25`, dan `forwardWeight=0,5` juga disetel semula pada seluruh split train. Rule-based-6 menambahkan satu aturan umum lagi, dipilih pada split train lengkap dan diterima pada split validation lengkap: **pepet medial sebelum r** (ke-r-ana, me-r-eka, be-r-apa) tidak memiliki huruf vokal Jawi, dan sebelum r konteks itu paling dominan (2.941 kasus train, dibanding sekitar seribu yang tersebar pada konsonan lain). Rule-based-5 menambahkan dua aturan ejaan umum, keduanya diturunkan dari keteraturan terukur pada split train, bukan dari daftar kata:

- **`di` + sengau.** Tidak ada akar pasif Melayu yang dimulai dengan `ng`/`ny`, sehingga prioritas `di` rangkai kini mengecualikan `د` + `nga`/`nya`. Aturan ini memperbaiki kelas besar, misalnya `دڠن → dengan` (sebelumnya `dingan`, 1.993 kemunculan di train) dan `دڠر → dengar`.
- **Vokal awal tidak tertulis.** Jawi menulis `/a/` dengan alif tetapi membiarkan pepet tidak tertulis. Bila dua huruf pertama adalah konsonan dan kata memiliki tiga suku kata atau lebih, vokal awal sisipan adalah pepet pada 38.537 kasus train dibanding 3.365 untuk `/a/`. Aturan ini memulihkan `نݢري → negeri`, `نݢارا → negara`, `ڤلاجر → pelajar`. Kata dua suku kata memang campuran dan dibiarkan netral.

Tuner seluruh train kemudian menerima `yaE=0,5`, yaitu sedikit mengutamakan `e` daripada `i` untuk `ي`. Seluruh pemilihan memakai split train lengkap dan setiap perubahan yang diterima diperiksa ulang pada split validation lengkap; test hanya dipakai untuk tolok ukur perbandingan terakhir.

Beberapa hipotesis terukur ditolak, bukan dipaksakan: pemulihan vokal akhir yang banyak dihilangkan (`ايت → itu`, `کڤد → kepada`), biaya vokal akhir berdasarkan kelas konsonan, pembacaan geminat `C-e-C`, kecenderungan `/u/` pada suku kata tertutup, dan perumusan ulang konteks pepet dari sisi Jawi. Semuanya memperburuk kedua split atau netral; hal ini sendiri menunjukkan kelas tersebut memang ambigu secara ejaan. Tidak ada kamus, daftar pengecualian, atau tambalan per kata.

Rule-based-2 dibekukan sebelum evaluasi test pertamanya. Versi berikutnya adalah penyempurnaan train/validation, sehingga angka testnya merupakan **tolok ukur perbandingan, bukan klaim holdout yang masih murni**. Hasil ini adalah perbaikan lokal terverifikasi, bukan klaim minimum global. Baca [docs/EVALUATION.md](docs/EVALUATION.md) untuk jumlah dan protokol reproduksi.

## Privasi

Konversi berlangsung lokal di browser dan teks tidak diunggah. Evaluasi hanya membaca korpus yang secara eksplisit diberikan pengembang. `artifacts/`, `corpus/`, dan file Parquet diabaikan Git.

## Lisensi dan kontribusi

Proyek ini berlisensi [MIT](LICENSE). Issue, koreksi, dan pull request dipersilakan. Untuk perubahan aturan, sertakan kasus regresi deterministik atau jelaskan mengapa input ambigu, lalu jalankan pengujian luring dan WER train/validation. Jangan menambahkan kamus pengecualian.
