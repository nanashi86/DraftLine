import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
