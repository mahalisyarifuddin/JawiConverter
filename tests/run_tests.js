#!/usr/bin/env node
/**
 * Pedoman rule coverage, standalone-browser checks, and PRPM evaluation.
 * Usage: node tests/run_tests.js
 */
const assert = require('assert');
const { assertRuleOnlyPedoman, assertProtectedPedoman } = require('../tools/optimize_exceptions.js');
const path = require('path');
const fs = require('fs');
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
const ruleOnly = loadEngine({ ruleOnly: true });
const optimized = loadEngine();
const FORMAT_CONTROLS = /[\u0080-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

function canonicalPedoman(value) {
  return String(value).normalize('NFC').replace(FORMAT_CONTROLS, '').replace(/ڬ/g, 'ݢ');
}

let failures = 0;
let ruleOk = 0;
let optimizedOk = 0;
let ruleTotal = 0;
for (const testCase of cases) {
  const { rumi, pedoman, phase } = testCase;
  if (phase !== 'exceptions') {
    ruleTotal++;
    const got = canonicalPedoman(ruleOnly.latinToJawi(rumi));
    if (got === canonicalPedoman(pedoman)) ruleOk++;
    else {
      failures++;
      console.error(`RULE FAIL ${testCase.rule || '?'} ${rumi}: expected ${pedoman}; got ${got}`);
    }
  }

  const got = canonicalPedoman(optimized.latinToJawi(rumi));
  if (got === canonicalPedoman(pedoman)) optimizedOk++;
  else {
    failures++;
    console.error(`APP FAIL ${testCase.rule || '?'} ${rumi}: expected ${pedoman}; got ${got}`);
  }
}
console.log(`Pedoman rule-only checks: ${ruleOk}/${ruleTotal} passed (EXC ignored)`);
console.log(`Pedoman checks after exceptions: ${optimizedOk}/${cases.length} passed`);

const coveredSections = new Set(cases.map(testCase => String(testCase.rule || '').split('.')[0]).filter(Boolean));
for (const section of ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']) {
  if (!coveredSections.has(section)) {
    console.error(`No Pedoman regression case covers section ${section}.`);
    failures++;
  }
}

// Numbered operational subrules must not silently disappear from the suite.
// 8.1 and 13.1 introduce the patterns exercised by 8.2 and 13.3 respectively.
const coveredRules = new Set(cases.map(c => c.rule));
const subrules = { 3:13, 4:7, 5:3, 6:4, 7:3, 8:17, 9:3,
  11:6, 12:5, 13:12, 14:1, 15:2, 16:2, 17:2, 18:5, 19:5 };
for (const [section, count] of Object.entries(subrules)) {
  for (let i = 1; i <= count; i++) {
    const rule = `${section}.${i}`;
    // The unnumbered note between 19.1 and 19.3 recommends full job titles;
    // it is editorial advice, not an automatic abbreviation-expansion rule.
    if (['8.1', '13.1', '19.2'].includes(rule)) continue;
    assert(coveredRules.has(rule), `Missing operational Pedoman subrule ${rule}`);
  }
}

// Rule 11.4 is independently testable without EXC: supply an Arabic root
// spelling, then check the productive rule rather than memorized derivatives.
assert.deepStrictEqual(Object.keys(ruleOnly.EXCEPTION_DICT), []);
for (const [latin, jawi, suffix, expected] of [
  ['fardu', 'فرض', 'kan', 'فرضوکن'],
  ['haji', 'حاج', 'lah', 'حاجيله'],
  ['haji', 'حاج', 'nya', 'حاجيڽ'],
  ['buku', 'بوکو', 'nya', 'بوکوڽ'],
  ['fatwa', 'فتوى', 'lah', 'فتواله'],
  ['lipase', 'ليڤاسى', 'nya', 'ليڤاسىڽ']
]) assert.strictEqual(ruleOnly.appendSuffix(latin, jawi, suffix), expected);

// Jawi input alias: some Jawi sources type ARABIC LETTER HIGH HAMZA (U+0674),
// the code point shared with the DBP "hamzah tiga suku" form, instead of the
// canonical hamzah (U+0621). Pasted text must convert exactly like the
// standard spelling — in dictionary lookups, in the fallback heuristic, and
// when the hamzah precedes Arabic digit two.
const HIGH_HAMZA = '\u0674';
const CANONICAL_HAMZA = '\u0621';
const withHighHamza = jawi => jawi.split(CANONICAL_HAMZA).join(HIGH_HAMZA);
const HAMZAH_WORDS = [
  ['ماءين', 'main'], ['باءيق', 'baik'], ['دوءيت', 'duit'], ['سوءال', 'soal'],
  ['باءو', 'bau'], ['اءير', 'air'], ['لاءوت', 'laut'], ['کاءين', 'kain'],
  ['ماءين٢', 'main-main']
];
for (const engine of [ruleOnly, optimized]) {
  for (const [canonical] of HAMZAH_WORDS) {
    const pasted = withHighHamza(canonical);
    assert.strictEqual(engine.jawiToRumi(pasted), engine.jawiToRumi(canonical));
    assert.strictEqual(engine.jawiToLatin(pasted), engine.jawiToLatin(canonical));
  }
  // Unseen words and the bare letter reach the character-level fallback with
  // the canonical letter and never leak the variant into the output.
  assert.strictEqual(engine.jawiToRumi(`زم${HIGH_HAMZA}ون`), engine.jawiToRumi(`زم${CANONICAL_HAMZA}ون`));
  assert.strictEqual(engine.jawiToLatin(HIGH_HAMZA), engine.jawiToLatin(CANONICAL_HAMZA));
}
for (const [canonical, expected] of HAMZAH_WORDS) {
  const pasted = withHighHamza(canonical);
  assert.strictEqual(optimized.jawiToLatin(pasted), expected);
  assert(!optimized.jawiToLatin(pasted).includes(HIGH_HAMZA));
}
// EXC-only spellings (absent from JAWI_TO_LATIN_AUTO) must resolve as well.
for (const [canonical, expected] of [
  ['قرءان', 'quran'], ['ستياءوسها', 'setiausaha'], ['فناء', 'fana'], ['علماء', 'ulama']
]) assert.strictEqual(optimized.jawiToLatin(withHighHamza(canonical)), expected);
// Whole sentences, spacing, and punctuation are handled by the same alias.
assert.strictEqual(
  optimized.jawiToLatin(`ساي ما${HIGH_HAMZA}ين دڠن با${HIGH_HAMZA}يق.`),
  'saya main dengan baik.'
);

// Explicit pronunciation markers: é forces taling, ě forces pepet (schwa).
// A marker outranks the engine's lexical and shape guesses, but stays
// invisible to the lexicon — a marked word still resolves to the same
// dictionary entry, PEDOMAN class, root, and affix boundary as its plain form.
const PEPET = '\u011b'; // ě
const plainE = value => value.replace(/[éě]/g, 'e');
for (const engine of [ruleOnly, optimized]) {
  // Forced pepet overrides a taling hint or shape guess...
  assert.strictEqual(engine.wordToJawi('setem'), 'سيتيم');
  assert.strictEqual(engine.wordToJawi(`s${PEPET}tem`), 'ستيم');
  assert.strictEqual(engine.wordToJawi('kereta'), 'کريتا');
  assert.strictEqual(engine.wordToJawi(`ker${PEPET}ta`), 'کرتا');
  assert.strictEqual(engine.wordToJawi('sate'), 'ساتي');
  assert.strictEqual(engine.wordToJawi(`sat${PEPET}`), 'ساتى'); // final open pepet → ى
  // ...and é still forces taling, including against a pepet hint.
  assert.strictEqual(engine.wordToJawi(`${PEPET}mas`), engine.wordToJawi('emas'));
  assert.strictEqual(engine.wordToJawi('sé'), 'سي');
  assert.strictEqual(engine.wordToJawi(`s${PEPET}`), engine.wordToJawi('se'));
  // Markers never leak into Jawi output and never change the lexicon.
  for (const word of [`s${PEPET}bab`, `ker${PEPET}ta`, `sat${PEPET}`]) {
    assert(!engine.wordToJawi(word).includes(PEPET) && !engine.wordToJawi(word).includes('é'));
  }
  assert.strictEqual(engine.wordToJawi(`s${PEPET}bab`), engine.wordToJawi('sebab'));
  assert.strictEqual(engine.wordToJawi(`m${PEPET}ngambil`), engine.wordToJawi('mengambil'));
  // Decomposed input (e + combining caron) composes to the same marker.
  assert.strictEqual(engine.wordToJawi('se\u030cbab'), engine.wordToJawi(`s${PEPET}bab`));
}
// A marker must never destroy a verified (EXC) spelling: passing over every
// dictionary key with e -> ě has to be a no-op.
for (const key of Object.keys(optimized.EXCEPTION_DICT)) {
  if (!key.includes('e')) continue;
  assert.strictEqual(
    optimized.wordToJawi(key.split('e').join(PEPET)),
    optimized.wordToJawi(key),
    `marker changed the verified spelling of ${key}`
  );
}
// Sentence-level behaviour: markers survive tokenization, joined di/ke, and
// reduplication, and the plain forms are unchanged.
assert.strictEqual(optimized.latinToJawi(`di ${PEPET}mas`), 'دأمس');
assert.strictEqual(optimized.latinToJawi(`b${PEPET}sar-b${PEPET}sar`), 'بسر٢');
assert.strictEqual(optimized.latinToJawi('setem'), 'سيتيم');
assert.strictEqual(optimized.latinToJawi('saté'), optimized.latinToJawi('sate'));
assert(!/[\u00e9\u011b]/.test(optimized.latinToJawi(`s${PEPET}tem, s${PEPET}tem`)));

// Negative tests: no optimizer may bypass the rule-first preflight or accept
// a derived-word regression just because every selected EXC key looks valid.
assert.strictEqual(assertRuleOnlyPedoman(ruleOnly), ruleTotal);
assert.throws(() => assertRuleOnlyPedoman(optimized), /empty EXC/);
assert.throws(() => assertRuleOnlyPedoman({ ...ruleOnly,
  latinToJawi: word => word === 'buku' ? 'broken' : ruleOnly.latinToJawi(word)
}), /Refusing to optimize/);
assertProtectedPedoman(optimized);
assert.throws(() => assertProtectedPedoman({ ...optimized,
  latinToJawi: word => word === 'menghajikan' ? 'broken' : optimized.latinToJawi(word)
}), /protected Pedoman/);
console.log('Subrule coverage, productive suffix rules, hamzah aliases, pronunciation markers, and optimizer safety checks passed');

// Prove that Node tooling consumes a disposable copy of the app's inline code.
const temporary = copyEngineToTemp();
try {
  if (fs.readFileSync(temporary.file, 'utf8') !== engineSource) {
    console.error('Temporary engine copy did not match the inline app source.');
    failures++;
  }
} finally {
  const directory = temporary.directory;
  temporary.cleanup();
  if (fs.existsSync(directory)) {
    console.error('Temporary engine directory was not removed.');
    failures++;
  }
}

if (fs.existsSync(path.join(root, 'jawi_converter.js'))) {
  console.error('Redundant shipped jawi_converter.js still exists.');
  failures++;
} else if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
  console.error('The standalone HTML references an external JavaScript file.');
  failures++;
} else {
  const browserContext = { window: {}, console };
  vm.runInNewContext(engineSource, browserContext, { timeout: 30000 });
  const browserEngine = browserContext.window.JawiConverter;
  const expectedExceptions = Object.keys(optimized.EXCEPTION_DICT).length;
  if (!browserEngine || Object.keys(browserEngine.EXCEPTION_DICT || {}).length !== expectedExceptions) {
    console.error('The standalone browser engine did not expose the optimized EXC dictionary.');
    failures++;
  } else if (browserEngine.latinToJawi('buku-buku') !== 'بوکو٢' ||
             browserEngine.latinToJawi('se\u0301') !== browserEngine.latinToJawi('sé') ||
             browserEngine.latinToJawi('s\u011btem') !== 'ستيم' ||
             browserEngine.jawiToLatin('سيکو') !== 'siku' ||
             browserEngine.jawiToLatin('با\u0674يق') !== 'baik' ||
             browserEngine.jawiToLatin('غاءيره') !== 'ghairah') {
    console.error('The standalone browser engine smoke test failed.');
    failures++;
  } else {
    console.log('Standalone HTML: inline source, temporary-copy adapter, and browser smoke tests passed');
  }
}

const prpmExit = require('./evaluate_prpm.js')();
if (prpmExit) failures++;
process.exitCode = failures ? 1 : 0;
