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
| **Tuned `2026-11-09-rule-based-2`** | **53.35%** | **52.62%** | **53.80%** |

The final test result is **20,618 edits / 38,326 reference words = 53.7964% WER**. Test WER fell by **4.30 percentage points**, and exact test sentences rose from 11 to 59. Four accepted coordinate passes used 200 evenly spaced train and validation sentences, with full-validation verification after each pass; a fifth pass found no improvement and was rejected. Test remained untouched until the engine was frozen. This is a verified local improvement, not a claim of a global minimum over all possible rules. See [docs/EVALUATION.md](docs/EVALUATION.md) for counts and the reproducibility protocol.

## Privacy

All conversion happens locally in the browser. Input text is not uploaded. Evaluation reads only the corpus path explicitly supplied by the developer. `artifacts/`, `corpus/`, and Parquet files are Git-ignored.

## License and contributions

The project is licensed under the [MIT License](LICENSE). Issues, corrections, and pull requests are welcome. For rule changes, include a deterministic regression case or document why the input is underdetermined, then run the offline suite and train/validation WER evaluation. Do not add exception dictionaries.
