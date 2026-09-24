#!/usr/bin/env node
/**
 * Pedoman rule coverage, standalone-browser checks, and PRPM evaluation.
 * Usage: node tests/run_tests.js
 */
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
             browserEngine.jawiToLatin('سيکو') !== 'siku' ||
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
