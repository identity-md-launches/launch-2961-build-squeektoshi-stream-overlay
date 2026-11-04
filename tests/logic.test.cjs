// Zero-dependency checks for URL parsing, stale and signal logic, alerts, session and themes. Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const C = require(path.join(__dirname, '..', 'src', 'assets', 'core.js'));
const Art = require(path.join(__dirname, '..', 'src', 'assets', 'art.js'));

const T0 = Date.parse('2026-11-04T10:00:00.000Z');
function payload(now, overrides) {
  const o = overrides || {};
  const stamp = new Date(now).toISOString();
  return {
    generatedAt: stamp,
    measurement: {
      freshness: o.freshness === undefined ? 'online' : o.freshness,
      observedAt: o.observedAt || stamp,
      staleAfterSeconds: 120,
      coreStatus: o.status || 'IDLE',
      rpmMilli: o.rpmMilli === undefined ? 0 : o.rpmMilli,
      speedMmPerSecond: 0,
      distanceMm: o.distance === undefined ? 1000 : o.distance,
      cumulativeWorkUnits: '92730'
    },
    builder: {
      anchor: {
        blockHeight: String(o.height === undefined ? 8430 : o.height),
        blockProgress: String(o.progress === undefined ? 478838171 : o.progress),
        settledThroughRound: String(o.round === undefined ? 1265 : o.round)
      }
    }
  };
}
function engine() { return C.createEngine({ session: C.newSession('') }); }
function kinds(result) { return result.events.map((e) => e.kind); }

test('defaults differ only where the page needs it', () => {
  assert.equal(C.parseParams('', 'scene').config.pos, 'bottom-left');
  assert.equal(C.parseParams('', 'widget').config.pos, 'bottom-right');
  const { config, issues } = C.parseParams('', 'scene');
  assert.equal(issues.length, 0);
  assert.equal(config.sound, false);
  assert.equal(config.poll, 7);
  assert.equal(config.demo, false);
  assert.deepEqual(config.parts, C.DEFAULT_PARTS);
});

test('every parameter validates and falls back', () => {
  const { config, issues } = C.parseParams('pos=moon&theme=neon&lang=de&poll=3&scale=9&volume=abc&sound=maybe&reset=a%20b&parts=wings&bogus=1', 'scene');
  assert.equal(config.pos, 'bottom-left');
  assert.equal(config.theme, 'burrow');
  assert.equal(config.lang, 'en');
  assert.equal(config.poll, 5);
  assert.equal(config.scale, 3);
  assert.equal(config.volume, 40);
  assert.equal(config.sound, false);
  assert.equal(config.reset, '');
  assert.deepEqual(config.parts, C.DEFAULT_PARTS);
  assert.deepEqual(issues.map((i) => i.key).sort(), ['bogus', 'lang', 'parts', 'poll', 'pos', 'reset', 'scale', 'sound', 'theme', 'volume']);
});

test('poll stays inside 5 to 10 seconds', () => {
  assert.equal(C.parseParams('poll=30', 'scene').config.poll, 10);
  assert.equal(C.parseParams('poll=1', 'scene').config.poll, 5);
  assert.equal(C.parseParams('poll=8', 'scene').config.poll, 8);
});

test('parts accept a list, unknown tokens and none', () => {
  assert.deepEqual(C.parseParams('parts=hamster,alerts', 'scene').config.parts, ['hamster', 'alerts']);
  assert.deepEqual(C.parseParams('parts=none', 'scene').config.parts, []);
  const mixed = C.parseParams('parts=hamster,wings', 'scene');
  assert.deepEqual(mixed.config.parts, ['hamster']);
  assert.equal(mixed.issues.length, 1);
});

test('buildQuery omits defaults and round-trips', () => {
  const base = C.parseParams('', 'scene').config;
  assert.equal(C.buildQuery(base, 'scene'), '');
  const custom = Object.assign({}, base, { theme: 'paper', lang: 'tr', pos: 'top', sound: true, alert_block: false, parts: ['hamster', 'supply'], reset: 'stream-1', scale: 1.5 });
  const query = C.buildQuery(custom, 'scene');
  const back = C.parseParams(query, 'scene');
  assert.equal(back.issues.length, 0);
  assert.deepEqual(back.config, custom);
  assert.equal(C.buildQuery(Object.assign({}, base, { parts: [] }), 'scene'), 'parts=none');
});

test('progress divides by 1e9 and clamps', () => {
  assert.equal(C.clampProgress('500000000'), 0.5);
  assert.equal(C.clampProgress('2000000000'), 1);
  assert.equal(C.clampProgress(-5), 0);
  assert.equal(C.clampProgress('garbage'), null);
  assert.equal(C.normalizeStatus(payload(T0)).blockProgress, 0.478838171);
});

test('animation speed is proportional to rpmMilli / 1000', () => {
  const reading = C.normalizeStatus(payload(T0, { status: 'SPINNING', rpmMilli: 30000 }));
  assert.equal(reading.rpm, 30);
  const low = C.animationSpeed(10);
  const high = C.animationSpeed(20);
  assert.equal(high.wheelDegPerSecond, low.wheelDegPerSecond * 2);
  assert.equal(high.legFramesPerSecond, low.legFramesPerSecond * 2);
  assert.equal(C.animationSpeed(0).wheelDegPerSecond, 0);
});

test('no alerts fire on the first reading', () => {
  const result = engine().ingest(payload(T0, { status: 'SPINNING', height: 9000, round: 2000 }), T0);
  assert.equal(result.signal, 'live');
  assert.deepEqual(result.events, []);
});

test('wake, sleep, block and round alerts fire on increases only', () => {
  const e = engine();
  e.ingest(payload(T0), T0);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 7000, { status: 'SPINNING' }), T0 + 7000)), ['wake']);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 14000, { status: 'SPINNING', height: 8431 }), T0 + 14000)), ['block']);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 21000, { status: 'SPINNING', height: 8431, round: 1266 }), T0 + 21000)), ['round']);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 28000, { status: 'SPINNING', height: 8400, round: 1266 }), T0 + 28000)), []);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 35000, { status: 'IDLE', height: 8400, round: 1266 }), T0 + 35000)), ['sleep']);
});

test('freshness other than online, old data and failures mean signal lost with no alerts', () => {
  const e = engine();
  e.ingest(payload(T0, { distance: 5000 }), T0);
  const offline = e.ingest(payload(T0 + 7000, { freshness: 'offline', status: 'SPINNING', height: 9999 }), T0 + 7000);
  assert.equal(offline.signal, 'lost');
  assert.deepEqual(offline.events, []);
  assert.equal(e.display.blockHeight, 8430, 'keeps the last good values');
  assert.equal(C.sessionView(e.session).distanceMm, 0);

  const old = new Date(T0 + 1000).toISOString();
  const stale = e.ingest(payload(T0 + 500000, { observedAt: old, distance: 999999 }), T0 + 500000);
  assert.equal(stale.signal, 'lost');
  assert.equal(stale.reason, 'stale');
  assert.equal(C.sessionView(e.session).distanceMm, 0, 'stale data adds no session distance');

  assert.equal(e.fail().signal, 'lost');
  assert.equal(e.ingest(null, T0).signal, 'lost');
  assert.equal(e.ingest({ measurement: 'nope' }, T0).signal, 'lost');
  assert.equal(e.ingest('<html>', T0).signal, 'lost');
});

test('a server response frozen past staleAfterSeconds counts as stale', () => {
  const e = engine();
  const frozen = payload(T0);
  assert.equal(e.ingest(frozen, T0).signal, 'live');
  assert.equal(e.ingest(frozen, T0 + 60000).signal, 'live');
  assert.equal(e.ingest(frozen, T0 + 121000).signal, 'lost');
});

test('a self-consistent reading older than staleAfterSeconds by the local clock is lost', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const old = '2026-11-04T11:57:00Z';
  const cached = {
    generatedAt: old,
    measurement: { freshness: 'online', observedAt: old, staleAfterSeconds: 120, coreStatus: 'SPINNING', rpmMilli: 60000, distanceMm: 1000 }
  };
  const e = engine();
  const result = e.ingest(cached, now);
  assert.equal(result.signal, 'lost');
  assert.equal(result.reason, 'stale');
  assert.equal(e.isSpinning(), false);
  assert.equal(e.display.coreStatus, null, 'a stale reading never reaches the screen');
  assert.equal(e.session.baselineMm, null, 'a stale reading never sets the session baseline');
});

test('the age limit is exact, and every timestamp the payload offers is checked', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const at = (ms) => new Date(now - ms).toISOString();
  const verdict = (json) => C.freshnessVerdict(C.normalizeStatus(json), now);
  const shape = (generatedAt, observedAt) => ({ generatedAt, measurement: { freshness: 'online', observedAt, staleAfterSeconds: 120 } });
  assert.equal(verdict(shape(at(120000), at(120000))).ok, true, 'exactly at the limit is still fresh');
  assert.equal(verdict(shape(at(120001), at(120001))).ok, false, 'one millisecond past the limit is stale');
  assert.equal(verdict(shape(at(0), at(121000))).ok, false, 'an old measurement in a new response');
  assert.equal(verdict(shape(at(121000), undefined)).ok, false, 'no observedAt falls back to generatedAt');
  assert.equal(verdict(shape(undefined, at(121000))).ok, false, 'no generatedAt still ages observedAt');
  assert.equal(verdict(shape(undefined, undefined)).ok, true, 'no timestamps at all leaves only freshness');
});

test('polling runs start to start, whatever the response time', () => {
  assert.equal(C.nextPollDelay(10, 1000, 3500), 7500, 'a 2.5 second response keeps a 10 second start interval');
  assert.equal(C.nextPollDelay(5, 0, 4000), 1000, 'a timed-out request at poll=5');
  assert.equal(C.nextPollDelay(10, 0, 9000), 1000, 'a timed-out request at poll=10');
  assert.equal(C.nextPollDelay(7, 0, 0), 7000);
  assert.equal(C.nextPollDelay(7, 0, 20000), 0, 'a late request never gives a negative delay');
  assert.equal(C.nextPollDelay(7, 5000, 1000), 7000, 'a clock stepping backwards never stretches the interval');
});

test('running time freezes at a loss and resumes without going backwards', () => {
  const e = engine();
  e.ingest(payload(T0, { status: 'SPINNING', distance: 1000 }), T0);
  assert.equal(e.fail('request-failed', T0 + 7000).signal, 'lost');
  assert.equal(C.sessionView(e.session).runningMs, 7000, 'the time since the last reading is kept');
  e.fail('request-failed', T0 + 14000);
  e.ingest(payload(T0 + 21000, { freshness: 'offline', status: 'SPINNING' }), T0 + 21000);
  assert.equal(C.sessionView(e.session).runningMs, 7000, 'frozen for the whole outage');
  e.ingest(payload(T0 + 28000, { status: 'SPINNING', distance: 2000 }), T0 + 28000);
  assert.equal(C.sessionView(e.session).runningMs, 7000, 'the outage itself is not counted');
  e.ingest(payload(T0 + 35000, { status: 'SPINNING', distance: 3000 }), T0 + 35000);
  assert.equal(C.sessionView(e.session).runningMs, 14000, 'counting resumes from the frozen value');
});

test('a loss while resting adds no running time, and a long gap is bounded', () => {
  const idle = engine();
  idle.ingest(payload(T0), T0);
  idle.fail('request-failed', T0 + 7000);
  assert.equal(C.sessionView(idle.session).runningMs, 0);
  const asleepPc = engine();
  asleepPc.ingest(payload(T0, { status: 'SPINNING' }), T0);
  asleepPc.fail('request-failed', T0 + 3600000);
  assert.equal(C.sessionView(asleepPc.session).runningMs, 30000);
});

test('recovery is silent and resumes by itself', () => {
  const e = engine();
  e.ingest(payload(T0), T0);
  e.fail();
  const back = e.ingest(payload(T0 + 7000, { status: 'SPINNING', height: 8500, round: 1300 }), T0 + 7000);
  assert.equal(back.signal, 'live');
  assert.deepEqual(back.events, []);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 14000, { status: 'IDLE', height: 8500, round: 1300 }), T0 + 14000)), ['sleep']);
});

test('missing fields keep the last good value and never throw', () => {
  const e = engine();
  e.ingest(payload(T0), T0);
  const sparse = { generatedAt: new Date(T0 + 7000).toISOString(), measurement: { freshness: 'online' } };
  const result = e.ingest(sparse, T0 + 7000);
  assert.equal(result.signal, 'live');
  assert.equal(e.display.blockHeight, 8430);
  assert.equal(e.display.coreStatus, 'IDLE');
  const weird = e.ingest({ generatedAt: new Date(T0 + 14000).toISOString(), measurement: { freshness: 'online', coreStatus: 'FLYING', rpmMilli: 'fast', distanceMm: -4 }, builder: 7 }, T0 + 14000);
  assert.deepEqual(weird.events, []);
  assert.equal(e.display.coreStatus, 'IDLE');
});

test('session distance is the difference from the first reading, running time counts SPINNING only', () => {
  const e = engine();
  e.ingest(payload(T0, { distance: 7000000 }), T0);
  e.ingest(payload(T0 + 7000, { status: 'SPINNING', distance: 7000000 }), T0 + 7000);
  e.ingest(payload(T0 + 14000, { status: 'SPINNING', distance: 7002000 }), T0 + 14000);
  e.ingest(payload(T0 + 21000, { status: 'IDLE', distance: 7003000 }), T0 + 21000);
  e.ingest(payload(T0 + 28000, { status: 'IDLE', distance: 7003000 }), T0 + 28000);
  const view = C.sessionView(e.session);
  assert.equal(view.distanceMm, 3000);
  assert.equal(view.runningMs, 14000);
  assert.equal(view.recordMm, 3000);
});

test('a counter restart keeps the distance already run', () => {
  const e = engine();
  e.ingest(payload(T0, { distance: 5000 }), T0);
  e.ingest(payload(T0 + 7000, { distance: 8000 }), T0 + 7000);
  e.ingest(payload(T0 + 14000, { distance: 100 }), T0 + 14000);
  e.ingest(payload(T0 + 21000, { distance: 600 }), T0 + 21000);
  assert.equal(C.sessionView(e.session).distanceMm, 3500);
});

test('the distance record fires when a longer run ends, not for shorter runs', () => {
  const e = engine();
  e.ingest(payload(T0, { distance: 0 }), T0);
  e.ingest(payload(T0 + 7000, { status: 'SPINNING', distance: 0 }), T0 + 7000);
  const first = e.ingest(payload(T0 + 14000, { status: 'IDLE', distance: 5000 }), T0 + 14000);
  assert.deepEqual(kinds(first), ['sleep', 'record']);
  assert.equal(first.events[1].value, 5000);
  e.ingest(payload(T0 + 21000, { status: 'SPINNING', distance: 5000 }), T0 + 21000);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 28000, { status: 'IDLE', distance: 6000 }), T0 + 28000)), ['sleep']);
  e.ingest(payload(T0 + 35000, { status: 'SPINNING', distance: 6000 }), T0 + 35000);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 42000, { status: 'IDLE', distance: 13000 }), T0 + 42000)), ['sleep', 'record']);
});

test('a record under one metre still fires, and an empty run does not', () => {
  const e = engine();
  e.ingest(payload(T0, { distance: 1000 }), T0);
  e.ingest(payload(T0 + 7000, { status: 'SPINNING', distance: 1000, rpmMilli: 5000 }), T0 + 7000);
  const short = e.ingest(payload(T0 + 14000, { distance: 1500 }), T0 + 14000);
  assert.deepEqual(short.events, [{ kind: 'sleep', value: null }, { kind: 'record', value: 500 }]);
  assert.equal(C.sessionView(e.session).recordMm, 500);
  e.ingest(payload(T0 + 21000, { status: 'SPINNING', distance: 1500 }), T0 + 21000);
  assert.deepEqual(kinds(e.ingest(payload(T0 + 28000, { distance: 1500 }), T0 + 28000)), ['sleep']);
});

test('reset rules and storage failure', () => {
  const stored = Object.assign(C.newSession('a'), { baselineMm: 10, lastMm: 50, savedAt: T0 });
  assert.equal(C.resolveSession(stored, '', T0 + 1000).baselineMm, 10);
  assert.equal(C.resolveSession(stored, 'a', T0 + 1000).baselineMm, 10);
  assert.equal(C.resolveSession(stored, 'b', T0 + 1000).baselineMm, null);
  assert.equal(C.resolveSession(stored, '1', T0 + 1000).baselineMm, null);
  assert.equal(C.resolveSession(stored, '', T0 + C.SESSION_MAX_AGE_MS + 1).baselineMm, null);
  assert.equal(C.resolveSession({ v: 9 }, '', T0).baselineMm, null);
  assert.equal(C.resolveSession('junk', '', T0).baselineMm, null);

  const throwing = C.createSessionStore(() => { throw new Error('denied'); }, 'k');
  assert.equal(throwing.load(), null);
  assert.equal(throwing.save({}), false);
  const broken = C.createSessionStore(() => ({ getItem() { return '{bad'; }, setItem() { throw new Error('quota'); } }), 'k');
  assert.equal(broken.load(), null);
  assert.equal(broken.save({}), false);
});

test('the alert queue shows one at a time with a gap', () => {
  const q = C.createAlertQueue({ durationMs: 1000, gapMs: 200 });
  q.push({ kind: 'wake' });
  q.push({ kind: 'block', value: 1 });
  q.push({ kind: 'block', value: 2 });
  assert.equal(q.tick(0).kind, 'wake');
  assert.equal(q.tick(500).kind, 'wake');
  assert.equal(q.tick(1000), null);
  assert.equal(q.tick(1100), null);
  const next = q.tick(1200);
  assert.equal(next.kind, 'block');
  assert.equal(next.value, 2, 'a waiting alert of one kind holds the newest value');
  assert.equal(q.pendingCount(), 0);
});

test('demo feed runs through the engine and produces alerts', () => {
  const feed = C.createDemoFeed(T0);
  const e = engine();
  const seen = new Set();
  let firstEvents = null;
  for (let t = 0; t <= 130000; t += 2000) {
    const result = e.ingest(feed.next(T0 + t), T0 + t);
    assert.equal(result.signal, 'live');
    if (firstEvents === null) firstEvents = result.events;
    result.events.forEach((ev) => seen.add(ev.kind));
  }
  assert.deepEqual(firstEvents, []);
  C.ALERT_KINDS.forEach((kind) => assert.ok(seen.has(kind), kind + ' fires in the demo'));
  feed.setCut(true);
  assert.equal(feed.next(T0 + 140000), null);
});

test('both languages have every string, and supply formats safely', () => {
  const keys = Object.keys(C.strings('en'));
  assert.deepEqual(Object.keys(C.strings('tr')), keys);
  C.ALERT_KINDS.forEach((kind) => {
    assert.ok(C.alertText(kind, 5, 'en').title);
    assert.ok(C.alertText(kind, 5, 'tr').title);
  });
  assert.equal(C.strings('tr').lostTitle, 'SİNYAL KAYIP');
  assert.equal(C.strings('en').lostTitle, 'SIGNAL LOST');
  assert.match(C.formatSupply({ asset: { symbol: 'SQK', decimals: 18 }, supply: { liveSupplyBaseUnits: '33547602104353572063931817' } }, 'en'), /33\.5M SQK/);
  assert.equal(C.formatSupply({ asset: { symbol: 'SQK', decimals: 18 }, supply: { liveSupplyBaseUnits: 'x' } }, 'en'), null);
  assert.equal(C.formatSupply(null, 'en'), null);
  assert.equal(C.formatDuration(3723000), '1:02:03');
  assert.equal(C.formatDuration(65000), '01:05');
});

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('at least three themes and readable contrast in each, computed from the token pairs', () => {
  assert.ok(Object.keys(C.THEMES).length >= 3);
  Object.entries(C.THEMES).forEach(([name, theme]) => {
    const ui = theme.ui;
    assert.ok(ratio(ui.text, ui.panel) >= 4.5, name + ' text');
    assert.ok(ratio(ui.muted, ui.panel) >= 4.5, name + ' muted');
    assert.ok(ratio(ui['on-accent'], ui.accent) >= 4.5, name + ' alert text');
    assert.ok(ratio(ui['lost-text'], ui['lost-bg']) >= 4.5, name + ' signal lost text');
    assert.ok(ratio(ui.accent, ui.track) >= 3, name + ' progress bar');
  });
});

test('sprites keep a rectangular shape', () => {
  const widths = (rows) => new Set(rows.map((r) => r.length));
  assert.deepEqual([...widths(Art.BODY)], [24]);
  assert.deepEqual([...widths(Art.SLEEPING)], [24]);
  Art.LEGS.forEach((frame) => assert.deepEqual([...widths(frame)], [24]));
  Object.values(Art.ALERT_ICONS).forEach((icon) => {
    assert.equal(icon.length, 12);
    assert.deepEqual([...widths(icon)], [12]);
  });
});
