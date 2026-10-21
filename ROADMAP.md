# Roadmap

These are proposals, not shipped features or promised dates.

- Collect synthetic CSV edge cases from users and improve header/delimiter diagnostics.
- Add explicit, documented validation profiles for different shipment types, including zero-volume exceptions where appropriate.
- Support user-provided header mappings without silently guessing units.
- Evaluate XLSX support against offline use, dependency size and security costs.
- Add optional item-level aggregation only after its grouping semantics are defined.

Initial release: browser checker, shared Node.js API/CLI, Chinese and English headers/messages, row-level reports and regression tests.
