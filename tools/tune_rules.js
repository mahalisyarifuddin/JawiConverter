#!/usr/bin/env node
'use strict';

/** Coordinate-descent rule-cost tuner. Test data is deliberately not accepted. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadEngine, readEngineSource, writeEngineSource, APP_PATH } = require('./app_engine.js');
const { loadCorpus, resolveCorpus, evaluateRows } = require('./corpus.js');

function usage() {
  console.log(`Usage:
  node tools/tune_rules.js --train TRAIN --validation VALIDATION [options]

Options:
  --direction jl|lj       Jawi→Rumi costs (default) or forward boolean rules
  --passes N              Coordinate passes (default: 1)
  --train-limit N         Evenly spaced training sentences; 0 = all (default: 200)
  --validation-limit N    Evenly spaced validation sentences; 0 = all (default: 200)
  --parameter NAME        Restrict tuning to one parameter (repeatable)
  --write                 Write only after validation improves and all regressions pass
  --report FILE           JSON report (default: artifacts/tuning-report.json)

TRAIN and VALIDATION may be corpus files or directories. The tuner never accepts
or opens a test split. It performs local coordinate descent, not a proof of a
global optimum. Use --train-limit 0 --validation-limit 0 for final full-split runs.`);
}

function parse(argv) {
  const options = {
    direction: 'jl', passes: 1, trainLimit: 200, validationLimit: 200,
    parameters: [], report: 'artifacts/tuning-report.json', write: false
  };
  let train = '', validation = '';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--write') { options.write = true; continue; }
    const value = argv[++i];
    if (!value) throw new Error(`Missing value for ${arg}`);
    if (arg === '--train') train = value;
    else if (arg === '--validation') validation = value;
    else if (arg === '--direction') options.direction = value;
    else if (arg === '--passes') options.passes = Number(value);
    else if (arg === '--train-limit') options.trainLimit = Number(value);
    else if (arg === '--validation-limit') options.validationLimit = Number(value);
    else if (arg === '--parameter') options.parameters.push(value);
    else if (arg === '--report') options.report = value;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!train || !validation) throw new Error('--train and --validation are required');
  if (!['jl', 'lj'].includes(options.direction)) throw new Error('Direction must be jl or lj');
  for (const key of ['passes', 'trainLimit', 'validationLimit']) {
    if (!Number.isInteger(options[key]) || options[key] < (key === 'passes' ? 1 : 0)) {
      throw new Error(`${key} has an invalid value`);
    }
  }
  return { train, validation, options };
}

function splitRows(filePath, split) {
  const resolved = resolveCorpus(filePath, split);
  let rows = loadCorpus(resolved);
  if (rows.some(row => typeof row.split === 'string')) rows = rows.filter(row => row.split === split);
  if (!rows.length) throw new Error(`No ${split} rows in ${resolved}`);
  return { file: resolved, rows };
}
function sample(rows, limit) {
  if (!limit || limit >= rows.length) return rows;
  return Array.from({ length: limit }, (_, i) => rows[Math.floor(i * rows.length / limit)]);
}
function parameters(engine, direction, requested) {
  const space = direction === 'jl' ? 'TUNE' : 'FORWARD_TUNE';
  const excluded = new Set(['beam', 'shortlist']);
  const names = Object.keys(engine[space]).filter(key =>
    !excluded.has(key) && ['number', 'boolean'].includes(typeof engine[space][key]));
  if (requested.length) {
    for (const key of requested) if (!names.includes(key)) throw new Error(`Unknown tunable parameter: ${key}`);
    return requested;
  }
  return names;
}
function candidates(value) {
  if (typeof value === 'boolean') return [false, true];
  /* Zero is not a one-sided boundary: a negative cost can encode a general
   * preference (for example, a restored final vowel) just as a positive cost
   * encodes a penalty. Keep the grid small enough for full-split searches. */
  const values = value === 0 ? [-1, -0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5, 1] :
    [0, value * 0.5, value * 0.75, value, value * 1.25, value * 1.5, value * 2];
  return [...new Set(values.map(number => Number(number.toFixed(6))))];
}
function score(engine, rows, direction) {
  return evaluateRows(engine, rows, { direction });
}
function better(candidate, incumbent) {
  return candidate.wer < incumbent.wer - 1e-12 ||
    (Math.abs(candidate.wer - incumbent.wer) < 1e-12 && candidate.exactSentences > incumbent.exactSentences);
}

function updateSource(source, direction, values) {
  const space = direction === 'jl' ? 'TUNE' : 'FORWARD_TUNE';
  const start = source.indexOf(`const ${space} = {`);
  const end = source.indexOf('};', start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${space}`);
  let block = source.slice(start, end);
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`(\\b${key}\\s*:\\s*)(?:true|false|-?\\d+(?:\\.\\d+)?)`);
    if (!pattern.test(block)) throw new Error(`Could not update ${space}.${key}`);
    block = block.replace(pattern, `$1${String(value)}`);
  }
  return source.slice(0, start) + block + source.slice(end);
}

function run(args) {
  const train = splitRows(args.train, 'train');
  const validation = splitRows(args.validation, 'validation');
  const options = args.options;
  const trainRows = sample(train.rows, options.trainLimit);
  const validationRows = sample(validation.rows, options.validationLimit);
  const engine = loadEngine();
  const space = options.direction === 'jl' ? 'TUNE' : 'FORWARD_TUNE';
  const names = parameters(engine, options.direction, options.parameters);
  const initial = Object.fromEntries(names.map(key => [key, engine[space][key]]));
  let current = { ...initial };
  let trainScore = score(engine, trainRows, options.direction);
  let validationScore = score(engine, validationRows, options.direction);
  const baseline = { train: trainScore, validation: validationScore };
  const history = [];

  for (let pass = 0; pass < options.passes; pass++) {
    const passStart = { ...current };
    const passStartTrain = trainScore, passStartValidation = validationScore;
    let changed = false;
    for (const key of names) {
      let bestValue = current[key], bestScore = trainScore;
      for (const value of candidates(initial[key])) {
        Object.assign(engine[space], current, { [key]: value });
        const candidate = score(engine, trainRows, options.direction);
        if (better(candidate, bestScore)) {
          bestValue = value; bestScore = candidate;
        }
      }
      if (bestValue !== current[key]) {
        current[key] = bestValue; trainScore = bestScore; changed = true;
        console.log(`pass ${pass + 1}: ${key}=${bestValue}; train WER=${trainScore.wer}`);
      }
    }
    Object.assign(engine[space], current);
    validationScore = score(engine, validationRows, options.direction);
    const accepted = changed && better(validationScore, passStartValidation);
    history.push({
      pass: pass + 1, parameters: { ...current }, train: trainScore,
      validation: validationScore, accepted
    });
    if (!accepted) {
      current = passStart; trainScore = passStartTrain; validationScore = passStartValidation;
      Object.assign(engine[space], current);
      console.log(`pass ${pass + 1}: rejected by validation`);
    } else console.log(`pass ${pass + 1}: accepted; validation WER=${validationScore.wer}`);
  }

  const improved = better(validationScore, baseline.validation) && !better(baseline.train, trainScore);
  const report = {
    schemaVersion: 1,
    objective: 'sentence-level micro-WER',
    method: 'train-selected coordinate descent with validation acceptance',
    direction: options.direction,
    engineVersion: engine.RULE_VERSION,
    trainCorpus: path.basename(train.file),
    validationCorpus: path.basename(validation.file),
    trainSentences: trainRows.length,
    validationSentences: validationRows.length,
    initialParameters: initial,
    finalParameters: current,
    baseline,
    final: { train: trainScore, validation: validationScore },
    history,
    improved,
    testSplitUsed: false,
    globalOptimalityClaimed: false
  };

  if (options.write && improved) {
    const original = readEngineSource();
    try {
      writeEngineSource(updateSource(original, options.direction, current));
      const env = { ...process.env };
      delete env.UTUSAN_TEST_CORPUS;
      const checked = spawnSync(process.execPath, ['tests/run_tests.js'], {
        cwd: path.join(__dirname, '..'), env, stdio: 'inherit'
      });
      if (checked.status !== 0) throw new Error('Regression suite rejected the tuned parameters');
      report.writtenTo = path.basename(APP_PATH);
    } catch (error) {
      writeEngineSource(original);
      throw error;
    }
  }
  const reportPath = path.resolve(options.report);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ improved, finalParameters: current,
    trainWER: trainScore.wer, validationWER: validationScore.wer, report: options.report }, null, 2));
  return report;
}

if (require.main === module) {
  try {
    const args = parse(process.argv.slice(2));
    if (args.help) usage();
    else run(args);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { parse, sample, candidates, better, updateSource, run };
