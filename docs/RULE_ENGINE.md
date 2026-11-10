# Rule engine design

The only production copy is the marked inline engine in `JawiConverter.html`.

## Rumi → Jawi

1. Normalize to NFC, fold `è` to `é` and `ê` to `ě`, and lowercase ordinary words.
2. Tokenize whitespace and punctuation while retaining dotted initialisms and hyphenated forms.
3. Scan vowel nuclei and divide intervocalic consonants with a maximal-onset rule. Malay digraphs count as one consonant and only productive onset clusters stay together.
4. Detect clitics and affix-shaped boundaries on plain Rumi while slicing the original marked string. Pronunciation markers therefore cannot move a boundary. Doubled `kk` is positive evidence for `-kan`; a suffix-shaped ending alone is not always sufficient.
5. Spell each syllable from consonant, vowel, openness, position, and surrounding syllable context. `é` forces taling and `ě`/`ê` forces pepet.
6. Resolve a final native `/k/` to qaf before adding a suffix, then apply suffix-specific hamzah, alif, waw, and ya rules.
7. Expand exact full reduplication to Arabic digit two; process other hyphenated parts independently.

## Jawi → Rumi

1. Apply the same Unicode normalization used by the evaluator.
2. Generate candidates with a finite-state beam search. Explicit Jawi vowels have direct interpretations; omitted vowels are inserted only at consonant transitions or word boundaries.
3. Keep incomplete states in the active beam and complete states separately. Only states that consumed the entire input may enter final ranking.
4. Add phonotactic costs for impossible onset/coda clusters and preferences for productive affix shapes.
5. Forward-convert a shortlist and combine edit consistency with the finite-state cost. This ranks hypotheses; it never uses the reference sentence or a word list.
6. Expand Arabic digit-two reduplication after decoding the base.

The inverse is inherently ambiguous. Forward consistency does not prove that the most likely Rumi pronunciation is the historically intended one.

## Public API

Node development tools expose `RULE_VERSION`, `appendSuffix`, `latinToJawi`, `jawiToLatin`, `wordToJawi`, `baseWordToJawi` (an alias of `wordToJawi`), `syllabify`, `jawiToRumi`, `heurJawiToRumi` (an alias of the finite-state decoder), `inverseCandidates`, `phonotacticCost`, `editDistance`, `TUNE`, and `FORWARD_TUNE`.

The browser exposes the main conversion API plus `RULE_VERSION` and `appendSuffix`. Syllable objects retain both the original UI aliases (`isOpen`, `isFirst`, `isLast`, `isPenult`) and descriptive fields (`open`, `first`, `last`, `penultimate`).

## Tuning boundaries

`TUNE` contains numeric search and phonotactic costs. `FORWARD_TUNE` contains broad shape switches. Neither contains words, roots, pronunciations keyed to words, or output spellings. `tools/tune_rules.js` can tune only numeric inverse costs or boolean forward switches; beam and shortlist controls are excluded.

New contextual rules should be justified by a general orthographic environment and tested against both positive and negative examples. A whole-word condition or a map from a Rumi word to its Jawi answer is not an acceptable substitute.

## Runtime memoization

Repeated Jawi tokens are memoized at runtime to make live conversion and corpus evaluation faster. The cache starts empty, contains only strings produced during the current session, and is limited to 50,000 entries. Its key includes a signature of the current numeric `TUNE` values, so parameter changes cannot return stale answers. No cached word data is serialized or shipped.
