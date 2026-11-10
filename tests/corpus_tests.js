#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  normalizeJawi,
  normalizeRumi,
  alignment,
  parseCsv,
  evaluateRows
} = require('../tools/corpus.js');

assert.strictEqual(normalizeJawi(' باٴيق\u200F '), 'باءيق');
assert.strictEqual(normalizeJawi('ك ڬ پ'), 'ک ݢ ڽ');
assert.strictEqual(normalizeRumi('  A\n B  '), 'a b');
assert.deepStrictEqual(alignment(['a', 'b'], ['a', 'x']), {
  substitutions: 1, deletions: 0, insertions: 0, edits: 1
});
assert.deepStrictEqual(alignment(['a', 'b'], []), {
  substitutions: 0, deletions: 2, insertions: 0, edits: 2
});
assert.deepStrictEqual(alignment([], ['a', 'b']), {
  substitutions: 0, deletions: 0, insertions: 2, edits: 2
});
const csv = parseCsv('text,latin_text\r\n"سطر\nجديد","satu\r\ndua"\r\n');
assert.strictEqual(csv.length, 1);
assert.strictEqual(csv[0].latin_text, 'satu\r\ndua');
const result = evaluateRows({
  RULE_VERSION: 'test',
  jawiToLatin: () => 'a x c'
}, [{ text: 'ignored', latin_text: 'A b c' }]);
assert.strictEqual(result.wer, 1 / 3);
assert.strictEqual(result.substitutions, 1);
assert.strictEqual(result.referenceWords, 3);
assert.strictEqual(result.sentences, 1);
console.log('Corpus loading, normalization, alignment, and WER self-tests passed');
