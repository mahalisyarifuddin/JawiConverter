# PEDOMAN rule-first audit

Source: the repository's 65-page `PEDOMAN_UMUM_EJAAN_JAWI_BAHASA_MELAYU.pdf`.
Evaluated 2026-09-25. No PRPM cache references were changed.

## Order of work and measured results

1. Disable the complete PRPM EXC increment. Expand the regression suite before
   changing the heuristic. The new cases exposed final-pepet, morphology, and
   Arabic-loan suffix failures that the old suite did not detect.
2. Fix productive rules and pronunciation inputs. Require 223/223 rule-only
   text cases plus isolated productive suffix tests to pass.
3. Rebuild EXC from zero in 50-entry increments, checking all 236 protected text
   outputs after every increment. Stop at the first boundary reaching 99%.
4. Run the full Node and standalone-browser-engine tests after applying EXC.

| Phase | Rumi → Jawi | Jawi → Rumi | Arithmetic mean |
| --- | ---: | ---: | ---: |
| Previous, EXC disabled | 3199/4067 (78.66%) | 3620/4067 (89.01%) | 83.83% |
| Revised, EXC disabled | 3236/4067 (79.57%) | 3648/4067 (89.70%) | 84.63% |
| Rebuilt, 750 EXC | 3998/4067 (98.30%) | 4052/4067 (99.63%) | 98.97% |
| Rebuilt, 800 EXC | 4045/4067 (99.46%) | 4052/4067 (99.63%) | 99.55% |

These are exact-match, in-corpus measurements, not held-out estimates. The
candidate dictionary and benchmark use the same 4,067 PRPM references. The
average gives equal weight to the two directions; it is not frequency-weighted.

## Coverage map and limits

`tests/pedoman_cases.json` identifies each example by numbered rule. The test
runner enforces subrule coverage, not merely one example per chapter.

| Sections | Implementation / validation |
| --- | --- |
| 1 | Historical background; no transliteration algorithm. |
| 2, 3.1–3.6 | Unicode letters and browser Arabic shaping; examples exercise letter sequences. Font joining and typography are not visually certified by Node tests. |
| 3.7–3.13 | Proper-name hamzah, vowel hiatus, retained Arabic hamzah, borrowed prefixes. Arabic source spellings require lexical information. |
| 4.1–4.7 | Vowel carriers, explicit é, pepet/taling pronunciation metadata, final pepet. |
| 5.1–5.3 | ai/au/oi diphthongs. Rumi spelling alone cannot resolve every hiatus/diphthong ambiguity. |
| 6.1–6.4 | Consonants, final kaf/qaf, lexical Arabic ta marbutah. |
| 7.1–7.3 | Monosyllables, closed-a suppression and stated exceptions. |
| 8.1–8.17 | Two-syllable patterns, alif decisions and vowel combinations. 8.1 introduces the patterns tested in the following subrules. |
| 9.1–9.3 | Multisyllabic words and lexically identified loan/acronym classes. |
| 10 | Conventional spellings; inherently lexical rather than universally derivable. |
| 11.1–11.6 | Arabic source forms and productive suffix rules. Isolated suffix tests supply source root spellings without loading EXC. |
| 12.1–12.5 | European loans, clusters and kaf; loan identity needs lexical metadata. |
| 13.1–13.12 | Affixes, nasal prefixes, suffixes, circumfixes. 13.1 defines derived words, exercised by the following cases. Root detection remains heuristic. |
| 14.1 | Joined di/ke and hamzah on initial alif. |
| 15.1–15.2 | Attached pronouns. |
| 16.1–16.2 | Attached particles and separated pun. |
| 17.1–17.2 | Full and changed-form reduplication. |
| 18.1–18.5 | Separate phrases, circumfixed and established solid compounds. |
| 19.1, 19.3–19.5 | Letter names, Malay/English initialisms and spoken acronyms; language/class identity is lexical. The intervening unnumbered note recommends full titles, not automatic expansion of ambiguous initials. |

Coverage is representative, **not a claim that every PDF example or every
possible word has been exhaustively verified**. Context-sensitive meaning,
Arabic etymology, loan identity and unmarked e cannot all be recovered from
plain Rumi characters. Existing fixed PEDOMAN spelling maps and the large
`JAWI_TO_LATIN_AUTO` reverse dictionary remain active with EXC disabled. Thus
“rule-only” in the tools means **zero PRPM EXC entries**, not zero lexical data.

## Changes to productive behavior

- 3.9: restrict the ui hiatus hamzah to the closed-syllable environment; suffix
  -i has its own rule and must not rely on an overbroad syllable fallback.
- 4.5: explicit pepet pronunciation overrides shape guesses. Examples such as
  metode and lipase now end in ye; mekanisme distinguishes its two e syllables.
- 4.4–4.5: é and ě are explicit pronunciation input for taling and pepet. Both
  outrank the shape and lexical hints, and both are transparent to lexical
  lookups, so marking a vowel can never bypass a verified spelling, root, or
  affix boundary.
- 9.3 / 12.1: identify the tested European-loan alif classes without inserting
  complete Jawi answers into EXC.
- 11.4: restore an unwritten final i/u before endings (haji → hajilah,
  fardu → memfardukan). The Arabic root still needs its source spelling.
- 11.6: distinguish final /a/ alif maqsurah from final pepet before changing it
  to alif; identical Unicode shape is not sufficient evidence.
- 13: prefer a validated suffix boundary over an inflected token accidentally
  treated as a root, while retaining stronger evidence from longer prefixes.
  For example, use me+lalu+i rather than me+lalui.

The optimizer now requires an empty EXC preflight, seeds declared reference-root
requirements (for example usul for prausul), re-evaluates all protected outputs
per batch, and fails closed on regression. It does not merely compare the keys
of proposed exceptions. Post-write full-suite failure restores the prior engine.
Negative tests cover attempted preflight bypass and indirect derivative failures.

## Reproduce

```sh
node tests/run_tests.js
node tools/optimize_exceptions.js          # dry run, starts from zero
node tools/optimize_exceptions.js --write  # rebuild and run full validation
SHOW_PRPM_ERRORS=1 node tests/evaluate_prpm.js
```
