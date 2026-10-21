const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateCSV, parseCSV, reportCSV, MAX_BYTES } = require('../lib/freightlint.js');
const root = path.resolve(__dirname, '..');
const header = 'order_id,origin,destination,pieces,weight_kg,volume_cbm';
const valid = 'A,Shenzhen,Nairobi,2,20.5,0.3';
const check = (row = valid, h = header) => validateCSV(h + '\n' + row);
const codes = result => result.issues.map(i => i.code);

test('valid English shipments and distinct split IDs pass', () => {
  const r = validateCSV(fs.readFileSync(path.join(root, 'examples/valid.csv'), 'utf8'));
  assert.equal(r.rows, 3); assert.equal(r.errors, 0); assert.equal(r.warnings, 0);
});
test('Chinese example has seven actionable errors and two warnings', () => {
  const r = validateCSV(fs.readFileSync(path.join(root, 'examples/issues.csv'), 'utf8'));
  assert.equal(r.rows, 5); assert.equal(r.errors, 7); assert.equal(r.warnings, 2);
});
test('BOM, CRLF, quoted comma, escaped quotes, embedded newline and final delimiter', () => {
  const r = parseCSV('\uFEFFa,b,c\r\n"one,two","say ""hi""\r\nnext",\r\n');
  assert.deepEqual(r.rows, [{cells:['a','b','c'],line:1},{cells:['one,two','say "hi"\nnext',''],line:2}]);
});
test('empty physical lines are skipped while line numbers stay accurate', () => {
  const r = validateCSV(header + '\n\n' + valid + '\n\n' + valid);
  assert.equal(r.rows, 2); assert.equal(r.issues[0].row, 5); assert.match(r.issues[0].message, /line 3/);
});
test('semicolon and tab are detected without confusing quoted delimiters', () => {
  for (const d of [';', '\t']) assert.equal(validateCSV((header+'\n'+valid).replaceAll(',',d)).errors,0);
  assert.equal(parseCSV('"a,b";c\n1;2').delimiter, ';');
  assert.equal(validateCSV('\n\r\n'+(header+'\n'+valid).replaceAll(',',';')).errors,0);
});
test('malformed quotes fail closed', () => {
  for (const csv of ['a,b\n"one,two', 'a,b\n"one"oops,two', 'a,b\none"x,two']) assert.deepEqual(codes(validateCSV(csv)),['CSV_SYNTAX']);
});
test('extra or missing cells do not silently shift columns', () => {
  for (const row of [valid+',extra',valid.slice(0,-4)]) assert.ok(codes(check(row)).includes('COLUMN_COUNT'));
});
test('duplicate aliases are rejected instead of overwriting one column', () => {
  assert.ok(codes(check(valid+',B', header+',运单号')).includes('DUPLICATE_COLUMN'));
});
test('missing columns, empty files and headers without rows fail', () => {
  assert.ok(codes(validateCSV('order_id\nA')).includes('MISSING_COLUMN'));
  assert.deepEqual(codes(validateCSV(' \r\n')), ['EMPTY_FILE']);
  assert.deepEqual(codes(validateCSV(header)), ['NO_DATA']);
});
test('unknown columns are reported but preserved from accidental schema mapping', () => {
  const r = check(valid+',hello',header+',__proto__');
  assert.equal(r.errors,0); assert.deepEqual(codes(r), ['UNKNOWN_COLUMN']);
});
test('numeric fields reject negatives, units, exponent syntax, infinity, zero and grouping', () => {
  for (const n of ['-2','0','12kg','NaN','Infinity','1e3','"1,000"','9007199254740992']) {
    assert.ok(codes(check('A,S,N,2,'+n+',0.3')).includes('POSITIVE_NUMBER'), n);
  }
});
test('pieces must be integral; fractional kg and volume remain valid', () => {
  assert.ok(codes(check('A,S,N,1.5,0.5,0.002')).includes('INTEGER_PIECES'));
  assert.equal(check('A,S,N,1,0.5,0.002').errors,0);
});
test('empty required values are reported independently', () => {
  assert.equal(check('A,,,1,2,3').issues.filter(i => i.code==='REQUIRED_VALUE').length,2);
});
test('duplicate ID checks are case-sensitive and split-aware', () => {
  assert.ok(codes(check(valid+'\n'+valid)).includes('DUPLICATE_SHIPMENT'));
  assert.equal(check(valid+'\n'+valid.replace(/^A/,'a')).errors,0);
  assert.equal(check(valid+',1\n'+valid+',2',header+',split_id').errors,0);
});
test('mixed split / unsplit rows are rejected in either order', () => {
  for (const lines of [valid+',\n'+valid+',B',valid+',B\n'+valid+',']) assert.ok(codes(check(lines,header+',split_id')).includes('MIXED_SPLITS'));
});
test('date validation covers leap years, impossible dates and reversed arrival', () => {
  assert.equal(check(valid+',2028-02-29,2028-03-01',header+',etd,eta').errors,0);
  for (const d of ['2026-02-29','2026-04-31','2026-13-01','01/11/2026']) assert.ok(codes(check(valid+','+d,header+',eta')).includes('INVALID_DATE'));
  assert.ok(codes(check(valid+',2026-11-05,2026-11-01',header+',etd,eta')).includes('DATE_ORDER'));
});
test('optional dates and transport mode may be absent', () => {
  assert.equal(check(valid+',,,',header+',mode,etd,eta').errors,0);
});
test('formula-like content is flagged and CSV report neutralises cells', () => {
  const r = check('=1+1,S,N,1,2,3');
  assert.ok(codes(r).includes('FORMULA_CELL'));
  const exported = parseCSV(reportCSV(r)).rows;
  assert.equal(exported[1].cells[5], "'=1+1");
  assert.equal(parseCSV(reportCSV({issues:[{row:1,field:'x',severity:'warning',code:'X',message:'test',value:' \t@SUM(1)'}]})).rows[1].cells[5], "' \t@SUM(1)");
});
test('untrusted HTML remains literal report data', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const r = check(payload+',S,N,1,2,3\n'+payload+',S,N,1,2,3');
  assert.equal(r.issues[0].value,payload);
  assert.ok(reportCSV(r).includes(payload));
});
test('input is not mutated; report generation is deterministic', () => {
  const input = header+'\n'+valid+'\n'+valid;
  assert.deepEqual(validateCSV(input),validateCSV(input));
  assert.equal(input,header+'\n'+valid+'\n'+valid);
});
test('file size, encoding and row limits fail safely', () => {
  assert.deepEqual(codes(validateCSV('a'.repeat(MAX_BYTES+1))), ['FILE_TOO_LARGE']);
  assert.deepEqual(codes(validateCSV(header+'\n\uFFFD')), ['ENCODING']);
  assert.deepEqual(codes(validateCSV(header+'\n\0')), ['ENCODING']);
  assert.deepEqual(codes(validateCSV(header+'\n'+(valid+'\n').repeat(10001))), ['CSV_SYNTAX']);
});
test('CLI returns machine-readable JSON and meaningful exit codes', () => {
  const run = args => spawnSync(process.execPath,['bin/freightlint.cjs',...args],{cwd:root,encoding:'utf8'});
  let r = run(['examples/valid.csv','--json']); assert.equal(r.status,0); assert.equal(JSON.parse(r.stdout).rows,3);
  r = run(['examples/issues.csv','--json']); assert.equal(r.status,1); assert.equal(JSON.parse(r.stdout).errors,7);
  assert.equal(run(['missing.csv']).status,2); assert.equal(run(['--unknown']).status,2);
  assert.equal(run(['--help']).status,0);
});
