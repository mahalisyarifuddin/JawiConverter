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

## Corpus availability and protocol when it is absent

The corpus is external, Git-ignored, and downloaded from the dataset host. When that host is unreachable (for example in a restricted sandbox), **do not** substitute ad-hoc or invented data and do not report any WER figure for the Utusan splits. In that situation the verified-in-repo `tools/prpm_cache.json` word pairs on `main` may be used only as a development benchmark with the status "unverified against the official splits".

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

Fetch the official splits into the Git-ignored `corpus/` directory. The host is
configurable for a mirror or an offline copy:

```sh
tools/fetch_corpus.sh corpus
UTUSAN_BASE_URL=https://mirror.example/dataset tools/fetch_corpus.sh corpus
```

If the host is unreachable, stop there: do not substitute synthetic or partial
data, and do not publish WER numbers for these splits.

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

## Fourth-cycle orthographic refinement

Rule-based-5 came from error analysis of the complete train split, looking for regularities that generalise rather than for individual words. Every measurement below used train only, and every accepted change was re-checked on the complete validation split.

| Measurement (train) | Result | Rule |
| --- | --- | --- |
| `دڠن` decoded as `dingan` | 1,993 occurrences | joined `di-` priority excluded before `ng`/`ny`, since no Malay passive root starts with a nasal |
| Initial vowel unwritten, 3+ syllables | schwa 38,537 vs `/a/` 3,365 vs others 5,894 | inserted initial vowel read as `e` under that context |
| Initial vowel unwritten, 2 syllables | schwa 6,986 vs `/a/` 5,595 | left neutral: genuinely mixed |
| Final-vowel omission (5,032 tokens) | `d` 67.8%, `n` 43.7%, `t` 36.8%, `m` 10%, other ≤1% | no rule retained; class costs regressed both splits |

| Change | Full train | Full validation | Decision |
| --- | --- | --- | --- |
| `di` + nasal exclusion | 47.365% → 46.742% (sample screen) | 45.171% → 44.385% (sample screen) | Accepted, then confirmed by the full-split runs below |
| Initial-schwa rule (`initialE=0.25`), on top of the `di` + nasal exclusion | 46.7992% → 44.5999% | 46.0803% → 43.7423% | Accepted |
| `yaE=0.5` | 44.5999% → 44.5142% | 43.7423% → 43.6558% | Accepted by full-train tuner with validation gate |

The `initialE` sweep on the full splits is flat above 0.25 (136,785 edits from 0.25 through 1.5, versus 140,962 at 0), so the smallest sufficient value is retained rather than a fitted maximum. The tuner's own coordinate proposal reported no objective change at that point, which is consistent with the plateau.

Rejected on sample screens (each held 500 evenly spaced train and validation sentences): honouring elided final vowels as forward-consistent matches (`ايت → itu`, `کڤد → kepada`) made consonant-final words expand freely (`دالم → dalama`); consonant-class final-vowel costs, geminate `C-e-C` readings, closed-syllable `/u/` preference, and Jawi-side reformulations of the schwa context all regressed both splits. These negative results are recorded because they show the affected classes are underdetermined by the orthography rather than badly ranked.

| Engine | Split | Sentences | Reference words | S | D | I | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-5** | train | 15,881 | 306,693 | 127,408 | 8,965 | 149 | 136,522 | **44.5142%** | 672 |
| **Refined rule-based-5** | validation | 1,989 | 38,153 | 15,551 | 1,086 | 19 | 16,656 | **43.6558%** | 97 |
| **Refined rule-based-5** | test (comparative) | 1,972 | 38,326 | 15,875 | 1,126 | 29 | 17,030 | **44.4346%** | 69 |

Rule-based-5 lowers full validation WER by **2.2384 points** over rule-based-4 and its comparative test WER by **2.5596 points**. Full validation Rumi → Jawi is unchanged at **34.9822%** (13,097 edits / 37,439 words, 40 exact sentences), because the changed rules act only in the inverse direction. Test was not used for any selection; it remains a comparative benchmark because it was inspected in the first cycle.

## Fifth-cycle: medial schwa and alignment quality

Rule-based-6 came from a corrected error analysis. Sentence word counts agree in only 55.9% of train rows, so naively pairing words by position invents substitutions. Analysis now uses a word-level edit alignment, and claims are checked against the engine directly before a rule is proposed.

| Measurement (train) | Result | Rule |
| --- | --- | --- |
| Rumi open /e/ after a stop, vowel letter unwritten | 35,387 cases | governs the medial-schwa context |
| ... of those, followed by `r` | 2,941 (largest single consonant) | prefer a medial schwa before `r` |
| Final vowel omitted by Jawi vs spuriously added (aligned) | 9,151 vs 3,294 | context examined but no rule retained |
| Words gaining a syllable (`majlis→mejelis`) | 7,742 | penalties tried at several scopes; all regressed |

| Change | Full train | Full validation | Decision |
| --- | --- | --- | --- |
| `medialER=0.1` | 44.5142% → 44.2201% | 43.6558% → 43.4619% | Accepted |
| `medialER=0.05` (tuner proposal) | 44.2195% (1 fewer edit) | 43.4724% (4 more edits) | Rejected by the validation gate |

A direct sweep on the full splits around the boundary (0, 0.025, 0.05, 0.075, 0.1, 0.15) confirmed 0.1 as the validation optimum; 0.05 and 0.075 tie on train at 135,618 edits while 0.1 gives 135,620, so the trade is a single train edit against four validation edits.

Rejected after measurement, each on 500 evenly spaced train and validation sentences:

- penalising a contiguous-cluster consonant reading, at three scopes: too broad, it also penalises correct `meN-`/`peN-` words;
- `C-e-CC` schwa-in-cluster cost (`majlis`, `lumpur`): that shape is far more often correct than wrong;
- penalising the bare form of short consonant-final tokens: most such tokens really are bare (`terhadap`, `sistem`);
- raising the final-vowel cost floor or penalising joined `di` above 0.5: both regressed;
- a medial-schwa cost restricted to non-`r` contexts, and closed-syllable vowel quality.

The `itu`/`ini`/`pada` class remains: the correct form always carries a forward edit distance of 1 while the bare form is exact, so `forwardBonus` outweighs any affordable final-vowel cost. Both directions were tested and both regress, which is direct evidence that the class is underdetermined by the orthography rather than badly ranked.

| Engine | Split | Sentences | Reference words | S | D | I | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-6** | train | 15,881 | 306,693 | 126,506 | 8,965 | 149 | 135,620 | **44.2201%** | 670 |
| **Refined rule-based-6** | validation | 1,989 | 38,153 | 15,477 | 1,086 | 19 | 16,582 | **43.4619%** | 97 |
| **Refined rule-based-6** | test (comparative) | 1,972 | 38,326 | 16,726 | 1,126 | 28 | 16,880 | **44.0406%** | 68 |

Rule-based-6 lowers full validation WER by **0.1939 points** and comparative test WER by **0.3939 points** over rule-based-5. Test was not used for any selection and remains a comparative benchmark because it was inspected in the first cycle.

## Sixth-cycle: final-vowel evidence and cost retuning

Rule-based-7 was selected on the complete train split with the complete validation split as the acceptance gate, after the corpus was restored through the repository's Git-blob transport (the dataset host itself is blocked from this sandbox).

| Measurement (train, word-aligned) | Result | Rule |
| --- | --- | --- |
| Reference ending after bare ن | no vowel 92.5% (27,641 cases) | prefer the bare consonant |
| ... ه / س / م | 97.1% / 82.1% / 75.1% | same |
| ... د / ک | prefer `a` (65.3% / 62.1%) | excluded from the rule |
| ... ي | prefers `i` (79.5%) | excluded from the rule |
| د + consonant contexts | joined passive 3,801 vs bare 402 | no new rule; the existing bonus is already optimal (raising it changes 1 validation edit) |

| Change | Full train | Full validation | Decision |
| --- | --- | --- | --- |
| `yaE` 0.5 → 0.75, `finalE` 0 → 0.25, `forwardWeight` 0.25 → 0.5 | 44.2201% → 44.1484% | 43.4619% → 43.3754% | Accepted (pass 1) |
| `noFinalVowel=0.625` | 44.1484% → 43.7398% | 43.3754% → 42.9403% | Accepted |
| Second coordinate pass | — | worse | Rejected by validation |

Rejected after measurement on 500 evenly spaced train and validation sentences:

- treating a final vowel as orthographically optional and letting per-vowel costs decide: 44.00% → 45.99% (train) and 42.08% → 44.05% (validation);
- an initial-`ي`-as-`e` preference (4,270 vs 185 aligned cases): neutral at low values, regressive above 1;
- `ي` between consonants as a schwa carrier: neutral, then regressive;
- prefix and `di` bonus retuning, intervocalic `w`, and initial-`او` as `/o/`: flat or worse.

The `itu`/`ini`/`pada` class (about 7,400 occurrences) is now explained precisely: `wordToJawi('itu')` returns `ايتو`, so the correct reading is always one forward edit from the input while the bare form is exact. Closing that gap requires a forward-spelling decision about final `و`/`ي`, and every attempt to compensate on the inverse side regressed both splits.

Residual classes such as `mereka → merika` are forward limits, not ranking bugs: `wordToJawi('mereka')` returns `مرکا`, two edits from `مريک`, so the correct candidate cannot win at any affordable cost.

| Engine | Split | Sentences | Reference words | S | D | I | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-7** | train | 15,881 | 306,693 | 126,196 | 8,965 | 149 | 135,310 | **43.7398%** | 676 |
| **Refined rule-based-7** | validation | 1,989 | 38,153 | 15,339 | 1,086 | 19 | 16,444 | **42.9403%** | 99 |
| **Refined rule-based-7** | test (comparative) | 1,972 | 38,326 | 16,542 | 1,126 | 28 | 16,696 | **43.5631%** | 68 |

Rule-based-7 lowers full validation WER by **0.5216 points** and comparative test WER by **0.4775 points** over rule-based-6, and raises exact validation sentences from 97 to 99. Test was not used for any selection.

## Seventh-cycle exploration: the remaining ceiling

After rule-based-7 a systematic search for further inverse cost changes found none. The full 25-parameter grid was re-swept on 500-sentence samples and **every coordinate was neutral or worse**. The grid included `yaE`, `wawO`, `wawW`, `initialO`, all five `final*` costs, all five `insert*` costs, `initialE`, `medialER`, `noFinalVowel`, `prefixBonus`, `forwardBonus`, `forwardWeight`, `pairAya`, `pairAwa`, `complexOnset`, `complexCoda`, `yaY`, and `invalidCluster`.

Several structural hypotheses were measured and rejected on both splits:

| Hypothesis | Evidence | Result |
| --- | --- | --- |
| Open-syllable vowel quality costs | final open syllables are u 11.1%, o 0.7%, e 2.3% | neutral below 0.5, then sharply worse |
| Closed final syllable `/a/` preference | closed final syllables are a 67.2% | worse from the smallest value tested |
| Score appended final vowels separately | appended candidates currently outrank correct bare forms (`majlis`, `langsung`) | worse at every value |
| Prefer shorter readings on exact ties | exact ties occur in **42.2% of tokens** | already optimal; a vowel-count tie-break was worse (44.00% → 44.74%) |
| Final-vowel elision as forward-consistent | `itu`/`ini`/`pada` ≈ 7,400 cases | 44.00% → 45.99% (train), 42.08% → 44.05% (validation) |
| Initial `ي` as `/e/`, `ي` between consonants as schwa carrier | 4,270 vs 185 aligned cases for the first | neutral then worse; worse |

Two findings explain the ceiling:

1. **Exact ties are pervasive.** On a 500-sentence train sample, 3,979 of 9,430 tokens (42.2%) have at least two candidates with identical scores at the top. The current shortest-form tie-break recovers the reference in 17,517 cases and misses 5,498, so it is already better than any alternative tested.
2. **The corpus writes final vowels.** Measured on positionally aligned rows: final `/i/` is written with a vowel letter 80.2% of the time, `/u/` 62.1%, `/a/` 48.6%. The forward spelling `itu → ايتو` is therefore majority-correct, and the `itu => it` errors are the irreducible minority, not a bug. Changing it would require accepting a 20–50% loss on the majority class.

The residual load is long-tail: the same Jawi token is overwhelmingly one reading (`ايت` is `itu` 1,305 times with 4 other readings across 15,881 sentences). Closing it needs a language model or lexicon, both of which are outside this rule-only design.

## Eighth-cycle: generation gaps and search width

The seventh cycle concluded that the cost surface was saturated. That was right about *costs* but wrong about the engine: two defects were not in the cost model at all.

**A missing candidate transition.** Mid-word `ي` could only be read `i`, `e` or `y`, so `/ia/` words (`kejadian`, `ujian`, `perisian`) were never generated — 5,806 reference words, 1.9% of the corpus. `kejadian` was not merely mis-scored, it was absent from the candidate set.

**Beam pruning before scoring.** The search keeps the best 1,000 states and then scores only the best 40 completed candidates. Measured on a sample, widening the beam from 250 to 1,000 and the shortlist from 40 to 80 improved both splits:

| beam / shortlist | train WER (sample) | validation WER (sample) |
| --- | --- | --- |
| 250 / 40 | 43.795% | 41.644% |
| 500 / 40 | 43.733% | 41.582% |
| 500 / 80 | 43.557% | 41.417% |
| 1,000 / 80 | 43.484% | 41.375% |
| 2,000 / 80 | 43.422% | 41.375% (no further gain) |

`iaCost=0` was retained: the full-train tuner found no better value, and a non-zero cost regressed both splits on samples.

A scan for other unproducible targets found that 62.1% of distinct Jawi tokens have no candidate equal to the reference. Most are unreachable for a different reason — they are fragmented or misaligned corpus rows, not missing transitions — but the `ia` class was a genuine engine gap. `aa`, `ua`, `au`, `io` and the remaining diphthongs are producible through existing `alif`/`waw` transitions; they are under-ranked rather than absent, and every cost tested for them regressed.

Search cost is the trade: a 200-sentence slice now takes about 8 seconds. Per-word results are memoised, and the reverse direction is unchanged, so only the first pass over new Jawi text pays the wider beam.

| Engine | Split | Sentences | Reference words | S | D | I | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-8** | train | 15,881 | 306,693 | 124,873 | 8,965 | 149 | 133,987 | **43.2882%** | 675 |
| **Refined rule-based-8** | validation | 1,989 | 38,153 | 15,120 | 1,086 | 19 | 16,225 | **42.3112%** | 99 |
| **Refined rule-based-8** | test (comparative) | 1,972 | 38,326 | 16,368 | 1,126 | 28 | 16,522 | **43.1091%** | 68 |

Rule-based-8 lowers full validation WER by **0.6291 points** and comparative test WER by **0.4540 points** over rule-based-7. Test was not used for any selection.

## Ninth-cycle: an oracle decomposition, then the sequences it exposed

The eighth cycle left the engine's remaining error undivided: WER say nothing about whether the right reading was *ranked* badly or never *generated*. Decomposing each aligned token by how far the reference sits from the nearest candidate separates the two ceilings:

| Bucket | Share of aligned train tokens | Meaning |
| --- | ---: | --- |
| Perfect | 54.42% | the reference was chosen |
| Rank gap | 24.86% | the reference was generated but scored worse |
| Generation gap, distance 1 | 11.12% | one edit from every candidate |
| Generation gap, distance > 1 | 9.60% | fragmented rows, abbreviations |

The rank gap is the known ceiling and needs a language model. The generation gap is a rules problem, and sorting it by how often a word appears named the target: `kerajaan` (219) was the single largest gap. Its corpus spelling is `کراجاٴن`, using the high hamza `ٴ` as a vowel carrier; the engine passed that character through literally, producing `kerajaٴn`. Normalising `ٴ` to `ء` exposed the deeper fault: `ا` + `ء` before a consonant reads as one `a` with the hamzah dropped, so `kerajaan`'s second vowel could never be written. The same sequence explains `berkenaan` (185) and the general `aa` class.

Two transitions were added, both at measured cost rather than guessed:

| Change | Effect on samples (train / validation) |
| --- | --- |
| `اء` before a consonant can read `/aa/` (`aaCost` 0.25) | 42.467% / 40.527% → 42.436% / 40.465% |
| Word-final `ي` after a consonant can read `/ia/` | neutral, but `berusia` becomes producible |

The `ia` extension was kept despite a neutral sample score because it closes a generation gap without costing anything, and generation gaps are the bucket this cycle is reducing. After both changes the decomposition moves: perfect 54.42% → 55.40%, generation-gap-1 11.12% → 10.28%.

**A rejected hypothesis, recorded for the same reason.** `دي → dia` looks like it completes the word-final `ia` class, but it does not: `dia` is already generated and scores −3.00, losing to `di` by two points. The rank gap is reward-shaped, not generation-shaped, and no `ia` reading fixes it.

| Engine | Split | Sentences | Reference words | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-9** | train | 15,881 | 306,693 | 129,856 | **42.3407%** | 690 |
| **Refined rule-based-9** | validation | 1,989 | 38,153 | 15,784 | **41.3702%** | 103 |
| **Refined rule-based-9** | test (comparative) | 1,972 | 38,326 | 16,123 | **42.0680%** | 81 |

Rule-based-9 lowers full validation WER by **0.9410 points** and comparative test WER by **1.0411 points** over rule-based-8. Test was not used for any selection.

## Tenth-cycle: alignment-based error extraction

Earlier cycles ranked errors by pairing words positionally inside same-length sentences. That pairing is not the alignment the evaluator uses, and it fabricated cases such as `bandaraya -> dan` that no decoder ever produced. Re-extracting the substitution pairs through the evaluator's own sentence-level alignment changed the priorities completely: the largest single error was not a vowel at all.

| Reference → hypothesis | Count | Cause |
| --- | ---: | --- |
| `di` → (deleted) | 4,251 | standalone `دي` decoded as the preposition |
| `itu` → `it` | 2,467 | known minority final-vowel spelling |
| `ini` → `in` | 1,854 | same |
| `pada` → `pad` | 1,759 | same |
| `mereka` → `merika` | 899 | schwa read as full `/e/` |
| `mangsa` → `mengesa` | 496 | intrusive schwa |

**The affix bug.** The `di` prefix bonus was awarded by `/^di/`, which matches the bare token `di`. `phonotacticCost('di')` returned −3.00, so standalone `دي` lost to the preposition reading. In the corpus `دي` is `dia` 278 times and `di` zero times. A prefix now requires a root (`text.length > 2`), for both `di-` and the general prefix set. This single fix removed the 4,251-deletion term and the knock-on word shifts around it.

**The schwa rule.** The corpus writes a reduced `/a/` where the engine emitted full `/e/`: `مريک` is `mereka`, `لومڤور` is `lumpur`. Charging an `e` between two consonants before a final syllable recovers these. Tuning on samples:

| `epentheticE` | train WER (sample) | validation WER (sample) |
| --- | ---: | ---: |
| 0 | 42.291% | 40.383% |
| 0.10 | 42.166% | 40.321% |
| **0.25** | **41.554%** | **39.752%** |
| 0.40 | 41.554% | 39.762% |
| 0.60 | 41.710% | 39.948% |

Restricting the rule to non-initial syllables was neutral; a three-consonant minimum was identical to the unrestricted form.

**A methodology note for future cycles.** Two screens in this round were silently no-ops because the patch anchor text did not match the file (the suffix bonus is `-= 0.1`, not `-= 0.5`). A variant that scores *exactly* the baseline at every parameter value is a patching failure, not a neutral result. Every patch now asserts its anchor is present.

| Engine | Split | Sentences | Reference words | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-10** | train | 15,881 | 306,693 | 127,466 | **41.5614%** | 699 |
| **Refined rule-based-10** | validation | 1,989 | 38,153 | 15,485 | **40.5866%** | 109 |
| **Refined rule-based-10** | test (comparative) | 1,972 | 38,326 | 15,876 | **41.4236%** | 81 |

Rule-based-10 lowers full validation WER by **0.7836 points** and comparative test WER by **0.6444 points** over rule-based-9. Test was not used for any selection.

## Eleventh-cycle: the cost surface, re-swept honestly

Re-extracting the alignment pairs after rule-based-10 put `dari -> diri` (893), `oleh -> ulih` (887), `orang -> urang` (643), `polis -> pulis` (686) and `boleh -> bulih` (412) near the top. All of these are generated with the correct reading present, so all are rank-gap cases, and the question was which fixed cost was binding. Only one was.

| Change | Effect on samples (train / validation) | Verdict |
| --- | --- | ---: |
| `insertI` 2.2 → 0.1 | 41.554% / 39.752% → 41.492% / 39.731% | accepted |
| `wawO` 0 → 1 (full sweep) | flat within ±0.002 points | no effect |
| prefix root minimum `>2` → `>3` | 41.554% → 41.637% | rejected |
| `ي` before final `ه` forced to `e` | 41.554% → 42.104% | rejected |
| `insertA` below 0 | sharply worse (43.9%+) | rejected |

**Why `oleh` cannot be fixed.** `اوليه` generates `ulih`, `olih`, `oleh` and `uleh`. The corpus wants `oleh` (887 tokens) but also keeps `dari` as `diri` (893) with the same low `i` cost, and `اوليه`'s unconditional `e` rule costs more than it gains. The `و` sweep being *exactly* flat is diagnostic: `u`, `o` and `w` are all generated, so the reading is already free to change and changing its price does not move it.

**Two silent-failure traps, both caught.** The first `medialWawO` screen used the wrong index (`i === 2`; the `و` is at index 1) and the rule never fired — a fresh instance of the failure recorded last cycle. The second used the wrong anchor text. The rule now applied into the file before use and the *generated candidate list* is asserted, not only WER: `inverseCandidates('اوليه')` must contain `oleh`.

**A boundary honestly checked.** `ket` receives the `se`/`ke` prefix bonus with a one-letter root, which looked like last cycle's bug one character over. Raising the minimum to `>3` regressed both splits (41.554% → 41.637%), so the boundary is corpus-backed and was left alone.

| Engine | Split | Sentences | Reference words | Total edits | WER | Exact sentences |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| **Refined rule-based-11** | train | 15,881 | 306,693 | 127,394 | **41.5380%** | 699 |
| **Refined rule-based-11** | validation | 1,989 | 38,153 | 15,477 | **40.5656%** | 109 |
| **Refined rule-based-11** | test (comparative) | 1,972 | 38,326 | 15,862 | **41.3870%** | 81 |

Rule-based-11 lowers full validation WER by **0.0210 points** and comparative test WER by **0.0366 points** over rule-based-10. This is a small gain and marks the cost surface as saturated a second time; further progress needs the rank-gap problem, not another cost. Test was not used for any selection.

## Twelfth-cycle: the majority oracle and four rejected rules

Four structural hypotheses were measured this round. None was accepted, and the tree is unchanged from rule-based-11.

| Hypothesis | Measurement | Verdict |
| --- | --- | --- |
| Gate `diPrefixBonus` on a joined `di-` prefix | `daripada -> dirpad` survives with the bonus at 0; gating gives 42.415% / 40.734% | rejected |
| A prefix must not launder an illegal root onset | `rootCluster` 0.5 → 43.495% / 41.272% | rejected |
| Medial schwa writes a `ي` carrier in the forward direction | 56.9% "carrier written" statistic is confounded; emitting one gives 45.9%–52.0% forward | rejected |
| `muhammad -> mahmad` (1,066) is rule-reachable | not producible at all | out of scope |

**Why the `dirpad` lead did not convert.** `phonotacticCost('dirpad')` is −3.00 while `phonotacticCost('rpad')` is +3.50: prefixing `di-` erases the illegal-onset penalty, which looked like a clean bug. But removing or gating the bonus does not change the `daripada` output, and penalising the root's cluster regresses both splits by ~2 points. The corpus itself contains many `dirpad`-shaped readings, so the penalty removes correct readings faster than it removes wrong ones. The intuition was reasonable and the data refused it.

**The forward-direction correction.** `wordToJawi('mereka')` returns `مرکا`, dropping the schwa, while the corpus writes `مريک`. Emitting a carrier for medial schwa looked like a fix, and the supporting statistic — 56.9% of medial-schwa words contain a mid-word `ي`/`و`/`ى` — was computed by counting any vowel letter in the middle of the word. That count cannot separate a schwa carrier from the consonant's own vowel in the *next* syllable, so it overstates the case. Implemented honestly, the change costs 4 to 11 points forward. The statistic was withdrawn, not the rule rescued.

**A ceiling, now measured.** Building a token→reading table from the train split and always choosing each Jawi token's most frequent reading reaches **96.03%** word accuracy on positionally aligned train tokens, against the engine's **56.33%**. This is not a target the rule-based design can approach without memorising the corpus, and it is reported here only to make the size of the gap explicit. The 24% "rank gap" is token-identity information: `دي` is `dia` because the corpus says so 278 times, not because of anything in its three letters.

| Engine | Split | WER | Exact sentences |
| --- | --- | ---: | ---: |
| **Refined rule-based-11** (unchanged) | train | **41.5380%** | 699 |
| **Refined rule-based-11** (unchanged) | validation | **40.5656%** | 109 |
| **Refined rule-based-11** (unchanged) | test (comparative) | **41.3870%** | 81 |

The aggregate metrics contain no corpus sentences. Detailed JSON metrics and error reports remain in Git-ignored `artifacts/`; downloaded Parquet files remain in Git-ignored `corpus/`.
