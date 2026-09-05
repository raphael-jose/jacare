// Generates the curated couple GIFs used by the chat when no Giphy key is set.
// Pure pixel-art animations, zero network dependency. Run: node scripts/make-gifs.mjs
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import gifenc from 'gifenc';
const { GIFEncoder } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'gifs');

const W = 120;
const H = 120;

// Palette (index 0 = background)
const PAL = [
  [255, 250, 250], // bg white-pink
  [244, 63, 94],   // love red
  [251, 113, 133], // pink
  [225, 29, 72],   // deep rose
  [253, 164, 175], // blush
  [255, 255, 255], // white
  [190, 18, 60],   // dark rose (outline/eyes)
];

const COLOR_TO_IDX = new Map(PAL.map((c, i) => [c.join(','), i]));
function nearestIdx(r, g, b) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PAL.length; i++) {
    const [pr, pg, pb] = PAL[i];
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function frame() {
  return new Uint8Array(W * H);
}
function put(buf, x, y, idx) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  buf[yi * W + xi] = idx;
}
function fillRect(buf, x0, y0, x1, y1, idx) {
  for (let y = Math.round(y0); y <= Math.round(y1); y++)
    for (let x = Math.round(x0); x <= Math.round(x1); x++)
      put(buf, x, y, idx);
}
function fillCircle(buf, cx, cy, r, idx) {
  for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++)
    for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(buf, x, y, idx);
    }
}

// 8x7 heart mask
const HEART_MASK = [
  '01100110',
  '11111111',
  '11111111',
  '11111111',
  '01111110',
  '00111100',
  '00011000',
];

function drawHeart(buf, cx, cy, scale, idx) {
  for (let row = 0; row < HEART_MASK.length; row++) {
    for (let col = 0; col < HEART_MASK[0].length; col++) {
      if (HEART_MASK[row][col] !== '1') continue;
      const x0 = cx + (col - 3.5) * scale;
      const y0 = cy + (row - 3) * scale;
      fillRect(buf, x0, y0, x0 + scale - 1, y0 + scale - 1, idx);
    }
  }
}

function drawFace(buf, cx, cy, lookDir) {
  // head
  fillCircle(buf, cx, cy, 20, 5); // white head
  fillCircle(buf, cx, cy, 20, 2); // outline ring (pink) behind white? draw outline first:
}
function drawHead(buf, cx, cy, lookDir) {
  fillCircle(buf, cx, cy, 21, 2);       // outline pink
  fillCircle(buf, cx, cy, 20, 5);       // face white
  // eyes (look toward partner)
  const eo = lookDir * 3;
  put(buf, cx - 8 + eo, cy - 4, 6);
  put(buf, cx + 8 + eo, cy - 4, 6);
  // blush
  fillCircle(buf, cx - 12, cy + 6, 3, 4);
  fillCircle(buf, cx + 12, cy + 6, 3, 4);
  // smile
  for (let i = -4; i <= 4; i++) put(buf, cx + i, cy + 12 - Math.abs(i) * 0.5, 6);
}
function drawBody(buf, cx, topY, tilt) {
  // rounded torso
  fillRect(buf, cx - 14 + tilt * 3, topY, cx + 14 + tilt * 3, topY + 42, 1);
  fillCircle(buf, cx + tilt * 3, topY + 42, 14, 1);
}

function drawSparkle(buf, x, y, on) {
  if (!on) return;
  const idx = 1;
  put(buf, x, y, idx);
  put(buf, x - 2, y, idx); put(buf, x + 2, y, idx);
  put(buf, x, y - 2, idx); put(buf, x, y + 2, idx);
}

function encodeGif(name, frames, delayMs) {
  const gif = GIFEncoder();
  for (const idxBuf of frames) {
    gif.writeFrame(idxBuf, W, H, { palette: PAL, delay: delayMs, transparent: false });
  }
  gif.finish();
  const bytes = gif.bytes();
  const out = join(OUT_DIR, name);
  writeFileSync(out, Buffer.from(bytes));
  console.log(`  ${name}: ${bytes.length} bytes, ${frames.length} frames`);
}

// ---------- 1) heart.gif — pulsing heart ----------
function heartGif() {
  const frames = [];
  for (let t = 0; t < 14; t++) {
    const buf = frame();
    const phase = (t % 7) / 6; // 0..1
    const s = phase < 0.5 ? 4 : 5; // beat: hold small, pop big
    drawHeart(buf, 60, 62, s, 1);
    // highlight
    put(buf, 52, 50, 5); put(buf, 54, 48, 5);
    frames.push(buf);
  }
  return encodeGif('heart.gif', frames, 90);
}

// ---------- 2) hearts2.gif — two hearts, right one bounces ----------
function hearts2Gif() {
  const frames = [];
  for (let t = 0; t < 16; t++) {
    const buf = frame();
    drawHeart(buf, 38, 68, 3, 2);
    const bounce = Math.round(Math.sin(t / 1.4) * 7);
    drawHeart(buf, 82, 48 + bounce, 3, 1);
    drawSparkle(buf, 60, 18, t % 4 < 2);
    frames.push(buf);
  }
  return encodeGif('hearts2.gif', frames, 80);
}

// ---------- 3) kiss.gif — two heads meeting + heart pop ----------
function kissGif() {
  const frames = [];
  const total = 18;
  for (let t = 0; t < total; t++) {
    const buf = frame();
    const prog = Math.min(1, t / 9);
    const lx = 34 + prog * 12;
    const rx = 86 - prog * 12;
    const dist = rx - lx;
    drawHead(buf, lx, 62, 1);
    drawHead(buf, rx, 62, -1);
    drawBody(buf, lx, 86, 0.4);
    drawBody(buf, rx, 86, -0.4);
    if (dist < 26) {
      // kiss heart pop
      const s = t % 3 === 0 ? 2 : 3;
      drawHeart(buf, 60, 44, s, 1);
      drawSparkle(buf, 60, 14, true);
    }
    frames.push(buf);
  }
  return encodeGif('kiss.gif', frames, 80);
}

// ---------- 4) hug.gif — hug + floating heart ----------
function hugGif() {
  const frames = [];
  for (let t = 0; t < 18; t++) {
    const buf = frame();
    const sway = Math.sin(t / 1.5) * 2;
    drawBody(buf, 42 + sway, 56, 0.35);
    drawBody(buf, 78 - sway, 56, -0.35);
    drawHead(buf, 42 + sway * 0.6, 34, 1);
    drawHead(buf, 78 - sway * 0.6, 34, -1);
    // floating heart rises and resets
    const fy = 20 - ((t * 3) % 16);
    drawHeart(buf, 60, fy, 2, 1);
    frames.push(buf);
  }
  return encodeGif('hug.gif', frames, 80);
}

// ---------- 5) sparkle.gif — big heart with twinkling sparkles ----------
function sparkleGif() {
  const frames = [];
  for (let t = 0; t < 16; t++) {
    const buf = frame();
    const s = t % 8 < 4 ? 4 : 5;
    drawHeart(buf, 60, 64, s, 1);
    drawSparkle(buf, 24, 22, t % 4 === 0);
    drawSparkle(buf, 96, 20, t % 4 === 1);
    drawSparkle(buf, 20, 92, t % 4 === 2);
    drawSparkle(buf, 100, 88, t % 4 === 3);
    frames.push(buf);
  }
  return encodeGif('sparkle.gif', frames, 90);
}

// ---------- 6) letter.gif — love letter envelope ----------
function letterGif() {
  const frames = [];
  for (let t = 0; t < 12; t++) {
    const buf = frame();
    const wig = t % 2 === 0 ? 0 : 2;
    fillRect(buf, 25, 45 + wig, 95, 95 + wig, 2);        // envelope body
    fillRect(buf, 25, 78 + wig, 95, 95 + wig, 1);        // bottom band
    // flap
    fillRect(buf, 25, 45 + wig, 95, 47 + wig, 3);
    // flap triangle (base at top, apex at middle of envelope)
    for (let i = 0; i <= 16; i++) {
      fillRect(buf, 60 - i, 48 + wig + i * 1.4, 60 + i, 48 + wig + i * 1.4, 3);
    }
    drawHeart(buf, 60, 70 + wig, 2, 5);
    frames.push(buf);
  }
  return encodeGif('letter.gif', frames, 90);
}

mkdirSync(OUT_DIR, { recursive: true });
heartGif();
hearts2Gif();
kissGif();
hugGif();
sparkleGif();
letterGif();
console.log('OK ->', OUT_DIR);