#!/usr/bin/env node
/**
 * Word-level benchmark against every non-null PRPM form in tools/prpm_cache.json.
 * The engine is extracted from JawiConverter.html to a temporary CommonJS file;
 * the app remains the single source of truth.
 */
const { loadEngine } = require('../tools/app_engine.js');
const jc = loadEngine();
const ruleOnly = loadEngine({ ruleOnly: true });
const cache = require('../tools/prpm_cache.json');

const FORMAT_CONTROLS = /[\u0080-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
function normalize(value) {
  return String(value)
    .normalize('NFC')
    .replace(FORMAT_CONTROLS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function score(engine, entries) {
  let latinToJawi = 0;
  let jawiToLatin = 0;
  const forwardErrors = [];
  const reverseErrors = [];
  for (const [latin, expectedJawi] of entries) {
    const expected = normalize(expectedJawi);
    const forward = normalize(engine.latinToJawi(latin));
    const reverse = normalize(engine.jawiToLatin(expectedJawi));
    const expectedLatin = normalize(latin.toLowerCase());
    if (forward === expected) latinToJawi++;
    else forwardErrors.push({ latin, expected, actual: forward });
    if (reverse === expectedLatin) jawiToLatin++;
    else reverseErrors.push({ latin, expected: expectedLatin, actual: reverse });
  }
  const words = entries.length;
  const forwardAccuracy = latinToJawi / words;
  const reverseAccuracy = jawiToLatin / words;
  return {
    words, latinToJawi, jawiToLatin, forwardAccuracy, reverseAccuracy,
    average: (forwardAccuracy + reverseAccuracy) / 2,
    forwardErrors, reverseErrors
  };
}

function printScore(label, result) {
  console.log(label);
  console.log(`latin2jawi: ${result.latinToJawi}/${result.words} (${(result.forwardAccuracy * 100).toFixed(2)}%)`);
  console.log(`jawi2latin: ${result.jawiToLatin}/${result.words} (${(result.reverseAccuracy * 100).toFixed(2)}%)`);
  console.log(`average: ${(result.average * 100).toFixed(2)}%`);
}

function evaluate() {
  const entries = Object.entries(cache).filter(([, jawi]) => typeof jawi === 'string' && jawi.trim());
  const baseline = score(ruleOnly, entries);
  const optimized = score(jc, entries);
  const exceptionCount = Object.keys(jc.EXCEPTION_DICT).length;
  const increment = jc.EXCEPTION_DICT_PRPM_INCREMENT || {};
  const incrementEntries = Object.entries(increment);
  const baseCount = exceptionCount - incrementEntries.length;
  const invalidIncrementEntries = incrementEntries.filter(([latin, jawi]) =>
    !cache[latin] || normalize(cache[latin]) !== normalize(jawi)
  );

  printScore('Rule-only baseline (0 EXC entries)', baseline);
  printScore('After PRPM exception optimization', optimized);
  console.log(`EXC entries: ${exceptionCount} (${baseCount} base + ${incrementEntries.length} optimized)`);

  let failures = 0;
  if (entries.length !== 4067) {
    console.error(`Expected 4,067 non-null PRPM forms; found ${entries.length}.`);
    failures++;
  }
  if (baseCount !== 0 || exceptionCount === 0 || incrementEntries.length !== exceptionCount ||
      incrementEntries.length % 50 !== 0) {
    console.error('Expected EXC to be rebuilt from zero in complete +50 steps.');
    failures++;
  }
  if (invalidIncrementEntries.length) {
    console.error(`EXC contains ${invalidIncrementEntries.length} entries not verified by the PRPM cache.`);
    failures++;
  }
  if (baseline.latinToJawi < 3236 || baseline.jawiToLatin < 3648) {
    console.error('Rule-only accuracy regressed below the audited baseline (3236 forward / 3648 reverse).');
    failures++;
  }
  if (optimized.average < 0.99) {
    console.error('Optimized average bidirectional accuracy is below the 99% target.');
    failures++;
  }

  if (process.env.SHOW_PRPM_ERRORS === '1') {
    for (const error of optimized.forwardErrors) {
      console.log(`L2J ${error.latin}: expected ${error.expected}; got ${error.actual}`);
    }
    for (const error of optimized.reverseErrors) {
      console.log(`J2L ${error.latin}: expected ${error.expected}; got ${error.actual}`);
    }
  }
  return failures ? 1 : 0;
}

module.exports = evaluate;
if (require.main === module) process.exitCode = evaluate();
