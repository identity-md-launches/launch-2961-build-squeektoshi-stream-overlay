# Portable settings and storage schema

The source of truth is `src/assets/settings.js` and `types/model.d.ts`. The static output accepts the original `overlay.html` and `widget.html` links. Old URLs without `v` retain the original parameter parser, clamping/defaults and page defaults. The original 28 tests are unchanged.

## Version and limits

Version 2 settings are `{version:2,page,sessionId,config,presentation}`. `page` is `scene` or `widget`; `sessionId` is 1–32 ASCII letters, digits, hyphens or underscores. A legacy URL gets `legacy-scene` or `legacy-widget`; new configurator drafts and profile copies use cryptographic random IDs. IDs are not credentials.

OBS links use the original query keys plus `v=2`, `sid`, and optional `p` (base64url of UTF-8 JSON presentation). `p` has no padding and carries only validated values. Defaults are omitted. Setup links point to `index.html` and additionally carry `page` and `ui=en|tr`. Preview background, zoom, guides, live/demo selector and editor handles never enter output URLs. `demo=1` explicitly requests simulated OUTPUT.

The complete generated URL is limited to 16,384 characters (the serialized query is ASCII). Parsed query strings are limited to the same length. Versioned URLs reject duplicate/unknown keys, bad values, unsupported versions and malformed encoding before applying anything. The legacy parser remains tolerant for old links; the configurator's Check and load action rejects issues rather than silently changing the input. Parameter arrays for parts are treated as sets and serialize in original canonical order.

Settings exports use `{app:"squeektoshi-overlay",version:2,settings:...}` and a maximum UTF-8 size of 32,768 bytes. Unknown properties at every object level are rejected. Imports never contain endpoint overrides, executable code, arbitrary CSS, measured session counters or profile collections. Bad import/URL checks leave the current settings intact. Invalid initial versioned URLs preserve a valid local draft if one exists.

## Original config fields

| Field | Accepted values; original default |
| --- | --- |
| `pos` | `top-left`, `top`, `top-right`, `left`, `right`, `bottom-left`, `bottom`, `bottom-right`; scene bottom-left, widget bottom-right |
| `scale` | 0.5–3; 1 |
| `theme` | burrow, arcade, paper, contrast; burrow |
| `lang` | en, tr; en |
| `parts` | hamster, stats, progress, session, alerts, supply; all except supply; `none` hides all |
| `alert_wake/sleep/block/round/record` | boolean; true |
| `alertsec` | integer 2–15 seconds; 5 |
| `sound` | boolean; false |
| `volume` | integer 0–100; 40 |
| `poll` | integer 5–10 seconds; 7 |
| `reset` | empty or 1–32 ASCII token characters; empty; literal `1` starts a new session on every load |
| `persist`, `motion` | boolean; true |
| `demo` | boolean; false |

Legacy booleans accept 1/true/on/yes and 0/false/off/no. Fractional legacy scale values are rounded to two decimals. Original scene/widget defaults are unchanged. Fresh samples with absent/invalid numbers display a dash; an outage retains and labels the last good values. Display counts accept finite nonnegative numbers through `Number.MAX_SAFE_INTEGER`; values beyond that supported precision become missing.

## Presentation fields

| Field | Values / bounds |
| --- | --- |
| `format` | scene: 1920x1080 (default), 1280x720, 1080x1920, 1080x1080; widget: 480x270 |
| `layout` | legacy (default), horizontal, vertical, custom |
| `inset` | 0–120 output pixels; defaults 48 scene / 12 widget |
| `font` | 75–150 percent; 100 |
| `opacity` | 0–100 percent for panel background only; 100 |
| `fps` | exactly 15 or 30; 30 |
| `metrics` | unique subset of rpm, speed, distance, work, block, round, at most six; original widget omits speed/work |
| `distance` | auto, m, km; auto; source millimetres ÷1000 or ÷1,000,000 |
| `speed` | m/s, km/h; m/s; source mm/s ÷1000, then ×3.6 for km/h |
| `colors` | panel/text/accent each empty or `#` plus six HEX digits; never raw CSS |
| `boxes` | exactly the six parts; each `{x,y,w,scale}`; x/y 0–100%, width 10–100%, scale 0.5–2 |
| `alert` | `{pos,width,scale}`; pos auto, custom, or an original position; width 20–100%; text scale 75–150% |
| `sounds` | five kinds; each `{tone,level}`; bell, soft, arcade or off; level 0–100 |
| `templates` | en/tr × five kinds × `{title,body}`; max 80/160 Unicode string code units; only `{value}` placeholder; controls, `<`, `>`, unmatched braces rejected |
| `locked`, `snap` | boolean; false/true defaults; snap grid 5% |

For alerts, only x/y are read from `boxes.alerts`; alert width and text size are controlled by `alert.width` and `alert.scale`.

Coordinates represent travel within the available output region: x=100 means right edge, not an off-screen origin. Grouped placement uses actual visible children, so hamster-only output has no phantom column. Each group/part scales down to fit the container and inset. Alerts reserve a disjoint region; custom position changes can reduce the companion's effective fit. Widgets widen overly narrow alerts and reduce alert text toward 12px before applying any final container-fit scale. Typical 480×270 output supports maximal Turkish templates without clipping; unusually small host containers can require a further global reduction. Requested and effective companion fit scales are shown in preview options. Arbitrary video contrast remains dependent on the video.

## Local stores and concurrency

- `squeektoshi.draft.v2`: one validated version 2 draft plus interface language.
- `squeektoshi.profiles.v2`: `{version:2,items:[{id,name,settings}]}`, maximum 30 profiles, name maximum 48 characters. Visual edits preserve IDs; copy/create allocate a new session ID. Delete is confirmed and undoable.
- `squeektoshi.sessions.v2.<id>.<token-or-keep>`: `{version:2,id,token,updatedAt,session}`. The internal original accumulator remains `v:1` for compatibility, with bounded numeric validation on load. Session fields: token, baselineMm, carryMm, lastMm, runningMs, recordMm, runStartMm, savedAt, counterEpoch, gaps, startedAt. Baseline/last/run-start may be null; numeric fields must be finite, nonnegative and at most `Number.MAX_SAFE_INTEGER`; epoch is null or a string of at most 128 characters. Timestamps are milliseconds since Unix epoch; measured time is milliseconds and distances are millimetres. Corrupt records are ignored. Reports include only records with an actual measurement (`startedAt>0`) and at most 100 records from this browser.

Web Locks grant one writer for an ID/token. Another same-ID mount keeps private in-memory counters and never overwrites the first writer. Different IDs or reset tokens are independent. Without Web Locks, persistence fails closed to private memory. Denied, corrupt and quota-limited storage leaves the overlay usable; settings can be downloaded. OBS/browser storage is never assumed to be shared.

The original 12-hour resume rule is retained. Reload, loss and epoch transitions close continuous runs. Only observed increments count toward measured distance; unobserved outage distance is excluded. The observed best survives a gap. A lower counter is the fallback when no epoch change is available; increases in a different epoch are also rebaselined. Recovery/first load never replay alerts. Running-time interpolation caps at 30 seconds and is committed at loss before freezing, preventing rollback.

The alert queue has at most six pending entries, replaces an already-pending kind with its newest value, uses a 500ms gap, and clears on signal loss/update/destroy. Diagnostics retain at most 40 events. Manual tests temporarily pause automatic demo alerts. Audio and fetch continuations are guarded against destroyed mounts and canceled sound generations. A 250ms text/queue timer is separate from the capped 15/30 FPS art loop; motion-off/reduced-motion stops continuous canvas drawing and still permits a new static pose after a state change.
