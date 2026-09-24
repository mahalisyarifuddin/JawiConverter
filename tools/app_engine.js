'use strict';

/**
 * Development adapter for the converter embedded in JawiConverter.html.
 *
 * The HTML application is the only shipped copy of the conversion engine.
 * Node-based tools copy that inline script to the operating system's temporary
 * directory before requiring it, so development code never needs a duplicate
 * jawi_converter.js source file.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_PATH = path.join(ROOT, 'JawiConverter.html');
const BEGIN = '<!-- BEGIN INLINE JAWI CONVERTER ENGINE -->';
const END = '<!-- END INLINE JAWI CONVERTER ENGINE -->';
const DECLARATION = 'const EXCEPTION_DICT_PRPM_INCREMENT = {';
const ASSIGNMENT = 'Object.assign(EXCEPTION_DICT, EXCEPTION_DICT_PRPM_INCREMENT);';

function engineRange(html) {
  const begin = html.indexOf(BEGIN);
  const scriptOpen = begin < 0 ? -1 : html.indexOf('<script>', begin + BEGIN.length);
  const bodyStart = scriptOpen < 0 ? -1 : scriptOpen + '<script>'.length;
  const scriptClose = bodyStart < 0 ? -1 : html.indexOf('</script>', bodyStart);
  const end = scriptClose < 0 ? -1 : html.indexOf(END, scriptClose + '</script>'.length);
  if (begin < 0 || scriptOpen < 0 || scriptClose < 0 || end < 0) {
    throw new Error(`Could not find the inline converter engine in ${APP_PATH}.`);
  }
  if (html.slice(scriptOpen + '<script>'.length, bodyStart) !== '') {
    throw new Error('Unexpected inline engine script layout.');
  }
  return { begin, bodyStart, scriptClose, end: end + END.length };
}

function readEngineSource() {
  const html = fs.readFileSync(APP_PATH, 'utf8');
  const range = engineRange(html);
  // The source is intentionally surrounded by one newline in the HTML block.
  return html.slice(range.bodyStart, range.scriptClose).replace(/^\n/, '').replace(/\n$/, '');
}

function writeEngineSource(source) {
  if (/<\/script/i.test(source)) {
    throw new Error('The engine contains a closing </script sequence and cannot be safely inlined.');
  }
  const html = fs.readFileSync(APP_PATH, 'utf8');
  const range = engineRange(html);
  const next = html.slice(0, range.bodyStart) + '\n' + source.replace(/\n?$/, '\n') + html.slice(range.scriptClose);
  const tempPath = `${APP_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, next, 'utf8');
  fs.renameSync(tempPath, APP_PATH);
}

function locateExceptionIncrement(source) {
  const declarationStart = source.indexOf(DECLARATION);
  if (declarationStart < 0) throw new Error('Could not find EXCEPTION_DICT_PRPM_INCREMENT.');
  const commentStart = source.lastIndexOf('// PRPM-verified', declarationStart);
  const objectStart = source.indexOf('{', declarationStart);
  const objectEnd = source.indexOf('\n};', objectStart);
  if (objectEnd < 0) throw new Error('Could not find the end of the EXC increment object.');
  const assignmentStart = source.indexOf(ASSIGNMENT, objectEnd);
  if (assignmentStart < 0) throw new Error('Could not find Object.assign for the EXC increment.');
  return {
    start: commentStart >= 0 ? commentStart : declarationStart,
    end: assignmentStart + ASSIGNMENT.length
  };
}

function withoutExceptions(source) {
  const { start, end } = locateExceptionIncrement(source);
  const empty = '// PRPM-verified EXC batch (+0; rule-only engine).\n' +
    'const EXCEPTION_DICT_PRPM_INCREMENT = {};\n' + ASSIGNMENT;
  return source.slice(0, start) + empty + source.slice(end);
}

function copyEngineToTemp({ source = readEngineSource(), ruleOnly = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jawi-converter-'));
  const file = path.join(directory, 'inline-engine.cjs');
  fs.writeFileSync(file, ruleOnly ? withoutExceptions(source) : source, 'utf8');
  return {
    directory,
    file,
    cleanup() { fs.rmSync(directory, { recursive: true, force: true }); }
  };
}

function loadEngine(options = {}) {
  const temporary = copyEngineToTemp(options);
  let resolved;
  try {
    resolved = require.resolve(temporary.file);
    delete require.cache[resolved];
    const engine = require(resolved);
    delete require.cache[resolved];
    return engine;
  } finally {
    if (resolved) delete require.cache[resolved];
    temporary.cleanup();
  }
}

module.exports = {
  APP_PATH,
  BEGIN,
  END,
  ASSIGNMENT,
  engineRange,
  readEngineSource,
  writeEngineSource,
  locateExceptionIncrement,
  withoutExceptions,
  copyEngineToTemp,
  loadEngine
};
