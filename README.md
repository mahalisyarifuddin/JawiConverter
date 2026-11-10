[**Bahasa Indonesia**](README-id.md) | **English**

# JawiConverter

A single-file, browser-based Malay Rumi (Latin) ↔ Jawi converter. The app combines spelling rules and a weighted inverse decoder with a corpus-derived dictionary for both directions. The dictionary is enabled by default and can be turned off in the interface.

## Quick start

1. Download `JawiConverter.html` and open it in a modern browser. No installation, server, network request, or external script is required.
2. Choose **Rumi → Jawi** or **Jawi → Rumi**.
3. Type, paste, or upload a `.txt` file. Copy the result or use **Swap** to change direction.
4. Uncheck **Dictionary** to use the rule-based conversion paths without the corpus dictionary.

The interface supports Bahasa Melayu and English, live conversion, light/dark themes, and desktop/mobile layouts.

## How conversion works

- **Rumi → Jawi** uses syllabification, contextual spelling rules, affixes, and reduplication. When enabled, the dictionary also supplies learned spellings for eligible tokens; pronunciation markers and protected regression forms take precedence.
- **Jawi → Rumi** uses a finite-state search to restore omitted vowels, ranking complete candidates by phonotactic costs and forward-conversion consistency. When enabled, dictionary readings and some learned context mappings supplement the rule decoder.
- Type **é** to force taling and **ě** or **ê** to force pepet. Mark both vowels when necessary: `sétém → سيتيم`; `sětěm/sêtêm → ستم`.
- Jawi input is normalized to NFC. High hamza `ٴ`, Arabic kaf `ك`, dotted gaf `ڬ`, and legacy peh `پ` are accepted as input aliases.

Unmarked Rumi and Jawi with omitted vowels are inherently ambiguous. Neither rules nor dictionary guarantee the intended spelling or pronunciation; check important output. See [engine design](docs/RULE_ENGINE.md) and the [Pedoman audit](docs/PEDOMAN_AUDIT.md).

## Tests and development

```sh
node tests/run_tests.js
```

The offline suite uses Node.js built-ins and checks 179 deterministic Pedoman forms, safe handling of 57 underdetermined examples, conversion rules and aliases, the browser and Node APIs, all 48 tests displayed in the HTML, corpus evaluation, and tuner behavior.

`JawiConverter.html` is the sole production engine source. `tools/app_engine.js` extracts its marked inline script into a temporary directory for Node tools; no duplicate engine JavaScript is shipped.

## Corpus evaluation

The evaluation tools target the external [Utusan Jawi sentence dataset](https://huggingface.co/datasets/mahalisyarifuddin/utusan-jawi-sentences), with aligned `text` (Jawi) and `latin_text` (Rumi) fields. Corpus text is **not included**. Respect the dataset card and Utusan copyright/terms; do not commit downloaded corpora or sentence-error reports.

```sh
# Parquet input requires Python and pyarrow; JSONL, JSON, and CSV are also supported.
python3 -m pip install --user pyarrow
node tests/evaluate_corpus.js --corpus /path/to/utusan/test.parquet \
  --direction jl --output artifacts/test-metrics.json
```

To tune, supply train and validation data separately; the tuner selects on train and gates changes on validation. Run test only after freezing the configuration. The tools evaluate with the shipped dictionary enabled by default. See [evaluation protocol and historical results](docs/EVALUATION.md) for commands, limitations, and benchmark history. The recorded v18 scores do **not** describe the current v19 hybrid; no current-build WER is claimed here.

## Privacy and contributions

Conversion happens locally in the browser; input text is not uploaded. Evaluation reads the corpus path supplied by the developer. `artifacts/`, `corpus/`, and Parquet files are Git-ignored.

The project is licensed under the [MIT License](LICENSE). Issues, corrections, and pull requests are welcome. For conversion changes, include regression tests and, where relevant, train/validation evaluation; document ambiguous cases rather than claiming a unique answer.
