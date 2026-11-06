# Changelog

## 2.0.1

- Fixed the configurator preview layout: the mounted renderer root now fills the format-sized preview box (`src/assets/configurator.css`), so the rig, alert and badge are placed exactly where `overlay.html`/`widget.html` put them instead of collapsing to the top-left with a zero-height root.
- A lost signal with no reading ever received now says "Lost · No data yet" / "Bağlantı yok · Henüz veri yok" instead of claiming last-known values; the supply line only says last-known when a supply value was received.
- `npm test` now reaches the regression suite (`tests/logic.test.cjs` requires `tests/regressions.test.cjs`; the 28 original tests are unchanged and `package.json` stays protected).
- Configurator header wraps at narrow effective widths (fixes 21px horizontal overflow at 768px with 200% zoom).
- Added `tests/browser-preview-layout.mjs` regression. Release identity 2.0.1, based on commit `cacb4d8cead5b5f8ab12f7a8d9e5dbe498f80a14`.

## 2.0.0

- Replaced the iframe preview and page-global runtime with one scoped DOM/canvas renderer and explicit update, alert, cut and destroy lifecycle.
- Added format/layout editing, accessible numeric and keyboard alternatives, five editable presets, granular stats, units, colors and transparency controls.
- Added independent EN/TR interface and stream text, safe alert templates, three synthesized tones and per-event controls.
- Added version 2 portable settings, strict atomic imports, setup/source links, browser-local profiles, 50-step undo/redo, isolated session IDs, reset URLs and measured JSON/CSV reports.
- Fixed epoch transitions, run continuity across outages, last-known labels, silent recovery, bounded polling, cleanup and motion preferences.
- Added screenshots, transparent original-art PNG, release archives, reproducible browser checks, a 30-minute soak and explicit verification limits.

The original package manifest remains at 1.0.0 because existing dependency/build manifests are protected in this assignment. Product release identity is 2.0.0 in `src/build.json` and `dist/build.json`. The base source commit is `44e6127595d7e248785eb195fd0cb4d7bc14be24`; the final submission commit is assigned after this workspace is handed off. A deterministic content hash identifies this build without claiming that uncommitted work is the base commit.
