#!/usr/bin/env node
/**
 * Test suite for the Jawi converter.
 *
 * pedoman_cases.json carries two expectations per word:
 *   - "golden"  — the engine's pinned output (regression guard; MUST pass)
 *   - "pedoman" — the Pedoman Umum Ejaan Jawi target (informational gap count)
 *
 * Usage:    node tests/run_tests.js
 * Exit 0 when every golden case passes (CI-friendly).
 */
const path = require('path');
const fs = require('fs');

const jc = require(path.join(__dirname, '..', 'jawi_converter.js'));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'pedoman_cases.json'), 'utf8'));

let goldenOk = 0, pedomanOk = 0;
const fails = [];
for (const { rumi, pedoman, golden } of cases) {
  const got = jc.wordToJawi(rumi);
  if (got === golden) goldenOk++;
  else fails.push({ rumi, expected: golden, got });
  if (pedoman && got === pedoman) pedomanOk++;
}

console.log(`Golden regression: ${goldenOk}/${cases.length} passed`);
console.log(`Pedoman agreement (informational): ${pedomanOk}/${cases.length}`);
for (const f of fails) {
  console.log(`  FAIL ${f.rumi}  expected ${f.expected}  got ${f.got}`);
}
process.exit(fails.length ? 1 : 0);
