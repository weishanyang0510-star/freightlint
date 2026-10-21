# Security and privacy

Do not post customer data, credentials or real shipping documents in issues. Use a minimal synthetic reproduction. For sensitive findings, use GitHub private vulnerability reporting if available; otherwise open a minimal issue requesting a private channel without including exploit details or private data.

The browser app processes files in memory. It has no upload, telemetry or persistence code. Exported reports can contain user data. The CLI reads only the specified file and writes its report to stdout. File and row limits reduce accidental resource exhaustion, but this is not a hostile-file sandbox or a guarantee of safety in every spreadsheet application.

Only the latest release is supported during the initial 0.x phase. Security fixes will be documented in the changelog. Do not pass unsanitised issue values to HTML renderers or evaluate spreadsheet formulas.
