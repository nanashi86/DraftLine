// The UI font (Inter) and the script font (Courier Prime) ship with DraftLine, so no page waits on
// another site before its first paint, and the fonts work offline. Only the optional Title Page fonts
// come from Google Fonts, and they never block rendering.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));
const PAGES = ['index.html', 'public/features/index.html', 'public/compare/index.html', 'public/philosophy/index.html', 'public/welcome/index.html'];

describe('self-hosted fonts', () => {
  it('no page loads Inter or Courier Prime from Google Fonts', () => {
    for (const p of PAGES) {
      const html = read(p);
      for (const m of html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/g)) {
        assert.doesNotMatch(m[1], /family=(Inter|Courier\+Prime)\b/, `${p} still loads a core font from Google: ${m[1]}`);
      }
    }
    assert.equal(read('public/features/index.html').includes('fonts.googleapis.com'), false);
    assert.equal(read('public/compare/index.html').includes('fonts.googleapis.com'), false);
    assert.equal(read('public/philosophy/index.html').includes('fonts.googleapis.com'), false);
  });

  it('the only Google Fonts stylesheet left (Title Page fonts) does not block rendering', () => {
    const html = read('index.html').replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    const sheets = [...html.matchAll(/<link\s[^>]*href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"[^>]*>/g)].map((m) => m[0]);
    assert.ok(sheets.length >= 1);
    for (const s of sheets) assert.match(s, /media="print"/, 'loaded without blocking the first paint');
  });

  it('every page preloads the Latin Inter file it uses, and every @font-face points at a shipped file', () => {
    for (const p of PAGES) assert.match(read(p), /<link rel="preload" href="(%BASE_URL%|\/)fonts\/inter-latin-wght-normal\.woff2" as="font" type="font\/woff2" crossorigin \/>/, p);
    const css = [read('src/index.css'), ...PAGES.slice(1).map(read)].join('\n');
    const urls = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(urls.length >= 9);
    for (const f of new Set(urls)) {
      assert.ok(exists(`public/fonts/${f}`), `public/fonts/${f} is missing`);
      assert.ok(statSync(new URL(`../public/fonts/${f}`, import.meta.url)).size > 5000, `${f} looks empty`);
    }
  });

  it('Inter is one variable family covering every weight the interface uses, under its licence', () => {
    const css = read('src/index.css');
    const faces = [...css.matchAll(/@font-face \{ font-family: 'Inter';[^}]*\}/g)].map((m) => m[0]);
    assert.equal(faces.length, 5, 'Latin, Latin Extended, Cyrillic, Greek, Vietnamese');
    for (const f of faces) {
      assert.match(f, /font-weight: 100 900;/);
      assert.match(f, /font-display: swap;/);
      assert.match(f, /unicode-range: /);
    }
    assert.match(read('public/fonts/Inter-OFL.txt'), /SIL Open Font License/);
    assert.match(read('public/fonts/CourierPrime-OFL.txt'), /SIL Open Font License/);
  });
});
