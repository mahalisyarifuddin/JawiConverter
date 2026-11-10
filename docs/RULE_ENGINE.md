# Rule engine design

The only production copy is the marked inline engine in `JawiConverter.html`. The current version (`2026-11-10-rule-based-19-hybrid`) combines rule paths with a corpus-derived dictionary enabled by default. `JawiDictionary.enabled = false` disables the learned lookup paths in both directions.

## Rumi → Jawi

1. Normalize and tokenize the input, retaining dotted initialisms and hyphenated forms.
2. For eligible tokens, consult learned Rumi → Jawi mappings when the dictionary is enabled. Protected regression forms and explicit pronunciation markers bypass these mappings.
3. For rule-based spelling, fold `è` to `é` and `ê` to `ě`, lowercase ordinary words, and divide vowel nuclei and intervocalic consonants using a maximal-onset rule.
4. Detect clitics and affix-shaped boundaries on plain Rumi while slicing the original marked string. Pronunciation markers therefore cannot move a boundary. Doubled `kk` is positive evidence for `-kan`; a suffix-shaped ending alone is not always sufficient.
5. Spell each syllable from its context. `é` forces taling and `ě`/`ê` forces pepet. Resolve a final native `/k/` to qaf before adding a suffix, then apply suffix-specific rules.
6. Expand exact full reduplication to Arabic digit two; process other hyphenated parts independently.

## Jawi → Rumi

1. Normalize Jawi input and tokenize it. When enabled, consult learned dictionary and contextual mappings for eligible tokens before falling back to the rule decoder.
2. Generate rule candidates with a finite-state beam search. Explicit Jawi vowels have direct interpretations; omitted vowels are inserted only at consonant transitions or word boundaries.
3. Keep incomplete states in the active beam and complete states separately. Only states that consumed the entire input may enter final ranking.
4. Add phonotactic costs for impossible onset/coda clusters and preferences for productive affix shapes.
5. Forward-convert a shortlist and combine edit consistency with the finite-state cost. The rule decoder does not use the reference sentence or a word list.
6. Handle Arabic digit-two reduplication, including dictionary entries for full reduplicated forms.

The inverse is inherently ambiguous. Forward consistency does not prove that the most likely Rumi pronunciation is the historically intended one.

## Public API

Node development tools expose `RULE_VERSION`, `appendSuffix`, `latinToJawi`, `jawiToLatin`, `wordToJawi`, `baseWordToJawi` (an alias of `wordToJawi`), `syllabify`, `jawiToRumi`, `heurJawiToRumi` (an alias of the finite-state decoder), `inverseCandidates`, `phonotacticCost`, `editDistance`, `TUNE`, `FORWARD_TUNE`, and `JawiDictionary`.

The browser exposes the main conversion API plus `RULE_VERSION`, `appendSuffix`, and `JawiDictionary`. Syllable objects retain both the original UI aliases (`isOpen`, `isFirst`, `isLast`, `isPenult`) and descriptive fields (`open`, `first`, `last`, `penultimate`).

## Tuning boundaries

`TUNE` contains numeric search and phonotactic costs. `FORWARD_TUNE` contains broad shape switches. Neither contains words, roots, pronunciations keyed to words, or output spellings. `tools/tune_rules.js` can tune only numeric inverse costs or boolean forward switches; beam and shortlist controls are excluded.

New contextual rules should be justified by a general orthographic environment and tested against both positive and negative examples. Changes to the learned mappings should be distinguished from changes to general rules and evaluated separately.

## Runtime memoization

Repeated Jawi tokens are memoized at runtime to make live conversion and corpus evaluation faster. The cache starts empty, contains only strings produced during the current session, and is limited to 50,000 entries. Its key includes a signature of the current numeric `TUNE` values, so parameter changes cannot return stale answers. Dictionary readings are applied outside the rule cache. No cached word data is serialized or shipped.
