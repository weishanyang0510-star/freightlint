# Contributing

FreightLint is new and small. Useful contributions include synthetic CSV edge cases, clearer Chinese/English messages, accessibility fixes and well-supported importer rules.

1. Open an issue explaining the problem, expected result and a minimal **synthetic** CSV. Do not post real shipment IDs, addresses, customer names or company templates.
2. Keep browser and CLI behaviour consistent by changing `lib/freightlint.js`.
3. Add a regression case when a parser or validation rule changes. Run `node --test` on Node.js 20 or newer.
4. For interface changes, open `index.html`, test sample/file/paste paths, language switching, filtering, downloads and a narrow viewport. Use `textContent` for file-derived text.
5. Describe actual validation in the PR. Do not claim user adoption, compatibility or security guarantees without evidence.

No build system or runtime dependencies are required. Discuss new dependencies or changes to the CSV contract first. Contributions are under the MIT license. The maintainer reviews issues, tests and release changes; response times are not guaranteed.
