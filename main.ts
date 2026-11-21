// SØLVHOLM — a travel poster for a place that isn't there.
// Writes /output/entry.png: 1024x1024 PNG, drawn from scratch (no fonts, no network).

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 1024;
const SS = 3;
const RW = W * SS;

const buf = new Uint8Array(RW * RW * 3);

// ---------- deterministic noise ----------
let seed = 0x5eed1a7;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- primitives ----------
function put(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= RW || y >= RW) return;
  const i = (y * RW + x) * 3;
  if (a >= 1) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
  } else {
    buf[i] += (r - buf[i]) * a;
    buf[i + 1] += (g - buf[i + 1]) * a;
    buf[i + 2] += (b - buf[i + 2]) * a;
  }
}

function fillRect(x0, y0, x1, y1, c, a) {
  const X0 = Math.max(0, Math.round(x0 * SS)), X1 = Math.min(RW, Math.round(x1 * SS));
  const Y0 = Math.max(0, Math.round(y0 * SS)), Y1 = Math.min(RW, Math.round(y1 * SS));
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) put(x, y, c[0], c[1], c[2], a === undefined ? 1 : a);
}

function fillPoly(pts, c, a) {
  const n = pts.length;
  const P = new Array(n);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    P[i] = [pts[i][0] * SS, pts[i][1] * SS];
    if (P[i][1] < minY) minY = P[i][1];
    if (P[i][1] > maxY) maxY = P[i][1];
  }
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(RW - 1, Math.ceil(maxY));
  const xs = [];
  const alpha = a === undefined ? 1 : a;
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[(i + 1) % n];
      if ((p[1] <= yc && q[1] > yc) || (q[1] <= yc && p[1] > yc)) {
        xs.push(p[0] + ((yc - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((m, k) => m - k);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
      if (xa < 0) xa = 0;
      if (xb > RW) xb = RW;
      for (let x = xa; x < xb; x++) put(x, y, c[0], c[1], c[2], alpha);
    }
  }
}

function circlePts(cx, cy, r, seg) {
  const out = [];
  const n = seg || 72;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return out;
}

function softDisc(cx, cy, r, c, a, power) {
  const R = Math.round(r * SS);
  const CX = cx * SS, CY = cy * SS;
  const x0 = Math.max(0, Math.floor(CX - R)), x1 = Math.min(RW - 1, Math.ceil(CX + R));
  const y0 = Math.max(0, Math.floor(CY - R)), y1 = Math.min(RW - 1, Math.ceil(CY + R));
  const p = power || 2;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - CY;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - CX;
      const d = Math.sqrt(dx * dx + dy * dy) / R;
      if (d >= 1) continue;
      const f = Math.pow(1 - d, p);
      put(x, y, c[0], c[1], c[2], a * f);
    }
  }
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function gradient(stops, y) {
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) {
      const t = (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mix(stops[i - 1][1], stops[i][1], t);
    }
  }
  return stops[stops.length - 1][1];
}

// ---------- palette ----------
const CREAM = [247, 235, 214];
const GOLD = [244, 186, 122];
const HORIZON = 636;

const skyStops = [
  [0, [9, 17, 34]],
  [120, [18, 28, 52]],
  [260, [38, 44, 74]],
  [380, [74, 54, 84]],
  [470, [126, 68, 88]],
  [540, [176, 88, 92]],
  [592, [222, 128, 96]],
  [622, [243, 172, 118]],
  [HORIZON, [252, 214, 158]],
];

// ---------- 1. sky ----------
const HY = HORIZON * SS;
for (let y = 0; y < HY; y++) {
  const c = gradient(skyStops, y / SS);
  for (let x = 0; x < RW; x++) put(x, y, c[0], c[1], c[2], 1);
}

// ---------- 1b. stars ----------
for (let i = 0; i < 150; i++) {
  const y = Math.pow(rnd(), 1.5) * 330;
  const x = rnd() * W;
  const fade = 1 - y / 380;
  const r = 0.9 + rnd() * 1.5;
  const a = (0.15 + rnd() * 0.5) * fade;
  softDisc(x, y, r, [236, 232, 226], a, 1.4);
}

// ---------- 2. sun ----------
const sunX = 632, sunY = 598, sunR = 103;
softDisc(sunX, sunY, sunR * 3.4, [250, 176, 116], 0.5, 2.6);
softDisc(sunX, sunY, sunR * 1.9, [255, 205, 150], 0.55, 2.2);
softDisc(sunX, sunY, sunR, [255, 238, 206], 1, 1);
softDisc(sunX, sunY - 6, sunR * 0.82, [255, 250, 236], 0.9, 1);

// ---------- 3. thin cloud bars ----------
for (let i = 0; i < 9; i++) {
  const cy = 430 + i * 22 + rnd() * 8;
  const w = 150 + rnd() * 420;
  let cx = 120 + rnd() * 800;
  if (Math.abs(cx - sunX) < 190 && Math.abs(cy - sunY) < 90) cx += 260;
  if (cx > 980) cx -= 520;
  const h = 2.2 + rnd() * 4.5;
  const warm = Math.min(1, (cy - 380) / 240);
  const c = mix([92, 74, 104], [246, 168, 122], warm);
  const a = 0.12 + 0.2 * warm;
  const pts = [];
  const n = 24;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push([cx - w / 2 + w * t, cy - Math.sin(t * Math.PI) * h]);
  }
  for (let k = n; k >= 0; k--) {
    const t = k / n;
    pts.push([cx - w / 2 + w * t, cy + Math.sin(t * Math.PI) * h * 0.75]);
  }
  fillPoly(pts, c, a);
}

// ---------- 4. far mountains ----------
function ridge(baseY, amp, step, off) {
  const pts = [[-20, HORIZON + 6]];
  for (let x = -20; x <= W + 20; x += step) {
    const t = (x + off) / 150;
    const h = amp * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.7) * Math.cos(t * 0.63 + 1.1)));
    pts.push([x, baseY - h]);
  }
  pts.push([W + 20, HORIZON + 6]);
  return pts;
}
fillPoly(ridge(614, 104, 26, 40), [72, 62, 92], 0.7);
fillPoly(ridge(628, 66, 18, 260), [46, 44, 70], 0.85);
fillPoly(ridge(636, 34, 14, 610), [26, 28, 46], 0.92);

// a low island shoulder on the left, so the bay reads as enclosed
fillPoly([[-10, HORIZON + 4], [-10, 588], [60, 574], [150, 592], [210, 616], [230, HORIZON + 4]], [26, 30, 48], 1);

// three birds, high over the bay
for (const b of [[712, 452, 1], [752, 438, 0.8], [690, 430, 0.62]]) {
  const [bx, by, sc] = b;
  const wspan = 11 * sc;
  const lift = 5.5 * sc;
  fillPoly([[bx - wspan, by], [bx - wspan * 0.45, by - lift], [bx, by - lift * 0.25], [bx, by + 1.1], [bx - wspan * 0.45, by - lift * 0.45]], [20, 22, 36], 0.85);
  fillPoly([[bx + wspan, by], [bx + wspan * 0.45, by - lift], [bx, by - lift * 0.25], [bx, by + 1.1], [bx + wspan * 0.45, by - lift * 0.45]], [20, 22, 36], 0.85);
}

// ---------- 5. water ----------
for (let y = HY; y < RW; y++) {
  const d = (y - HY) / (RW - HY);
  const c = mix([70, 58, 78], [9, 16, 32], Math.pow(d, 0.5));
  for (let x = 0; x < RW; x++) put(x, y, c[0], c[1], c[2], 1);
}

// ---------- 6. the tower (drawn before its reflection) ----------
const tx = 352;
const rockTop = 652;
const baseY = 648;
const shaftTop = 452;
const halfBottom = 27, halfTop = 15;
const TOWER = [10, 16, 30];
const RIM = [255, 196, 138];

// rock outcrop
fillPoly([[tx - 96, rockTop + 26], [tx - 74, rockTop + 2], [tx - 22, rockTop - 8], [tx + 30, rockTop - 4], [tx + 74, rockTop + 10], [tx + 96, rockTop + 30], [tx + 60, 676], [tx - 56, 676]], [7, 12, 22], 1);
fillPoly([[tx - 74, rockTop + 2], [tx - 22, rockTop - 8], [tx + 30, rockTop - 4], [tx + 40, rockTop + 6], [tx - 40, rockTop + 8]], [16, 22, 36], 0.8);

// shaft
fillPoly([[tx - halfBottom, baseY], [tx - halfTop, shaftTop], [tx + halfTop, shaftTop], [tx + halfBottom, baseY]], TOWER, 1);
// rim light on the sunlit side
fillPoly([[tx + halfTop - 5, shaftTop], [tx + halfTop, shaftTop], [tx + halfBottom, baseY], [tx + halfBottom - 6, baseY]], RIM, 0.5);
// a few stone courses
for (let i = 1; i < 7; i++) {
  const t = i / 7;
  const y = shaftTop + (baseY - shaftTop) * t;
  const hw = halfTop + (halfBottom - halfTop) * t;
  fillRect(tx - hw, y, tx + hw, y + 1.4, [18, 24, 40], 0.5);
}
// windows, warm
for (let i = 0; i < 3; i++) {
  const y = shaftTop + 54 + i * 46;
  fillRect(tx - 4, y, tx + 4, y + 13, [255, 198, 132], 0.95);
  softDisc(tx, y + 6, 20, [255, 190, 120], 0.35, 2);
}
// gallery
fillRect(tx - 25, shaftTop - 9, tx + 25, shaftTop, [12, 18, 32], 1);
fillRect(tx - 25, shaftTop - 9, tx + 25, shaftTop - 7.5, RIM, 0.45);
// lantern room
fillRect(tx - 17, shaftTop - 40, tx + 17, shaftTop - 9, [12, 18, 32], 1);
fillRect(tx - 13, shaftTop - 36, tx + 13, shaftTop - 14, [255, 206, 140], 1);
softDisc(tx, shaftTop - 25, 78, [255, 196, 128], 0.5, 2.2);
softDisc(tx, shaftTop - 25, 26, [255, 236, 196], 0.85, 1.6);
// roof
fillPoly([[tx - 21, shaftTop - 40], [tx, shaftTop - 70], [tx + 21, shaftTop - 40]], [12, 18, 32], 1);
fillPoly([[tx - 21, shaftTop - 40], [tx, shaftTop - 70], [tx + 6, shaftTop - 60], [tx - 8, shaftTop - 44]], RIM, 0.3);
fillRect(tx - 1.4, shaftTop - 82, tx + 1.4, shaftTop - 68, [12, 18, 32], 1);

// a warm waterline where sky meets water
fillRect(0, HORIZON - 1.6, W, HORIZON + 0.8, [255, 208, 158], 0.22);
softDisc(sunX, HORIZON + 2, 190, [255, 214, 160], 0.35, 2.4);

// ---------- 7. reflection in still water ----------
const reflH = RW - HY;
for (let y = HY; y < RW; y++) {
  const dy = y - HY;
  const srcY = HY - Math.round(dy * 0.92);
  if (srcY < 0) continue;
  const depth = dy / reflH;
  const strength = 0.62 * (1 - Math.pow(depth, 1.25));
  const wob = Math.sin(dy * 0.19) * (0.6 + dy * 0.02) + Math.sin(dy * 0.07) * 1.6;
  for (let x = 0; x < RW; x++) {
    const sx = Math.round(x + wob * SS);
    if (sx < 0 || sx >= RW) continue;
    const si = (srcY * RW + sx) * 3;
    const di = (y * RW + x) * 3;
    const a = strength * (0.75 + 0.25 * Math.sin(dy * 0.9 + x * 0.01));
    buf[di] += (buf[si] * 0.72 - buf[di]) * a;
    buf[di + 1] += (buf[si + 1] * 0.72 - buf[di + 1]) * a;
    buf[di + 2] += (buf[si + 2] * 0.8 - buf[di + 2]) * a;
  }
}

softDisc(tx, HORIZON + 26, 62, [255, 190, 120], 0.22, 2.2);

// ---------- 8. sun glitter path on the water ----------
for (let y = HORIZON + 1; y < W; y++) {
  const dy = y - HORIZON;
  const spread = 14 + dy * 0.34;
  const fade = Math.pow(1 - dy / (W - HORIZON), 1.1);
  const n = 3;
  for (let k = 0; k < n; k++) {
    const cx = sunX + (rnd() - 0.5) * spread * 2;
    const w = (6 + rnd() * 46) * (0.5 + fade);
    const a = (0.06 + rnd() * 0.3) * fade;
    fillRect(cx - w / 2, y, cx + w / 2, y + 1.6, [255, 214, 160], a);
  }
}

// ---------- 9. ripple lines ----------
for (let i = 0; i < 130; i++) {
  const y = HORIZON + 4 + Math.pow(rnd(), 1.7) * (W - HORIZON - 6);
  const d = (y - HORIZON) / (W - HORIZON);
  const x = rnd() * W;
  const w = 18 + rnd() * (60 + d * 190);
  const a = 0.03 + rnd() * 0.09 * (1 - d);
  fillRect(x, y, x + w, y + 1.1, [188, 190, 214], a);
}

// ---------- 10. type ----------
const CAP = 88;
const STROKE = 12.4;
const hs = STROKE / 2;
const GAP = 25;

const GLYPHS = {
  S: { w: 0.93, paths: [[[0.86, 0.14], [0.66, 0.04], [0.38, 0.04], [0.17, 0.15], [0.12, 0.31], [0.25, 0.46], [0.52, 0.53], [0.75, 0.6], [0.87, 0.75], [0.82, 0.9], [0.59, 0.97], [0.31, 0.97], [0.12, 0.88]]] },
  O: { w: 0.93, circle: [0.465, 0.5, 0.44], paths: [] },
  L: { w: 0.88, paths: [[[0.1, 0.04], [0.1, 0.96], [0.84, 0.96]]] },
  V: { w: 0.93, paths: [[[0.07, 0.04], [0.5, 0.96], [0.93, 0.04]]] },
  H: { w: 0.93, paths: [[[0.1, 0.04], [0.1, 0.96]], [[0.9, 0.04], [0.9, 0.96]], [[0.1, 0.5], [0.9, 0.5]]] },
  M: { w: 1.02, paths: [[[0.09, 0.96], [0.09, 0.04], [0.51, 0.62], [0.93, 0.04], [0.93, 0.96]]] },
  'Ø': { w: 0.93, circle: [0.465, 0.5, 0.44], paths: [[[0.15, 0.85], [0.85, 0.15]]] },
};

function drawStroke(x, y, w, paths, col, alpha) {
  for (const path of paths) {
    for (let i = 0; i + 1 < path.length; i++) {
      const ax = x + path[i][0] * w, ay = y + path[i][1] * w;
      const bx = x + path[i + 1][0] * w, by = y + path[i + 1][1] * w;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * hs, ny = (dx / len) * hs;
      fillPoly([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]], col, alpha);
    }
    for (const p of path) {
      fillPoly(circlePts(x + p[0] * w, y + p[1] * w, hs, 40), col, alpha);
    }
  }
}

function drawName(text, cx, top, capH, col, alpha) {
  const total = [];
  let width = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    const w = g.w * capH;
    total.push({ g, w });
    width += w + GAP;
  }
  width -= GAP;
  let x = cx - width / 2;
  for (const item of total) {
    if (item.g.circle) {
      const [ccx, ccy, r] = item.g.circle;
      const ring = [];
      const inner = [];
      const n = 96;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        ring.push([x + (ccx + Math.cos(t) * r) * item.w, top + (ccy + Math.sin(t) * r) * item.w]);
        const rr = r - STROKE / item.w;
        inner.push([x + (ccx + Math.cos(t) * rr) * item.w, top + (ccy + Math.sin(t) * rr) * item.w]);
      }
      fillPoly(ring.concat(inner.reverse()), col, alpha);
    }
    drawStroke(x, top, item.w, item.g.paths, col, alpha);
    x += item.w + GAP;
  }
  return width;
}

const nameW = drawName('SØLVHOLM', W / 2, 70, CAP, CREAM, 1);
// a hairline under the name, echoing the horizon
fillRect(W / 2 - nameW * 0.34, 196, W / 2 + nameW * 0.34, 197.6, GOLD, 0.55);

// ---------- 11. grain and vignette ----------
for (let y = 0; y < RW; y++) {
  const vy = (y / RW - 0.5) * 2;
  for (let x = 0; x < RW; x++) {
    const i = (y * RW + x) * 3;
    const n = (rnd() - 0.5) * 3;
    const vx = (x / RW - 0.5) * 2;
    const vig = 1 - 0.1 * Math.pow(Math.max(0, vx * vx * 0.5 + vy * vy * 0.5), 1.3);
    let r = (buf[i] + n) * vig, g = (buf[i + 1] + n) * vig, b = (buf[i + 2] + n) * vig;
    buf[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    buf[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    buf[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

// ---------- 12. downsample ----------
const out = new Uint8Array(W * W * 3);
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) {
      const row = (y * SS + sy) * RW;
      for (let sx = 0; sx < SS; sx++) {
        const i = (row + x * SS + sx) * 3;
        r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
      }
    }
    const k = SS * SS;
    const o = (y * W + x) * 3;
    out[o] = r / k; out[o + 1] = g / k; out[o + 2] = b / k;
  }
}

// ---------- 13. PNG ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = encodePng(out, W, W);
const dir = process.env.OUTPUT_DIR || '/output';
try {
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + '/entry.png', png);
} catch (e) {
  mkdirSync('./out', { recursive: true });
  writeFileSync('./out/entry.png', png);
}
console.log('entry.png', png.length, 'bytes');
