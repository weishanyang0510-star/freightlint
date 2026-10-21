# FreightLint

**Catch freight spreadsheet errors before import. Files stay on your device.**

[中文说明](README.zh-CN.md) · [Contributing](CONTRIBUTING.md) · [Rules](docs/rules.md)

FreightLint is a small, dependency-free CSV checker for small logistics teams and developers building import workflows. It recognises English and Chinese shipment headers and reports duplicate shipment keys, missing values, invalid quantities and impossible dates. The browser and Node.js CLI use the same validation engine.

This is an early-stage, independently developed open-source project. It does not claim production adoption, carrier certification or an established user base. All examples are synthetic; no employer code, templates or customer data are included. Development was assisted by OpenAI Codex.

## Try it

Download this repository (Code → Download ZIP), unzip it, then double-click **index.html**. The checker works locally, including without an internet connection. No install, account, backend, API key, build step or running cost is required. Click **English** to switch language, then **Try a sample with issues**.

For a local HTTP preview, from the repository folder run `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765`.

## Command line

Requires Node.js 20 or newer. No `npm install` is needed.

```sh
node bin/freightlint.cjs examples/valid.csv
node bin/freightlint.cjs examples/issues.csv --json
node bin/freightlint.cjs your-file.csv --strict
node --test
```

Exit codes: **0** no errors; **1** validation errors (or any warnings with `--strict`); **2** file, encoding or usage error. JSON is printed to stdout with `--json`; operational errors go to stderr. This repository is not published to npm.

## CSV contract

One row represents **one shipment or one split shipment**, not a product line. Repeated `order_id` values need distinct non-empty `split_id` values. IDs are trimmed, case-sensitive strings. Leading zeros are preserved.

```csv
order_id,split_id,origin,destination,pieces,weight_kg,volume_cbm,mode,etd,eta
DEMO-001,,Shenzhen,Dar es Salaam,12,680,3.2,sea,2026-11-01,2026-11-25
DEMO-002,A,Shanghai,Nairobi,4,90,0.8,air,2026-11-03,2026-11-05
DEMO-002,B,Shanghai,Nairobi,6,120,1.1,air,2026-11-03,2026-11-05
```

- Required: `order_id`, `origin`, `destination`, `pieces`, `weight_kg`, `volume_cbm`.
- Optional: `split_id`, `mode`, `etd`, `eta`.
- Encoding: UTF-8, with optional BOM. Export Excel workbooks as **CSV UTF-8** first.
- Delimiters: comma, semicolon or tab, automatically detected from the header.
- Decimal point: `.`; no thousands separators or unit suffixes. No automatic unit conversion.
- Weight is kilograms; volume is cubic metres. Pieces must be a positive whole number; weight and volume must be positive numbers.
- Dates: optional ISO calendar dates (`YYYY-MM-DD`), not timestamps.
- Limits: 5 MiB and 10,000 data rows. Browser tables show the first 500 matching issues; exports include all issues.

Chinese aliases, error codes and boundary details are in [docs/rules.md](docs/rules.md).

## Embed the engine

```js
const { validateCSV, reportCSV } = require('./lib/freightlint.js');
const report = validateCSV(csvText);
console.log(report.errors, report.warnings, report.issues);
const csvReport = reportCSV(report, 'en'); // 'zh' for Chinese messages
```

In a browser, include `lib/freightlint.js` as a normal script and use `FreightLint.validateCSV(text)`. Validation is deterministic, has no network calls, and never rewrites the source file. Issue rows are physical file line numbers (0 means the whole file). Multiline quoted fields count toward physical lines.

## Privacy and limitations

The checker has no analytics, remote fonts, remote scripts, upload endpoint or persistent storage. Files are processed in memory. A hosted copy still makes normal HTTP requests to load its page assets; clicking external links navigates away. CSV/JSON reports can contain original shipment IDs and cell values and should be treated as business data.

Exported issue CSV cells are quoted, and formula-like cells are prefixed with an apostrophe. JSON retains original values. Treat input as untrusted wherever you integrate the engine; never interpolate its values into HTML. No attempt is made to run formulas or automatically fix data.

FreightLint checks data shape and a limited set of basic rules. It does not validate addresses, carrier schedules, customs rules, dangerous goods, pricing, rates or booking acceptance. Passing is not a guarantee of business correctness. XLSX, legacy encodings, item-level aggregation, carrier-specific schemas and configurable zero-weight exceptions are not supported in v0.1.

## Development and maintenance

Run `node --test` before submitting a change. Tests cover CSV parsing, bilingual aliases, split shipments, numeric and date boundaries, unsafe spreadsheet values and CLI exit codes. See [CONTRIBUTING.md](CONTRIBUTING.md) for synthetic fixtures and review expectations.

Planned next steps are listed in [ROADMAP.md](ROADMAP.md). Please open issues with anonymised or synthetic reproductions only. MIT licensed.
