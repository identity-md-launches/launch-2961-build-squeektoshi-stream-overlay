/* Squeektoshi Stream Overlay: original pixel art, drawn from scratch as strings and canvas pixels.
   The canvas works at low resolution and CSS scales it with image-rendering: pixelated. */
(function (root) {
  'use strict';

  /* o outline, f fur, d dark fur, l belly, c cheek, e eye, p pink */
  const BODY = [
    '..............oo..oo....',
    '.............oppooppo...',
    '........oooooofffffffo..',
    '......ooffffffffffffffo.',
    '.....offfddfffffeeffffo.',
    '....offfdddfffffeefffffo',
    '....offffddffffffffccfpo',
    '...offffffffffffffcccco.',
    '...offffffffllllllllcco.',
    '...offfffllllllllllllo..',
    '....offfllllllllllllo...',
    '.....oooooooooooooo.....'
  ];
  const LEGS = [
    ['....oo..............oo..', '...opo...............opo'],
    ['......oo........oo......', '......opo.......opo.....'],
    ['.........oo...oo........', '.........opo..opo.......'],
    ['......oo........oo......', '......opo.......opo.....']
  ];
  const SLEEPING = [
    '.........oooooooo.......',
    '......ooofffffffoooo....',
    '....oofffffffffffffpo...',
    '...offfddfffffffffffo...',
    '..offfdddffffffffffffo..',
    '..offffddfffffffoofffo..',
    '.offffffffffffffffccfpo.',
    '.offffffffffffffccccco..',
    '.offffffffflllllllllco..',
    '..offffflllllllllllo....',
    '...oooooooooooooooo.....'
  ];
  const MOON = [
    '...oooo....',
    '..oo.......',
    '.oo........',
    'ooo........',
    'ooo........',
    'ooo.......o',
    'oooo.....oo',
    '.ooooooooo.',
    '..ooooooo..'
  ];
  const NO_SIGNAL = [
    '..#######..',
    '.#.......#.',
    '#..#####..#',
    '..#.....#..',
    '....###....',
    '...#...#...',
    '.....#.....',
    '.....#.....'
  ];
  const GLYPHS = {
    W: ['#.#.#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    H: ['#.#', '#.#', '###', '#.#', '#.#'],
    E: ['###', '#..', '##.', '#..', '###'],
    L: ['#..', '#..', '#..', '#..', '###'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
    9: ['###', '#.#', '###', '..#', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###']
  };
  const Z_SMALL = ['##.', '.#.', '.##'];
  const Z_LARGE = ['#####', '...#.', '..#..', '.#...', '#####'];
  const ALERT_ICONS = {
    wake: [
      '.....##.....', '.#...##...#.', '..#......#..', '....####....', '...######...', '##.######.##',
      '##.######.##', '...######...', '....####....', '..#......#..', '.#...##...#.', '.....##.....'
    ],
    sleep: [
      '.....####...', '...###......', '..###.......', '.###........', '.###........', '.###........',
      '.###........', '.####.....#.', '..####...##.', '..#########.', '....#####...', '............'
    ],
    block: [
      '.....##.....', '...######...', '.##########.', '#.########.#', '##..####..##', '####.##.####',
      '#####..#####', '#####.######', '#####.######', '.####.#####.', '...##.###...', '.....##.....'
    ],
    round: [
      '...######...', '..#......#..', '.#........#.', '#.........##', '#........#.#', '#.#.....#..#',
      '#..#...#...#', '#...#.#....#', '#....#.....#', '.#........#.', '..#......#..', '...######...'
    ],
    record: [
      '.##......##.', '..##....##..', '...##..##...', '....####....', '...######...', '..###..###..',
      '..##.##.##..', '..##.##.##..', '..###..###..', '...######...', '....####....', '............'
    ]
  };

  function drawIcon(canvas, kind, color) {
    const rows = ALERT_ICONS[kind] || ALERT_ICONS.record;
    canvas.width = 12;
    canvas.height = 12;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 12, 12);
    ctx.fillStyle = color;
    rows.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') ctx.fillRect(x, y, 1, 1);
    });
  }

  function createStage(canvas, options) {
    const compact = Boolean(options.compact);
    const pal = options.palette;
    const W = compact ? 96 : 160;
    const H = compact ? 84 : 120;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const CX = compact ? 48 : 72;
    const CY = compact ? 38 : 52;
    const R = compact ? 34 : 46;
    const PLATE_Y = CY + R + 3;
    const FUR = { o: pal.outline, f: pal.fur, d: pal.furDark, l: pal.belly, c: pal.cheek, e: pal.eye, p: pal.pink };

    let angle = 0;
    let spin = 0;
    let legPhase = 0;
    let clock = 0;
    let nextBlink = 3000;
    let blinkUntil = 0;
    let zTimer = 0;
    let dustTimer = 0;
    const zs = [];
    const dust = [];

    function rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    }
    function ring(cx, cy, r, color) {
      ctx.fillStyle = color;
      let x = r;
      let y = 0;
      let err = 1 - r;
      while (x >= y) {
        [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(function (p) {
          ctx.fillRect(cx + p[0], cy + p[1], 1, 1);
        });
        y += 1;
        if (err < 0) err += 2 * y + 1;
        else { x -= 1; err += 2 * (y - x) + 1; }
      }
    }
    function disc(cx, cy, r, color) {
      ctx.fillStyle = color;
      for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y));
        ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
      }
    }
    function line(x0, y0, x1, y1, color) {
      ctx.fillStyle = color;
      let x = Math.round(x0);
      let y = Math.round(y0);
      const xe = Math.round(x1);
      const ye = Math.round(y1);
      const dx = Math.abs(xe - x);
      const dy = -Math.abs(ye - y);
      const sx = x < xe ? 1 : -1;
      const sy = y < ye ? 1 : -1;
      let err = dx + dy;
      for (let guard = 0; guard < 400; guard++) {
        ctx.fillRect(x, y, 1, 1);
        if (x === xe && y === ye) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    }
    function sprite(rows, x, y, colors, firstRow, lastRow) {
      const from = firstRow || 0;
      const to = lastRow === undefined ? rows.length - 1 : lastRow;
      for (let r = from; r <= to; r++) {
        const row = rows[r];
        for (let c = 0; c < row.length; c++) {
          const color = colors[row[c]];
          if (color) rect(x + c, y + r, 1, 1, color);
        }
      }
    }
    function glyphRows(rows, x, y, color) {
      sprite(rows, x, y, { '#': color });
    }
    function zGlyph(rows, x, y) {
      const edge = { '#': pal.zEdge };
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { sprite(rows, x + d[0], y + d[1], edge); });
      sprite(rows, x, y, { '#': pal.z });
    }

    function drawStand() {
      for (let off = -1; off <= 1; off++) {
        line(CX + off, CY, CX - R * 0.62 + off, PLATE_Y, pal.rimDark);
        line(CX + off, CY, CX + R * 0.62 + off, PLATE_Y, pal.rimDark);
      }
      const plateW = compact ? 57 : 62;
      const plateX = CX - Math.floor(plateW / 2);
      rect(plateX, PLATE_Y, plateW, 7, pal.plate);
      let textX = plateX + Math.floor((plateW - 41) / 2);
      'WHEELY9000'.split('').forEach(function (ch) {
        const rows = GLYPHS[ch];
        glyphRows(rows, textX, PLATE_Y + 1, pal.plateText);
        textX += rows[0].length + 1;
      });
    }
    function drawWheel() {
      disc(CX, CY, R, pal.disc);
      const rad = (angle * Math.PI) / 180;
      for (let k = 0; k < 8; k++) {
        const a = rad + (k * Math.PI) / 4;
        line(CX, CY, CX + Math.cos(a) * (R - 3), CY + Math.sin(a) * (R - 3), pal.spoke);
      }
      ring(CX, CY, R, pal.outline);
      ring(CX, CY, R - 1, pal.rim);
      ring(CX, CY, R - 2, pal.rim);
      const rungs = compact ? 20 : 28;
      for (let k = 0; k < rungs; k++) {
        const a = rad + (k * 2 * Math.PI) / rungs;
        rect(CX + Math.cos(a) * (R - 2), CY + Math.sin(a) * (R - 2), 1, 1, pal.rimDark);
        rect(CX + Math.cos(a) * (R - 1), CY + Math.sin(a) * (R - 1), 1, 1, pal.rimDark);
      }
      disc(CX, CY, 3, pal.metal);
      rect(CX, CY, 1, 1, pal.outline);
    }
    function drawRunner(frame, blinking) {
      const colors = Object.assign({}, FUR);
      if (blinking) colors.e = pal.furDark;
      const bob = frame % 2 === 1 ? 1 : 0;
      const x = CX - 12;
      const floor = CY + R - 3;
      const y = floor - 13;
      sprite(BODY, x, y + bob, colors);
      sprite(LEGS[frame], x, y + 12, FUR);
    }
    function drawSleeper(breathIn) {
      const x = CX - 12;
      const y = CY + R - 3 - 10;
      sprite(SLEEPING, x, y, FUR);
      if (breathIn) sprite(SLEEPING, x, y - 1, FUR, 0, 4);
    }
    function drawProps() {
      if (compact) return;
      const floorY = PLATE_Y + 7;
      rect(4, floorY, W - 8, 3, pal.floor);
      rect(4, floorY + 3, W - 8, 2, pal.floorDark);
      [[10, 3], [18, 2], [24, 4], [116, 3], [124, 2], [146, 3]].forEach(function (t) {
        line(t[0], floorY - 1, t[0] - 1, floorY - t[1], pal.hay);
        line(t[0] + 1, floorY - 1, t[0] + 2, floorY - t[1], pal.hay);
      });
      /* Food bowl with seeds: resting and running both have snacks waiting. */
      rect(126, floorY - 7, 26, 2, pal.bowl);
      rect(128, floorY - 5, 22, 3, pal.bowl);
      rect(130, floorY - 2, 18, 2, pal.bowl);
      [130, 133, 137, 140, 144, 147].forEach(function (x, i) { rect(x, floorY - 8 - (i % 2), 2, 1, pal.seed); });
    }
    function drawMoth() {
      if (compact) return;
      const x = 130 + Math.sin(clock / 1700) * 18 + Math.sin(clock / 610) * 4;
      const y = 30 + Math.cos(clock / 1300) * 16;
      const wing = Math.floor(clock / 180) % 2 === 0;
      rect(x, y, 1, 2, pal.moth);
      if (wing) { rect(x - 1, y, 1, 1, pal.moth); rect(x + 1, y, 1, 1, pal.moth); }
      else { rect(x - 1, y - 1, 1, 1, pal.moth); rect(x + 1, y - 1, 1, 1, pal.moth); }
    }
    function drawNight(still) {
      const mx = compact ? W - 12 : W - 30;
      const my = compact ? 1 : 8;
      sprite(MOON, mx, my, { o: pal.moon });
      if (compact) return;
      [[W - 44, 12, 0], [W - 14, 26, 1], [W - 40, 34, 2]].forEach(function (s) {
        /* A slow twinkle: one soft change every 1.8 seconds, far below any flash threshold. */
        const big = still ? true : (Math.floor(clock / 1800) + s[2]) % 3 !== 0;
        rect(s[0], s[1], 1, 1, pal.star);
        if (big) {
          rect(s[0] - 1, s[1], 1, 1, pal.star);
          rect(s[0] + 1, s[1], 1, 1, pal.star);
          rect(s[0], s[1] - 1, 1, 1, pal.star);
          rect(s[0], s[1] + 1, 1, 1, pal.star);
        }
      });
    }
    function drawZs(still, dt) {
      const startX = CX + 6;
      const startY = CY + R - 18;
      if (still) {
        zGlyph(Z_SMALL, startX + 6, startY - 8);
        zGlyph(Z_SMALL, startX + 12, startY - 16);
        zGlyph(Z_LARGE, startX + 18, startY - 28);
        return;
      }
      zTimer += dt;
      if (zTimer > 1400) {
        zTimer = 0;
        zs.push({ x: startX, y: startY, age: 0 });
      }
      for (let i = zs.length - 1; i >= 0; i--) {
        const z = zs[i];
        z.age += dt;
        if (z.age > 4200) { zs.splice(i, 1); continue; }
        z.y -= dt * 0.011;
        z.x += dt * 0.006 + Math.sin(z.age / 500) * 0.04;
        zGlyph(z.age > 2000 ? Z_LARGE : Z_SMALL, z.x, z.y);
      }
    }
    function drawDust(rpm, dt) {
      if (rpm > 0) {
        dustTimer += dt * rpm;
        while (dustTimer > 16000 && dust.length < 24) {
          dustTimer -= 16000;
          dust.push({ x: CX - R * 0.4, y: PLATE_Y - 2, vx: -0.018 - Math.random() * 0.02, vy: -0.006 - Math.random() * 0.01, age: 0 });
        }
        if (dustTimer > 16000) dustTimer = 0;
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.age += dt;
        if (d.age > 700) { dust.splice(i, 1); continue; }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        rect(d.x, d.y, 1, 1, pal.dust);
      }
    }

    /* state: { mode: 'spinning' | 'sleeping' | 'unknown', rpm, lost, motion, speed: { wheelDegPerSecond, legFramesPerSecond } } */
    return {
      render: function (state, dtMs) {
        if (!ctx) return;
        const still = !state.motion;
        const dt = still ? 0 : Math.min(100, dtMs);
        clock += dt;
        const running = state.mode === 'spinning' && !state.lost;
        const target = running ? state.speed.wheelDegPerSecond : 0;
        spin = still ? target : spin + (target - spin) * Math.min(1, dt / 400);
        angle = (angle + (spin * dt) / 1000) % 360;
        if (running) legPhase += (state.speed.legFramesPerSecond * dt) / 1000;
        if (clock > nextBlink) {
          blinkUntil = clock + 140;
          nextBlink = clock + 2600 + Math.random() * 3600;
        }
        const blinking = clock < blinkUntil;

        ctx.clearRect(0, 0, W, H);
        drawProps();
        drawStand();
        if (state.mode === 'sleeping') drawNight(still);
        drawWheel();
        if (state.mode === 'sleeping') {
          drawSleeper(!still && Math.floor(clock / 1100) % 2 === 0);
          if (!state.lost) drawZs(still, dt);
        } else if (running) {
          drawRunner(still ? 0 : Math.floor(legPhase) % 4, blinking);
          if (!still) drawDust(state.rpm, dt);
        } else {
          drawRunner(1, blinking);
        }
        drawMoth();
        if (state.lost) sprite(NO_SIGNAL, 2, 2, { '#': pal.lost });
      }
    };
  }

  const api = { createStage: createStage, drawIcon: drawIcon, BODY: BODY, LEGS: LEGS, SLEEPING: SLEEPING, ALERT_ICONS: ALERT_ICONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SqueekArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
