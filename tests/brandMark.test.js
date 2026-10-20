import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const pngSize = (p) => {
  const b = readFileSync(new URL(p, root));
  assert.equal(b.toString('hex', 0, 8), '89504e470d0a1a0a', `${p} is a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

// The in-app badge (.brand-mark in App.css) is the source for every icon.
const css = read('src/App.css');
const badge = css.slice(css.indexOf('.brand-mark {'), css.indexOf('}', css.indexOf('.brand-mark {')));
const px = (prop) => Number(badge.match(new RegExp(`${prop}:\\s*([\\d.]+)px`))[1]);
const accent = read('src/index.css').match(/--accent:\s*(#[0-9a-f]{6})/i)[1].toLowerCase();

/** Decode an 8-bit RGB / RGBA PNG (no interlace) → { w, h, px(x, y) → [r, g, b, a] }. */
function decodePng(p) {
  const b = readFileSync(new URL(p, root));
  let i = 8; const idat = []; let w; let h; let type;
  while (i < b.length) {
    const len = b.readUInt32BE(i); const kind = b.toString('ascii', i + 4, i + 8); const d = b.subarray(i + 8, i + 8 + len);
    if (kind === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); assert.equal(d[8], 8); type = d[9]; assert.equal(d[12], 0); }
    if (kind === 'IDAT') idat.push(d);
    i += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : assert.fail(`colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat)); const stride = w * bpp; const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0; const up = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(up - c); const pb = Math.abs(a - c); const pc = Math.abs(a + up - 2 * c);
      const pred = [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f];
      out[y * stride + x] = (v + pred) & 255;
    }
  }
  return { w, h, px: (x, y) => { const o = y * stride + x * bpp; return [out[o], out[o + 1], out[o + 2], bpp === 4 ? out[o + 3] : 255]; } };
}
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('Maskable icon (Android / ChromeOS shelf)', () => {
  const img = decodePng('public/icon-maskable-512.png');
  const red = hexRgb(accent);
  const isRed = ([r, g, b, a]) => a === 255 && Math.abs(r - red[0]) <= 2 && Math.abs(g - red[1]) <= 2 && Math.abs(b - red[2]) <= 2;
  it('is solid brand red edge to edge — no transparent or dark border', () => {
    assert.deepEqual([img.w, img.h], [512, 512]);
    for (let t = 0; t < 512; t += 7) {
      for (const [x, y] of [[t, 0], [t, 511], [0, t], [511, t]]) assert.ok(isRed(img.px(x, y)), `edge pixel ${x},${y}`);
    }
  });
  it('keeps the white "D" centred inside the 80 % safe-zone circle', () => {
    let minX = 512; let maxX = 0; let minY = 512; let maxY = 0; let white = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const [r, g, b] = img.px(x, y);
        if (r > 240 && g > 240 && b > 240) {
          white += 1; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    assert.ok(white > 5000, 'the mark is there');
    const safe = 512 * 0.4; // radius of the 80 % circle
    for (const x of [minX, maxX]) for (const y of [minY, maxY]) assert.ok(Math.hypot(x - 256, y - 256) < safe, `corner ${x},${y} inside`);
    assert.ok(Math.abs((minX + maxX) / 2 - 256) < 12 && Math.abs((minY + maxY) / 2 - 256) < 12, 'centred');
  });
  it('the 192 / 512 badges stay transparent-cornered rounded squares for desktop shortcuts', () => {
    for (const f of ['public/icon-192.png', 'public/icon-512.png']) {
      const p = decodePng(f);
      assert.equal(p.px(0, 0)[3], 0, `${f} corner is transparent`);
      assert.ok(isRed(p.px(p.w >> 1, 2)), `${f} top edge is the badge red`);
    }
  });
  it('the manifest declares each icon with an explicit purpose', () => {
    assert.deepEqual(JSON.parse(read('public/manifest.json')).icons, [
      { src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });
});

describe('Brand mark: favicon and icons match the in-app "D" badge', () => {
  const svg = read('public/favicon.svg');
  it('favicon.svg is the badge scaled up: same corner radius, colour and white Courier Prime "D"', () => {
    const [, w] = svg.match(/viewBox="0 0 (\d+) \1"/);
    const scale = Number(w) / px('width');
    assert.equal(px('width'), px('height'));
    const rect = svg.match(/<rect [^>]*>/)[0];
    assert.match(rect, new RegExp(`width="${w}" height="${w}"`), 'full-bleed square like the badge');
    assert.ok(Math.abs(Number(rect.match(/rx="([\d.]+)"/)[1]) - px('border-radius') * scale) < 0.01, 'radius 5/24 of the size');
    assert.equal(rect.match(/fill="(#[0-9a-f]{6})"/i)[1].toLowerCase(), accent);
    assert.match(badge, /background:\s*var\(--accent\)/);
    assert.match(badge, /Courier Prime/);
    assert.match(svg, /<path fill="#fff"/);
    assert.ok(!/vite|#863bff|c2pa/i.test(svg), 'no template logo or embedded metadata');
  });
  it('the PNG icons exist at their sizes', () => {
    assert.deepEqual(pngSize('public/icon-192.png'), [192, 192]);
    assert.deepEqual(pngSize('public/icon-512.png'), [512, 512]);
    assert.deepEqual(pngSize('public/icon-maskable-512.png'), [512, 512]);
    assert.deepEqual(pngSize('public/apple-touch-icon.png'), [180, 180]);
  });
  it('index.html and the manifest point at them; the template icons are gone', () => {
    const html = read('index.html');
    assert.match(html, /rel="icon" type="image\/svg\+xml" href="%BASE_URL%favicon\.svg"/);
    assert.match(html, /rel="icon" type="image\/png" sizes="192x192" href="%BASE_URL%icon-192\.png"/);
    const icons = JSON.parse(read('public/manifest.json')).icons.map((i) => i.src);
    for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) assert.ok(icons.some((s) => s.endsWith(f)), f);
    assert.equal(existsSync(new URL('public/icons.svg', root)), false);
  });
});
