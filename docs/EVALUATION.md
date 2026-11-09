# Utusan evaluation protocol

## Dataset and separation

Target: `mahalisyarifuddin/utusan-jawi-sentences`.

The dataset card describes 19,842 aligned sentences from 2,069 articles, with `text` containing Jawi and `latin_text` containing Rumi. The official article-level splits are:

| Split | Sentences |
| --- | ---: |
| train | 15,881 |
| validation | 1,989 |
| test | 1,972 |

Use the official split files rather than reconstructing them from the combined JSONL. The card documents article-level stratified 8:1:1 splitting with seed 0. Corpus text is copyrighted and is not redistributed here. Follow the dataset card and source terms; error reports can contain corpus sentences and must remain outside Git.

The required separation is:

1. Change rules or select costs using **train** only.
2. Accept/reject a tuning pass using **validation**.
3. Freeze the engine and run **test** only for final evaluation.
4. If test results motivate another change, treat that as further development and obtain a genuinely untouched holdout before making a new generalization claim.

`tools/tune_rules.js` intentionally has no test-path option. Its JSON report records `testSplitUsed: false` and `globalOptimalityClaimed: false`.

## Metric

The evaluator computes standard word error rate (WER), aggregated over all selected sentences:

```
WER = (substitutions + deletions + insertions) / reference word count
```

This is corpus-level micro-WER, not the mean of per-sentence WER and not exact-match word accuracy. The report includes all edit counts, reference words, exact sentences, and sentence exact-match rate.

Normalization is deliberately limited and reproducible:

- Unicode NFC;
- remove invisible formatting controls and tatweel;
- fold Jawi high-hamza variants to `ء`, Arabic kaf `ك` to `ک`, dotted gaf `ڬ` to `ݢ`, and legacy peh `پ` to `ڽ`;
- collapse whitespace;
- case-fold Rumi, because the converter emits lowercase Rumi;
- tokenize on whitespace;
- preserve punctuation attached to tokens.

No spelling correction, stemming, punctuation stripping, or reference-guided candidate selection is performed. Changing any of these choices requires a new metric version and prevents direct comparison with this protocol.

## Commands

JSONL, JSON, CSV, and Parquet are supported. Parquet conversion uses `tools/parquet_to_jsonl.py` and requires `pyarrow`; all other formats need only Node.js.

```sh
python3 -m pip install --user pyarrow

node tests/evaluate_corpus.js \
  --corpus /data/utusan-jawi-sentences/test.parquet \
  --direction jl \
  --output artifacts/test-baseline.json

# Optional: sentence-level diagnostics. This file can contain copyrighted text.
node tests/evaluate_corpus.js \
  --corpus /data/utusan-jawi-sentences/test.parquet \
  --direction jl \
  --errors artifacts/test-errors.json
```

Use `--direction lj` for Rumi → Jawi. `--offset` and `--limit` select deterministic row ranges for debugging; a limited result must not be reported as a full-split score.

## Tuning

Fast developmental pass on evenly spaced samples:

```sh
node tools/tune_rules.js \
  --train /data/utusan-jawi-sentences/train.parquet \
  --validation /data/utusan-jawi-sentences/validation.parquet \
  --direction jl --passes 1
```

Full-split run that writes accepted parameters:

```sh
node tools/tune_rules.js \
  --train /data/utusan-jawi-sentences/train.parquet \
  --validation /data/utusan-jawi-sentences/validation.parquet \
  --direction jl --passes 3 \
  --train-limit 0 --validation-limit 0 \
  --write --report artifacts/tuning-full.json
```

The default samples are 200 train and 200 validation sentences, selected at evenly spaced positions without randomness. `0` selects the complete split. Jawi → Rumi tunes numeric finite-state costs; Rumi → Jawi tunes boolean forward-shape rules. Beam width and shortlist size are excluded because they are performance/search controls rather than linguistic costs.

Each coordinate is selected on train. A changed pass is retained only if validation WER improves; otherwise the pass is rolled back. `--write` additionally requires an overall validation improvement, no train-WER regression, and a passing offline regression suite. A failed suite restores the original inline engine.

Coordinate descent over a fixed parameterization is a local search. It cannot establish a global minimum over all possible algorithms, rule contexts, or cost functions. Repeatedly inspecting validation also adapts to that split, so final test must remain untouched until the configuration is frozen.

## Verified results

The official Parquet files were downloaded and validated locally: 15,881 train, 1,989 validation, and 1,972 test rows. Four coordinate passes were accepted using 200 evenly spaced sentences from each of train and validation. Every accepted pass was then verified on the full validation split. The fifth pass made no train improvement and was rejected. The engine was frozen as `2026-11-09-rule-based-2` before final test evaluation.

### Full-split Jawi → Rumi micro-WER

| Engine | Split | Sentences | Reference words | S | D | I | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pre-tuning, punctuation-corrected | validation | 1,989 | 38,153 | 20,700 | 1,085 | 18 | 21,803 | 57.1462% | 15 |
| Pre-tuning, punctuation-corrected | test | 1,972 | 38,326 | 21,117 | 1,123 | 26 | 22,266 | 58.0963% | 11 |
| **Tuned rule-based-2** | train | 15,881 | 306,693 | 154,522 | 8,960 | 144 | 163,626 | **53.3517%** | 514 |
| **Tuned rule-based-2** | validation | 1,989 | 38,153 | 18,975 | 1,085 | 18 | 20,078 | **52.6250%** | 89 |
| **Tuned rule-based-2** | test | 1,972 | 38,326 | 19,465 | 1,125 | 28 | 20,618 | **53.7964%** | 59 |

The tuned engine reduces full test WER by **4.3000 percentage points** (a 7.40% relative reduction) and increases exact test sentences from 11 to 59. Full validation WER falls by **4.5212 percentage points**. The pre-tuning baseline already includes deterministic Arabic-punctuation conversion, so this comparison isolates the accepted tuning passes rather than combining them with the earlier punctuation gain.

The aggregate metrics above contain no corpus sentences. Detailed JSON metrics and error reports remain in Git-ignored `artifacts/`; downloaded Parquet files remain in Git-ignored `corpus/`. Test was not used to select rules or parameters, and no subsequent tuning was performed after viewing test. These results establish a measured local optimum for the performed coordinate search, not a mathematical global minimum over an open-ended rule space.
