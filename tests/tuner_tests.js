#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { sample, candidates, better, updateSource, parse } = require('../tools/tune_rules.js');

assert.deepStrictEqual(sample([0, 1, 2, 3, 4], 2), [0, 2]);
assert.deepStrictEqual(sample([0, 1], 0), [0, 1]);
assert(candidates(false).includes(true));
assert(candidates(1).includes(0));
assert(better({ wer: 0.1, exactSentences: 0 }, { wer: 0.2, exactSentences: 10 }));
assert(!better({ wer: 0.2, exactSentences: 10 }, { wer: 0.1, exactSentences: 0 }));
const tuned = updateSource('const TUNE = { insertA:0.8, finalA:1 };\nconst FORWARD_TUNE = { openNonFinal:false };', 'jl', { insertA: 0.5, finalA: 0 });
assert(tuned.includes('insertA:0.5'));
assert(tuned.includes('finalA:0'));
const forward = updateSource('const FORWARD_TUNE = { openNonFinal:false, closedFinalAll:false };', 'lj', { openNonFinal: true });
assert(forward.includes('openNonFinal:true'));
assert.throws(() => parse(['--train', 'a', '--validation', 'b', '--test', 'c']), /Unknown option/);
console.log('Tuner sampling, objective, source-update, and test-isolation checks passed');
