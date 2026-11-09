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

At the end of this first cycle, test had not selected rules or parameters and no post-test tuning had been performed. The result established a measured local optimum for that coordinate search, not a mathematical global minimum over an open-ended rule space.

## Second-cycle rule refinement

A later development cycle analyzed recurring errors on train and refined general orthographic rules rather than adding lexical mappings:

- the explicit Pedoman §7.2 spelling of `dan`;
- pass-through for already-Latin tokens in mixed-script input;
- joined `di/ke/se` hamzah contexts and joined-`di` ranking;
- contextual waw/ya handling around those prefixes and before final `ه`;
- general `aya/ai`, forward-consistency, and prefix costs selected on train samples.

The retained configuration is `2026-11-09-rule-based-3`. One additional sampled coordinate pass proposed `pairAya=-0.125`; although both 200-sentence samples improved, full validation worsened by five edits, so that adjustment was rejected and `pairAya=-0.25` retained. The accepted `forwardWeight=0.25` adjustment and structural rules were checked on the full validation split.

| Engine | Split | Sentences | Reference words | S | D | I | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-3** | train | 15,881 | 306,693 | 140,851 | 8,963 | 147 | 149,961 | **48.8961%** | 601 |
| **Refined rule-based-3** | validation | 1,989 | 38,153 | 17,239 | 1,086 | 19 | 18,344 | **48.0801%** | 94 |
| **Refined rule-based-3** | test (comparative) | 1,972 | 38,326 | 17,677 | 1,126 | 29 | 18,832 | **49.1364%** | 66 |

Rule-based-3 reduces full validation WER by **4.5449 percentage points** over rule-based-2. Its comparative test WER is **4.6600 points** lower than rule-based-2 and **8.9599 points** lower than the punctuation-corrected baseline. Because test had already been inspected during the first cycle, the rule-based-3 test score is **not a pristine-holdout result** and must not be presented as one. Test did not select the second-cycle rules or costs, but a genuinely untouched holdout would be needed for a new generalization claim.

## Third-cycle full-train tuning

Rule-based-4 was selected without sampling. Each coordinate was evaluated on all 15,881 train sentences (306,693 reference words) and every accepted change was re-checked on all 1,989 validation sentences. A full-train Jawi → Rumi evaluation takes about 71 seconds, so a coordinate can sweep its whole candidate grid on train and validation while remaining practical.

The tuning infrastructure gained two changes: zero-valued costs now explore negative as well as positive values (a negative cost encodes a general preference, not only a penalty), and forward spellings computed while ranking inverse candidates are memoized in a bounded runtime cache. The cache stores generated strings only, ships no data, and changes no candidate or score.

| Change | Train effect | Full-validation effect | Decision |
| --- | --- | --- | --- |
| `finalA=-0.1` | 48.8961% → 48.8534% | 48.0801% → 47.9988% | Accepted |
| `complexOnset=0.5`, `complexCoda=0.5` | 48.8534% → 46.7992% | 47.9988% → 46.0803% | Accepted; each cost also improved both samples on its own, and full train preferred only a marginally larger onset cost |
| `complexOnset=0.625` | small gain | worse than 0.5 | Rejected by validation |
| `insertE=0` (was 0.25) | 46.7992% → 46.6346% | 46.0803% → 45.8942% | Accepted |
| `insertA=0`, `finalNone` removal | neutral | neutral | `insertA` retained at 0; unused `finalNone` parameter removed |
| `diPrefixBonus=2.25` | 46.6346% → 46.5958% (112 edits) | 45.8942% → 45.8260% (25 edits) | Rejected: offline suite failed (`دسيني` decoded as `dasini`) |

A blanket closed-syllable penalty was rejected outright: on 500-sentence samples it raised train WER from 49.36% to 62.51% and validation WER from 47.47% to 60.86%. Final-I/final-U costs, `wawO`, `initialO`, `forwardBonus`, `forwardWeight`, `prefixBonus`, and `pairAya` were screened and left unchanged because changes were neutral, non-monotone, or worse.

To keep the deterministic joined spelling while accepting the small global gain, `diPrefixBonus` was also split into a lower general cost plus an explicit bonus for the joined `د + consonant` context. That variant passed every regression but scored 45.8994% validation WER, two edits worse than rule-based-4, so it was discarded and the engine restored to `diPrefixBonus=3`.

| Engine | Split | Sentences | Reference words | S | D | I | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Full-train rule-based-4** | train | 15,881 | 306,693 | 133,913 | 8,964 | 148 | 143,025 | **46.6346%** | 664 |
| **Full-train rule-based-4** | validation | 1,989 | 38,153 | 16,405 | 1,086 | 19 | 17,510 | **45.8942%** | 102 |
| **Full-train rule-based-4** | test (comparative) | 1,972 | 38,326 | 16,856 | 1,126 | 29 | 18,011 | **46.9942%** | 65 |

Rule-based-4 lowers full validation WER by a further **2.1859 percentage points** over rule-based-3 and raises exact validation sentences from 94 to 102. Its comparative test WER is **2.1422 points** lower than rule-based-3. The reverse direction is unchanged by these inverse costs: full validation Rumi → Jawi remains **34.9822%** (13,097 edits / 37,439 words, 40 exact sentences). Because test was inspected in the first cycle, this remains a comparative benchmark rather than a pristine-holdout claim.

The aggregate metrics contain no corpus sentences. Detailed JSON metrics and error reports remain in Git-ignored `artifacts/`; downloaded Parquet files remain in Git-ignored `corpus/`.
