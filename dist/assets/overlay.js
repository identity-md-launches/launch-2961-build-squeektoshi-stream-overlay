/* Squeektoshi Stream Overlay: runtime for overlay.html and widget.html. Reads the public API only. */
(function () {
  'use strict';
  const C = window.SqueekCore;
  const Art = window.SqueekArt;
  const root = document.documentElement;
  const body = document.body;
  const page = body.getAttribute('data-page') === 'widget' ? 'widget' : 'scene';
  const parsed = C.parseParams(window.location.search, page);
  const config = parsed.config;
  parsed.issues.forEach(function (issue) { console.warn('[overlay setting] ' + issue.message); });

  const T = C.strings(config.lang);
  const theme = C.THEMES[config.theme];
  root.lang = config.lang;
  Object.keys(theme.ui).forEach(function (key) { root.style.setProperty('--' + key, theme.ui[key]); });
  body.setAttribute('data-pos', config.pos);
  const has = function (part) { return config.parts.indexOf(part) >= 0; };

  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function motionOn() { return config.motion && !(motionQuery && motionQuery.matches); }
  function applyMotionClass() { body.classList.toggle('is-still', !motionOn()); }
  applyMotionClass();

  /* ---------- Session ---------- */
  const keepsSession = config.persist && !config.demo;
  const store = C.createSessionStore(function () { return keepsSession ? window.localStorage : null; }, 'squeektoshi.session.v1.' + page);
  const session = C.resolveSession(store.load(), config.reset, Date.now());
  store.save(session);
  const engine = C.createEngine({ session: session });
  const queue = C.createAlertQueue({ durationMs: config.alertsec * 1000, gapMs: 500 });

  /* ---------- Markup ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function setText(node, text) { if (node && node.textContent !== text) node.textContent = text; }
  function stat(list, label, extraClass) {
    const wrap = el('div', 'stat' + (extraClass ? ' ' + extraClass : ''));
    wrap.appendChild(el('dt', 'label', label));
    const value = el('dd', 'value', '–');
    wrap.appendChild(value);
    list.appendChild(wrap);
    return value;
  }

  const rig = el('div', 'rig');
  const refs = {};

  const statusLine = el('p', 'status');
  const signalBox = el('div', 'signal');
  signalBox.setAttribute('role', 'status');
  signalBox.hidden = true;
  signalBox.appendChild(el('strong', 'signal-title', T.lostTitle));
  signalBox.appendChild(el('span', 'signal-text', T.lostText));

  let stage = null;
  if (has('hamster')) {
    const art = el('div', 'art');
    const canvas = el('canvas', 'art-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    art.appendChild(canvas);
    art.appendChild(statusLine);
    rig.appendChild(art);
    stage = Art.createStage(canvas, { compact: page === 'widget', palette: C.artPalette(config.theme) });
  }

  const col = el('div', 'col');
  col.appendChild(signalBox);
  if (config.demo) col.appendChild(el('p', 'demo-tag', T.demo));

  const panel = el('div', 'panel');
  if (has('stats')) {
    if (!has('hamster')) panel.appendChild(statusLine);
    const list = el('dl', 'stats');
    refs.rpm = stat(list, T.rpm);
    if (page === 'scene') refs.speed = stat(list, T.speed);
    refs.distance = stat(list, T.distance);
    if (page === 'scene') refs.work = stat(list, T.work);
    refs.block = stat(list, T.block);
    refs.round = stat(list, T.round);
    panel.appendChild(list);
  }
  if (has('supply')) {
    const list = el('dl', 'stats stats-single');
    refs.supply = stat(list, T.supply);
    panel.appendChild(list);
  }
  if (has('progress')) {
    const wrap = el('div', 'progress');
    const row = el('div', 'progress-row');
    row.appendChild(el('span', 'label', T.progress));
    refs.percent = el('span', 'value', '–');
    row.appendChild(refs.percent);
    const bar = el('div', 'bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', T.progress);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    refs.bar = bar;
    refs.fill = el('div', 'bar-fill');
    bar.appendChild(refs.fill);
    wrap.appendChild(row);
    wrap.appendChild(bar);
    panel.appendChild(wrap);
  }
  if (has('session')) {
    const wrap = el('div', 'session');
    wrap.appendChild(el('p', 'session-title', T.session));
    const list = el('dl', 'stats stats-session');
    refs.sessionDistance = stat(list, T.sessionDistance);
    refs.sessionTime = stat(list, T.sessionTime);
    if (page === 'scene') refs.sessionRecord = stat(list, T.sessionRecord);
    wrap.appendChild(list);
    panel.appendChild(wrap);
  }
  if (panel.childElementCount > 0) col.appendChild(panel);
  rig.appendChild(col);
  body.appendChild(rig);

  const alertBox = el('div', 'alert');
  alertBox.setAttribute('role', 'status');
  const alertIcon = el('canvas', 'alert-icon');
  alertIcon.setAttribute('aria-hidden', 'true');
  const alertWords = el('div', 'alert-words');
  const alertTitle = el('p', 'alert-title');
  const alertBody = el('p', 'alert-body');
  alertWords.appendChild(alertTitle);
  alertWords.appendChild(alertBody);
  alertBox.appendChild(alertIcon);
  alertBox.appendChild(alertWords);
  body.appendChild(alertBox);

  /* The stated scale is honoured unless the rig would not fit the source, which would clip it. */
  function fit() {
    const width = rig.offsetWidth;
    const height = rig.offsetHeight;
    if (!width || !height || !window.innerWidth || !window.innerHeight) return;
    const inset = page === 'widget' ? 12 : 48;
    const room = Math.min((window.innerWidth - inset * 2) / width, (window.innerHeight - inset * 2) / height);
    root.style.setProperty('--scale', String(Math.max(0.25, Math.min(config.scale, room))));
  }
  window.addEventListener('resize', fit);

  /* ---------- Rendering ---------- */
  function artState() {
    const d = engine.display;
    const mode = d.coreStatus === 'SPINNING' ? 'spinning' : d.coreStatus === 'IDLE' ? 'sleeping' : 'unknown';
    const rpm = d.rpm || 0;
    return { mode: mode, rpm: rpm, lost: engine.signal() === 'lost', motion: motionOn(), speed: C.animationSpeed(rpm) };
  }
  function statusText() {
    const d = engine.display;
    if (d.coreStatus === 'SPINNING') return T.running + ' · ' + C.formatNumber(d.rpm, config.lang, 1) + ' ' + T.rpm;
    if (d.coreStatus === 'IDLE') return T.resting + ' · ' + T.healthyRest;
    return engine.signal() === 'connecting' ? T.connecting : T.unknown;
  }
  function renderSession(now) {
    const view = C.sessionView(session);
    const lastAt = engine.lastReadingAt();
    const extra = engine.isSpinning() && lastAt !== null ? Math.min(Math.max(0, now - lastAt), config.poll * 2000) : 0;
    setText(refs.sessionDistance, C.formatDistance(view.distanceMm, config.lang));
    setText(refs.sessionTime, C.formatDuration(view.runningMs + extra));
    setText(refs.sessionRecord, C.formatDistance(view.recordMm, config.lang));
  }
  function render() {
    const d = engine.display;
    const lang = config.lang;
    const lost = engine.signal() === 'lost';
    setText(statusLine, statusText());
    statusLine.setAttribute('data-mode', artState().mode);
    if (signalBox.hidden === lost) {
      signalBox.hidden = !lost;
      body.classList.toggle('is-lost', lost);
    }
    setText(refs.rpm, C.formatNumber(d.rpm, lang, 1));
    setText(refs.speed, C.formatSpeed(d.speedMmPerSecond, lang));
    setText(refs.distance, C.formatDistance(d.distanceMm, lang));
    setText(refs.work, C.formatNumber(d.workUnits, lang, 0));
    setText(refs.block, C.formatNumber(d.blockHeight, lang, 0));
    setText(refs.round, C.formatNumber(d.settledRound, lang, 0));
    if (refs.bar) {
      setText(refs.percent, C.formatPercent(d.blockProgress, lang));
      if (d.blockProgress !== null) {
        refs.fill.style.width = (d.blockProgress * 100).toFixed(2) + '%';
        refs.bar.setAttribute('aria-valuenow', (d.blockProgress * 100).toFixed(1));
      }
    }
    renderSession(Date.now());
    fit();
    if (stage && !motionOn()) stage.render(artState(), 0);
  }

  /* ---------- Sound: generated with the Web Audio API, off unless sound=1 ---------- */
  const NOTES = {
    wake: [523, 659, 784], sleep: [659, 523, 392], block: [784, 988],
    round: [587, 880], record: [523, 659, 784, 1047]
  };
  let audio = null;
  function chime(kind) {
    if (!config.sound || config.volume <= 0) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audio) audio = new Ctx();
      if (audio.state === 'suspended') audio.resume().catch(function () {});
      const peak = (config.volume / 100) * 0.2;
      (NOTES[kind] || NOTES.block).forEach(function (frequency, i) {
        const start = audio.currentTime + i * 0.13;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = kind === 'sleep' ? 'triangle' : 'square';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(start);
        osc.stop(start + 0.13);
      });
    } catch (_e) { /* Sound is optional. A blocked audio context leaves the visual alert untouched. */ }
  }

  /* ---------- Alerts ---------- */
  function alertValue(item) {
    if (item.kind === 'record') return C.formatDistance(item.value, config.lang);
    if (item.kind === 'block' || item.kind === 'round') return C.formatNumber(item.value, config.lang, 0);
    return null;
  }
  let shownAlert = null;
  function showAlert(item) {
    shownAlert = item;
    if (!item) {
      alertBox.classList.remove('is-on');
      return;
    }
    const text = C.alertText(item.kind, alertValue(item), config.lang);
    setText(alertTitle, text.title);
    setText(alertBody, text.body);
    Art.drawIcon(alertIcon, item.kind, theme.ui['on-accent']);
    alertBox.classList.add('is-on');
    chime(item.kind);
  }
  function handle(result) {
    result.events.forEach(function (event) {
      if (has('alerts') && C.alertEnabled(config, event.kind)) queue.push(event);
    });
    render();
    store.save(session);
  }

  /* ---------- Data ---------- */
  function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal })
      .then(function (response) {
        if (!response.ok) throw new Error('status ' + response.status);
        return response.json();
      })
      .finally(function () { clearTimeout(timer); });
  }
  function pollStatus() {
    const startedAt = Date.now();
    fetchJson(C.STATUS_URL, Math.max(4000, (config.poll - 1) * 1000))
      .then(function (json) { handle(engine.ingest(json, Date.now())); })
      .catch(function () { handle(engine.fail('request-failed', Date.now())); })
      .finally(function () { setTimeout(pollStatus, C.nextPollDelay(config.poll, startedAt, Date.now())); });
  }
  /* A separate chain: this endpoint failing can only leave the supply figure at its last good value. */
  function pollEconomy() {
    fetchJson(C.ECONOMY_URL, 8000)
      .then(function (json) {
        const text = C.formatSupply(json, config.lang);
        if (text) setText(refs.supply, text);
      })
      .catch(function () {})
      .finally(function () { setTimeout(pollEconomy, 60000); });
  }

  let feed = null;
  function demoTick() {
    const payload = feed.next(Date.now());
    handle(payload ? engine.ingest(payload, Date.now()) : engine.fail('demo-cut', Date.now()));
  }
  const SAMPLE_VALUES = { record: 4200, block: 8431, round: 1266, wake: null, sleep: null };
  function listenToConfigurator() {
    window.addEventListener('message', function (event) {
      if (window.parent === window || event.source !== window.parent) return;
      if (window.location.protocol !== 'file:' && event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'squeektoshi-demo') return;
      if (data.action === 'alert' && C.ALERT_KINDS.indexOf(data.kind) >= 0) {
        if (has('alerts') && C.alertEnabled(config, data.kind)) queue.push({ kind: data.kind, value: SAMPLE_VALUES[data.kind] });
      } else if (data.action === 'cut') {
        feed.setCut(Boolean(data.value));
        demoTick();
      }
    });
  }

  /* ---------- Loops ---------- */
  setInterval(function () {
    const now = Date.now();
    const active = queue.tick(now);
    if (active !== shownAlert) showAlert(active);
    renderSession(now);
  }, 250);

  let lastFrame = 0;
  function frame(time) {
    if (!motionOn()) { lastFrame = 0; return; }
    window.requestAnimationFrame(frame);
    if (time - lastFrame < 32) return;
    const dt = lastFrame ? time - lastFrame : 16;
    lastFrame = time;
    stage.render(artState(), dt);
  }
  function startFrames() {
    applyMotionClass();
    if (!stage) return;
    if (motionOn()) window.requestAnimationFrame(frame);
    else stage.render(artState(), 0);
  }
  if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', startFrames);

  render();
  startFrames();
  if (config.demo) {
    feed = C.createDemoFeed(Date.now());
    listenToConfigurator();
    demoTick();
    setInterval(demoTick, 2000);
    if (refs.supply) setText(refs.supply, C.formatSupply(feed.economy(), config.lang) || '–');
  } else {
    pollStatus();
    if (has('supply')) pollEconomy();
  }
})();
