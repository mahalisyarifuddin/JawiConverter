**English** | [Bahasa Indonesia](README-id.md)

# JawiConverter
*Rumi ↔ Jawi, simplified.*

## Introduction
JawiConverter is a single-file, browser-based tool for converting Malay text between Rumi (Latin) and Jawi. It follows the **Pedoman Umum Ejaan Jawi Bahasa Melayu** and combines syllable-based spelling rules with a word exception dictionary.

The interface is available in **English** and **Bahasa Melayu**. The converter runs locally in your browser; `JawiConverter.html` has no runtime JavaScript or network dependencies and can be used offline.

## How It Works
- **Rumi → Jawi**: Applies letter, syllable, vowel, and final-consonant rules, then uses verified whole-word spellings where the rules are ambiguous.
- **Jawi → Rumi**: Checks exact reverse spellings, then unambiguous forms from the built-in base-word set, and finally uses a character-level fallback. Since short vowels are often unwritten in Jawi, some words remain ambiguous without context.
- Pasted Jawi is normalized before lookup: the high hamza **ٴ** (U+0674) that some Jawi sources type in place of the hamzah is folded onto the standard hamzah **ء** (U+0621), so both spellings convert the same way.
- The app preserves ordinary spacing and common punctuation, and supports hyphenated forms and reduplication entries.
- Type **é** to explicitly mark a taling vowel; unaccented **e** is handled by the engine’s pepet/taling rules.

## Quick Start
1. Download `JawiConverter.html` from the repository.
2. Open it in a modern browser (Chrome, Edge, Firefox, or Safari). No installation is required.
3. Select **Rumi → Jawi** or **Jawi → Rumi**.
4. Type or paste text into the source panel. Conversion runs live; you can also upload a `.txt` file.
5. Copy the result, or use **Swap** to reverse the direction and move the result into the source panel.

## Key Features
- **Two-way conversion**: Rumi ↔ Jawi transliteration.
- **Single HTML file**: The converter engine is embedded in `JawiConverter.html`; it works offline without loading external scripts.
- **Rule-based transliteration**: Syllabification, vowel handling, consonant digraphs, morphology, and final kaf/qaf rules.
- **Verified exceptions**: 800 PRPM-verified entries, rebuilt only after the rule-only Pedoman suite passes, in 16 increments of 50.
- **Live conversion** with examples, copy/paste, `.txt` upload, and direction swapping.
- **English and Bahasa Melayu interface**, with auto, light, and dark theme options.
- **Responsive layout** for desktop and mobile screens.

## Accuracy Evaluation
Run the tests and the PRPM-cache benchmark with:

```sh
node tests/run_tests.js
```

The current word-level snapshot contains **4,067 non-null PRPM forms**. Tests first remove every EXC entry and run 223 rule-only cases covering Pedoman sections 3–19. The optimizer runs only after those pass, and protects all 236 Pedoman cases while evaluating each +50 PRPM batch:

| EXC entries | Average accuracy |
| ---: | ---: |
| 0 | 84.63% |
| 50 | 86.01% |
| 100 | 87.34% |
| 150 | 88.66% |
| 200 | 89.89% |
| 250 | 91.15% |
| 300 | 92.38% |
| 350 | 93.59% |
| 400 | 94.55% |
| 450 | 95.24% |
| 500 | 95.88% |
| 550 | 96.51% |
| 600 | 97.11% |
| 650 | 97.74% |
| 700 | 98.34% |
| 750 | 98.97% |
| **800** | **99.55%** |

At 800 entries, the individual scores are **99.46%** Rumi → Jawi and **99.63%** Jawi → Rumi. This is the first 50-entry boundary to reach the 99% average target. The optimizer greedily maximizes combined exact-match gains, uses PRPM frequency to break ties, and rejects candidates that conflict with a protected Pedoman form. Since entries are selected from this same PRPM snapshot, this is an in-corpus benchmark, not a held-out accuracy guarantee. Unicode is normalized to NFC and invisible formatting controls are ignored; spellings are otherwise compared exactly.

“Rule-only” means the PRPM EXC batch is disabled, not dictionary-free conversion: pronunciation/root metadata, fixed PEDOMAN lexical classes, and the existing reverse lookup table remain. Tests cover the operational numbered subrules, but representative examples are not proof of correctness for every possible word or context. See [the PEDOMAN audit](docs/PEDOMAN_AUDIT.md) for scope and limitations.

The optimizer rechecks **all protected outputs after every batch**, including derivatives affected by root exceptions, and refuses to write a failing result. After writing, it runs the full test suite and restores the prior engine if validation fails.

`JawiConverter.html` is the sole engine source. Node tools and tests use `tools/app_engine.js` to extract its marked inline engine into a disposable operating-system temporary directory, load it, and remove the copy. No duplicate engine JavaScript is shipped.

To rebuild EXC from zero in increments of 50, first run a dry evaluation, then apply the optimized entries directly to the app:

```sh
node tools/optimize_exceptions.js          # dry run; prints each 50-entry step
node tools/optimize_exceptions.js --write  # rewrites the inline batch in JawiConverter.html
```

## Privacy & Data
All conversion happens in your browser. Text is not uploaded or sent to a server. The PRPM word forms in `tools/prpm_cache.json` are used for development and evaluation; the app itself does not fetch PRPM or any other service.

## License
This project is licensed under the [MIT License](LICENSE).

## Contributions
Issues, corrections, and pull requests are welcome. For spelling-rule changes, please include a regression case and run the PRPM evaluation so the effect on both directions is clear.

## Feedback
Please use the repository's Issues section for questions, corrections, and suggestions.
