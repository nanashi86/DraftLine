import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TITLE_FONTS, TITLE_FONT_GROUPS, titleTypography } from '../src/lib/titleFonts.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const html = read('index.html');
const links = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/g)].map((m) => m[1]);
const familiesIn = (url) => [...url.matchAll(/family=([^:&]+)/g)].map((m) => decodeURIComponent(m[1].replace(/\+/g, ' ')));
const primary = (f) => f.family.match(/'([^']+)'/)[1];

const NEW = [
  'Asimovian', 'Google Sans', 'Manufacturing Consent', 'Boldonse', 'Doto', 'Matemasie', 'Sankofa Display', 'Anton SC',
  'Playwrite South Africa', 'Playwrite USA Modern', 'Tiny5', 'Danfo', 'Anta', 'Delicious Handrawn', 'Tilt Neon',
  'Mynerve', 'Bonheur Royale', 'Miss Fajardose',
];

describe('title fonts', () => {
  it('offers all 18 added families, each once', () => {
    const labels = TITLE_FONTS.map((f) => f.label);
    for (const n of NEW) assert.ok(labels.includes(n), n);
    assert.equal(new Set(labels).size, labels.length, 'no label twice');
    assert.equal(new Set(TITLE_FONTS.map((f) => f.id)).size, TITLE_FONTS.length, 'no id twice');
    assert.equal(TITLE_FONTS.length, 38);
    for (const f of TITLE_FONTS) assert.ok(TITLE_FONT_GROUPS[f.group], f.id);
  });
  it('Google Sans falls back to Open Sans, then the system sans', () => {
    assert.equal(TITLE_FONTS.find((f) => f.id === 'google-sans').family, "'Google Sans', 'Open Sans', system-ui, sans-serif");
  });
  it('uses Google Fonts’ own names for the two Playwrite styles', () => {
    assert.equal(primary(TITLE_FONTS.find((f) => f.label === 'Playwrite South Africa')), 'Playwrite ZA');
    assert.equal(primary(TITLE_FONTS.find((f) => f.label === 'Playwrite USA Modern')), 'Playwrite US Modern');
  });
  it('every title font is loaded by index.html, exactly once', () => {
    const loaded = links.flatMap(familiesIn);
    for (const f of TITLE_FONTS) assert.ok(loaded.includes(primary(f)), primary(f));
    const fams = [...new Set(links)].flatMap(familiesIn); // the <noscript> copy repeats the same link
    assert.equal(new Set(fams).size, fams.length, 'no family requested twice');
  });
  it('asks for a bold weight only where the font has one (Bold is disabled otherwise)', () => {
    const all = `${links.join('&')}&`;
    for (const f of TITLE_FONTS.filter((x) => x.bold)) {
      const spec = all.match(new RegExp(`family=${primary(f).replace(/ /g, '\\+')}(:[^&]*)?&`));
      assert.ok(spec?.[1]?.includes(String(f.bold)), `${f.label} loads weight ${f.bold}`);
    }
    assert.equal(titleTypography({ titleFont: 'anta', titleBold: true }).bold, false);
    assert.equal(titleTypography({ titleFont: 'google-sans', titleBold: true }).bold, true);
  });
  it('title fonts load without blocking the first paint; Courier Prime and Inter load first', () => {
    assert.match(html, /css2\?family=Courier\+Prime[^"]*&family=Inter[^"]*"\s+rel="stylesheet"\s*\/>/);
    assert.match(html, /Asimovian[^"]*"\s+rel="stylesheet"\s+media="print"\s+onload="this\.media='all'"/);
    assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>/);
  });
});

describe('the script itself stays Courier Prime 12pt', () => {
  const editorCss = read('src/components/Editor.css');
  it('the page canvas and print view are set in Courier Prime at one line per 1/6 inch (12pt)', () => {
    assert.match(editorCss, /\.sheet,\s*\.print-root \{[^}]*font-family: 'Courier Prime'/);
    assert.match(editorCss, /--line: calc\(var\(--in\) \/ 6\);[^}]*font-size: var\(--line\);/);
  });
  it('no title font is referenced by the editor or print styles', () => {
    const css = editorCss + read('src/components/PrintView.css');
    for (const f of TITLE_FONTS.filter((x) => x.id !== 'courier-prime')) {
      assert.ok(!css.includes(primary(f)), `${primary(f)} must not style the script`);
    }
  });
});
