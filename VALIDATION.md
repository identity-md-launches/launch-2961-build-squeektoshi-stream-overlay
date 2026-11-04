# Validation record

**Completion: Incomplete.** The site is written in full, but nothing has been executed by the worker that wrote it: no build, test, typecheck, probe, or browser check, in the original build or in the revision. Treat it as unverified code until the commands below have been run.

## Revision: four review findings

The reviewer reported these from Chromium and Node on another machine. Here, Bash and the browser failed with the same errors as before (see "Why nothing ran"), so **no finding was reproduced by running it and no fix has been executed.** Each was confirmed by tracing the code, and the new tests were traced by hand, which is not a test result.

| Finding | Confirmed by reading | Fix | Regression test added (not run) |
| --- | --- | --- | --- |
| High: readings older than `staleAfterSeconds` accepted as live | `src/assets/core.js`, `freshnessVerdict`: age 180 s passed against limit 120 s + 300 s tolerance | Tolerance removed. `now - observedAt > limit` is stale; the `generatedAt - observedAt` check stays. A reading with no `observedAt` or `receivedAt` is aged by `generatedAt`, which the report did not ask for but is the same defect | "a self-consistent reading older than staleAfterSeconds...", "the age limit is exact..." |
| Medium: response time added to the poll interval | `src/assets/overlay.js`, `pollStatus`: delay started after the request finished | New `nextPollDelay` in `core.js` subtracts elapsed time. The timeout is unchanged and always shorter than the interval, and the next request is still only scheduled after the last one ends, so requests do not overlap | "polling runs start to start..." |
| Medium: running time jumps backwards on signal loss | `core.js`, `lose()`: cleared `previousAt` without saving the elapsed time the display was adding | `lose()` commits the elapsed time, capped at the existing 30 s step, when the last reading was `SPINNING`. `engine.fail` now takes the time. The display's cap is at most 20 s, so the committed value is never below what was shown | "running time freezes at a loss...", "a loss while resting..." |
| Medium: records under 1 m never alert | `core.js`, `applySessionReading`: `RECORD_MIN_MM` gate | Gate and constant removed. A run must still be longer than the current record, so a zero-length run stays silent | "a record under one metre still fires..." |

Behaviour changes to be aware of:

- A streaming PC clock running ahead by more than `staleAfterSeconds` now shows SIGNAL LOST permanently. This is the requested trade-off, and it is documented in the README.
- Very short runs can now fire a record alert early in a session.
- WebFetch read `generatedAt` and `observedAt` under one second apart on the live API, against a 120-second limit, so normal operation should stay well inside it. That was one sample.

`dist/assets/core.js` and `dist/assets/overlay.js` received the same edits as `src/` by hand, because `npm run build` could not run. Line counts match (636 and 343), and Grep shows the same lines for every changed symbol in both trees. That is not a byte comparison.

## Why nothing ran

Every Bash call in both sessions, from the first to the last, returned the same error:

```
Sandbox is required but failed to initialize: Failed to create bridge sockets after 5 attempts. Restart to retry. Running it outside the sandbox (dangerouslyDisableSandbox) is not allowed either.
```

The browser tool also failed:

```
Browser "chrome-for-testing" is not installed; expected executable at .cache/ms-playwright/chromium-1247/chrome-linux64/chrome. Run `npx @playwright/mcp install-browser chrome-for-testing` to install
```

Installing it needs the shell. The browser tool's arbitrary-code method was not used to run commands, because that would have stepped around the sandbox instead of working within it.

## Scope and assumptions

- **Pages:** `index.html` (configurator), `overlay.html` (full scene), `widget.html` (corner widget). `dist/` is the export.
- **Stack:** plain HTML, CSS and classic scripts instead of the usual Vite, React and TypeScript default. The brief asks for a pure static site, classic scripts also work from `file://`, and with no shell a bundler could not have run anyway.
- **Choices the brief left open:**
  - The record alert fires when a run ends, for any run longer than the current record.
  - Recovery after a signal loss is silent.
  - A session expires after 12 hours without an update.
  - `reset=1` resets on every load; other tokens reset once.
- **API shape:** read through WebFetch, which summarizes through a small model, so the raw JSON was not inspected directly. It reported `freshness` and `staleAfterSeconds` under `measurement`, and block values as strings. The parser accepts both placements and both types.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Production build | `npm run build` | **Not run.** `dist/` was written by hand |
| Typecheck | `npm run typecheck` | **Not run** |
| Logic tests | `npm test` | **Not run.** I traced the assertions by reading the code, which is not a test result |
| Design probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **Not run** |
| Browser, all widths, console, overflow, interaction | | **Not run.** No page has ever been rendered |
| Real OBS or Streamlabs | | **Not run** |
| Live API request from the overlay | | **Not run.** WebFetch reached both endpoints, but the CORS path in a browser was not exercised |
| Bundle size against 8 MiB | | **Not measured.** The additions are small text files |
| `git commit` | | **Not done** |

### What was actually checked, with Grep

| Check | Result |
| --- | --- |
| `src/` and `dist/` line counts per file | Equal for all 11 files before one later edit, which was applied identically to both. This compares line counts only, not bytes |
| Em dashes, emoji, `transition: all`, `text-transform`, `letter-spacing` in `src/` | None |
| `outline: none` in `src/` | One: `.settings` at `src/assets/configurator.css`, a skip-link target that is not otherwise focusable |
| Root-relative or absolute `src`/`href`, CSS `url()`, wallet or tracking calls in `dist/` | None. The only matches for `url(` were the JS function `overlayUrl(` and `new URL(` |
| Network calls in `dist/` | One `fetch(` wrapper, used only with the two named API URLs |
| `localStorage` in `dist/` | Only through the guarded session store |

### To finish verification

```sh
npm test && npm run build && git status --short dist
npm run typecheck
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

`git status` after the build should show no changes to `dist/` beyond what is expected; any difference is a hand-copy mistake. Then open `overlay.html?demo=1`, `widget.html?demo=1` and `index.html` at 320, 390 and 1440 wide.

## Better Interface review

Coverage is **source only**. Rendered checks are unperformed, and that is a stated limitation rather than a pass.

| Domain | Status | Checked in source | Unperformed |
| --- | --- | --- | --- |
| Accessibility | Checked, source only | Native controls and labels, `:focus-visible` ring, 44px minimums, `role="status"` regions, `aria-invalid` with `aria-describedby`, skip link, reduced-motion handling in both CSS and JS | Keyboard walk, focus visibility, accessibility tree, screen reader, 200% zoom |
| Layout | Checked, source only | Logical properties in the configurator, content-derived `60rem` breakpoint, DOM order puts the product first, `fit()` prevents clipping | All widths, the 390 first screen, Turkish string fit on stream |
| Writing | Checked | Verb-first buttons, errors that state the fix, one sentence-case policy, no blame or exclamation marks, resting framed positively. Turkish copy was written without a native-speaker review | None for source checks |
| Typography | Checked, source only | Four sizes and three weights in the configurator, `tabular-nums` on values, 16px inputs, wrap rules, monospace limited to data | Rendered wrapping and truncation. The system font actually used was not observed |
| Colors | Checked, source only | Role tokens, per-theme pairs covered by a test | **No contrast ratio has been measured.** The test that computes them has not run, and the checkerboard and video backdrops were not examined |
| UI | Checked, source only | Named transition properties, 0.96 press scale, single non-repeating alert motion, static text cue for every animated state, slowest star twinkle at one change per 1.8 seconds | State walk, motion review, how the art actually looks |

## Findings and fixes

All were found by reading the source. None were reproduced in a browser.

| Severity | Location | Finding | Fix | Recheck |
| --- | --- | --- | --- | --- |
| Medium | `src/assets/art.js`, `drawRunner` | Body bob moved up, leaving a one-pixel gap above the legs | Bob moves down, onto the legs | Not rendered |
| Medium | `src/assets/configurator.js`, `updatePreviewSoon` | Any form change reset the "Cut the signal" button even when the preview did not reload | Resets only when the iframe URL changes | Not run |
| Medium | `src/assets/configurator.css`, `.stagearea` | A sticky column taller than a short viewport would hold controls out of reach | Sticky only from `60rem` tall | Not rendered |
| Low | `src/assets/configurator.css`, `.choice` | Selected state combined border and shadow, and hover used raw hex | Border and background only, plus new hover tokens | Not rendered |
| Low | `src/index.html`, test buttons | Labels were not verb-first | "Test wake-up" and similar | Source |
| Low | `package.json` | `node --test tests/` can fail on recent Node versions, as far as I recall | Names the test file directly | Not run |

## Known limitations

- **Art is unseen.** The sprites were drawn as text and have never been displayed, so the hamster may need touch-ups once someone sees it.
- **`og:image` is an SVG,** so some link unfurlers will not display it. A PNG needs a shell or an image tool to produce.
- **Preview text is small on phones,** because the 1920-wide scene is scaled down to about 358px wide. The widget page previews larger.
- **Scene preview at 390:** no measurement confirms the expected first screen.
- **Widget alerts** may cover part of the rig while showing.
- **Configurator language** is English only. `lang` applies to the on-stream overlay, as the brief specifies.
