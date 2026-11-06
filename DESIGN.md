# Squeektoshi Stream Overlay design

## Overview

This is an OBS/Streamlabs source editor for streamers. The original pixel hamster and WHEELY9000 wheel carry the visual identity. A warm, quiet control surface surrounds a labeled transparency preview; the companion's running and healthy-rest poses have equal status. The first screen presents three content choices, the actual painted preview, running/sleeping controls and Copy OBS URL. Advanced controls use native disclosures.

The original artwork, four theme palettes, favicon and SVG share artwork remain. No new photographic or generated illustration assets were introduced. `src/assets/original-project.png` is a transparent export of the original canvas art.

## Colors

Configurator tokens are in `src/assets/configurator.css:1`:

| Role | Value |
| --- | --- |
| Page | `#1c130c` |
| Surface / raised / hover | `#2a1d14` / `#38281b` / `#4a3626` |
| Border | `#7d6248` |
| Primary / secondary text | `#fdf3df` / `#d8c4a5` |
| Primary action | `#ffb938` with `#2a1d14` text |
| Keyboard focus | `#7fd4ff` |
| Error | `#ffb4a8` |
| Checkerboard | `#332c26` / `#3d352e` |

Stream theme tokens remain canonical in `src/assets/core.js` (`THEMES`): Burrow uses warm browns and gold, Arcade navy/mint, Paper cream/dark ink, and High contrast black/white/yellow. `SqueekSettings.colors` applies only validated six-digit HEX overrides and chooses black or white alert text based on contrast. Main text/panel opaque contrast is calculated and displayed in the editor; all default pairs passed the unit checks at 4.5:1 or better. Translucent video contrast cannot be guaranteed by an opaque-pair calculation and is labeled accordingly.

Each renderer mount sets CSS custom properties on its own `.sq-root`; it does not theme the document or another mount. Panel alpha is applied to background color only. Text and canvas art remain opaque, and standalone page backgrounds remain transparent.

## Typography

The configurator uses the local `system-ui, -apple-system, "Segoe UI", sans-serif` stack, regular 400 and semibold 600. Its scale is 14px hints/labels, 16px body/controls, 20px section/mobile brand and 24px desktop brand. No downloaded fonts are required. Input text remains 16px on mobile. Body line-height is 1.5; the brand uses 1.2; multi-line alert text uses 1.4. Letter spacing is natural. URLs alone use a system monospace stack and are selectable in full.

The stream root starts at 16px and accepts a bounded 75–150% text multiplier. Stream labels use 0.875em, values 1.25em and session values 1em, with tabular numerals. Alert typography is independent (14px widget / 20px scene before its own percentage setting). Widget fit expands overly narrow alerts before reducing type toward 12px. Long words and numbers wrap rather than truncate. Container fit can reduce the whole group; requested/effective scales are visible in preview options.

## Layout

Spacing tokens are 4, 8, 12, 16, 24 and 32px. The main editor is at most 1440px wide with 32px outer padding and a 32px two-column gap; the preview takes the larger column. At 1000px, padding/gap become 24px. At 760px and below, normal document flow places the preview and copy action before the settings; outer padding is 16px. The narrowest field grids become one column below 360px. No sticky pane or modal traps the mobile flow.

The preview is an explicitly 100%-wide scrollable viewport. Fit shows the full source; close-up magnifies the same output; actual size permits scrolling. These views and checkerboard/light/dark backgrounds change only editor presentation. A preview-only empty state explains intentionally hidden output. Safe guides and layout handles are siblings of the renderer root, never part of streamed DOM.

Source formats are 1920×1080, 1280×720, 1080×1920, 1080×1080 and 480×270. The original grouped layout is default. Horizontal/vertical groups, eight anchors and bounded custom coordinates are available. Visible content determines group size, so hamster-only output has no empty column. Alert space is reserved separately to prevent accidental overlap; components fit to their container without clipped text. Custom overlap between non-alert parts remains a deliberate user layout choice.

Observed checks cover 320, 390, 768 and 1440px editor widths; all five output formats; 200% CSS zoom; pointer drag, emulated touch and keyboard movement. Native browser zoom, physical devices and assistive-technology sessions remain unverified.

## Elevation & Depth

The editor is flat: borders distinguish controls and disclosure sections, and tonal fills show surfaces. It has no card-within-card system or decorative drop shadows. Selected demo buttons use an inset underline as a state cue. The checkerboard denotes transparency, not part of the output. Focus uses a visible 3px perimeter and a system-color fallback in forced-colors mode.

## Shapes

Editor controls and preview viewport use a 6px radius. Stream art and panels retain square pixel geometry. The artwork canvases use `image-rendering: pixelated`. Alert icons are the original 12×12 pixel glyphs. Text panels are never clipped or ellipsized.

## Components

- `SqueekRenderer.mount` in `src/assets/overlay.js`: scoped canvas/DOM source with `update`, `alert`, `cut`, `demo`, `clear`, `soundTest`, diagnostics and `destroy`. Only preview configuration mounts expose editor feedback. Data polling, text updates and drawing use separate lifecycles. Destroy cancels scheduled work, observers, media listeners, requests and audio, seals observed session time, and guards late continuations.
- `field`, `check`, `bound`, `choice`, `section` in `src/assets/configurator.js`: native labeled inputs, bounded settings, and native `<details>/<summary>` disclosures. Invalid imports and values leave settings unchanged and announce a recoverable error. All actions use real buttons or anchors.
- `.primary`: only the Copy OBS URL action uses the filled accent. Other actions remain neutral. Controls are normally at least 44px tall; preview handles are 28px with equivalent numeric controls. Disabled state is both native and visually dimmed.
- `.sq-status`: explicit Connecting/Live/Lost plus pose/rest labels. Outages label last-known data and stop the running pose. The empty-state message exists only in the configurator.
- `.sq-alert`: one queued alert at a time, a 500ms gap, original icon, safe localized template text, optional generated sound. Loss clears active and waiting alerts and audio. First sample/recovery are silent.
- Layout handles: stable elements retain focus across diagnostics updates; invisible parts have no handle (test an alert to show its handle). Pointer capture supports drag; arrows move 1%, Shift+arrow 5%; numeric coordinates and scale provide an equivalent path. One gesture creates one history entry. Lock disables handles and numeric positioning.
- Profiles/transfer: browser-local named profiles, 50-step undo/redo, confirmed/undoable deletion, validated JSON and distinct setup/source links. No ownership/account metaphor is implied.

There are no decorative CSS animation loops. Button press feedback uses a brief static scale only when reduced motion is not requested. Canvas motion is capped at 15 or 30 FPS; moth wings change every 500ms. Motion-off/reduced-motion stops continuous drawing while allowing data/text and state poses to update.

## Do and don't

Reuse the root-scoped renderer for any additional source surface. Keep editor controls outside `.sq-root`; use the validated settings object and existing field/disclosure helpers. Add translation pairs for labels, hints, errors and accessible names together. Use the four theme tokens rather than inserting CSS strings. Keep source URLs relative and runtime assets local.

Do not add a frame wrapper, document-wide stream theme, analytics, wallet infrastructure or a runtime package dependency. Do not present demo values as live, imply remote control of OBS, or promise contrast over arbitrary video. Preserve the original sprite arrays when changing animation behavior.

The six-domain review, measured findings, fixes and unperformed checks are recorded in `VALIDATION.md` and `artifacts/design-review.md`. Guidance attribution and licenses are in `NOTICE.md` and `LICENSES/design-guidance.txt`.
