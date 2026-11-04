/* Squeektoshi Stream Overlay: configurator. Holds one config object, mirrors it to the form, the preview and the URL. */
(function () {
  'use strict';
  const C = window.SqueekCore;
  const form = document.getElementById('settings');
  const urlBox = document.getElementById('url');
  const copyStatus = document.getElementById('copy-status');
  const iframe = document.getElementById('preview');
  const frameBox = document.getElementById('preview-frame');
  const previewLive = document.getElementById('preview-live');
  const cutButton = document.getElementById('cut');
  const testsHint = document.getElementById('tests-hint');
  const CHECK_KEYS = ['alert_wake', 'alert_sleep', 'alert_block', 'alert_round', 'alert_record', 'sound', 'persist', 'motion', 'demo'];

  function currentPageFromLocation() {
    return new URLSearchParams(window.location.search).get('page') === 'widget' ? 'widget' : 'scene';
  }
  let page = currentPageFromLocation();
  const initialParams = new URLSearchParams(window.location.search);
  initialParams.delete('page');
  let config = C.parseParams(initialParams.toString(), page).config;

  function field(name) { return form.elements.namedItem(name); }
  function pageSpec() { return C.PAGES[page]; }

  /* ---------- Form mirrors config ---------- */
  function writeForm() {
    form.querySelector('input[name="page"][value="' + page + '"]').checked = true;
    form.querySelector('input[name="pos"][value="' + config.pos + '"]').checked = true;
    field('theme').value = config.theme;
    field('lang').value = config.lang;
    field('scale').value = String(config.scale);
    field('alertsec').value = String(config.alertsec);
    field('volume').value = String(config.volume);
    field('poll').value = String(config.poll);
    field('reset').value = config.reset;
    CHECK_KEYS.forEach(function (key) { field(key).checked = Boolean(config[key]); });
    form.querySelectorAll('input[name="part"]').forEach(function (box) {
      box.checked = config.parts.indexOf(box.value) >= 0;
    });
    clearFieldError('alertsec');
    clearFieldError('poll');
    clearFieldError('reset');
  }
  const FIELD_HINTS = {};
  ['alertsec', 'poll', 'reset'].forEach(function (key) {
    FIELD_HINTS[key] = document.getElementById(key + '-msg').textContent;
  });
  function clearFieldError(key) {
    const input = field(key);
    const msg = document.getElementById(key + '-msg');
    input.removeAttribute('aria-invalid');
    msg.textContent = FIELD_HINTS[key];
    msg.classList.remove('is-error');
  }
  function showFieldError(key, text) {
    const input = field(key);
    const msg = document.getElementById(key + '-msg');
    input.setAttribute('aria-invalid', 'true');
    msg.textContent = text;
    msg.classList.add('is-error');
  }
  /* A validated text field: a bad value is flagged next to it and the URL keeps the nearest valid value. */
  function readValidated(key) {
    const parsed = C.parseParam(key, field(key).value, page);
    if (parsed.issue) showFieldError(key, C.describeAllowed(C.specFor(key)));
    else clearFieldError(key);
    return parsed.value;
  }
  function readForm() {
    const checkedPage = form.querySelector('input[name="page"]:checked');
    const nextPage = checkedPage && checkedPage.value === 'widget' ? 'widget' : 'scene';
    const next = Object.assign({}, config);
    const checkedPos = form.querySelector('input[name="pos"]:checked');
    /* Switching page moves a position still on the old default to the new page's default. */
    if (nextPage !== page && checkedPos && checkedPos.value === C.parseParam('pos', null, page).value) {
      next.pos = C.parseParam('pos', null, nextPage).value;
      form.querySelector('input[name="pos"][value="' + next.pos + '"]').checked = true;
    } else if (checkedPos) {
      next.pos = checkedPos.value;
    }
    page = nextPage;
    next.theme = field('theme').value;
    next.lang = field('lang').value;
    next.scale = Number(field('scale').value);
    next.volume = Number(field('volume').value);
    next.alertsec = readValidated('alertsec');
    next.poll = readValidated('poll');
    next.reset = readValidated('reset');
    CHECK_KEYS.forEach(function (key) { next[key] = field(key).checked; });
    next.parts = C.PARTS.filter(function (part) {
      return form.querySelector('input[name="part"][value="' + part + '"]').checked;
    });
    config = next;
  }

  /* ---------- Output ---------- */
  function overlayUrl(cfg) {
    const url = new URL(pageSpec().file, window.location.href);
    url.search = '';
    url.hash = '';
    const query = C.buildQuery(cfg, page);
    return url.href + (query ? '?' + query : '');
  }
  function previewConfig() {
    const live = previewLive.checked;
    return Object.assign({}, config, { demo: !live, persist: false });
  }
  let previewTimer = null;
  function updatePreviewSoon() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      const next = overlayUrl(previewConfig());
      if (iframe.getAttribute('src') === next) return;
      iframe.setAttribute('src', next);
      /* A reload starts a fresh simulated feed, so the signal is back. */
      cutButton.setAttribute('aria-pressed', 'false');
      cutButton.textContent = 'Cut the signal';
    }, 200);
  }
  function fitPreview() {
    const spec = pageSpec();
    const width = frameBox.clientWidth;
    if (!width) return;
    frameBox.style.aspectRatio = spec.width + ' / ' + spec.height;
    iframe.style.width = spec.width + 'px';
    iframe.style.height = spec.height + 'px';
    iframe.style.transform = 'scale(' + width / spec.width + ')';
  }
  function updateTestControls() {
    const live = previewLive.checked;
    document.querySelectorAll('#test-buttons [data-alert]').forEach(function (button) {
      const kind = button.getAttribute('data-alert');
      button.disabled = live || config.parts.indexOf('alerts') < 0 || !C.alertEnabled(config, kind);
    });
    cutButton.disabled = live;
    if (live) testsHint.textContent = 'Test buttons work with simulated values. Turn off live preview to use them.';
    else if (config.parts.indexOf('alerts') < 0) testsHint.textContent = 'Turn on the Alerts part to test alerts.';
    else testsHint.textContent = 'The simulated hamster also wakes, sleeps and completes blocks by itself.';
  }
  function refresh() {
    const spec = pageSpec();
    urlBox.value = overlayUrl(config);
    document.getElementById('open').setAttribute('href', overlayUrl(config));
    document.getElementById('size-hint').textContent =
      'Set the browser source to ' + spec.width + ' × ' + spec.height + '.';
    document.getElementById('scale-out').textContent = C.formatNumber(config.scale, 'en', 2) + '×';
    document.getElementById('volume-out').textContent = config.volume + '%';
    field('volume').disabled = !config.sound;
    fitPreview();
    updateTestControls();
    updatePreviewSoon();
  }
  function onFormChange() {
    readForm();
    copyStatus.textContent = '';
    refresh();
  }
  form.addEventListener('input', onFormChange);
  form.addEventListener('change', onFormChange);
  form.addEventListener('submit', function (event) { event.preventDefault(); });
  previewLive.addEventListener('change', function () { updateTestControls(); updatePreviewSoon(); });

  /* ---------- Copy ---------- */
  function copyFallback() {
    urlBox.focus();
    urlBox.select();
    try { return document.execCommand('copy'); } catch (_e) { return false; }
  }
  document.getElementById('copy').addEventListener('click', function () {
    const done = function () { copyStatus.textContent = 'Copied. Paste it into your browser source.'; };
    const failed = function () {
      if (copyFallback()) done();
      else {
        urlBox.focus();
        urlBox.select();
        copyStatus.textContent = 'Unable to copy automatically. The URL is selected: press Ctrl+C or Cmd+C.';
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(urlBox.value).then(done, failed);
    else failed();
  });
  urlBox.addEventListener('focus', function () { urlBox.select(); });

  /* ---------- Reset token ---------- */
  document.getElementById('new-token').addEventListener('click', function () {
    field('reset').value = 'stream-' + Date.now().toString(36);
    onFormChange();
  });

  /* ---------- Test alerts talk to the preview by postMessage, same origin only ---------- */
  function tellPreview(message) {
    if (!iframe.contentWindow) return;
    const target = window.location.protocol === 'file:' ? '*' : window.location.origin;
    iframe.contentWindow.postMessage(Object.assign({ type: 'squeektoshi-demo' }, message), target);
  }
  document.getElementById('test-buttons').addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button === cutButton) {
      const on = cutButton.getAttribute('aria-pressed') !== 'true';
      cutButton.setAttribute('aria-pressed', String(on));
      cutButton.textContent = on ? 'Restore the signal' : 'Cut the signal';
      tellPreview({ action: 'cut', value: on });
      return;
    }
    tellPreview({ action: 'alert', kind: button.getAttribute('data-alert') });
  });

  /* ---------- Check an existing URL ---------- */
  document.getElementById('load').addEventListener('click', function () {
    const input = document.getElementById('paste');
    const out = document.getElementById('paste-msg');
    out.textContent = '';
    input.removeAttribute('aria-invalid');
    out.classList.remove('is-error');
    let parsedUrl = null;
    try { parsedUrl = new URL(input.value.trim()); } catch (_e) { parsedUrl = null; }
    if (!parsedUrl) {
      input.setAttribute('aria-invalid', 'true');
      out.classList.add('is-error');
      out.textContent = 'Paste the full overlay URL, starting with https:// or file://.';
      input.focus();
      return;
    }
    page = /widget\.html$/.test(parsedUrl.pathname) ? 'widget' : 'scene';
    const result = C.parseParams(parsedUrl.search, page);
    config = result.config;
    writeForm();
    refresh();
    if (result.issues.length === 0) {
      out.textContent = 'All settings are valid and loaded into the form.';
      return;
    }
    out.classList.add('is-error');
    const intro = document.createElement('p');
    intro.textContent = 'Loaded with safe values. Fix these in your saved URL:';
    const list = document.createElement('ul');
    result.issues.forEach(function (issue) {
      const item = document.createElement('li');
      item.textContent = issue.message;
      list.appendChild(item);
    });
    out.appendChild(intro);
    out.appendChild(list);
  });

  /* ---------- Start ---------- */
  if ('ResizeObserver' in window) new ResizeObserver(fitPreview).observe(frameBox);
  else window.addEventListener('resize', fitPreview);
  writeForm();
  refresh();
})();
