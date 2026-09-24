#!/usr/bin/env node
/**
 * Regression checks for the Jawi converter and its standalone browser bundle.
 *
 * pedoman_cases.json keeps pinned engine outputs as regression guards and
 * reports Pedoman agreement separately as the file has known variant forms.
 * The PRPM benchmark (including the 95% bidirectional target) runs after it.
 * Usage: node tests/run_tests.js
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.join(__dirname, '..');
const jc = require(path.join(root, 'jawi_converter.js'));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'pedoman_cases.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'JawiConverter.html'), 'utf8');
const engineSource = fs.readFileSync(path.join(root, 'jawi_converter.js'), 'utf8');
const BEGIN = '<!-- BEGIN INLINE JAWI CONVERTER ENGINE -->';
const END = '<!-- END INLINE JAWI CONVERTER ENGINE -->';

let failures = 0;
let goldenOk = 0;
let pedomanOk = 0;
for (const { rumi, pedoman, golden } of cases) {
  const got = jc.wordToJawi(rumi);
  if (got === golden) goldenOk++;
  else {
    failures++;
    console.error(`FAIL ${rumi}: expected ${golden}; got ${got}`);
  }
  if (pedoman && got === pedoman) pedomanOk++;
}
console.log(`Golden regression: ${goldenOk}/${cases.length} passed`);
console.log(`Pedoman agreement (informational): ${pedomanOk}/${cases.length}`);

const begin = html.indexOf(BEGIN);
const scriptOpen = begin >= 0 ? html.indexOf('<script>', begin + BEGIN.length) : -1;
const scriptBodyStart = scriptOpen >= 0 ? scriptOpen + '<script>'.length + 1 : -1;
const scriptClose = scriptBodyStart >= 0 ? html.indexOf('</script>', scriptBodyStart) : -1;
const end = scriptClose >= 0 ? html.indexOf(END, scriptClose + '</script>'.length) : -1;
if (begin < 0 || scriptOpen < 0 || scriptClose < 0 || end < 0) {
  console.error('Standalone bundle markers/script could not be found in JawiConverter.html.');
  failures++;
} else {
  const embedded = html.slice(scriptBodyStart, scriptClose);
  if (embedded !== engineSource) {
    console.error('The HTML-embedded engine is stale; run python tools/embed_engine.py.');
    failures++;
  } else if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
    console.error('The standalone HTML still references an external JavaScript file.');
    failures++;
  } else {
    const browserContext = { window: {}, console };
    vm.runInNewContext(embedded, browserContext, { timeout: 30000 });
    const browserEngine = browserContext.window.JawiConverter;
    if (!browserEngine || Object.keys(browserEngine.EXCEPTION_DICT || {}).length !== 650) {
      console.error('The standalone browser engine did not expose the rebuilt 650-entry EXC dictionary.');
      failures++;
    } else if (browserEngine.latinToJawi('tiba-tiba') !== 'تيبا٢' ||
               browserEngine.latinToJawi('se\u0301') !== browserEngine.latinToJawi('sé') ||
               browserEngine.jawiToLatin('اڤ ٢') !== 'apa-apa' ||
               browserEngine.jawiToLatin('سيکو') !== 'siku' ||
               browserEngine.jawiToLatin('غاءيره') !== 'ghairah') {
      console.error('The standalone browser engine smoke test failed.');
      failures++;
    } else {
      console.log('Standalone HTML bundle: source parity and browser smoke test passed');
    }
  }
}

const prpmExit = require('./evaluate_prpm.js')();
if (prpmExit) failures++;
process.exitCode = failures ? 1 : 0;
