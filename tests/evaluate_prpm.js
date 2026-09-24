#!/usr/bin/env node
/**
 * Word-level benchmark against every non-null PRPM form in tools/prpm_cache.json.
 * Accuracy is the arithmetic mean of Latin -> Jawi and Jawi -> Latin exact
 * match rates. NFC and invisible copy/paste controls are normalized; spelling,
 * spaces, and Jawi letters are otherwise compared as supplied by PRPM.
 */
const fs = require('fs');
const path = require('path');
const jc = require(path.join(__dirname, '..', 'jawi_converter.js'));
const cache = require(path.join(__dirname, '..', 'tools', 'prpm_cache.json'));

const FORMAT_CONTROLS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
function normalize(value) {
  return String(value)
    .normalize('NFC')
    .replace(FORMAT_CONTROLS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function evaluate() {
  const entries = Object.entries(cache).filter(([, jawi]) => typeof jawi === 'string' && jawi.trim());
  let latinToJawi = 0;
  let jawiToLatin = 0;
  const forwardErrors = [];
  const reverseErrors = [];

  for (const [latin, expectedJawi] of entries) {
    const expected = normalize(expectedJawi);
    const forward = normalize(jc.latinToJawi(latin));
    const reverse = normalize(jc.jawiToLatin(expectedJawi));
    const expectedLatin = normalize(latin.toLowerCase());

    if (forward === expected) latinToJawi++;
    else forwardErrors.push({ latin, expected, actual: forward });

    if (reverse === expectedLatin) jawiToLatin++;
    else reverseErrors.push({ latin, expected: expectedLatin, actual: reverse });
  }

  const total = entries.length;
  const forwardAccuracy = latinToJawi / total;
  const reverseAccuracy = jawiToLatin / total;
  const average = (forwardAccuracy + reverseAccuracy) / 2;
  const exceptionCount = Object.keys(jc.EXCEPTION_DICT).length;
  const increment = jc.EXCEPTION_DICT_PRPM_INCREMENT || {};
  const incrementEntries = Object.entries(increment);
  const baseCount = exceptionCount - incrementEntries.length;
  const invalidIncrementEntries = incrementEntries.filter(([latin, jawi]) =>
    !cache[latin] || normalize(cache[latin]) !== normalize(jawi)
  );

  console.log(`PRPM word forms: ${total}`);
  console.log(`latin2jawi: ${latinToJawi}/${total} (${(forwardAccuracy * 100).toFixed(2)}%)`);
  console.log(`jawi2latin: ${jawiToLatin}/${total} (${(reverseAccuracy * 100).toFixed(2)}%)`);
  console.log(`average: ${(average * 100).toFixed(2)}%`);
  console.log(`EXC entries: ${exceptionCount} (${baseCount} base + ${incrementEntries.length} added)`);

  let failures = 0;
  if (total !== 4056) {
    console.error(`Expected 4,056 non-null PRPM forms; found ${total}.`);
    failures++;
  }
  if (incrementEntries.length !== 650 || baseCount !== 0 || exceptionCount !== 650 || incrementEntries.length % 50 !== 0) {
    console.error('Expected EXC to be rebuilt from zero in +50 steps, stopping at 650 entries.');
    failures++;
  }
  if (invalidIncrementEntries.length) {
    console.error(`EXC increment contains ${invalidIncrementEntries.length} entries not verified by the PRPM cache.`);
    failures++;
  }
  if (average < 0.95) {
    console.error('Average bidirectional accuracy is below the 95% target.');
    failures++;
  }

  if (process.env.SHOW_PRPM_ERRORS === '1') {
    for (const error of forwardErrors) {
      console.log(`L2J ${error.latin}: expected ${error.expected}; got ${error.actual}`);
    }
    for (const error of reverseErrors) {
      console.log(`J2L ${error.latin}: expected ${error.expected}; got ${error.actual}`);
    }
  }
  return failures ? 1 : 0;
}

module.exports = evaluate;
if (require.main === module) process.exitCode = evaluate();
