/* Squeektoshi Stream Overlay: pure logic shared by the overlay, the configurator and the Node tests.
   Classic script on purpose: it also runs from file:// in an OBS browser source, where ES modules are blocked.
   Nothing here touches the DOM, the network or the clock directly. */
(function (root) {
  'use strict';

  const STATUS_URL = 'https://api.squeekchain.com/v1/status';
  const ECONOMY_URL = 'https://api.squeekchain.com/v1/economy/state';
  const POSITIONS = ['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'];
  const LANGS = ['en', 'tr'];
  /** @type {import('../../types/model').Part[]} */
  const PARTS = ['hamster', 'stats', 'progress', 'session', 'alerts', 'supply'];
  /** @type {import('../../types/model').Part[]} */
  const DEFAULT_PARTS = ['hamster', 'stats', 'progress', 'session', 'alerts'];
  /** @type {import('../../types/model').Kind[]} */
  const ALERT_KINDS = ['wake', 'sleep', 'block', 'round', 'record'];
  const PAGES = {
    scene: { file: 'overlay.html', width: 1920, height: 1080, label: 'Full scene' },
    widget: { file: 'widget.html', width: 480, height: 270, label: 'Corner widget' }
  };
  const DEFAULT_STALE_SECONDS = 120;
  const MAX_RUNNING_STEP_MS = 30 * 1000;
  const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const TOKEN_RE = /^[A-Za-z0-9_-]{1,32}$/;

  /* ---------- Themes. Every UI pair is checked for contrast in tests/logic.test.cjs. ---------- */
  const BASE_ART = {
    outline: '#2b1a0e', fur: '#e0a15a', furDark: '#b9743a', belly: '#fff0d6', cheek: '#f6c992',
    eye: '#14090a', pink: '#f08f94', rim: '#f4f0e6', rimDark: '#8d8a84', disc: '#3a2a1e', spoke: '#a9958a',
    metal: '#cfd3d6', plate: '#5a4431', plateText: '#fdf3df', floor: '#6f4f33', floorDark: '#4a3424',
    hay: '#e6c463', z: '#fdf3df', zEdge: '#2b1a0e', moon: '#ffe9a8', star: '#fff6d8', dust: '#d8c4a5',
    lost: '#ffd24d', bowl: '#c95f43', seed: '#f5e2a6', moth: '#fff6d8'
  };
  const THEMES = {
    burrow: {
      label: 'Burrow',
      ui: {
        panel: '#2a1d14', text: '#fdf3df', muted: '#d8c4a5', accent: '#ffb938', 'on-accent': '#2a1d14',
        track: '#4a3626', edge: '#120b06', 'lost-bg': '#fbe3a0', 'lost-text': '#2a1d14'
      },
      art: {}
    },
    arcade: {
      label: 'Arcade',
      ui: {
        panel: '#10162f', text: '#eaf6ff', muted: '#a9c3dd', accent: '#4fe3c1', 'on-accent': '#0b1226',
        track: '#2b3562', edge: '#050817', 'lost-bg': '#ffd0e4', 'lost-text': '#24102a'
      },
      art: {
        outline: '#0b1226', disc: '#1a2350', spoke: '#6f83c9', rim: '#7ff0d6', rimDark: '#2b8f86',
        plate: '#2b3562', plateText: '#eaf6ff', floor: '#2b3562', floorDark: '#161d44', hay: '#4fe3c1',
        z: '#7ff0d6', zEdge: '#0b1226', moon: '#d9e9ff', star: '#7ff0d6', dust: '#a9c3dd',
        lost: '#ff8fc4', bowl: '#ff6fae', seed: '#ffe28a', moth: '#7ff0d6'
      }
    },
    paper: {
      label: 'Paper',
      ui: {
        panel: '#fbf5e6', text: '#2b2a33', muted: '#5e5a55', accent: '#b23a2e', 'on-accent': '#ffffff',
        track: '#ded3bb', edge: '#2b2a33', 'lost-bg': '#2b2a33', 'lost-text': '#fbf5e6'
      },
      art: {
        outline: '#2b2a33', disc: '#fbf5e6', spoke: '#a79f8d', rim: '#2b2a33', rimDark: '#6d675c',
        plate: '#2b2a33', plateText: '#fbf5e6', floor: '#8b7f68', floorDark: '#5e5a55', hay: '#c9a94a',
        z: '#2b2a33', zEdge: '#fbf5e6', moon: '#2b2a33', star: '#b23a2e', dust: '#8b7f68',
        lost: '#b23a2e', bowl: '#b23a2e', seed: '#2b2a33', moth: '#2b2a33'
      }
    },
    contrast: {
      label: 'High contrast',
      ui: {
        panel: '#000000', text: '#ffffff', muted: '#e6e6e6', accent: '#ffe600', 'on-accent': '#000000',
        track: '#4d4d4d', edge: '#ffffff', 'lost-bg': '#ffffff', 'lost-text': '#000000'
      },
      art: {
        outline: '#000000', fur: '#ffcf70', furDark: '#c98a2e', disc: '#000000', spoke: '#ffffff',
        rim: '#ffffff', rimDark: '#bdbdbd', plate: '#000000', plateText: '#ffffff', floor: '#ffffff',
        floorDark: '#bdbdbd', hay: '#ffe600', z: '#ffffff', zEdge: '#000000', moon: '#ffe600',
        star: '#ffffff', dust: '#ffffff', lost: '#ffe600', bowl: '#ffe600', seed: '#000000', moth: '#ffe600'
      }
    }
  };
  function artPalette(themeKey) {
    const theme = THEMES[themeKey] || THEMES.burrow;
    return Object.assign({}, BASE_ART, theme.art);
  }

  /* ---------- Language ---------- */
  const STRINGS = {
    en: {
      running: 'Running', resting: 'Resting', connecting: 'Connecting', unknown: 'Checking',
      healthyRest: 'Healthy rest', live: 'Live', lost: 'Lost', lastKnown: 'Last-known values', noData: 'No data yet', rpm: 'RPM', speed: 'Speed', distance: 'Total distance', work: 'Work units',
      block: 'Squeek block', round: 'Settled round', supply: 'Supply', progress: 'Block progress',
      session: 'This stream', sessionDistance: 'Distance', sessionTime: 'Running time', sessionRecord: 'Longest run',
      lostTitle: 'SIGNAL LOST', lostText: 'Showing the last good values. Reconnecting by itself.', demo: 'Demo data',
      alerts: {
        wake: ['Squeektoshi woke up', 'Back on the WHEELY9000.'],
        sleep: ['Squeektoshi fell asleep', 'Rest is healthy. Sweet dreams.'],
        block: ['Squeek block completed', 'Block {value} is done.'],
        round: ['Settlement round confirmed', 'Settled through round {value}.'],
        record: ['New session distance record', 'Longest run this stream: {value}.']
      }
    },
    tr: {
      running: 'Koşuyor', resting: 'Dinleniyor', connecting: 'Bağlanıyor', unknown: 'Kontrol ediliyor',
      healthyRest: 'Sağlıklı uyku', live: 'Canlı', lost: 'Bağlantı yok', lastKnown: 'Son bilinen değerler', noData: 'Henüz veri yok', rpm: 'RPM', speed: 'Hız', distance: 'Toplam mesafe', work: 'İş birimi',
      block: 'Squeek bloğu', round: 'Uzlaşılan tur', supply: 'Arz', progress: 'Blok ilerlemesi',
      session: 'Bu yayın', sessionDistance: 'Mesafe', sessionTime: 'Koşu süresi', sessionRecord: 'En uzun koşu',
      lostTitle: 'SİNYAL KAYIP', lostText: 'Son geçerli değerler ekranda. Kendiliğinden yeniden bağlanıyor.', demo: 'Demo verisi',
      alerts: {
        wake: ['Squeektoshi uyandı', 'Yeniden WHEELY9000 üzerinde.'],
        sleep: ['Squeektoshi uykuya daldı', 'Dinlenmek sağlıklıdır. İyi uykular.'],
        block: ['Squeek bloğu tamamlandı', 'Blok {value} bitti.'],
        round: ['Uzlaşma turu onaylandı', 'Tur {value} dahil uzlaşıldı.'],
        record: ['Yeni oturum mesafe rekoru', 'Bu yayının en uzun koşusu: {value}.']
      }
    }
  };
  function strings(lang) { return STRINGS[lang] || STRINGS.en; }
  function localeOf(lang) { return lang === 'tr' ? 'tr-TR' : 'en-US'; }
  function formatNumber(value, lang, digits) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '–';
    const d = digits === undefined ? 0 : digits;
    return new Intl.NumberFormat(localeOf(lang), { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  }
  function formatPercent(fraction, lang) {
    if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '–';
    return new Intl.NumberFormat(localeOf(lang), {
      style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1
    }).format(fraction);
  }
  function formatDistance(mm, lang) {
    if (mm === null || mm === undefined || !Number.isFinite(mm)) return '–';
    const metres = mm / 1000;
    if (metres >= 1000) return formatNumber(metres / 1000, lang, 2) + ' km';
    if (metres >= 100) return formatNumber(metres, lang, 0) + ' m';
    return formatNumber(metres, lang, 1) + ' m';
  }
  function formatSpeed(mmPerSecond, lang) {
    if (mmPerSecond === null || mmPerSecond === undefined || !Number.isFinite(mmPerSecond)) return '–';
    return formatNumber(mmPerSecond / 1000, lang, 2) + ' m/s';
  }
  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '00:00';
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return (hours > 0 ? hours + ':' : '') + pad(minutes) + ':' + pad(seconds);
  }
  function formatSupply(economy, lang) {
    if (!economy || !economy.asset || !economy.supply) return null;
    const symbol = economy.asset.symbol;
    const raw = economy.supply.liveSupplyBaseUnits;
    const decimals = Number(economy.asset.decimals);
    if (typeof symbol !== 'string' || !/^[A-Za-z0-9]{1,12}$/.test(symbol)) return null;
    if (typeof raw !== 'string' || !/^\d{1,78}$/.test(raw)) return null;
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
    const whole = Number(BigInt(raw) / (BigInt(10) ** BigInt(decimals)));
    const text = new Intl.NumberFormat(localeOf(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(whole);
    return text + ' ' + symbol;
  }
  function alertText(kind, value, lang) {
    const pair = strings(lang).alerts[kind];
    if (!pair) return { title: '', body: '' };
    const shown = value === null || value === undefined ? '–' : String(value);
    return { title: pair[0], body: pair[1].replace('{value}', shown) };
  }

  /* ---------- URL parameters ---------- */
  const TRUE_WORDS = ['1', 'true', 'on', 'yes'];
  const FALSE_WORDS = ['0', 'false', 'off', 'no'];
  const SPEC = [
    { key: 'pos', type: 'enum', values: POSITIONS, def: function (page) { return page === 'widget' ? 'bottom-right' : 'bottom-left'; } },
    { key: 'scale', type: 'number', min: 0.5, max: 3, def: 1 },
    { key: 'theme', type: 'enum', values: Object.keys(THEMES), def: 'burrow' },
    { key: 'lang', type: 'enum', values: LANGS, def: 'en' },
    { key: 'parts', type: 'parts', def: DEFAULT_PARTS },
    { key: 'alert_wake', type: 'bool', def: true },
    { key: 'alert_sleep', type: 'bool', def: true },
    { key: 'alert_block', type: 'bool', def: true },
    { key: 'alert_round', type: 'bool', def: true },
    { key: 'alert_record', type: 'bool', def: true },
    { key: 'alertsec', type: 'int', min: 2, max: 15, def: 5 },
    { key: 'sound', type: 'bool', def: false },
    { key: 'volume', type: 'int', min: 0, max: 100, def: 40 },
    { key: 'poll', type: 'int', min: 5, max: 10, def: 7 },
    { key: 'reset', type: 'token', def: '' },
    { key: 'persist', type: 'bool', def: true },
    { key: 'motion', type: 'bool', def: true },
    { key: 'demo', type: 'bool', def: false }
  ];
  function specFor(key) { return SPEC.find(function (s) { return s.key === key; }) || null; }
  function defaultFor(spec, page) {
    const value = typeof spec.def === 'function' ? spec.def(page) : spec.def;
    return Array.isArray(value) ? value.slice() : value;
  }
  function describeAllowed(spec) {
    if (spec.type === 'enum') return 'Use one of: ' + spec.values.join(', ') + '.';
    if (spec.type === 'bool') return 'Use 1 or 0.';
    if (spec.type === 'int') return 'Use a whole number from ' + spec.min + ' to ' + spec.max + '.';
    if (spec.type === 'number') return 'Use a number from ' + spec.min + ' to ' + spec.max + '.';
    if (spec.type === 'parts') return 'Use a comma list of: ' + PARTS.join(', ') + ', or none.';
    return 'Use 1 to 32 letters, digits, dashes or underscores.';
  }
  /* Returns { value, issue }. An invalid value never reaches the overlay: it clamps or falls back to the default. */
  function parseParam(key, raw, page) {
    const spec = specFor(key);
    if (!spec) return { value: undefined, issue: null };
    const fallback = defaultFor(spec, page);
    if (raw === null || raw === undefined) return { value: fallback, issue: null };
    const text = String(raw).trim();
    const bad = function (value) {
      return { value: value, issue: { key: key, value: text, message: key + ': ' + describeAllowed(spec) } };
    };
    switch (spec.type) {
      case 'enum': {
        const lower = text.toLowerCase();
        return spec.values.indexOf(lower) >= 0 ? { value: lower, issue: null } : bad(fallback);
      }
      case 'bool': {
        const lower = text.toLowerCase();
        if (TRUE_WORDS.indexOf(lower) >= 0) return { value: true, issue: null };
        if (FALSE_WORDS.indexOf(lower) >= 0) return { value: false, issue: null };
        return bad(fallback);
      }
      case 'int':
      case 'number': {
        if (text === '') return bad(fallback);
        const n = Number(text);
        if (!Number.isFinite(n)) return bad(fallback);
        const rounded = spec.type === 'int' ? Math.round(n) : Math.round(n * 100) / 100;
        const clamped = Math.min(spec.max, Math.max(spec.min, rounded));
        if (clamped !== n) return bad(clamped);
        return { value: clamped, issue: null };
      }
      case 'parts': {
        const lower = text.toLowerCase();
        if (lower === 'none') return { value: [], issue: null };
        const tokens = lower.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
        const valid = PARTS.filter(function (p) { return tokens.indexOf(p) >= 0; });
        if (valid.length === 0) return bad(fallback);
        const hasUnknown = tokens.some(function (t) { return !PARTS.some(p => p === t); });
        return hasUnknown ? bad(valid) : { value: valid, issue: null };
      }
      default:
        if (text === '') return { value: '', issue: null };
        return TOKEN_RE.test(text) ? { value: text, issue: null } : bad('');
    }
  }
  function parseParams(search, page) {
    const pageKey = page === 'widget' ? 'widget' : 'scene';
    const params = new URLSearchParams(search || '');
    const config = /** @type {import('../../types/model').Config} */ ({});
    const issues = [];
    SPEC.forEach(function (spec) {
      const raw = params.has(spec.key) ? params.get(spec.key) : null;
      const parsed = parseParam(spec.key, raw, pageKey);
      config[spec.key] = parsed.value;
      if (parsed.issue) issues.push(parsed.issue);
    });
    params.forEach(function (_value, key) {
      if (!specFor(key)) issues.push({ key: key, value: '', message: key + ': this is not an overlay setting, so it was ignored.' });
    });
    return { config: config, issues: issues };
  }
  /* Shortest query string for a config: values equal to their default are left out. */
  function buildQuery(config, page) {
    const pageKey = page === 'widget' ? 'widget' : 'scene';
    const out = new URLSearchParams();
    SPEC.forEach(function (spec) {
      const value = config[spec.key];
      if (value === undefined) return;
      const def = defaultFor(spec, pageKey);
      if (spec.type === 'parts') {
        const canonical = PARTS.filter(function (p) { return value.indexOf(p) >= 0; });
        const same = canonical.length === def.length && def.every(function (p) { return canonical.indexOf(p) >= 0; });
        if (!same) out.set(spec.key, canonical.length ? canonical.join(',') : 'none');
        return;
      }
      if (value === def) return;
      if (spec.type === 'bool') out.set(spec.key, value ? '1' : '0');
      else out.set(spec.key, String(value));
    });
    return out.toString().replace(/%2C/g, ',');
  }
  function alertEnabled(config, kind) { return config['alert_' + kind] !== false; }

  /* ---------- Reading the status payload defensively ---------- */
  function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function toNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  function toCount(v) {
    const n = toNumber(v);
    return n !== null && n >= 0 && n <= Number.MAX_SAFE_INTEGER ? n : null;
  }
  function toTime(v) {
    if (typeof v !== 'string') return null;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  function clampProgress(raw) {
    const n = toNumber(raw);
    if (n === null) return null;
    return Math.min(1, Math.max(0, n / 1e9));
  }
  function normalizeStatus(json) {
    if (!isObject(json) || !isObject(json.measurement)) return null;
    const m = json.measurement;
    const anchor = isObject(json.builder) && isObject(json.builder.anchor) ? json.builder.anchor : {};
    const status = m.coreStatus === 'SPINNING' || m.coreStatus === 'IDLE' ? m.coreStatus : null;
    const freshness = m.freshness !== undefined ? m.freshness : json.freshness;
    const staleRaw = toNumber(m.staleAfterSeconds !== undefined ? m.staleAfterSeconds : json.staleAfterSeconds);
    return {
      coreStatus: status,
      counterEpoch: (typeof m.counterEpoch === 'string' || typeof m.counterEpoch === 'number') ? String(m.counterEpoch).slice(0, 128) : null,
      rpm: (function () { const r = toCount(m.rpmMilli); return r === null ? null : r / 1000; })(),
      speedMmPerSecond: toCount(m.speedMmPerSecond),
      distanceMm: toCount(m.distanceMm),
      workUnits: toCount(m.cumulativeWorkUnits),
      freshness: typeof freshness === 'string' ? freshness : null,
      staleAfterSeconds: staleRaw !== null && staleRaw > 0 ? staleRaw : DEFAULT_STALE_SECONDS,
      observedAtMs: toTime(m.observedAt) !== null ? toTime(m.observedAt) : toTime(m.receivedAt),
      generatedAtMs: toTime(json.generatedAt),
      blockHeight: toCount(anchor.blockHeight),
      blockProgress: clampProgress(anchor.blockProgress),
      settledRound: toCount(anchor.settledThroughRound)
    };
  }
  /* Animation speed derives from rpmMilli / 1000. The wheel turns at true RPM; legs scale with it. */
  function animationSpeed(rpm) {
    const r = Number.isFinite(rpm) && rpm > 0 ? rpm : 0;
    return { wheelDegPerSecond: r * 6, legFramesPerSecond: Math.min(24, r * 0.25) };
  }
  /* Age is measured against the local clock with no allowance: a cached response can agree with itself and
     still be old. generatedAt - observedAt stays as a second check, for a server handing out an old measurement.
     A reading without observedAt is aged by generatedAt. */
  function freshnessVerdict(reading, now) {
    if (!reading) return { ok: false, reason: 'invalid' };
    if (reading.freshness !== 'online') return { ok: false, reason: 'not-online' };
    const limit = reading.staleAfterSeconds * 1000;
    const seenAt = reading.observedAtMs !== null ? reading.observedAtMs : reading.generatedAtMs;
    if (seenAt !== null && now - seenAt > limit) return { ok: false, reason: 'stale' };
    if (reading.generatedAtMs !== null && seenAt !== null && reading.generatedAtMs - seenAt > limit) {
      return { ok: false, reason: 'stale' };
    }
    return { ok: true, reason: null };
  }
  /* Requests run start to start, so response time is not added to the interval. The request timeout is shorter
     than the interval, so waiting for one to finish never overlaps or delays the next. */
  function nextPollDelay(pollSeconds, startedAt, now) {
    const interval = pollSeconds * 1000;
    return Math.min(interval, Math.max(0, interval - (now - startedAt)));
  }

  /* ---------- Stream session ---------- */
  function newSession(token) {
    return {
      v: 1, token: token || '', baselineMm: null, carryMm: 0, lastMm: null,
      runningMs: 0, recordMm: 0, runStartMm: null, savedAt: 0, counterEpoch: null, gaps: 0, startedAt: 0
    };
  }
  function sanitizeSession(stored) {
    if (!isObject(stored) || stored.v !== 1) return null;
    const num = function (v, fallback) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER ? v : fallback; };
    return {
      v: 1,
      token: typeof stored.token === 'string' && (stored.token === '' || TOKEN_RE.test(stored.token)) ? stored.token : '',
      baselineMm: num(stored.baselineMm, null),
      carryMm: Math.max(0, num(stored.carryMm, 0)),
      lastMm: num(stored.lastMm, null),
      runningMs: Math.max(0, num(stored.runningMs, 0)),
      recordMm: Math.max(0, num(stored.recordMm, 0)),
      runStartMm: num(stored.runStartMm, null),
      savedAt: num(stored.savedAt, 0),
      counterEpoch: typeof stored.counterEpoch === 'string' ? stored.counterEpoch.slice(0, 128) : null,
      gaps: Math.max(0, num(stored.gaps, 0)), startedAt: num(stored.startedAt, 0)
    };
  }
  /* reset=1 starts a new baseline on every load. Any other token starts one once, when the token changes. */
  function resolveSession(stored, resetToken, now) {
    const clean = sanitizeSession(stored);
    if (resetToken === '1') return newSession('1');
    if (!clean) return newSession(resetToken);
    if (resetToken && clean.token !== resetToken) return newSession(resetToken);
    if (now - clean.savedAt > SESSION_MAX_AGE_MS) return newSession(clean.token);
    return clean;
  }
  /* Storage may be missing or throw (private mode, disabled, quota). Then the session just lives in memory. */
  function createSessionStore(getStorage, key) {
    function storage() { try { return getStorage(); } catch (_e) { return null; } }
    return {
      load: function () {
        try {
          const s = storage();
          const raw = s ? s.getItem(key) : null;
          return raw ? JSON.parse(raw) : null;
        } catch (_e) { return null; }
      },
      save: function (session) {
        try {
          const s = storage();
          if (!s) return false;
          s.setItem(key, JSON.stringify(session));
          return true;
        } catch (_e) { return false; }
      }
    };
  }
  function runningStep(previousAt, now) {
    return Math.min(MAX_RUNNING_STEP_MS, Math.max(0, now - previousAt));
  }
  // Seal only observed distance; no continuous record crosses an outage or counter epoch.
  function breakContinuity(session) {
    if (session.runStartMm !== null && session.lastMm !== null) {
      session.recordMm = Math.max(session.recordMm, session.lastMm - session.runStartMm);
    }
    if (session.baselineMm !== null && session.lastMm !== null) {
      session.carryMm += Math.max(0, session.lastMm - session.baselineMm);
    }
    session.runStartMm = null;
    session.baselineMm = null;
    session.lastMm = null;
  }
  function applySessionReading(session, reading, previousStatus, previousAt, now) {
    const d = reading.distanceMm;
    const changedEpoch = reading.counterEpoch !== null && session.counterEpoch !== null &&
      reading.counterEpoch !== session.counterEpoch;
    const decreased = d !== null && session.lastMm !== null && d < session.lastMm;
    if (changedEpoch || decreased) breakContinuity(session);
    if (reading.counterEpoch !== null) session.counterEpoch = reading.counterEpoch;
    if (d !== null) {
      if (session.baselineMm === null) session.baselineMm = d;
      session.lastMm = d;
    }
    if (previousStatus === 'SPINNING' && previousAt !== null) {
      session.runningMs += runningStep(previousAt, now);
    }
    if (reading.coreStatus === 'SPINNING' && session.runStartMm === null && d !== null) session.runStartMm = d;
    session.savedAt = now;
    if (!session.startedAt) session.startedAt = now;
    if (reading.coreStatus === 'IDLE' && session.runStartMm !== null) {
      const run = session.lastMm === null ? 0 : Math.max(0, session.lastMm - session.runStartMm);
      session.runStartMm = null;
      if (run > session.recordMm) { session.recordMm = run; return run; }
    }
    return null;
  }
  function sessionView(session) {
    const distanceMm = session.baselineMm === null || session.lastMm === null
      ? 0 : session.carryMm + Math.max(0, session.lastMm - session.baselineMm);
    const currentRun = session.runStartMm !== null && session.lastMm !== null ? Math.max(0, session.lastMm - session.runStartMm) : 0;
    return { distanceMm: distanceMm, runningMs: session.runningMs, recordMm: Math.max(session.recordMm, currentRun) };
  }

  /* ---------- Engine: turns payloads into display values, signal state and alert events ---------- */
  function createEngine(options) {
    const session = options.session;
    let previous = null;
    let previousAt = null;
    let signal = 'connecting';
    let reason = null;
    let lastSuccess = null;
    let currentReading = null;
    let lastGenerated = null;
    let lastGeneratedChange = 0;
    const display = {
      coreStatus: null, rpm: null, speedMmPerSecond: null, distanceMm: null, workUnits: null,
      blockHeight: null, blockProgress: null, settledRound: null
    };
    function lose(why, now) {
      /* The overlay counts running time up between readings. Commit that time before the comparison point goes,
         so the counter freezes at the loss instead of dropping back to the last reading. */
      if (previous && previous.coreStatus === 'SPINNING' && previousAt !== null && Number.isFinite(now)) {
        session.runningMs += runningStep(previousAt, now);
      }
      /* Alerts re-baseline on recovery: the first good reading after a loss is treated like the first load. */
      if (signal === 'live') { breakContinuity(session); session.gaps += 1; }
      session.savedAt = Number.isFinite(now) ? now : session.savedAt;
      previous = null;
      previousAt = null;
      signal = 'lost';
      reason = why;
      return { signal: signal, reason: reason, events: [] };
    }
    function isFrozen(reading, now) {
      if (reading.generatedAtMs === null) return false;
      if (reading.generatedAtMs !== lastGenerated) {
        lastGenerated = reading.generatedAtMs;
        lastGeneratedChange = now;
        return false;
      }
      return now - lastGeneratedChange > reading.staleAfterSeconds * 1000;
    }
    return {
      session: session,
      display: display,
      signal: function () { return signal; },
      reason: function () { return reason; },
      isSpinning: function () { return signal === 'live' && display.coreStatus === 'SPINNING'; },
      lastReadingAt: function () { return previousAt; },
      lastSuccess: function () { return lastSuccess; },
      reading: function () { return currentReading; },
      fail: function (why, now) { return lose(why || 'request-failed', now); },
      ingest: function (json, now) {
        const reading = normalizeStatus(json);
        const verdict = freshnessVerdict(reading, now);
        if (!verdict.ok) return lose(verdict.reason, now);
        if (isFrozen(reading, now)) return lose('stale', now);
        Object.keys(display).forEach(function (key) {
          if (reading[key] !== null && reading[key] !== undefined) display[key] = reading[key];
        });
        currentReading = reading;
        lastSuccess = now;
        const record = applySessionReading(session, reading, previous ? previous.coreStatus : null, previousAt, now);
        const events = [];
        if (previous) {
          const nowStatus = reading.coreStatus;
          if (previous.coreStatus === 'IDLE' && nowStatus === 'SPINNING') events.push({ kind: 'wake', value: null });
          if (previous.coreStatus === 'SPINNING' && nowStatus === 'IDLE') events.push({ kind: 'sleep', value: null });
          if (record !== null) events.push({ kind: 'record', value: record });
          if (reading.blockHeight !== null && previous.blockHeight !== null && reading.blockHeight > previous.blockHeight) {
            events.push({ kind: 'block', value: reading.blockHeight });
          }
          if (reading.settledRound !== null && previous.settledRound !== null && reading.settledRound > previous.settledRound) {
            events.push({ kind: 'round', value: reading.settledRound });
          }
        }
        previous = {
          coreStatus: reading.coreStatus !== null ? reading.coreStatus : (previous ? previous.coreStatus : null),
          blockHeight: reading.blockHeight !== null ? reading.blockHeight : (previous ? previous.blockHeight : null),
          settledRound: reading.settledRound !== null ? reading.settledRound : (previous ? previous.settledRound : null)
        };
        previousAt = now;
        signal = 'live';
        reason = null;
        return { signal: signal, reason: null, events: events };
      }
    };
  }

  /* ---------- Alert queue: one at a time, with a gap, never overlapping ---------- */
  function createAlertQueue(options) {
    const opts = options || {};
    const durationMs = opts.durationMs || 5000;
    const gapMs = opts.gapMs === undefined ? 500 : opts.gapMs;
    const max = opts.max || 6;
    const pending = [];
    let active = null;
    let until = 0;
    let nextAt = 0;
    return {
      push: function (alert) {
        /* A newer alert of a waiting kind replaces it, so a backlog never replays stale counts. */
        const existing = pending.findIndex(function (p) { return p.kind === alert.kind; });
        if (existing >= 0) { pending[existing] = alert; return; }
        pending.push(alert);
        if (pending.length > max) pending.shift();
      },
      tick: function (now) {
        if (active && now >= until) { active = null; nextAt = now + gapMs; }
        if (!active && pending.length > 0 && now >= nextAt) {
          active = pending.shift();
          until = now + durationMs;
        }
        return active;
      },
      pendingCount: function () { return pending.length; },
      clear: function () { pending.length = 0; active = null; until = 0; nextAt = 0; }
    };
  }

  /* ---------- Demo feed: simulated payloads in the shape of the real API, run through the same engine ---------- */
  function createDemoFeed(start) {
    const WHEEL_MM_PER_REV = 628;
    const CYCLE_SECONDS = 64;
    const SPIN_WINDOWS = [[8, 34], [50, 64]];
    let lastAt = start;
    let distance = 7022244;
    let work = 92730;
    let height = 8430;
    let progress = 620000000;
    let round = 1265;
    let blocksSinceRound = 0;
    let cut = false;
    return {
      setCut: function (value) { cut = Boolean(value); },
      isCut: function () { return cut; },
      next: function (now) {
        const dt = Math.max(0, now - lastAt) / 1000;
        lastAt = now;
        if (cut) return null;
        const t = ((now - start) / 1000) % CYCLE_SECONDS;
        const spinning = SPIN_WINDOWS.some(function (w) { return t >= w[0] && t < w[1]; });
        const rpm = spinning ? 46 + 22 * Math.sin(t / 3) : 0;
        const speed = (rpm / 60) * WHEEL_MM_PER_REV;
        if (spinning) {
          distance += speed * dt;
          work += Math.round(dt * 2);
          progress += dt * 90000000;
          if (progress >= 1e9) {
            progress -= 1e9;
            height += 1;
            blocksSinceRound += 1;
            if (blocksSinceRound >= 2) { blocksSinceRound = 0; round += 1; }
          }
        }
        const stamp = new Date(now).toISOString();
        return {
          generatedAt: stamp,
          measurement: {
            freshness: 'online', observedAt: stamp, staleAfterSeconds: 120,
            coreStatus: spinning ? 'SPINNING' : 'IDLE',
            rpmMilli: Math.round(rpm * 1000), speedMmPerSecond: Math.round(speed),
            distanceMm: Math.round(distance), cumulativeWorkUnits: String(work)
          },
          builder: {
            anchor: {
              blockHeight: String(height), blockProgress: String(Math.round(progress)),
              settledThroughRound: String(round)
            }
          }
        };
      },
      economy: function () {
        return { asset: { symbol: 'SQK', decimals: 18 }, supply: { liveSupplyBaseUnits: '33547602104353572063931817' } };
      }
    };
  }

  const api = {
    STATUS_URL: STATUS_URL, ECONOMY_URL: ECONOMY_URL, POSITIONS: POSITIONS, LANGS: LANGS, PARTS: PARTS,
    DEFAULT_PARTS: DEFAULT_PARTS, ALERT_KINDS: ALERT_KINDS, PAGES: PAGES, THEMES: THEMES, SPEC: SPEC,
    SESSION_MAX_AGE_MS: SESSION_MAX_AGE_MS,
    artPalette: artPalette, strings: strings, formatNumber: formatNumber, formatPercent: formatPercent,
    formatDistance: formatDistance, formatSpeed: formatSpeed, formatDuration: formatDuration,
    formatSupply: formatSupply, alertText: alertText, describeAllowed: describeAllowed, specFor: specFor,
    parseParam: parseParam, parseParams: parseParams, buildQuery: buildQuery, alertEnabled: alertEnabled,
    normalizeStatus: normalizeStatus, clampProgress: clampProgress, animationSpeed: animationSpeed,
    freshnessVerdict: freshnessVerdict, nextPollDelay: nextPollDelay, newSession: newSession, resolveSession: resolveSession,
    createSessionStore: createSessionStore, applySessionReading: applySessionReading, sessionView: sessionView,
    breakContinuity: breakContinuity, createEngine: createEngine, createAlertQueue: createAlertQueue, createDemoFeed: createDemoFeed
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SqueekCore = api;
})(globalThis);
