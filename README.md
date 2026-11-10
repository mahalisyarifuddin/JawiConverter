[**Bahasa Indonesia**](README-id.md) | **English**

# JawiConverter
*Rumi ↔ Jawi, lebih sederhana.*

JawiConverter is a single-file, browser-based Malay Rumi (Latin) ↔ Jawi converter. The redesigned engine is **purely algorithmic and rule-based**: it contains no word inventory, reverse lookup table, or exception-to-the-rule dictionary.

## Quick start

1. Download `JawiConverter.html`.
2. Open it in a modern browser. No installation, server, network request, or external script is required.
3. Choose **Rumi → Jawi** or **Jawi → Rumi**.
4. Type, paste, or upload a `.txt` file. Copy the result or use **Swap** to change direction.

The interface supports Bahasa Melayu and English, live conversion, light/dark themes, and desktop/mobile layouts.

## How conversion works

- **Rumi → Jawi** uses maximal-onset syllabification, Malay consonant digraphs, contextual alif and vowel rules, productive affixes and clitics, reduplication, initialisms, and final kaf/qaf handling.
- **Jawi → Rumi** uses a deterministic finite-state search to restore omitted vowels. Phonotactic costs and forward-conversion consistency rank only complete candidates. It does not consult a lexicon.
- Type **é** to force taling and **ě** or **ê** to force pepet. Mark both vowels when both need specifying: `sétém → سيتيم`; `sětěm/sêtêm → ستم`.
- Jawi input is normalized to NFC. High hamza `ٴ`, Arabic kaf `ك`, dotted gaf `ڬ`, and legacy peh `پ` are accepted as input aliases.

Unmarked Rumi and defective Jawi are inherently ambiguous. Arabic source letters such as `ع`, `ء`, `ى`, and `ة`, some pepet/taling homographs, historical compound boundaries, and acronym pronunciation cannot always be recovered from the surface string alone. The converter uses general rules rather than hiding whole-word answers in a table. See [the Pedoman audit](docs/PEDOMAN_AUDIT.md).

## Tests

```sh
node tests/run_tests.js
```

The offline suite uses only Node.js built-ins and checks:

- 178 deterministic Pedoman forms and safe handling of 58 explicitly labeled underdetermined audit examples;
- productive suffixes, final qaf before suffixes, affix boundaries, markers, reduplication, and Unicode aliases;
- complete inverse-decoder states and browser/Node API compatibility;
- all 48 tests displayed in the standalone HTML;
- WER arithmetic, corpus parsing, and tuner test-split isolation.

`JawiConverter.html` remains the sole production engine source. `tools/app_engine.js` extracts its marked inline script into a disposable temporary directory for Node tests; no duplicate engine JavaScript is shipped.

## Utusan sentence WER

The evaluation tooling targets [`mahalisyarifuddin/utusan-jawi-sentences`](https://huggingface.co/datasets/mahalisyarifuddin/utusan-jawi-sentences), whose aligned fields are `text` (Jawi) and `latin_text` (Rumi). Corpus text is **not included** in this repository. Respect the dataset card and Utusan copyright/terms; do not commit downloaded corpora or sentence-error reports.

Evaluate the official test Parquet file (Parquet support requires Python and `pyarrow`):

```sh
python3 -m pip install --user pyarrow
node tests/evaluate_corpus.js \
  --corpus /path/to/utusan/test.parquet \
  --direction jl \
  --output artifacts/test-metrics.json
```

Tune only on train, accept a pass only when validation improves, and evaluate test afterward:

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

`--train-limit 0 --validation-limit 0` means both full splits. Lower limits are useful for development. JSONL, JSON, and CSV inputs are also supported. The tuner has no test-split option and writes parameters only after validation improves and all offline regressions pass.

**Measured Jawi → Rumi results** on the complete official splits:

| Engine | Train WER | Validation WER | Test WER |
| --- | ---: | ---: | ---: |
| Pre-tuning, punctuation-corrected | — | 57.15% | 58.10% |
| Tuned `2026-11-09-rule-based-2` | 53.35% | 52.62% | 53.80% |
| Refined `2026-11-09-rule-based-3` | 48.90% | 48.08% | 49.14% |
| Full-train tuned `2026-11-09-rule-based-4` | 46.63% | 45.89% | 46.99% |
| Refined `2026-11-09-rule-based-5` | 44.51% | 43.66% | 44.43% |
| Refined `2026-11-09-rule-based-6` | 44.22% | 43.46% | 44.04% |
| Refined `2026-11-09-rule-based-7` | 43.74% | 42.94% | 43.56% |
| Refined `2026-11-09-rule-based-8` | 43.29% | 42.31% | 43.11% |
| Refined `2026-11-09-rule-based-9` | 42.34% | 41.37% | 42.07% |
| Refined `2026-11-09-rule-based-10` | 41.56% | 40.59% | 41.42% |
| **Refined `2026-11-09-rule-based-11`** | **41.54%** | **40.57%** | **41.39%** |
| + 70-word dictionary (Pareto knee) | 33.69% | 32.84% | — |
| + full 21,271-word dictionary | 7.97%* | **7.97%** | 8.12% |
| Shipped: 500-word dictionary (v1 pairing) | 27.62% | 26.59% | 27.50% |
| v2: corrected word pairing + 500 entries | 20.23% | 19.79% | 20.95% |
| **v3: ke- splitting + 500 entries** | **20.10%** | **19.70%** | 20.78% |

The current rule-based-11 result is **15,862 edits / 38,326 reference words = 41.3870% test WER**, with 81 exact test sentences. Relative to rule-based-2, this is a **12.4094-point** test reduction; relative to the punctuation-corrected baseline, it is **16.7093 points**. On the full validation split WER falls to **40.5656%**, a further **0.0210 points** over rule-based-10.

Rule-based-11 lowers the cost of an inserted `i`, the last unsaturated coordinate: `dari` was read `diri` and `seperti` `separti` wherever an `i`-insertion competed with an `a`. Rule-based-10 fixes an affix-scoring bug and adds a schwa rule. The `di` prefix bonus was awarded to the bare token `di` itself, so standalone `دي` decoded as the preposition rather than the pronoun `dia` (278 corpus occurrences versus none) and every surrounding word shifted by one, producing 4,251 spurious deletions; a prefix now requires a root. A schwa between two consonants before a final syllable is charged, recovering the corpus's reduced `/a/` in `mereka`, `kerana` and `lumpur`. Rule-based-9 adds two vowel-sequence readings the candidate generator could not express. The sequence `اء` before a consonant spells the long `/aa/` (`kerajaan`, `berkenaan`), but the alif read a single `a` and the hamzah was dropped, losing the second vowel; the high hamza `ٴ` the corpus uses as that carrier is normalised to `ء`. Word-final `ي` after a consonant can also spell `/ia/` (`berusia`), extending rule-based-8's `ia` reading beyond the before-consonant case. Rule-based-8 closes a candidate-generation gap and widens the search. Mid-word `ي` before a consonant could only be read `i`, `e` or `y`, so words with `/ia/` (`kejadian`, `ujian`, `perisian` — 5,806 reference words) could never be produced at all; the `ia` reading is now generated at zero cost. The beam was also widened from 250 to 1,000 candidates and the scored shortlist from 40 to 80, because the old beam pruned correct readings such as `ditempatkan` before they were scored. Rule-based-7 added a **final-vowel evidence rule**: after the consonant letters `ن ه ف س ر ل ڠ م` the reference almost always ends without a vowel (ن 92.5%, ه 97.1%, س 82.1%, م 75.1% of aligned cases), unlike `د`/`ک` which prefer `a` and `ي` which prefers `i`. It also retunes `yaE=0.75`, `finalE=0.25` and `forwardWeight=0.5` on the full train split. Rule-based-6 added one further general rule, selected on the complete train split and accepted on the complete validation split: a **medial schwa before r** (ke-r-ana, me-r-eka, be-r-apa) has no Jawi vowel letter, and before r it is by far the most frequent such context (2,941 train cases, versus roughly a thousand spread across every other consonant). Rule-based-5 added two general orthographic rules, both derived from measured train-split regularities rather than word lists:

- **`di` + nasal.** No Malay passive root begins with `ng`/`ny`, so the joined-`di` priority now excludes `د` + `nga`/`nya`. This alone fixed a large class, for example `دڠن → dengan` (previously `dingan`, 1,993 train occurrences) and `دڠر → dengar`.
- **Unwritten initial vowel.** Jawi writes `/a/` with alif but leaves schwa unwritten. When the first two letters are consonants and the word has three or more syllables, an inserted initial vowel is schwa in 38,537 train cases versus 3,365 for `/a/`. This restores `نݢري → negeri`, `نݢارا → negara`, `ڤلاجر → pelajar`. Two-syllable words are genuinely mixed and are left neutral.

The full-train tuner then accepted `yaE=0.5`, slightly preferring `e` over `i` for `ي`. All selection used the complete train split and every accepted change was re-checked on the complete validation split; test was used only for the final comparative benchmark.

Several measured hypotheses were rejected rather than fitted: honouring the many omitted final vowels (`ايت → itu`, `کڤد → kepada`), a consonant-class final-vowel cost, geminate `C-e-C` readings, a closed-syllable `/u/` preference, and Jawi-side reformulations of the schwa context. Each either regressed both splits or was neutral, which is itself evidence that those classes are genuinely underdetermined from the orthography alone. No dictionaries, exception lists, or per-word patches are used.

Rule-based-2 was frozen before its first test evaluation. Later versions are train/validation refinements, so their test numbers are **comparative benchmarks, not pristine-holdout claims**. These are verified local improvements, not a claim of a global minimum. See [docs/EVALUATION.md](docs/EVALUATION.md) for counts and the reproducibility protocol.

## Privacy

All conversion happens locally in the browser. Input text is not uploaded. Evaluation reads only the corpus path explicitly supplied by the developer. `artifacts/`, `corpus/`, and Parquet files are Git-ignored.

## License and contributions

The project is licensed under the [MIT License](LICENSE). Issues, corrections, and pull requests are welcome. For rule changes, include a deterministic regression case or document why the input is underdetermined, then run the offline suite and train/validation WER evaluation. Do not add exception dictionaries.
