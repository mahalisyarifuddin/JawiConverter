#!/usr/bin/env node
'use strict';

/** Deterministic rule, Unicode, API, and standalone-browser regression tests. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  APP_PATH,
  readEngineSource,
  copyEngineToTemp,
  loadEngine
} = require('../tools/app_engine.js');

const root = path.join(__dirname, '..');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'pedoman_cases.json'), 'utf8'));
const html = fs.readFileSync(APP_PATH, 'utf8');
const engineSource = readEngineSource();
const engine = loadEngine();
const FORMAT_CONTROLS = /[\u0080-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const canonical = value => String(value).normalize('NFC').replace(FORMAT_CONTROLS, '').replace(/ڬ/g, 'ݢ');

// A forbidden lookup table must not be reintroduced under the old names.
for (const forbidden of ['EXCEPTION_DICT', 'JAWI_TO_LATIN_AUTO', 'REVERSE_DICT', 'BASE_SET', 'prpm_cache']) {
  assert(!engineSource.includes(forbidden), `Dictionary artifact found in engine: ${forbidden}`);
}
assert(!/(?:dictionary-assisted|dibantu kamus|Membina kamus|Building the PRPM)/i.test(html),
  'Outdated dictionary-oriented UI text remains');

let deterministic = 0;
let underdetermined = 0;
for (const testCase of cases) {
  const output = engine.latinToJawi(testCase.rumi);
  assert(!FORMAT_CONTROLS.test(output), `Control character leaked from ${testCase.rumi}`);
  FORMAT_CONTROLS.lastIndex = 0;
  const got = canonical(output);
  if (testCase.deterministic === false) {
    underdetermined++;
    assert(!/[A-Za-z]/.test(got), `Unconverted Rumi leaked from ${testCase.rumi}: ${got}`);
    continue;
  }
  assert.strictEqual(got, canonical(testCase.pedoman),
    `${testCase.rule || '?'} ${testCase.rumi}`);
  deterministic++;
}
assert.strictEqual(deterministic, 179);
assert.strictEqual(underdetermined, 57);
console.log(`Pedoman audit: ${deterministic} deterministic forms passed; ${underdetermined} underdetermined forms converted safely`);

// Numbered operational rules stay represented in the deterministic audit.
const coveredRules = new Set(cases.filter(c => c.deterministic !== false).map(c => c.rule));
const subrules = { 3:13, 4:7, 5:3, 6:4, 7:3, 8:17, 9:3,
  11:6, 12:5, 13:12, 14:1, 15:2, 16:2, 17:2, 18:5, 19:5 };
const inherentlyLexical = new Set([
  '3.9', '3.11', '3.12', '4.4', '4.5', '5.1', '6.4', '7.2', '8.9', '8.17', '9.3',
  '11.1', '11.3', '11.4', '11.6', '12.2', '12.3', '12.4', '12.5',
  '13.12', '18.1', '18.4', '18.5', '19.4', '19.5'
]);
for (const [section, count] of Object.entries(subrules)) {
  for (let i = 1; i <= count; i++) {
    const rule = `${section}.${i}`;
    if (['8.1', '13.1', '19.2'].includes(rule)) continue; // editorial introductions
    assert(coveredRules.has(rule) || inherentlyLexical.has(rule), `Missing deterministic coverage for ${rule}`);
  }
}

// Productive suffixation is public and works with an externally supplied Arabic
// base spelling; no Arabic root is stored in the engine.
for (const [latin, jawi, suffix, expected] of [
  ['fardu', 'فرض', 'kan', 'فرضوکن'],
  ['haji', 'حاج', 'lah', 'حاجيله'],
  ['haji', 'حاج', 'nya', 'حاجيڽ'],
  ['buku', 'بوکو', 'nya', 'بوکوڽ'],
  ['fatwa', 'فتوى', 'lah', 'فتواله'],
  ['lipase', 'ليڤاسى', 'nya', 'ليڤاسىڽ']
]) assert.strictEqual(engine.appendSuffix(latin, jawi, suffix), expected);
for (const [rumi, jawi] of [
  ['anakkan', 'انقکن'], ['anaknya', 'انقڽ'], ['baikkan', 'باءيقکن'],
  ['sukai', 'سوکاءي'], ['melalui', 'ملالوءي'], ['mencintai', 'منچينتاءي'],
  ['memadai', 'مماداءي'], ['dipakai', 'ديڤاکاءي'], ['sungai', 'سوڠاي'],
  ['usai', 'اوساي'], ['serai', 'سراي'], ['lautan', 'لاءوتن'],
  ['beliau', 'بلياو'], ['subur', 'سوبور'], ['subeditor', 'سوبئيديتور']
]) assert.strictEqual(engine.latinToJawi(rumi), jawi, rumi);

// Backward-compatible syllable aliases used by the UI.
for (const syllable of engine.syllabify('baca')) {
  assert.strictEqual(syllable.isOpen, syllable.open);
  assert.strictEqual(syllable.isFirst, syllable.first);
  assert.strictEqual(syllable.isLast, syllable.last);
  assert.strictEqual(syllable.isPenult, syllable.penultimate);
}
assert.deepStrictEqual(engine.syllabify('baca').map(s => s.text), ['ba', 'ca']);

// Reduplication, clitics, joined prepositions, productive initialisms, and
// Pedoman's explicitly marked non-Malay name shapes.
for (const [rumi, jawi] of [
  ['buku-buku', 'بوکو٢'], ['buku-buku!', 'بوکو٢!'], ['kura-kura', 'کورا٢'],
  ['anak-anaknya', 'انق-انقڽ'], ['berlari-lari', 'برلاري-لاري'],
  ['di sana', 'دسان'], ['di atas', 'دأتس'], ['ke utara', 'کأوتارا'],
  ['rumahku', 'رومهکو'], ['rumahnya', 'رومهڽ'], ['TUDM', 'ت.او.د.م.'],
  ['P.M.', 'ڤ.م.'], ['Ng', 'ءڠ'], ['Ong', 'ءوڠ'], ["Ch'ng", 'چئڠ']
]) assert.strictEqual(engine.latinToJawi(rumi), jawi, rumi);

// NFC pronunciation markers select a vowel without changing affix boundaries.
for (const [rumi, jawi] of [
  ['sétém', 'سيتيم'], ['sětěm', 'ستم'], ['sêtêm', 'ستم'],
  ['saté', 'ساتي'], ['satě', 'ساتى'], ['satê', 'ساتى'],
  ['di ěmas', 'دأمس'], ['di êmas', 'دأمس'], ['běsar-běsar', 'بسر٢'],
  ['měngambil', 'مڠامبيل']
]) assert.strictEqual(engine.latinToJawi(rumi), jawi, rumi);
assert.strictEqual(engine.latinToJawi('se\u0301tem'), engine.latinToJawi('sétem'));
assert.strictEqual(engine.latinToJawi('se\u030ctem'), engine.latinToJawi('sětem'));
assert.strictEqual(engine.latinToJawi('se\u0302tem'), engine.latinToJawi('sêtem'));
assert(!/[éěêè]/.test(engine.latinToJawi('sétem, sětem, sêtem')));

// High-hamza and other dataset/input aliases take exactly the same finite-state
// path as canonical text. Only complete decoder states may be ranked.
const HIGH_HAMZA = '\u0674';
const withHighHamza = jawi => jawi.replace(/ء/g, HIGH_HAMZA);
for (const [canonicalJawi, expected] of [
  ['ماءين', 'main'], ['باءيق', 'baik'], ['دوءيت', 'duit'], ['باءو', 'bau'],
  ['اءير', 'air'], ['لاءوت', 'laut'], ['کاءين', 'kain'], ['ماءين٢', 'main-main'] // standard Malay & Utusan corpus hyphenate reduplication
]) {
  const pasted = withHighHamza(canonicalJawi);
  assert.strictEqual(engine.jawiToLatin(pasted), expected);
  assert.strictEqual(engine.jawiToRumi(pasted), engine.jawiToRumi(canonicalJawi));
}
assert.strictEqual(engine.jawiToLatin(HIGH_HAMZA), '');
assert.strictEqual(engine.jawiToLatin('١٢ ، ٣.٥؟'), '12, 3.5?');
assert.strictEqual(engine.jawiToLatin('MBJB Press e-peper'), 'MBJB Press e-peper');
assert.strictEqual(engine.jawiToLatin('يڠ'), 'yang');
assert.strictEqual(engine.jawiToLatin('دأمبيل'), 'diambil');
assert.strictEqual(engine.jawiToLatin('سأورڠ'), 'seorang');
/* One Jawi token, two Rumi words: دسيني is "di sini" in the corpus. */
assert.strictEqual(engine.jawiToLatin('دسيني'), 'di sini');
assert.strictEqual(engine.jawiToLatin('دباوه'), 'di bawah');
/* ٢ marks repetition, hyphenated in standard Rumi and the corpus (kira-kira). */
assert.strictEqual(engine.jawiToLatin('کيرا٢'), 'kira-kira');
assert.strictEqual(engine.jawiToLatin('دباوه'), 'di bawah');
assert.strictEqual(engine.jawiToLatin('دالم'), 'dalam');
assert.strictEqual(engine.jawiToLatin('جوݢ'), 'juga');
/* d + vowel + nasal is not a passive di- root: no Malay root starts with ng/ny. */
assert.strictEqual(engine.jawiToLatin('دڠن'), 'dengan');
assert.strictEqual(engine.jawiToLatin('دڠر'), 'dengar');
/* Schwa is unwritten in Jawi while /a/ takes alif, so an unwritten initial
 * vowel in a polysyllabic word is read as e. Ambiguous roots such as سڤرتي
 * (separti/seperti/separeti) are left to the general costs. */
assert.strictEqual(engine.jawiToLatin('نݢري'), 'negeri');
assert.strictEqual(engine.jawiToLatin('نݢارا'), 'negara');
assert.strictEqual(engine.jawiToLatin('ڤلاجر'), 'pelajar');
/* Rumi /e/ in a medial open syllable is unwritten in Jawi; before r that is the
 * dominant context (ke-r-ana, be-r-apa), so the medial schwa is preferred. */
assert.strictEqual(engine.jawiToLatin('کران'), 'kerana');
assert.strictEqual(engine.jawiToLatin('براڤ'), 'berapa');
assert(engine.phonotacticCost('kerana') < engine.phonotacticCost('karana'));
/* A final vowel is rare after these consonant letters, so a bare final
 * consonant is preferred (دالم dalam, سموا semua). */
assert.strictEqual(engine.jawiToLatin('دالم'), 'dalam');
assert.strictEqual(engine.jawiToLatin('سموا'), 'semua');
/* Mid-word ي before a consonant can spell /ia/ (kejadian, ujian). */
assert.strictEqual(engine.jawiToLatin('کجادين'), 'kejadian');
assert.strictEqual(engine.jawiToLatin('اوجين'), 'ujian');
/* اء before a consonant spells long /aa/ (kerajaan, berkenaan). */
assert.strictEqual(engine.jawiToLatin('کراجاءن'), 'kerajaan');
assert.strictEqual(engine.jawiToLatin('برکناءن'), 'berkenaan');
assert.strictEqual(engine.jawiToLatin('کراجاٴن'), 'kerajaan');
/* Word-final ي after a consonant can spell /ia/ (berusia). */
assert.strictEqual(engine.jawiToLatin('بروسيا'), 'berusia');
/* Bare di/ke are words, not prefix-bearing forms. */
assert.strictEqual(engine.jawiToLatin('دي'), 'dia');
/* A schwa between consonants before a final syllable reads as reduced /a/. */
/* Corpus-majority reading (مريک appears as "mereka" 484 times in train). */
assert.strictEqual(engine.jawiToLatin('مريک'), 'mereka');
assert.strictEqual(engine.jawiToLatin('لومڤور'), 'lumpur');
assert(engine.phonotacticCost('plajar') > engine.phonotacticCost('pelajar'));
assert(engine.phonotacticCost('tersbut') > engine.phonotacticCost('tersebut'));
assert.strictEqual(engine.jawiToLatin('غاءيره'), engine.jawiToLatin('غاٴيره'));
assert(engine.jawiToLatin('غاءيره').length > 0);
for (const candidate of engine.inverseCandidates('ممباچ')) {
  assert.strictEqual(candidate.at, 'ممباچ'.length, 'Incomplete inverse candidate was returned');
}

// The default hybrid dictionary can be disabled independently of the rule cache.
assert.strictEqual(engine.JawiDictionary.enabled, true);
assert.strictEqual(engine.latinToJawi('akademi'), 'اکادمي');
assert.strictEqual(engine.jawiToLatin('اکادمي'), 'akademi');

// Morphological/contextual Stage B+C invariants (v21)
assert.strictEqual(engine.latinToJawi('ke-10'), 'ک-10');
assert.strictEqual(engine.latinToJawi('di mana-mana'), 'دمان-مان');
assert.strictEqual(engine.jawiToLatin('1مليسيا'), '1malaysia');
assert.strictEqual(engine.jawiToLatin('41ترماسوق'), '41 termasuk');
assert.strictEqual(engine.latinToJawi('Kg.'), 'Kg.');
assert.strictEqual(engine.latinToJawi('Abdul Rahman'), 'عبدالرحمن');
assert.strictEqual(engine.jawiToLatin('عبدالرحمن'), 'abdul rahman');
assert.strictEqual(engine.jawiToLatin('ساءين س مارا'), 'sains mara');
engine.JawiDictionary.enabled = false;
try {
  assert.strictEqual(engine.latinToJawi('ke-10'), 'ک-10');
  assert.strictEqual(engine.latinToJawi('di mana-mana'), 'دمان-مان');
  assert.strictEqual(engine.latinToJawi('memastikan'), 'ممستيکن');
  assert.strictEqual(engine.latinToJawi('mengambil'), 'مڠمبيل');
  assert.strictEqual(engine.latinToJawi('m\u011bngambil'), 'مڠامبيل');
  assert.strictEqual(engine.jawiToLatin('41ترماسوق'), '41 termasuk');
  assert.strictEqual(engine.jawiToLatin('ترسبوت'), 'tersebut');
  assert.strictEqual(engine.jawiToLatin('منتري'), 'menteri');
  assert.strictEqual(engine.jawiToLatin('ممبري'), 'memberi');
  assert.strictEqual(engine.jawiToLatin('هنتر'), 'hantar');
  assert.strictEqual(engine.jawiToLatin('مجليس'), 'majlis');
} finally {
  engine.JawiDictionary.enabled = true;
}
engine.JawiDictionary.enabled = false;
try {
  assert.strictEqual(engine.latinToJawi('akademi'), 'اکدمي');
  assert.strictEqual(engine.jawiToLatin('اکادمي'), 'akadmi');
} finally {
  engine.JawiDictionary.enabled = true;
}
assert.strictEqual(engine.jawiToLatin('اکادمي'), 'akademi');

// Node consumes a disposable, byte-identical copy of the inline engine.
const temporary = copyEngineToTemp();
try {
  assert.strictEqual(fs.readFileSync(temporary.file, 'utf8'), engineSource);
} finally {
  const directory = temporary.directory;
  temporary.cleanup();
  assert(!fs.existsSync(directory));
}
assert(!fs.existsSync(path.join(root, 'jawi_converter.js')));
assert(!/<script\b[^>]*\bsrc\s*=/i.test(html));
assert(/<\/html>\s*$/i.test(html));

const browserContext = { window: {}, console };
vm.runInNewContext(engineSource, browserContext, { timeout: 30000 });
const browser = browserContext.window.JawiConverter;
assert(browser && browser.RULE_VERSION === engine.RULE_VERSION);
for (const api of ['appendSuffix', 'latinToJawi', 'jawiToLatin', 'wordToJawi', 'syllabify', 'jawiToRumi']) {
  assert.strictEqual(typeof browser[api], 'function', `Browser API missing ${api}`);
}
assert.strictEqual(browser.latinToJawi('buku-buku'), 'بوکو٢');
assert.strictEqual(browser.latinToJawi('se\u0301tem'), browser.latinToJawi('sétem'));
assert.strictEqual(browser.jawiToLatin('با\u0674يق'), 'baik');

// Execute the exact 48 rows displayed by the standalone UI.
const testStart = html.indexOf('const TESTS = [');
const testEnd = html.indexOf('\n\t\t];', testStart) + 7;
assert(testStart >= 0 && testEnd > testStart);
const uiTests = vm.runInNewContext(html.slice(testStart, testEnd) + ';TESTS');
assert.strictEqual(uiTests.length, 48);
for (const [rumi, expected] of uiTests) assert.strictEqual(browser.wordToJawi(rumi), expected, `UI ${rumi}`);
console.log('Affixes, markers, Unicode aliases, API compatibility, and 48 standalone-browser checks passed');
require('./corpus_tests.js');
require('./tuner_tests.js');

// Corpus evaluation is opt-in so the copyrighted Utusan data is never required
// for ordinary tests or copied into the repository.
if (process.env.UTUSAN_TEST_CORPUS) {
  const { evaluatePath } = require('./evaluate_corpus.js');
  const result = evaluatePath(process.env.UTUSAN_TEST_CORPUS, { direction: 'jl' });
  console.log(`Utusan test: ${result.sentences} sentences, WER ${(100 * result.wer).toFixed(4)}%`);
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts', 'latest-test-metrics.json'), JSON.stringify(result, null, 2) + '\n');
}
