'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let language = 'zh', report = null, revision = 0, inputSource = 'local', inputName = '';
  const zh = {};
  document.querySelectorAll('[data-i18n]').forEach(el => { zh[el.dataset.i18n] = el.innerHTML; });
  const en = {
    docs:'Documentation', title:'Catch the errors.<br>Then move the freight.', lede:'Check duplicate shipments, missing fields, numbers and dates before import.', privacy:'Your files stay on your device<br>No account · No API · No running costs', limit:'UTF-8 CSV · Up to 5 MiB / 10,000 rows', inputTitle:'Start with your shipment list', drop:'Drop a CSV file here', choose:'Choose file', local:'Read on this device only', paste:'Or paste your CSV below', demo:'Try a sample with issues ↗', inputHelp:'English and Chinese headers. Comma, semicolon and tab delimiters.', check:'Check shipments →', template:'Download valid template', clear:'Clear', rulesTitle:'Small checks. Fewer surprises.', rule1:'Unique shipment keys', rule1b:'Detect duplicate order + split IDs while allowing legitimate split shipments.', rule2:'Numbers with clear units', rule2b:'Whole positive pieces. Weight in kg, volume in m³. All greater than zero.', rule3:'Dates that make sense', rule3b:'Real calendar dates, with arrival on or after departure.', schema:'View column rules', required:'Required: order_id, origin, destination, pieces, weight_kg, volume_cbm.', optional:'Optional: split_id, mode, etd, eta. Dates use YYYY-MM-DD.', boundary:'Basic data checks, not carrier validation or a replacement for human review. One row per shipment or split. Aggregate item-level lists first.', exportCSV:'Export issues CSV', exportJSON:'Export JSON', filter:'Show', all:'All issues', errors:'Errors', warnings:'Warnings', lineHelp:'Line numbers refer to physical file lines; 0 means the whole file.', line:'Line', severity:'Level', field:'Field', problem:'Issue & next step', value:'Original value', empty:'No issues match this filter.', reportNote:'Reports may contain shipment IDs and original values. Handle them as business data. Your original file is never changed.', footer:'A small checkpoint for small teams. English + 中文 · Browser + CLI'
  };
  const demo = '运单号,分单号,起运地,目的地,件数,重量kg,体积cbm,运输方式,预计出发日期,预计到达日期\nDEMO-001,,深圳,达累斯萨拉姆,12,680,3.2,海运,2026-11-01,2026-11-25\nDEMO-001,,深圳,达累斯萨拉姆,12,680,3.2,海运,2026-11-01,2026-11-25\nDEMO-003,,上海,内罗毕,2.5,-20,0.8,空运,2026-11-08,2026-11-05\nDEMO-004,,广州,,3,80,0,陆运,2026-02-30,2026-11-08\nDEMO-005,,宁波,宁波,5,120,1.2,快递,2026-11-05,2026-11-08';
  const t = (cn, english) => language === 'zh' ? cn : english;
  function invalidate() { revision++; report = null; $('results').hidden = true; $('notice').textContent = ''; }
  function render() {
    if (!report) return;
    $('results').hidden = false;
    $('row-count').textContent = t(`${report.rows} 行已检查`, `${report.rows} rows checked`);
    $('result-title').textContent = report.errors ? t('先修正这些问题，再导入。', 'Resolve these issues before import.') : report.warnings ? t('没有错误，还有几处需要确认。', 'No errors. A few things to confirm.') : t('这份清单通过了基础检查。', 'This list passed the basic checks.');
    $('result-summary').textContent = t(`${report.errors} 个错误 · ${report.warnings} 个提醒。通过检查不代表数据已获承运人确认。`, `${report.errors} errors · ${report.warnings} warnings. Passing these checks does not imply carrier approval.`);
    const shown = report.issues.filter(i => $('filter').value === 'all' || i.severity === $('filter').value);
    $('issues').replaceChildren();
    for (const issue of shown.slice(0, 500)) {
      const row = document.createElement('tr');
      const values = [issue.row, '', issue.field || t('文件', 'file'), '', issue.value];
      for (const value of values) { const td = document.createElement('td'); td.textContent = value; row.append(td); }
      const badge = document.createElement('span'); badge.className = 'badge ' + issue.severity;
      badge.textContent = issue.severity === 'error' ? t('错误','Error') : t('提醒','Warning'); row.children[1].append(badge);
      const message = document.createElement('span'); message.textContent = language === 'zh' ? issue.message_zh : issue.message;
      const code = document.createElement('span'); code.className = 'code'; code.textContent = issue.code;
      row.children[3].append(message, code); $('issues').append(row);
    }
    $('empty-filter').hidden = shown.length !== 0;
    $('notice').textContent = shown.length > 500 ? t('页面显示前 500 条问题，下载报告可查看全部。', 'Showing the first 500 issues. Download the full report for all issues.') : '';
  }
  function check() { report = FreightLint.validateCSV($('csv').value); $('filter').value = 'all'; render(); }
  async function readFile(file) {
    if (!file) return;
    invalidate();
    const requestRevision = revision;
    inputSource = 'file'; inputName = file.name;
    $('csv').value = ''; $('filename').textContent = inputName;
    if (file.size > FreightLint.MAX_BYTES) { $('notice').textContent = t('文件超过 5 MiB，请拆分后再试。', 'File exceeds 5 MiB. Split it and try again.'); return; }
    try {
      const buffer = await file.arrayBuffer();
      if (revision !== requestRevision) return;
      $('csv').value = new TextDecoder('utf-8', {fatal:true}).decode(buffer);
      check();
    } catch (_) {
      if (revision === requestRevision) $('notice').textContent = t('读取失败。请将文件另存为 UTF-8 CSV，暂不支持 XLSX。', 'Could not read this file. Save as UTF-8 CSV; XLSX is not supported.');
    }
  }
  function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], {type}));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('language').addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh'; document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = language === 'zh' ? 'FreightLint · 货运表格检查' : 'FreightLint · Freight CSV checker';
    document.querySelectorAll('[data-i18n]').forEach(el => { if (el.id !== 'filename') el.innerHTML = (language === 'zh' ? zh : en)[el.dataset.i18n]; });
    $('filename').textContent = inputSource === 'file' ? inputName : inputSource === 'sample' ? t('虚构问题示例', 'Synthetic sample') : t('仅在本机读取', 'Read on this device only');
    $('language').textContent = language === 'zh' ? 'English' : '中文'; render();
  });
  $('csv').addEventListener('input', invalidate);
  $('file').addEventListener('change', e => readFile(e.target.files[0]));
  $('check').addEventListener('click', check);
  $('demo').addEventListener('click', () => { invalidate(); inputSource = 'sample'; $('csv').value = demo; $('file').value = ''; $('filename').textContent = t('虚构问题示例', 'Synthetic sample'); check(); });
  $('clear').addEventListener('click', () => { invalidate(); inputSource = 'local'; $('csv').value = ''; $('file').value = ''; $('filename').textContent = t('仅在本机读取','Read on this device only'); $('csv').focus(); });
  $('filter').addEventListener('change', render);
  $('export-csv').addEventListener('click', () => { if (report) download(FreightLint.reportCSV(report, language), 'freightlint-issues.csv', 'text/csv;charset=utf-8'); });
  $('export-json').addEventListener('click', () => { if (report) download(JSON.stringify(report, null, 2), 'freightlint-report.json', 'application/json'); });
  for (const event of ['dragenter', 'dragover']) $('dropzone').addEventListener(event, e => { e.preventDefault(); $('dropzone').classList.add('dragging'); });
  for (const event of ['dragleave', 'drop']) $('dropzone').addEventListener(event, e => { e.preventDefault(); $('dropzone').classList.remove('dragging'); });
  $('dropzone').addEventListener('drop', e => readFile(e.dataTransfer.files[0]));
})();
