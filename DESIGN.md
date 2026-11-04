# Design system: Squeektoshi Stream Overlay

Facts below come from the source. Nothing was rendered during the build, so layout statements describe what the CSS declares, not observed results. See [VALIDATION.md](VALIDATION.md).

## Overview

There are two surfaces for one audience, streamers:

- **Overlay pages** (`src/overlay.html`, `src/widget.html`) paint on a fully transparent page over a live video feed. They are read at a distance by viewers, so they use solid panels, large numbers and pixel art.
- **Configurator** (`src/index.html`) is a normal settings tool. It puts the preview and the URL first, with the settings as a plain form.

The one visual idea is a pixel hamster on a wheel, and square pixel-stepped frames echo the art. The configurator reuses the Burrow theme's colours so it reads as the same product.

## Colors

**Overlay themes** are defined once in `THEMES` in `src/assets/core.js`. `overlay.js` writes each `ui` key to `:root` as a custom property, and `art.js` uses the matching `art` palette merged over `BASE_ART`.

| Token | Role | `burrow` | `arcade` | `paper` | `contrast` |
| --- | --- | --- | --- | --- | --- |
| `--panel` | Panel background | `#2a1d14` | `#10162f` | `#fbf5e6` | `#000000` |
| `--text` | Primary text | `#fdf3df` | `#eaf6ff` | `#2b2a33` | `#ffffff` |
| `--muted` | Labels | `#d8c4a5` | `#a9c3dd` | `#5e5a55` | `#e6e6e6` |
| `--accent` | Alert fill, bar fill, running status | `#ffb938` | `#4fe3c1` | `#b23a2e` | `#ffe600` |
| `--on-accent` | Text on accent | `#2a1d14` | `#0b1226` | `#ffffff` | `#000000` |
| `--track` | Empty progress bar | `#4a3626` | `#2b3562` | `#ded3bb` | `#4d4d4d` |
| `--edge` | Pixel frame | `#120b06` | `#050817` | `#2b2a33` | `#ffffff` |
| `--lost-bg` | Signal lost banner | `#fbe3a0` | `#ffd0e4` | `#2b2a33` | `#ffffff` |
| `--lost-text` | Signal lost text | `#2a1d14` | `#24102a` | `#fbf5e6` | `#000000` |

**Configurator tokens** are in `:root` in `src/assets/configurator.css`:

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#1c130c` | Page |
| `--color-surface` | `#2a1d14` | Fieldsets, inputs |
| `--color-surface-raised` | `#38281b` | Buttons, choices |
| `--color-surface-hover` | `#4a3626` | Hover, selected choice |
| `--color-border` | `#7d6248` | Control borders |
| `--color-text` / `--color-text-muted` | `#fdf3df` / `#d8c4a5` | Text |
| `--color-accent` / `--color-accent-hover` | `#ffb938` / `#ffc75f` | The one primary action, selected state, sliders and checks |
| `--color-on-accent` | `#2a1d14` | Text on accent |
| `--color-focus` | `#7fd4ff` | Focus ring |
| `--color-error` | `#ffb4a8` | Inline errors |
| `--check-light` / `--check-dark` | `#bdbdbd` / `#8a8a8a` | Transparency checkerboard |

The test `at least three themes and readable contrast` in `tests/logic.test.cjs` computes WCAG ratios for the overlay pairs: 4.5:1 for text, 3:1 for bar against track. It has not been run yet, so no ratios are claimed here.

## Typography

No web fonts are bundled. Both surfaces use system stacks, declared as `--font-sans` and `--font-data`:

- Sans: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "DejaVu Sans", sans-serif`
- Data: `ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace`, for values and the URL only, with `tabular-nums`

Weights in use are 400, 600 and 700.

| Configurator token | Size | Role |
| --- | --- | --- |
| `--t-small` | 14px | Labels, hints, small buttons, URL |
| `--t-body` | 16px | Body and all inputs |
| `--t-title` | 20px | Section headings, `h1` on narrow widths |
| `--t-brand` | 24px | `h1` from 60rem |

| Overlay token | Scene | Widget | Role |
| --- | --- | --- | --- |
| `--t-label` | 16px | 12px | Stat labels |
| `--t-value` | 28px | 16px | Stat values (session values at 0.8×) |
| `--t-status` | 22px | 13px | Status line, percentage, lost title |
| `--t-alert-title` | 36px | 18px | Alert title |
| `--t-alert-body` | 24px | 14px | Alert body |

Text uses natural letter-spacing and no `text-transform`. "SIGNAL LOST" is written in capitals in the strings because the brief names it that way.

## Layout

**Overlay:** `.rig` is absolutely positioned from `body[data-pos]`, with `--tx`/`--ty` centring the edge positions and `--origin` keeping the chosen edge fixed as `--scale` grows. Inset is 48px (scene) or 12px (widget). The art and panel sit in a row, reversed for right-hand positions. `fit()` in `overlay.js` lowers `--scale` when the rig would not fit the viewport. Alerts sit top centre, moving to bottom centre for `top*` positions so they stay clear of the rig on the scene page. On the 480 × 270 widget an alert may cover part of the rig while it shows.

**Configurator:** one column by default, in the order preview, URL and copy button, test alerts, settings, setup guide. From `60rem` it becomes two columns, `minmax(0, 1.6fr) minmax(340px, 1fr)`. The preview column is sticky only when the viewport is also at least `60rem` tall, so nothing is held out of reach. The spacing scale is 4, 8, 12, 16, 24 and 32px (`--space-*`). The preview keeps its source's aspect ratio and scales the iframe with a transform from `fitPreview()`.

## Elevation & Depth

The configurator is flat, using tonal layers only: `--color-bg`, then `--color-surface`, then `--color-surface-raised`. There are no shadows.

Overlay panels and alerts use a four-direction hard `box-shadow` in `--edge`, offset by `--px` (4px scene, 2px widget). It reads as a pixel frame with notched corners and keeps edges visible over any video. These surfaces have no border.

## Shapes

Overlay surfaces are square. Configurator controls have a 4px radius (`--radius`). The progress bar is cut into 20 segments by a repeating gradient in `.bar::after`. Art renders through `image-rendering: pixelated`.

## Components

| Component | Source | Notes |
| --- | --- | --- |
| Stage (hamster, wheel, props) | `createStage()` in `src/assets/art.js` | 160 × 120 canvas at 3× (scene) or 96 × 84 at 2× (widget). Modes: `spinning`, `sleeping`, `unknown`, plus `lost` and `motion`. Ambient life: blinks, breathing, rising z's, dust that follows RPM, a moth, twinkling stars. A twinkle changes state once every 1.8 seconds |
| Alert | `.alert` in `overlay.css`, `showAlert()` in `overlay.js` | One slide and fade over 240ms. Icon from `drawIcon()`. Uses `role="status"`. Fade only when still |
| Signal banner | `.signal` | Shown for any part selection. Uses `role="status"` |
| Stats | `.stats`, `stat()` | `dl` grid: 2 columns, single for supply, 3 for session (2 on the widget) |
| Progress bar | `.bar` | `role="progressbar"` with `aria-valuenow` |
| Button | `.btn`, `.btn-primary`, `.btn-small` | 44px minimum, `scale: 0.96` on press, hover gated by `(hover: hover)`. One primary per view |
| Choice | `.choice` | Radio card. Selected state is bold text, a raised background and an accent border, so it does not rely on colour alone |
| Check | `.check` | Checkbox row, 44px minimum, whole row clickable |
| Field | `.field`, `.field-msg` | Label, control, then a hint that becomes the error with `aria-invalid` |

## Do's and Don'ts

- Do add overlay settings to `SPEC` in `core.js`, so parsing, validation and URL building stay in one place, then add the control to `index.html` and a row to the README table.
- Do add a new theme as one `THEMES` entry. The contrast test covers it automatically.
- Do keep the overlay `html` and `body` transparent, and do not set `color-scheme` on only one of the two documents, because that can make the preview iframe opaque.
- Do keep sleep and running equally positive in the copy. Nothing may ask or reward the hamster for running.
- Don't add an API field read outside `normalizeStatus()`, which is what keeps bad payloads off the screen.
- Don't add repeating flashes to alerts.
- To add a page, start from `src/widget.html`, set `data-page`, add it to `PAGES`, and reuse `overlay.css`.
