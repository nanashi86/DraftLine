// The four public pages (welcome/, philosophy/, features/, compare/) read as one family: one title
// pattern and the same spacing for major sections. Welcome keeps its own hero (a WELCOME TO DRAFTLINE
// eyebrow over "Just Write."); the other three open straight on a heading in the same style.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../public/${p}/index.html`, import.meta.url), 'utf8');
const PAGES = {
  welcome: { h1: 'Just Write.', title: 'DraftLine — Welcome — Free Screenwriting Software' },
  philosophy: { h1: 'Story &amp; Principles', title: 'DraftLine — Core Philosophy — Story &amp; Principles' },
  features: { h1: 'DraftLine Features', title: 'DraftLine — Explore Features — Screenwriting Tools' },
  compare: { h1: 'How DraftLine Compares', title: 'DraftLine — Compare — vs Final Draft, Fade In &amp; More' },
};
const H1_CSS = "h1 { font: 700 clamp(28px, 6vw, 40px)/1.2 'Courier Prime', 'Courier New', monospace; color: var(--strong); margin: 0 0 14px; }";

describe('The four public pages', () => {
  for (const [page, { h1, title }] of Object.entries(PAGES)) {
    const html = read(page);
    it(`${page}: the title follows "DraftLine — Page — Description"`, () => {
      assert.ok(html.includes(`<title>${title}</title>`));
    });
    it(`${page}: one h1`, () => {
      assert.ok(html.includes(`<h1>${h1}</h1>`));
      assert.equal(html.match(/<h1[ >]/g).length, 1, 'one h1');
    });
    it(`${page}: major sections are 32px apart, ruled above, with 16px under their headings`, () => {
      assert.match(html, /\n {6}section \{ padding: 32px 0; border-top: 1px solid var\(--line\);/);
      assert.match(html, /margin: 0 0 16px; \}/);
      assert.doesNotMatch(html, /section \{[^}]*border-bottom/);
      assert.match(html, /footer \{ padding: 32px 0 48px;/);
      assert.match(html, /footer \.next \{ margin: 0 0 18px; \}/);
      assert.match(html, /<p class="next"><a class="cta"/);
    });
  }
  it('Welcome keeps its eyebrow and Just Write.; the other three open on their heading, no eyebrow, same style', () => {
    assert.match(read('welcome'), /<div class="hero">\s*<p class="eyebrow">Welcome to DraftLine<\/p>\s*<p class="kicker">[\s\S]*?<\/p>\s*<h1>Just Write\.<\/h1>/);
    for (const page of ['philosophy', 'features', 'compare']) {
      const html = read(page);
      assert.match(html, new RegExp(`<div class="hero">\\s*<h1>${PAGES[page].h1}</h1>`), page);
      assert.doesNotMatch(html, /eyebrow/, `${page}: no eyebrow left (markup or CSS)`);
      assert.ok(html.includes(H1_CSS), `${page}: the shared heading style`);
    }
    assert.match(read('philosophy'), /<h1>Story &amp; Principles<\/h1>\s*<p class="kicker">[\s\S]*?<strong>Just Write\.<\/strong><\/p>\s*<dl class="pair">/);
  });
  it('Welcome describes Core Philosophy as its story and principles', () => {
    assert.match(read('welcome'), /<strong>Core Philosophy<\/strong><span>The story and principles behind DraftLine\.<\/span>/);
  });
});
