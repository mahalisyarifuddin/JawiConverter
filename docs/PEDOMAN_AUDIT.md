# Pedoman audit: dictionary-free engine

## Scope

`tests/pedoman_cases.json` retains the 236 legacy examples from *Pedoman Umum Ejaan Jawi Bahasa Melayu*. The redesigned engine does not use the former pronunciation inventories, Arabic-root tables, solid-compound mappings, acronym list, reverse dictionary, or PRPM exception batch.

The fixture now distinguishes:

- **178 deterministic examples**: the expected form must match exactly.
- **58 underdetermined examples**: conversion must complete safely without leaking ASCII Rumi or invisible controls, but an exact match is not asserted.

Every underdetermined entry has `deterministic: false` and a `reason`. These entries remain as an ambiguity audit; they are not claimed to be correct and are not silently deleted. The 48 examples displayed in the HTML are all deterministic and all pass.

## Why exact matching is not always well-posed

A rule-based converter cannot recover information that is absent from its input without adding lexical or contextual knowledge. The audit labels four recurring cases:

1. **Arabic source orthography.** Unmarked Rumi does not encode choices such as `ع` versus a vowel carrier, `ء`, alif maqsurah `ى`, or ta marbutah `ة`. Examples include `quran`, `fardu`, `haji`, `arif`, and `fatwa`.
2. **Pronunciation and loan classes.** Plain `e` does not always distinguish pepet from taling, and the surface string does not always identify a European loan's alif or final-kaf convention. Explicit `é` and `ě`/`ê` markers are available when a writer knows the pronunciation.
3. **Historical morphology.** Some established solid compounds and suffixed-looking roots require a boundary that is not visible in modern Rumi. A suffix-shaped ending is not sufficient proof of a suffix.
4. **Acronyms.** Capital letters alone do not specify whether an acronym is read as a word or spelled out, nor whether English or Malay letter names apply.

Using a hidden whole-word map for these cases would violate the dictionary-free requirement. Treating every legacy expected form as a deterministic regression would encourage precisely that violation. The audit instead makes the information boundary explicit.

For clients that already possess an Arabic base spelling, the public `appendSuffix(baseLatin, baseJawi, suffix)` function applies productive suffix and clitic rules without storing the base. This supports forms such as `فردو` supplied as `فرض` plus `kan` → `فرضوکن`.

## Deterministic behavior covered

The executable suite covers representative rules across Pedoman sections 3–19, including:

- consonants and digraphs, diphthongs, hamzah, and Unicode aliases;
- open/closed syllables, alif contexts, pepet/taling markers, and final vowels;
- native prefixes, clitics, suffixes `-an`, `-kan`, and `-i`;
- final qaf resolution before suffixation;
- joined `di`/`ke`, reduplication, initialisms, and the explicitly marked non-Malay name shapes;
- the standalone browser API and all 48 displayed tests.

Coverage of a numbered example is not proof that every word in that class is determined. The `inherentlyLexical` list in `tests/run_tests.js` records sections whose remaining legacy example requires missing lexical information rather than a general mechanical rule.

## Unicode comparison

Regression comparison normalizes to NFC, removes invisible formatting controls, and treats legacy dotted gaf `ڬ` as equivalent to canonical `ݢ`. Production output uses `ݢ`; both forms are accepted on Jawi input. High hamza `ٴ` is normalized to `ء`, Arabic kaf `ك` to `ک`, and legacy peh `پ` to `ڽ`, matching the benchmark normalization.

## Interpretation

The Pedoman audit is a rule-regression suite, not a sentence-level accuracy estimate. It must not be compared with the old exception-assisted 236/236 result as though both systems had the same information constraints. For corpus performance, use the Utusan micro-WER protocol in [EVALUATION.md](EVALUATION.md).
