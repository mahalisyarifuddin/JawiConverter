'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CONTROLS = /[\u0080-\u009F\u00AD\u0640\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

function normalizeJawi(value) {
  return String(value).normalize('NFC')
    .replace(/[ٴ؞]/g, 'ء').replace(/ك/g, 'ک').replace(/ڬ/g, 'ݢ').replace(/پ/g, 'ڽ')
    .replace(CONTROLS, '').replace(/\s+/gu, ' ').trim();
}
function normalizeRumi(value) {
  return String(value).normalize('NFC').toLowerCase()
    .replace(CONTROLS, '').replace(/\s+/gu, ' ').trim();
}
function normalize(value, direction) {
  return direction === 'lj' ? normalizeJawi(value) : normalizeRumi(value);
}
function words(value) {
  const text = String(value).trim();
  return text ? text.split(/\s+/u) : [];
}

/** Levenshtein alignment with corpus-WER operation counts. */
function alignment(reference, hypothesis) {
  const rows = reference.length + 1, columns = hypothesis.length + 1;
  const dp = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < columns; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < columns; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1),
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1
      );
    }
  }
  let i = reference.length, j = hypothesis.length;
  let substitutions = 0, deletions = 0, insertions = 0;
  while (i || j) {
    if (i && j && dp[i][j] === dp[i - 1][j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1)) {
      if (reference[i - 1] !== hypothesis[j - 1]) substitutions++;
      i--; j--;
    } else if (i && dp[i][j] === dp[i - 1][j] + 1) {
      deletions++; i--;
    } else {
      insertions++; j--;
    }
  }
  return { substitutions, deletions, insertions, edits: substitutions + deletions + insertions };
}

function validateRows(rows, source) {
  if (!Array.isArray(rows) || !rows.length) throw new Error(`No corpus rows found in ${source}`);
  return rows.map((row, index) => {
    if (!row || typeof row.text !== 'string' || typeof row.latin_text !== 'string') {
      throw new Error(`${source} row ${index} must contain string fields text and latin_text`);
    }
    return row;
  });
}

function parseCsv(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const ch = i < text.length ? text[i] : '\n';
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && !field) quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value !== '')) records.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  const headers = records.shift();
  if (!headers) return [];
  return records.map(values => Object.fromEntries(headers.map((header, i) => [header, values[i] || ''])));
}

function loadCorpus(filePath) {
  const resolved = path.resolve(filePath);
  const extension = path.extname(resolved).toLowerCase();
  let text;
  if (extension === '.parquet') {
    const script = path.join(__dirname, 'parquet_to_jsonl.py');
    const converted = spawnSync('python3', [script, resolved], {
      encoding: 'utf8', maxBuffer: 512 * 1024 * 1024
    });
    if (converted.error) throw converted.error;
    if (converted.status !== 0) throw new Error(converted.stderr.trim() || 'Parquet conversion failed');
    text = converted.stdout;
  } else {
    text = fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
  }
  let rows;
  if (extension === '.json') {
    const parsed = JSON.parse(text);
    rows = Array.isArray(parsed) ? parsed : parsed.data;
  } else if (extension === '.csv') rows = parseCsv(text);
  else rows = text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  return validateRows(rows, resolved);
}

function resolveCorpus(corpusPath, split) {
  const resolved = path.resolve(corpusPath);
  if (!fs.statSync(resolved).isDirectory()) return resolved;
  for (const extension of ['parquet', 'jsonl', 'json', 'csv']) {
    const candidate = path.join(resolved, `${split || 'test'}.${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`No ${split || 'test'}.{parquet,jsonl,json,csv} found in ${resolved}`);
}

function evaluateRows(engine, rows, options = {}) {
  const direction = options.direction || 'jl';
  if (!['jl', 'lj'].includes(direction)) throw new Error('Direction must be jl or lj');
  const offset = options.offset || 0;
  const selected = rows.slice(offset, options.limit ? offset + options.limit : undefined);
  const totals = {
    schemaVersion: 1,
    engineVersion: engine.RULE_VERSION || 'unknown',
    direction,
    sentences: selected.length,
    referenceWords: 0,
    substitutions: 0,
    deletions: 0,
    insertions: 0,
    edits: 0,
    exactSentences: 0
  };
  const errors = [];
  selected.forEach((row, index) => {
    const input = direction === 'jl' ? row.text : row.latin_text;
    const reference = normalize(direction === 'jl' ? row.latin_text : row.text, direction);
    const hypothesis = normalize(direction === 'jl' ? engine.jawiToLatin(input) : engine.latinToJawi(input), direction);
    const counts = alignment(words(reference), words(hypothesis));
    totals.referenceWords += words(reference).length;
    for (const key of ['substitutions', 'deletions', 'insertions', 'edits']) totals[key] += counts[key];
    if (reference === hypothesis) totals.exactSentences++;
    else if (options.collectErrors && errors.length < (options.errorLimit ?? 100)) {
      errors.push({ index: offset + index, reference, hypothesis, ...counts });
    }
  });
  totals.wer = totals.referenceWords ? totals.edits / totals.referenceWords : null;
  totals.sentenceExactMatch = totals.sentences ? totals.exactSentences / totals.sentences : null;
  if (options.collectErrors) totals.errors = errors;
  return totals;
}

function evaluatePath(corpusPath, options = {}) {
  const resolved = resolveCorpus(corpusPath, options.split);
  let rows = loadCorpus(resolved);
  if (options.split && rows.some(row => typeof row.split === 'string')) {
    rows = rows.filter(row => row.split === options.split);
  }
  const { loadEngine } = require('./app_engine.js');
  const result = evaluateRows(options.engine || loadEngine(), rows, options);
  result.corpusFile = path.basename(resolved);
  if (options.split) result.split = options.split;
  if (options.offset) result.offset = options.offset;
  if (options.limit) result.limit = options.limit;
  return result;
}

module.exports = {
  normalizeJawi,
  normalizeRumi,
  alignment,
  parseCsv,
  loadCorpus,
  resolveCorpus,
  evaluateRows,
  evaluatePath
};
