#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const { validateCSV, MAX_BYTES, VERSION } = require('../lib/freightlint.js');
const args = process.argv.slice(2);
if (args.includes('--help') || !args.length) {
  console.log('FreightLint ' + VERSION + '\nUsage: node bin/freightlint.cjs <file.csv> [--json] [--strict]\nExit 0: passed; 1: validation errors (or warnings with --strict); 2: usage / file error.');
  process.exit(args.length ? 0 : 2);
}
const flags = args.filter(a => a.startsWith('--'));
const files = args.filter(a => !a.startsWith('--'));
if (files.length !== 1 || flags.some(a => !['--json', '--strict'].includes(a))) {
  console.error('Invalid arguments. Use --help.'); process.exit(2);
}
try {
  if (fs.statSync(files[0]).size > MAX_BYTES) throw new Error('File exceeds 5 MiB.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(files[0]));
  const result = validateCSV(text);
  if (flags.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`FreightLint: ${result.rows} rows | ${result.errors} errors | ${result.warnings} warnings`);
    for (const i of result.issues) console.log(`${i.severity.toUpperCase()} line ${i.row} [${i.field || 'file'}] ${i.code}: ${i.message}`);
  }
  process.exitCode = result.errors || (flags.includes('--strict') && result.warnings) ? 1 : 0;
} catch (e) { console.error('FreightLint: ' + e.message); process.exitCode = 2; }
