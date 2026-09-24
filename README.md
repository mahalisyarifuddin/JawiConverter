**English** | [Bahasa Indonesia](README-id.md)

# JawiConverter
*Rumi ↔ Jawi, simplified.*

## Introduction
JawiConverter is a single-file, browser-based tool for converting Malay text between Rumi (Latin) and Jawi. It follows the **Pedoman Umum Ejaan Jawi Bahasa Melayu** and combines syllable-based spelling rules with a word exception dictionary.

The interface is available in **English** and **Bahasa Melayu**. The converter runs locally in your browser; `JawiConverter.html` has no runtime JavaScript or network dependencies and can be used offline.

## How It Works
- **Rumi → Jawi**: Applies letter, syllable, vowel, and final-consonant rules, then uses verified whole-word spellings where the rules are ambiguous.
- **Jawi → Rumi**: Checks exact reverse spellings, then unambiguous forms from the built-in base-word set, and finally uses a character-level fallback. Since short vowels are often unwritten in Jawi, some words remain ambiguous without context.
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
- **Verified exceptions**: 950 PRPM-verified exception entries, rebuilt from an empty EXC dictionary in 19 increments of 50.
- **Live conversion** with examples, copy/paste, `.txt` upload, and direction swapping.
- **English and Bahasa Melayu interface**, with auto, light, and dark theme options.
- **Responsive layout** for desktop and mobile screens.

## Accuracy Evaluation
Run the tests and the PRPM-cache benchmark with:

```sh
node tests/run_tests.js
```

The current word-level snapshot contains **4,056 non-null PRPM forms**. Starting with **zero EXC entries**, the optimizer evaluates the average of the Rumi → Jawi and Jawi → Rumi exact-match rates after each +50 increment:

| EXC entries | Average accuracy |
| ---: | ---: |
| 0 | 81.30% |
| 50 | 82.74% |
| 100 | 84.01% |
| 150 | 85.33% |
| 200 | 86.61% |
| 250 | 87.87% |
| 300 | 89.13% |
| 350 | 90.36% |
| 400 | 91.59% |
| 450 | 92.85% |
| 500 | 93.58% |
| 550 | 94.26% |
| 600 | 94.92% |
| 650 | 95.55% |
| 700 | 96.17% |
| 750 | 96.79% |
| 800 | 97.41% |
| 850 | 98.02% |
| 900 | 98.64% |
| **950** | **99.27%** |

At 950 entries, the individual scores are **98.84%** Rumi → Jawi and **99.70%** Jawi → Rumi. This is the first 50-entry boundary to reach the 99% average target. The average is the arithmetic mean of the two direction scores. The Jawi → Rumi rate sits at the snapshot ceiling: 12 pairs of corpus words share an identical Jawi spelling (for example *pasal*/*fasal* → فصل), so at most one word of each pair can reverse correctly. The optimizer greedily maximizes combined exact-match gains, uses PRPM word frequency to break ties, and retains PRPM-backed golden regression cases. Since entries are selected from this same PRPM snapshot, this is an in-corpus benchmark, not a held-out accuracy guarantee. Unicode is normalized to NFC and invisible formatting controls are ignored; spellings are otherwise compared exactly.

To rebuild EXC from zero in increments of 50, first run a dry evaluation, then apply the optimized entries:

```sh
node tools/optimize_exceptions.js          # dry run; prints each 50-entry step
node tools/optimize_exceptions.js --write  # rewrite the batch and sync the standalone HTML
```

To manually sync the embedded engine after editing `jawi_converter.js`:

```sh
python tools/embed_engine.py
python tools/embed_engine.py --check
```

## Privacy & Data
All conversion happens in your browser. Text is not uploaded or sent to a server. The PRPM word forms in `tools/prpm_cache.json` are used for development and evaluation; the app itself does not fetch PRPM or any other service.

## License
This project is licensed under the [MIT License](LICENSE).

## Contributions
Issues, corrections, and pull requests are welcome. For spelling-rule changes, please include a regression case and run the PRPM evaluation so the effect on both directions is clear.

## Feedback
Please use the repository's Issues section for questions, corrections, and suggestions.
