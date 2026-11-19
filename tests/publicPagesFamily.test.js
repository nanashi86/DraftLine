// The four public pages (welcome/, philosophy/, features/, compare/) read as one family: the same
// eyebrow with the page's official name, one title pattern, and the same spacing for major sections.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../public/${p}/index.html`, import.meta.url), 'utf8');
const PAGES = {
  welcome: { eyebrow: 'Welcome to DraftLine', title: 'DraftLine — Welcome — Free Screenwriting Software' },
  philosophy: { eyebrow: 'Core Philosophy', title: 'DraftLine — Core Philosophy — Our Story &amp; Principles' },
  features: { eyebrow: 'Explore Features', title: 'DraftLine — Explore Features — Screenwriting Tools' },
  compare: { eyebrow: 'Compare DraftLine', title: 'DraftLine — Compare — vs Final Draft, Fade In &amp; More' },
};
const EYEBROW_CSS = ".eyebrow { font: 600 12px/1.4 Inter, system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase;\n        color: var(--muted); margin: 0 0 10px; }";

describe('The four public pages', () => {
  for (const [page, { eyebrow, title }] of Object.entries(PAGES)) {
    const html = read(page);
    it(`${page}: the title follows "DraftLine — Page — Description"`, () => {
      assert.ok(html.includes(`<title>${title}</title>`));
    });
    it(`${page}: the eyebrow names the page, first in the hero, styled like the others`, () => {
      assert.match(html, new RegExp(`<div class="hero">\\s*<p class="eyebrow">${eyebrow}</p>`));
      assert.ok(html.includes(EYEBROW_CSS));
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
  it('the hero keeps Just Write. on Welcome and Philosophy, and the headings on Features and Compare', () => {
    assert.match(read('welcome'), /<p class="kicker">[\s\S]*?<\/p>\s*<h1>Just Write\.<\/h1>/);
    assert.match(read('philosophy'), /<p class="eyebrow">Core Philosophy<\/p>\s*<p class="kicker">[\s\S]*?<\/p>\s*<h1>Just Write\.<\/h1>\s*<dl class="pair">/);
    assert.match(read('features'), /<h1>DraftLine Features<\/h1>/);
    assert.match(read('compare'), /<h1>How DraftLine Compares<\/h1>/);
  });
  it('Welcome describes Core Philosophy as its story and principles', () => {
    assert.match(read('welcome'), /<strong>Core Philosophy<\/strong><span>The story and principles behind DraftLine\.<\/span>/);
  });
});
