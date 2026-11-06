# Squeektoshi Stream Overlay

A static OBS/Streamlabs browser source with the original Squeektoshi hamster and WHEELY9000 wheel. Running and healthy rest both have a live pose. The editor, transparent scene and widget share one root-scoped renderer; there are no frames, runtime packages, accounts, wallets, tracking or backend.

The site is exported in **`dist/`**, including its local assets and downloadable source/static ZIPs. Existing `overlay.html`, `widget.html` and their original parameters remain supported. The project remains `squeektoshi-stream-overlay-obs-a.identitymd.eth`; no contract, address or token was deployed or replaced.

## Use it

1. Open `index.html` from a static HTTP(S) server. Choose **Hamster only**, **Hamster + essentials** or **Full scene**.
2. Try running and sleeping in the labeled simulated preview. Choose a format or edit the advanced disclosures if needed.
3. Copy **OBS URL**, then paste it into an OBS Browser or Streamlabs Browser Source. Apply the exact width and height shown under the button.

The checkerboard, guides and editor controls never stream. Output is live by default; the preview is simulated by default. The separate **Use demo data in the OUTPUT URL** setting makes an explicitly labeled demo source. Sound is initially off. Use a sound test after enabling it; browser/OBS audio permissions and mixer settings still apply. Live mode requires internet access to `api.squeekchain.com`; the complete demo works offline once static files are available.

Every changed source setting creates a new URL for you to apply. This editor cannot update or reset a remote OBS source. Browser-local reports include only measured sessions stored in that browser; OBS may use a different store. Same-ID sources allow one persistent writer, and conflicting or storage-denied mounts continue in private memory.

## Install, preview and rebuild

Node 20+ and Python 3 (only for release ZIP packaging) are sufficient. The original root package manifest and lockfile are preserved and have zero production dependencies.

```sh
npm ci --ignore-scripts
npm run build
npm run preview
```

Open the local preview URL printed by the command. The production build copies `src/` exactly into `dist/`; all assets use relative paths and work under a static subpath. No service worker or routing backend is needed. Keep `overlay.html`, `widget.html`, `index.html` and `assets/` together.

To create the full deliverable, including build metadata and both downloadable archives:

```sh
python3 scripts/package-release.py
```

This clears/rebuilds `dist/`, emits `build.json`, creates `artifacts/squeektoshi-source.zip` and `artifacts/squeektoshi-static.zip`, and copies both to `dist/downloads/`. Archive inputs are allowlisted. The static archive contains the deployable app before the downloadable archives are attached, so ZIPs do not recursively include themselves. The source archive contains source, original manifest/lockfile, types, checks, documentation and release tooling. Rebuild with the command above to restore its archive-download links.

## Development checks

The required dev tooling is locked in `tooling.lock.json`; it never ships at runtime. Install it into disposable scratch without changing root dependencies:

```sh
node scripts/install-tools.mjs
node test/scratch/tools/node_modules/typescript/bin/tsc -p tsconfig.json
npm test
node --test tests/*.test.cjs
```

`npm test` runs the 28 unchanged original tests and, through one `require` appended to `tests/logic.test.cjs` (the protected `package.json` cannot change), the regression suite: **57 tests**. `node --test tests/*.test.cjs` runs the regression file a second time on its own, so it reports more than 57. `checkJs` remains enabled with proper DOM/global declarations and no excluded source files.

For browser checks, install Chromium with the locked Playwright CLI, then run:

```sh
export PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers"
node test/scratch/tools/node_modules/playwright/cli.js install chromium
export SQUEEK_PLAYWRIGHT_MODULE="$PWD/test/scratch/tools/node_modules/playwright/index.mjs"
node tests/browser-suite.mjs
node tests/browser-extended.mjs
node tests/browser-epochs.mjs
node tests/browser-refresh.mjs
node tests/browser-keyboard.mjs
node tests/browser-resources.mjs
node tests/browser-touch.mjs
node tests/browser-alert-positions.mjs
node tests/browser-preview-layout.mjs
node tests/soak.mjs 1800000 artifacts/soak-final-results.json
```

The scripts serve `dist/` under `/preview/` with a restrictive test CSP (`frame-ancestors 'none'`, `frame-src 'none'`, self-hosted scripts, only the fixed public API permitted for connections). They manage and close their own servers and browsers. An optional `SQUEEK_BROWSER_EXECUTABLE` selects an installed Chromium executable. Browser-system libraries must be present. `tests/live-check.mjs` separately tests direct public API access; `tests/live-bridge.mjs` is an explicitly labeled test-only transport fallback, not app code or a production backend.

## What was checked

See **[VALIDATION.md](VALIDATION.md)** for actual commands/results, the 01–32 evidence table, six requested flows, screenshots, limitations and final soak result. **[DESIGN.md](DESIGN.md)** records the final implemented tokens/components and the Better Interface review. **[SCHEMA.md](SCHEMA.md)** documents field bounds, versioned URL/import formats, session behavior and storage. The build's content identity is in `dist/build.json`; `CHANGELOG.md` explains the version and preserved base commit.

Native OBS Studio, Streamlabs Desktop, physical devices, screen readers, native browser 200% zoom and the future published version are not certified by these checks. WebKit could not launch because system libraries are unavailable. Direct Chromium access to the API could not be established on this host; the lost state remained honest, and real API responses were separately verified via the documented test transport. Do not treat local worker checks as independent certification.
