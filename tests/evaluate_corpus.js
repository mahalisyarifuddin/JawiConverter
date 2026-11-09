#!/usr/bin/env node
'use strict';

/**
 * Evaluate sentence-level micro-WER on an external aligned corpus.
 * No Utusan text is bundled. See docs/EVALUATION.md.
 */
const fs = require('fs');
const path = require('path');
const { evaluatePath } = require('../tools/corpus.js');

function usage() {
  console.log(`Usage:
  node tests/evaluate_corpus.js --corpus PATH [options]

Options:
  --split train|validation|test  Split to select from a directory or split field (default: test)
  --direction jl|lj             Jawi→Rumi (jl, default) or Rumi→Jawi (lj)
  --offset N                    Skip N aligned rows
  --limit N                     Evaluate at most N rows
  --output FILE                 Save metrics JSON
  --errors FILE                 Include up to --error-limit sentence errors in this separate report
  --error-limit N               Maximum saved errors (default: 100)

PATH may be a JSONL, JSON, CSV, or Parquet file, or a directory containing
SPLIT.parquet/jsonl/json/csv. Parquet conversion requires Python and pyarrow.
WER = (substitutions + deletions + insertions) / reference words, aggregated
over the corpus. Rumi scoring is case-folded; Unicode aliases and whitespace
are normalized, while punctuation attached to whitespace tokens is preserved.`);
}

function argumentsFrom(argv) {
  const options = { split: 'test', direction: 'jl', errorLimit: 100 };
  let corpus = process.env.UTUSAN_CORPUS || '';
  let output = '', errors = '';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i], value = argv[++i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (!value && arg !== '--help') throw new Error(`Missing value for ${arg}`);
    if (arg === '--corpus') corpus = value;
    else if (arg === '--split') options.split = value;
    else if (arg === '--direction') options.direction = value;
    else if (arg === '--offset') options.offset = Number(value);
    else if (arg === '--limit') options.limit = Number(value);
    else if (arg === '--error-limit') options.errorLimit = Number(value);
    else if (arg === '--output') output = value;
    else if (arg === '--errors') errors = value;
    else throw new Error(`Unknown option: ${arg}`);
  }
  for (const key of ['offset', 'limit', 'errorLimit']) {
    if (options[key] !== undefined && (!Number.isInteger(options[key]) || options[key] < 0)) {
      throw new Error(`--${key.toLowerCase()} must be a non-negative integer`);
    }
  }
  return { corpus, output, errors, options };
}

function main(argv = process.argv.slice(2)) {
  const args = argumentsFrom(argv);
  if (args.help || !args.corpus) { usage(); return args.help ? 0 : 2; }
  args.options.collectErrors = Boolean(args.errors);
  const result = evaluatePath(args.corpus, args.options);
  const { errors, ...metrics } = result;
  console.log(JSON.stringify(metrics, null, 2));
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(args.output, JSON.stringify(metrics, null, 2) + '\n');
  }
  if (args.errors) {
    fs.mkdirSync(path.dirname(path.resolve(args.errors)), { recursive: true });
    fs.writeFileSync(args.errors, JSON.stringify({ ...metrics, errors }, null, 2) + '\n');
  }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { evaluatePath, argumentsFrom, main };
