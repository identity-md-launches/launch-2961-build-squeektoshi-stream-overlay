# Validation and delivery evidence

## Status and identity

The static implementation is delivered in `src/` and `dist/`. **Full acceptance is not claimed**: native OBS/Streamlabs, WebKit, native-device/accessibility checks, direct Chromium API transport on this host, the future published build/CSP and provider commercial confirmation remain unverified. These are worker-side results, not independent certification.

Release **2.0.0**, based on commit **44e6127595d7e248785eb195fd0cb4d7bc14be24**. Content-derived build identity and file hashes are in `dist/build.json` and `artifacts/build.json`. The submission commit is assigned after handoff; this build does not pretend its modifications are already part of the base commit. The project remains `squeektoshi-stream-overlay-obs-a.identitymd.eth`. No contract, token, address, wallet or account action was performed. The original endpoints, art, HTML links, 28 tests and root dependency manifests remain.

## Commands and actual results

| Check | Recorded result |
| --- | --- |
| `npm run build` / `node scripts/build.mjs` | Production export built; `artifacts/commands.json` and `build-log.txt`. Relative assets served under `/preview/`. |
| `node scripts/install-tools.mjs` | Exact TypeScript/Playwright/core versions installed only in scratch and verified against integrity metadata. |
| `node test/scratch/tools/node_modules/typescript/bin/tsc -p tsconfig.json` | Exit 0; checkJs enabled, no disabled/excluded source. `artifacts/typecheck.txt`. |
| `npm test` | Original 28/28 unchanged tests. |
| `node --test tests/*.test.cjs` | 56/56 passing tests, including 28 new regressions. `artifacts/logic-tests.txt`. |
| `node tests/browser-suite.mjs` | 21/21 passing Chromium checks; `artifacts/browser-results.json`. |
| `node tests/browser-extended.mjs` | 10/10 passing checks; `artifacts/browser-extended-results.json`. |
| `node tests/browser-epochs.mjs` | Six browser responses crossing higher/lower epochs: 4700mm measured total, 4000mm best. `artifacts/browser-epoch-results.json`. |
| `node tests/browser-refresh.mjs` | Displayed 00:02 preserved at destroy/reload; 2349ms saved in recorded run. `artifacts/browser-refresh-results.json`. |
| `node tests/browser-keyboard.mjs` | Keyboard-only choose/run/sleep/copy and focus restoration passed; `artifacts/browser-keyboard-results.json`. |
| `node tests/browser-resources.mjs` | 20 mounts with four sound tests; zero remaining timers, RAF callbacks, observers, media listeners, audio contexts or nodes. `artifacts/browser-resources-results.json`. |
| `node tests/browser-touch.mjs` | Emulated touch drag and a single touch undo restore the original placement. Physical device remains unverified. |
| `node tests/browser-alert-positions.mjs` | 100 independent alert-position × format × language cases; visible, bounded, no content overlap. |
| Pinned `taste.mjs --out test/scratch/taste` | 16/16 checks pass; `artifacts/taste-results.json`. |
| `node tests/soak.mjs 1800000 artifacts/soak-final-results.json` | Real-time 30-minute run; complete result, samples, teardown and runtime hashes in that JSON and final `validation-summary.json`. |
| Clean source install/build/typecheck/test | `artifacts/clean-source-results.json`. No working-tree dependencies or vendored registry required. |
| `python3 scripts/package-release.py` and `tests/release-check.mjs` | Source/static archives and local download/metadata validation. `artifacts/release-results.json`. |

Chromium version: **154.0.8037.0**. The supplied browser-tool launcher failed because its Unix socket path was too long. The installed headless shell worked in the script harness, which manages and closes its own server/browser. WebKit downloaded but could not launch because host libraries are missing; exact failure is in `artifacts/webkit-results.json`.

The browser export was served with this explicit test CSP:

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; connect-src https://api.squeekchain.com;
object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'
```

This establishes compatibility with the requested frame prohibition and this restrictive test policy. The actual remote host CSP could not be retrieved. A transient browser-test assertion read clipboard feedback before its promise completed; the test now awaits the actual copied/selected message, and the full suite reran successfully. The original 28 tests were never weakened.

## Six flows

| Flow | Observed evidence |
| --- | --- |
| First use | At 390px: choose hamster, try running/sleeping, copy source URL and 480×270 dimensions. Recorded scripted flow: **564ms**. This meets the automation target, not a human usability study. Product and copy action are on the first screen. |
| Clean source | Extracted downloadable source ZIP, clean install/build/typecheck/tests and byte-for-byte output comparison; `clean-source-results.json`. |
| Outage/recovery | Status start intervals recorded at 4999/5000/5000ms. Failure and newly fetched stale data preserve last success, clear alerts, freeze time and show Lost/last-known without stale Running. Recovery silent; economy failure independent. |
| Advanced edit/export/import | Presets/formats/languages, pointer/keyboard/numeric edits, 20 undo/redo changes, exports/imports, atomic rejection and URL loading. Clipboard-denied fallback selects the entire link. |
| Sessions/report | Same-ID second writer private, different ID independent; reset token creates separate measured report; copies receive new IDs; storage failures usable; demo makes no API requests or real-session writes. |
| Deployed build | Local production export works under a subpath. Existing ENS gateway TLS failure and pinned IPFS HTTP 403 prevented remote assets/version/CSP verification. New publication happens after handoff. `deployed-check.json`. |

## Evidence table: 01–32

| ID | Implemented behavior and evidence | Remaining limit |
| --- | --- | --- |
| 01 | Root-scoped DOM/canvas renderer: update/alert/cut/destroy, independent roots, no embedding tags/postMessage, actual painted output under CSP. Browser matrix and dual-root check. | Remote host CSP unverified. |
| 02 | EN/TR Connecting/Live/Lost, labeled last-known values, freeze/recovery, nonoverlapping 5–10s polling/timeouts, independent supply. Outage browser test. | Direct external Chromium transport unavailable here. |
| 03 | Sequential alerts, 500ms gap, loss clears active/pending/audio, silent first/recovery sample. Five-alert test. | Physical audio output unverified. |
| 04 | Epoch comparison (higher/lower), decrease fallback, observed-best sealing, gap exclusion, rebaseline and storage fallback. Node plus browser epoch/refresh checks. | Supported numeric precision is bounded in SCHEMA.md. |
| 05 | RPM wheel/leg cadence, moth changes every 500ms, motion/reduced-motion stops decoration while text updates. Draw-count tests. | No physiological certification. |
| 06 | Original sprite arrays byte-equivalent to base (`art-preservation.json`), overlay.html/widget.html, valid old parameters/defaults and 28 unchanged tests retained; 28 regressions added. | Version 2 parsing intentionally stricter. |
| 07 | Editable Minimal/Broadcast/Night/High contrast/Data presets; sound initially off; session/reset retained. Preset tests. | None known. |
| 08 | Six-part drag/touch-capable handles, arrows/Shift+arrows, numeric x/y/width/scale, bounded URL state; editor outside source. Pointer/touch/keyboard tests. | Physical device unverified. |
| 09 | Legacy/horizontal/vertical/custom, alignment, snap/grid/guides, lock/reset; position presets restore groups. Twenty layout/format stress combinations. | Deliberate non-alert custom overlap is possible. |
| 10 | Six metric switches; auto/m/km, m/s/km/h; correct conversions and missing-value dashes. Browser conversions/sparse-data checks. | None known. |
| 11 | Bounded inset/font/background opacity; opaque text/art; requested/effective fit; long-number/max-setting checks. | Apply stated OBS dimensions; tiny hosts can shrink output. |
| 12 | Four original themes, HEX overrides/reset, opaque contrast calculation, transparency explanation. Theme matrix and contrast tests. | Video-dependent contrast needs scene inspection. |
| 13 | All five requested formats and exact OBS dimensions in URL. Matrix/round-trip tests. | None known. |
| 14 | Fit/close-up/actual-scroll, three backgrounds, safe guides and explicit all-hidden state. Preview does not pollute output URL. | Close-up intentionally scrollable. |
| 15 | Automatic/running/sleeping/lost/restore changes actual engine/pose; isolated, labeled demo. No API/session-write proof. | Demo is intentionally synthetic. |
| 16 | Bounded 0–120 demo RPM; inactive in live preview. | None known. |
| 17 | Five tests, run-all, clear, sound tests; automatic demo alerts paused; switches honored; preview/output demo distinct. | Tests require connected demo. |
| 18 | Source/state, last success, age, interval, queue, audio/storage, 40-event bound, no raw stream errors/telemetry. Failure/soak checks. | Diagnostics never stream. |
| 19 | Local create/save/copy/rename/delete, draft restore, fresh copy IDs, separate stores, denied/quota/corrupt tolerance. Browser profile/storage checks. | No cross-device/OBS shared-storage claim. |
| 20 | 50 history steps, 20-step browser proof, coalesced gestures, section/all reset preserves session identity, confirmed/undoable deletion. | History is page-local. |
| 21 | Version 2 JSON, 32KiB bound, nested schema/value checks, atomic failure, no code/endpoints/counters. Import tests. | None known. |
| 22 | Setup/source copy, open source, URL check/load, full-link fallback, 16KiB limit and clean-store reproducibility. | Clipboard permission varies; fallback supplied. |
| 23 | Separate IDs, exclusive same-ID writer, reset URL, local-only measured JSON/CSV distance/time/best/timestamps/gaps, no stream UI. Concurrency/report tests. | Web Locks unavailable means private memory; native OBS persistence unverified. |
| 24 | Independent alert position/width/text scale/duration; 100 position/format/language cases pass. Extreme Turkish widget fixture: 18px effective type, 456×170.56px, no content overlap. | Extreme message reduces companion size. |
| 25 | Three Web Audio tones, per-event tone/level and master, gesture test, cancellation/close. Nine oscillator starts; off/zero/lost silence checks. | Speakers and native mixer capture unverified. |
| 26 | EN/TR templates, 80/160 bounds, validated {value}, safe missing marker/reset, textContent only, healthy rest. | User prose not auto-translated. |
| 27 | Independent EN/TR UI/stream text, hints/errors/names; native disclosures, keyboard/focus, responsive/emulated touch, 200% CSS zoom. | Native zoom, screen readers, physical devices, WebKit unverified. |
| 28 | OBS/Streamlabs setup, size/URL/transparency/audio/shutdown/refresh/troubleshooting; apply-new-URL/storage boundaries explicit. | OBS Studio unverified; Streamlabs Desktop separately unverified. |
| 29 | Current transparent-canvas PNG download, original-art PNG, actual configurator/scene/widget/alert screenshots. | Earlier project supplied canvas art, not a PNG; delivered PNG is its render. |
| 30 | Source/static ZIP, original lock, exact dev-tool lock, build/base commit/changelog, README/VALIDATION/DESIGN/SCHEMA, relative assets. | New deployment and provider scope/price confirmation unverified. |
| 31 | 15/30 FPS, no continuous motion-off drawing, complete cleanup/late guards. 25 remounts, delayed fetch destroy, 20 separately instrumented cleanup cycles, refresh and real-time soak. | Soak uses deterministic API fixtures, not controlled hardware. |
| 32 | Build/typecheck/logic/browser checks; bounded versioned presentation/format/session/FPS schema and atomic oversized/unsupported rejection. | Broader platform/deployment evidence not falsely marked passed. |

## Live data and publication

Both public HTTPS APIs returned 200 to direct transport reads. The actual economy token address is recorded in `artifacts/deployed-check.json`; no replacement was configured.

Direct Chromium networking yielded no successful API response on this host. Output correctly stayed Lost with dashes, without invented values; its canvas still had **8239 nontransparent pixels** and no script errors (`live-api-results.json`). This proves the failure presentation, not direct live connectivity.

A separate test-only route forwarded unchanged real HTTPS responses fetched by Python. Both APIs returned 200 and CORS `*`. The rendered observation was **Live · Resting · Healthy rest**, work 11,048, block 1,140, round 389 and supply 214.2M SQK at the recorded timestamps. See `live-bridge-results.json` and `screenshots/scene-real-api-bridged.png`. These are observed, time-specific values, not hardcoded app content. The bridge is test code only and does not add a production backend or certify native Chromium transport.

The existing ENS gateway returned `TLSV1_ALERT_INTERNAL_ERROR`; the pinned IPFS gateway returned HTTP 403. No publishing command ran. After publication, verify the new build ID, asset hashes and actual CSP. Commercial scope/price confirmation was not supplied or inferred.

## Soak and screenshots

`artifacts/soak-final-results.json` records the completed 30-minute wall-clock run, request counts, DOM/resource/error samples, teardown and exact six runtime file hashes. Final numerical results are copied into `artifacts/validation-summary.json`. Interrupted preliminary runs are not presented as passes.

Final result: **1,805,539ms including teardown, 61 samples, 360 status requests, 30 economy requests, zero demo API requests, zero demo session writes and zero script errors**. Renderer node counts stayed at 49 (demo) and 47 (live fixture). Diagnostics stayed within 40 events. Destroy removed all renderer nodes and stopped request/draw counters during the subsequent 5.5-second observation. The final six renderer-file hashes match the soak. The overall recorded checks are **56 logic tests, 37 browser checks and 16 design-probe checks**, plus clean-source/release validation; this does not close the external/native gaps above.

Actual screenshots: `artifacts/screenshots/configurator-{320,390,768,1440}.png`, `overlay.png`, `widget.png`, `widget-turkish-alert.png`, `widget-long-alert-fit.png`, `zoom-200.png` and `scene-real-api-bridged.png`. CSS zoom is explicitly not native zoom; headless audio is not an OBS recording. Original PNG and source/static ZIPs are under `artifacts/`, with archives also in `dist/downloads/`.

All six Better Interface domains were reviewed and reproduced findings fixed; file/line evidence, limits and 16/16 probe result are in `artifacts/design-review.md`. `PATH_BUDGET.md` defines explicit ignore-path budgets; `artifacts/bundle-budget.json` records final measured inventory. Generated dependencies, caches and npm archives are excluded at every level.
