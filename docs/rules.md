# Validation rules, v0.1

The engine applies a fixed, documented baseline. It deliberately does not guess units, carrier constraints or shipment semantics from free text. Data rows use trimmed values for validation without modifying the source CSV.

| Code | Level | Meaning |
| --- | --- | --- |
| FILE_TOO_LARGE | Error | More than 5 MiB of UTF-8 input |
| ENCODING | Error | Replacement characters or NULs; resave as UTF-8 |
| CSV_SYNTAX | Error | Invalid quotes, delimiter option or more than 10,000 data rows |
| EMPTY_FILE / NO_DATA | Error | No file contents / no shipment records |
| MISSING_COLUMN | Error | A required canonical field is absent |
| DUPLICATE_COLUMN | Error | Multiple headers map to one canonical field |
| UNKNOWN_COLUMN | Warning | Column is not validated against business rules |
| COLUMN_COUNT | Error | Row width differs from header width; row is not validated further |
| REQUIRED_VALUE | Error | Required cell is empty after trimming |
| POSITIVE_NUMBER | Error | Invalid/zero/negative/unsafe-size number, units or grouping |
| INTEGER_PIECES | Error | Non-integral pieces |
| DUPLICATE_SHIPMENT | Error | Repeated (order_id, split_id), including unsplit shipments |
| MIXED_SPLITS | Error | An order has both blank and non-blank split IDs |
| INVALID_DATE | Error | Not a valid YYYY-MM-DD date |
| DATE_ORDER | Error | ETA is earlier than ETD |
| SAME_ROUTE | Warning | Origin equals destination (case-insensitive) |
| UNKNOWN_MODE | Warning | Non-empty mode outside supported aliases |
| FORMULA_CELL | Warning | Value resembles a spreadsheet formula |

Header aliases ignore case and whitespace. `order_id` also accepts `shipment_id`, `运单号`, `订单号`; `origin` accepts `起运地`, `始发地`; the remaining Chinese names are listed in the Chinese README. Weight additionally accepts `重量(kg)`, `重量（kg）`; volume accepts `体积(m3)`, `体积（m³）`, `体积(m³)`. The exact alias table is the exported `COLUMNS` object.

Supported modes: `air`/`空运`, `sea`/`海运`, `road`/`陆运`, `rail`/`铁路`, `multimodal`/`多式联运`. An omitted optional mode or date is accepted. Zero-weight or zero-volume shipments are not supported by this baseline; a future profile system may add explicit exceptions.

The engine reports duplicates on subsequent occurrences, pointing to the first occurrence. It does not count every affected row as a separate issue. Schema errors stop row validation. Syntax errors stop parsing; row counts in failed parsing results are zero, not a partial validated count.

Formula detection is a review hint, not a complete spreadsheet sandbox. Spreadsheet products may behave differently. Exported report values starting with whitespace/control characters followed by `=`, `+`, `-` or `@` are apostrophe-prefixed; leading tabs/newlines are also prefixed. CSV quoting escapes embedded quotes. Never automatically run source CSV formulas.
