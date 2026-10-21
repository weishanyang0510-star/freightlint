/* FreightLint. MIT licensed. Shared, dependency-free browser / Node engine. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FreightLint = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.1.0';
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_ROWS = 10000;
  const COLUMNS = {
    order_id: ['order_id', 'shipment_id', '运单号', '订单号'],
    split_id: ['split_id', '分单号'],
    origin: ['origin', '起运地', '始发地'],
    destination: ['destination', '目的地'],
    pieces: ['pieces', '件数'],
    weight_kg: ['weight_kg', '毛重kg', '重量kg', '重量(kg)', '重量（kg）'],
    volume_cbm: ['volume_cbm', '体积cbm', '体积(m3)', '体积（m³）', '体积(m³)'],
    mode: ['mode', '运输方式'],
    etd: ['etd', '预计出发日期'],
    eta: ['eta', '预计到达日期']
  };
  const REQUIRED = ['order_id', 'origin', 'destination', 'pieces', 'weight_kg', 'volume_cbm'];
  const normalizeHeader = value => value.trim().toLowerCase().replace(/\s+/g, '');
  const aliases = new Map(Object.entries(COLUMNS).flatMap(([key, values]) => values.map(v => [normalizeHeader(v), key])));
  const modes = new Set(['air', 'sea', 'road', 'rail', 'multimodal', '空运', '海运', '陆运', '铁路', '多式联运']);
  const numericFields = new Set(['pieces', 'weight_kg', 'volume_cbm']);
  const formulaLike = value => /^[\s\u0000-\u001f]*[=+@-]/u.test(String(value));
  function chooseDelimiter(text) {
    text = text.replace(/^(?:[ \t]*(?:\r\n|\r|\n))+/, '');
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
      else if (!quoted && (c === '\n' || c === '\r')) break;
      else if (!quoted && Object.hasOwn(counts, c)) counts[c]++;
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }
  function parseCSV(input, delimiter = 'auto') {
    const text = input.replace(/^\uFEFF/, '');
    if (delimiter === 'auto') delimiter = chooseDelimiter(text);
    if (![',', ';', '\t'].includes(delimiter)) throw new Error('Delimiter must be comma, semicolon or tab.');
    const rows = [];
    let cells = [], value = '', state = 'start', line = 1, rowLine = 1, touched = false;
    const error = message => { const e = new Error(message); e.line = line; throw e; };
    const pushCell = () => { cells.push(value); value = ''; state = 'start'; };
    const pushRow = () => {
      pushCell();
      if (touched || cells.some(v => v.trim() !== '')) rows.push({ cells, line: rowLine });
      cells = []; touched = false;
      if (rows.length > MAX_ROWS + 1) error(`Maximum ${MAX_ROWS} data rows.`);
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (state === 'quoted') {
        if (c === '"') {
          if (text[i + 1] === '"') { value += '"'; i++; }
          else state = 'closed';
        } else if (c === '\r' || c === '\n') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          value += '\n'; line++;
        } else value += c;
        continue;
      }
      if (c === delimiter) { touched = true; pushCell(); }
      else if (c === '\r' || c === '\n') {
        pushRow();
        if (c === '\r' && text[i + 1] === '\n') i++;
        line++; rowLine = line;
      } else if (state === 'closed') {
        error('Unexpected character after closing quote.');
      } else if (c === '"') {
        if (state !== 'start') error('Quote inside an unquoted field.');
        state = 'quoted'; touched = true;
      } else { value += c; state = 'plain'; if (c.trim()) touched = true; }
    }
    if (state === 'quoted') error('Unclosed quoted field.');
    if (touched || cells.length || value.length) pushRow();
    return { rows, delimiter };
  }
  function isDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function validateCSV(text, options = {}) {
    const issues = [];
    const result = { version: VERSION, rows: 0, errors: 0, warnings: 0, delimiter: null, columns: [], issues };
    const add = (row, field, code, severity, en, zh, value = '') => {
      issues.push({ row, field, code, severity, message: en, message_zh: zh, value });
      result[severity === 'error' ? 'errors' : 'warnings']++;
    };
    if (typeof text !== 'string') throw new TypeError('CSV input must be a string.');
    if (new TextEncoder().encode(text).length > MAX_BYTES) {
      add(0, '', 'FILE_TOO_LARGE', 'error', 'File exceeds 5 MiB.', '文件超过 5 MiB。'); return result;
    }
    if (text.includes('\uFFFD') || text.includes('\0')) {
      add(0, '', 'ENCODING', 'error', 'Save the file as UTF-8 CSV; invalid text or NUL bytes found.', '请另存为 UTF-8 CSV，文件包含乱码或空字节。'); return result;
    }
    let parsed;
    try { parsed = parseCSV(text, options.delimiter || 'auto'); }
    catch (e) { add(e.line || 0, '', 'CSV_SYNTAX', 'error', e.message, 'CSV 格式错误：请检查引号、分隔符或行数上限。'); return result; }
    result.delimiter = parsed.delimiter;
    if (parsed.rows.length === 0) {
      add(0, '', 'EMPTY_FILE', 'error', 'The file is empty.', '文件为空。'); return result;
    }
    const header = parsed.rows.shift();
    const columns = header.cells.map(v => aliases.get(normalizeHeader(v)) || null);
    result.columns = columns;
    const seenColumns = new Set();
    header.cells.forEach((name, i) => {
      const key = columns[i];
      if (!key) add(header.line, name, 'UNKNOWN_COLUMN', 'warning', 'Unrecognised column; values are not validated.', '未识别此列，不检查其业务字段规则。', name);
      else if (seenColumns.has(key)) add(header.line, key, 'DUPLICATE_COLUMN', 'error', 'Two headers map to the same field.', '两列表头对应同一个字段。', name);
      else seenColumns.add(key);
    });
    REQUIRED.filter(key => !seenColumns.has(key)).forEach(key => add(header.line, key, 'MISSING_COLUMN', 'error', 'Required column is missing.', '缺少必填列。'));
    result.rows = parsed.rows.length;
    if (!result.rows) add(header.line, '', 'NO_DATA', 'error', 'The header has no shipment rows.', '只有表头，没有运单数据。');
    if (result.errors) return result;
    const keys = new Map(), orders = new Map();
    for (const { cells, line } of parsed.rows) {
      if (cells.length !== columns.length) {
        add(line, '', 'COLUMN_COUNT', 'error', `Expected ${columns.length} columns, found ${cells.length}.`, `应有 ${columns.length} 列，实际 ${cells.length} 列。`); continue;
      }
      const data = Object.create(null);
      columns.forEach((key, i) => { if (key) data[key] = cells[i].trim(); });
      REQUIRED.forEach(key => { if (!data[key]) add(line, key, 'REQUIRED_VALUE', 'error', 'Required value is blank.', '必填值为空。'); });
      cells.forEach((value, i) => {
        if (formulaLike(value) && !(numericFields.has(columns[i]) && /^-\d+(\.\d+)?$/.test(value.trim()))) {
          add(line, columns[i] || header.cells[i], 'FORMULA_CELL', 'warning', 'Formula-like value; review before opening in a spreadsheet.', '内容类似公式，请在电子表格中打开前核实。', value);
        }
      });
      for (const key of numericFields) {
        const value = data[key];
        if (!value) continue;
        const number = Number(value);
        if (!/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(number) || number <= 0 || number > Number.MAX_SAFE_INTEGER) {
          add(line, key, 'POSITIVE_NUMBER', 'error', 'Use a positive decimal number, without units or thousands separators.', '请输入正数，不含单位或千位分隔符。', value);
        } else if (key === 'pieces' && !Number.isSafeInteger(number)) {
          add(line, key, 'INTEGER_PIECES', 'error', 'Pieces must be a whole number.', '件数必须为整数。', value);
        }
      }
      if (data.origin && data.destination && data.origin.toLowerCase() === data.destination.toLowerCase()) {
        add(line, 'destination', 'SAME_ROUTE', 'warning', 'Origin and destination are identical; confirm the route.', '起运地与目的地相同，请确认。', data.destination);
      }
      if (data.mode && !modes.has(data.mode.toLowerCase())) {
        add(line, 'mode', 'UNKNOWN_MODE', 'warning', 'Use air, sea, road, rail or multimodal (Chinese aliases also supported).', '建议填写 air、sea、road、rail、multimodal，或对应中文。', data.mode);
      }
      for (const key of ['etd', 'eta']) {
        if (data[key] && !isDate(data[key])) add(line, key, 'INVALID_DATE', 'error', 'Use a real calendar date in YYYY-MM-DD format.', '请使用有效日期，格式为 YYYY-MM-DD。', data[key]);
      }
      if (isDate(data.etd || '') && isDate(data.eta || '') && data.eta < data.etd) {
        add(line, 'eta', 'DATE_ORDER', 'error', 'Arrival is earlier than departure.', '预计到达日期早于出发日期。', data.eta);
      }
      if (data.order_id) {
        const split = data.split_id || '';
        const key = JSON.stringify([data.order_id, split]);
        if (keys.has(key)) add(line, 'order_id', 'DUPLICATE_SHIPMENT', 'error', `Shipment key duplicates line ${keys.get(key)}. Use distinct split_id values for split shipments.`, `运单键与第 ${keys.get(key)} 行重复；分单请填写不同的分单号。`, data.order_id);
        else keys.set(key, line);
        if (!orders.has(data.order_id)) orders.set(data.order_id, []);
        orders.get(data.order_id).push({ line, split });
      }
    }
    for (const [id, rows] of orders) {
      if (rows.some(r => r.split) && rows.some(r => !r.split)) {
        rows.filter(r => !r.split).forEach(r => add(r.line, 'split_id', 'MIXED_SPLITS', 'error', 'This order contains both split and unsplit rows; make the shipment keys explicit.', '同一运单混用了分单与未分单记录，请明确分单号。', id));
      }
    }
    return result;
  }
  function reportCSV(result, language = 'en') {
    const escape = value => {
      let s = String(value ?? '');
      if (formulaLike(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = [['line', 'field', 'severity', 'code', 'message', 'value'], ...result.issues.map(i => [i.row, i.field, i.severity, i.code, language === 'zh' ? i.message_zh : i.message, i.value])];
    return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
  }
  return { VERSION, MAX_BYTES, MAX_ROWS, COLUMNS, REQUIRED, parseCSV, validateCSV, reportCSV };
});
