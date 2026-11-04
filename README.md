# Squeektoshi Stream Overlay

A static, fully client-side streamer tool. It adds Squeektoshi, the Squeekchain hamster on the WHEELY9000 wheel, to a live stream as an OBS or Streamlabs browser source. It has a configurable transparent overlay, queued event alerts, a stream session counter, and an animated scene that keeps moving when nobody interacts with it.

No backend, no wallet, no signing, no keys, no accounts, no tracking. It only reads the public API.

**Verification status:** nothing here has been executed yet. The shell was unavailable for the whole build, so the build, tests, typecheck, probe and browser checks did not run, and `dist/` was written by hand. See [VALIDATION.md](VALIDATION.md) and run the commands below before relying on it.

## Pages

| Page | File | Browser source size | Use |
| --- | --- | --- | --- |
| Configurator | `index.html` | Normal browser | Live preview on a checkerboard, generates the URL |
| Full scene | `overlay.html` | 1920 × 1080 | Whole-scene overlay |
| Corner widget | `widget.html` | 480 × 270 | Small widget |

## Install, preview and rebuild

The site has no dependencies, so there is nothing to install beyond Node 20 or newer.

```sh
npm install        # nothing to fetch: the lockfile lists no packages
npm test           # URL parsing, signal, alert, session, queue, demo and contrast checks
npm run build      # copies src/ to dist/ (clears dist/ first)
npm run preview    # serves dist/ at http://127.0.0.1:4173/
npm run typecheck  # runs tsc on the JS with checkJs, fetching TypeScript through npx
```

Source lives in `src/`. `dist/` is the committed static export with relative URLs, so it works at a gateway subpath or on any static host. Edit `src/`, then rebuild. You can also open `dist/index.html` directly from disk, because the scripts are classic scripts rather than ES modules.

## Add the overlay to OBS Studio

1. Open the configurator, choose your settings and select **Copy overlay URL**.
2. In **Sources**, select **+** and choose **Browser**, then name it.
3. Paste the URL into **URL**. Leave **Local file** off, because that mode cannot carry query parameters.
4. Set **Width** and **Height**: 1920 × 1080 for `overlay.html`, 480 × 270 for `widget.html`.
5. For chimes, tick **Control audio via OBS** and add `sound=1`.
6. Transparency needs no setup. The page background is `transparent`. **Custom CSS** can stay at the OBS default or be empty. You can use it for tweaks such as `.panel { opacity: 0.9; }`, but do not add a background to `html` or `body`.
7. Turn off **Shutdown source when not visible** so the session counter and alerts keep running while the scene is hidden.

## Add the overlay to Streamlabs Desktop

1. Copy the URL from the configurator.
2. In **Sources**, select **+**, choose **Browser Source**, then **Add Source**.
3. Paste the URL and set the width and height as above.
4. Leave **Custom CSS** at its default. The same note about backgrounds applies.
5. Select **Done**, then drag and resize the source in the scene.

Sizing the source to anything other than the sizes above still works: the overlay shrinks its content to fit rather than clipping it.

## URL parameters

Every value is validated. A bad value falls back to the default or clamps to the nearest allowed value, and is logged to the browser console only. It never shows on stream. The configurator's **Check an existing URL** field lists those problems.

| Parameter | Default | Allowed values | Meaning |
| --- | --- | --- | --- |
| `pos` | `bottom-left` (scene), `bottom-right` (widget) | `top-left`, `top`, `top-right`, `left`, `right`, `bottom-left`, `bottom`, `bottom-right` | Where the hamster and panel sit |
| `scale` | `1` | `0.5` to `3` | Size multiplier, reduced automatically if it would not fit |
| `theme` | `burrow` | `burrow`, `arcade`, `paper`, `contrast` | Colour theme, including the art |
| `lang` | `en` | `en`, `tr` | On-stream language |
| `parts` | `hamster,stats,progress,session,alerts` | Comma list of `hamster`, `stats`, `progress`, `session`, `alerts`, `supply`, or `none` | Parts shown. `supply` adds the optional economy figure |
| `alert_wake` | `1` | `1`, `0` | Hamster woke up alert |
| `alert_sleep` | `1` | `1`, `0` | Hamster fell asleep alert |
| `alert_block` | `1` | `1`, `0` | New Squeek block alert |
| `alert_round` | `1` | `1`, `0` | Settlement round alert |
| `alert_record` | `1` | `1`, `0` | Session distance record alert |
| `alertsec` | `5` | Whole number, `2` to `15` | Seconds each alert stays on screen |
| `sound` | `0` | `1`, `0` | Web Audio chimes, generated in the browser. Off by default |
| `volume` | `40` | Whole number, `0` to `100` | Chime volume |
| `poll` | `7` | Whole number, `5` to `10` | Seconds between status requests |
| `reset` | empty | `1`, or a token of 1 to 32 letters, digits, `-`, `_` | `1` starts a new session on every load. Any other token starts one once, when the token changes |
| `persist` | `1` | `1`, `0` | Keep the session in `localStorage` |
| `motion` | `1` | `1`, `0` | `0` holds a still pose. `prefers-reduced-motion` does the same |
| `demo` | `0` | `1`, `0` | Simulated values, labelled "Demo data" on screen. No API requests, and nothing written to storage |

Booleans also accept `true`/`false`, `on`/`off` and `yes`/`no`. The configurator itself also accepts these parameters plus `page=widget` to open with a setting preloaded.

## Alerts

Alerts play one at a time with a 500 ms gap and never overlap. No alert fires on the first load.

| Alert | Fires when |
| --- | --- |
| Woke up | `measurement.coreStatus` goes from `IDLE` to `SPINNING` |
| Fell asleep | `measurement.coreStatus` goes from `SPINNING` to `IDLE` |
| New block | `builder.anchor.blockHeight` increases |
| Round confirmed | `builder.anchor.settledThroughRound` increases |
| Distance record | A run ends longer than every earlier run this session, and is at least 1 m |

The record fires when a run ends rather than while it is under way, so it reports the finished distance and never reads as pressure to keep running. If more alerts of one kind wait in the queue, the newest value replaces the older one. Alerts use one slide and fade and do not flash or blink.

## Data fields used

`GET https://api.squeekchain.com/v1/status`, polled every `poll` seconds:

| Field | Use |
| --- | --- |
| `measurement.coreStatus` | `SPINNING` runs, `IDLE` sleeps with a "zzz" |
| `measurement.rpmMilli` | `rpmMilli / 1000` is the RPM. Wheel speed is RPM × 6 degrees per second; leg speed is RPM × 0.25 frames per second, capped at 24 |
| `measurement.speedMmPerSecond` | Speed stat |
| `measurement.distanceMm` | Total distance and session distance |
| `measurement.cumulativeWorkUnits` | Work units stat |
| `measurement.freshness` | Anything except `online` means signal lost |
| `measurement.staleAfterSeconds` | Age limit, 120 seconds if missing |
| `measurement.observedAt`, `measurement.receivedAt`, `generatedAt` | Used to work out the age of the data |
| `builder.anchor.blockHeight` | Block stat and alert |
| `builder.anchor.blockProgress` | `value / 1e9`, clamped to 0 to 1, shown as a percentage |
| `builder.anchor.settledThroughRound` | Round stat and alert |

The live API places `freshness` and `staleAfterSeconds` under `measurement` and sends many numbers as strings. The parser accepts both strings and numbers, and also reads those two fields from the top level if they appear there.

`GET https://api.squeekchain.com/v1/economy/state` is requested only with `supply` in `parts`, once a minute. It uses `asset.symbol`, `asset.decimals` and `supply.liveSupplyBaseUnits`. It runs on its own request chain, so a failure there only leaves that one figure at its last value.

## Session counter

- **Distance:** the current `distanceMm` minus the first reading. If the hardware counter restarts, the distance already run is kept.
- **Running time:** time between consecutive fresh readings while `SPINNING`.
- **Longest run:** the largest distance of one continuous run (scene page only).
- **Where it lives:** `localStorage`, per page. If storage is missing or refuses, it stays in memory for that load and the overlay carries on. A session not updated for 12 hours starts over.

## Signal-lost behaviour

The overlay shows **SIGNAL LOST** (**SİNYAL KAYIP** in Turkish) when any of these is true:

- A request fails, times out or returns a non-success status.
- `measurement.freshness` is not `online`, or the payload is unusable.
- The data is older than `staleAfterSeconds`. Age is `generatedAt - observedAt`, so a wrong clock on the streaming PC does not cause a false alarm. A reading more than 5 minutes past the limit by the local clock also counts, and so does a `generatedAt` that stops changing for longer than the limit.

While lost, the last good values stay on screen, no alerts fire, the session distance and running time stop, and the wheel stops with a small no-signal icon. Polling continues, and the banner clears by itself on the next good reading. Before any data has arrived, values show as `–`. Raw error text is never displayed.

The first good reading after a loss is treated like a first load: it sets a new comparison point without alerts, so a recovery does not fire a burst. Distance covered during the gap is still counted, because the hardware counter measured it.

## Good to know

- Demo mode compresses time so every alert appears within about a minute. It polls every 2 seconds, ignoring `poll`.
- Under `prefers-reduced-motion` the hamster holds a still pose, and the status text still says what it is doing.
- In a normal browser, a page may need a click before it can play sound. OBS and Streamlabs generally do not require that, but it has not been tested in either app.
- `assets/og-image.svg` is an SVG because no tool was available to produce a PNG. Some link unfurlers do not render SVG, so a PNG is the better long-term choice.
- All pixel art is original to this project, drawn from text sprites and canvas pixels in `src/assets/art.js`.
