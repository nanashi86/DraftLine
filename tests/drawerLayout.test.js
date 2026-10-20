import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN_FIT_ZOOM, effectiveZoomFor, fitZoomFor, linePxFor, pageWidthAt } from '../src/lib/zoom.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const pbCss = read('components/ProjectBibleDrawer.css');

describe('Right dock: 480px drawers', () => {
  it('the dock is 480px wide (max 90vw), and the workspace makes the same room', () => {
    assert.match(read('index.css'), /--tuner-w: 480px;/);
    assert.match(pbCss, /\.pb \{[^}]*width: var\(--tuner-w\);[^}]*max-width: 90vw;/);
    assert.match(read('App.css'), /\.dock-open \.workspace \{ padding-right: var\(--tuner-w\); \}/);
  });
  it('slides with the new easing, and animates width', () => {
    for (const rule of [/\.pb \{[^}]*\}/, /\.pb\.is-open \{[^}]*\}/]) {
      const r = pbCss.match(rule)[0];
      assert.match(r, /transition: transform 0\.2s cubic-bezier\(0\.16, 1, 0\.3, 1\), width 0\.2s ease/);
    }
  });
});

describe('Page zoom: the page fits beside the drawers instead of scrolling sideways', () => {
  it('a line is a whole number of pixels, and the page is 51 lines wide (816px at 100 %)', () => {
    assert.equal(linePxFor(1), 16);
    assert.equal(pageWidthAt(1), 816);
    assert.equal(pageWidthAt(0.5), 408);
  });
  it('the fitted page never overshoots the space it was fitted to', () => {
    for (let w = 408; w <= 2000; w += 13) {
      assert.ok(pageWidthAt(fitZoomFor(w)) <= w, `width ${w}`);
      assert.ok(pageWidthAt(fitZoomFor(w) + 1 / 16) > w, `width ${w}: as large as fits`);
    }
  });
  it('Page and Split shrink to fit, never zoom in past your zoom, never below 50 %; the Board is untouched', () => {
    assert.equal(effectiveZoomFor({ view: 'page', zoom: 1, width: 2000 }), 1);
    assert.equal(effectiveZoomFor({ view: 'page', zoom: 1, width: 760 }), 14 / 16);
    assert.equal(effectiveZoomFor({ view: 'split', zoom: 1.25, width: 700 }), 13 / 16);
    assert.equal(effectiveZoomFor({ view: 'page', zoom: 1, width: 200 }), MIN_FIT_ZOOM);
    assert.equal(effectiveZoomFor({ view: 'board', zoom: 1, width: 300 }), 1);
    assert.equal(effectiveZoomFor({ view: 'page', zoom: 1, width: 0 }), 1, 'before the pane is measured');
  });
});

describe('Blueprint layout', () => {
  const dna = read('components/StoryDna.jsx');
  it('genre pills wrap with 6px gaps; refined pill; accent fill with white text when picked', () => {
    assert.match(pbCss, /\.dna-pills \{ display: flex; flex-wrap: wrap; gap: 6px; \}/);
    const pill = read('index.css').match(/\.pill \{[^}]*\}/)[0];
    for (const d of ['padding: 4px 10px', 'font-size: 11.5px', 'border-radius: 12px', 'border: 1px solid rgba(255, 255, 255, 0.12)', 'background: rgba(255, 255, 255, 0.04)']) {
      assert.ok(pill.includes(d), d);
    }
    assert.match(read('index.css'), /\.pill\.is-on,\s*\.pill\.is-selected \{[^}]*background: var\(--accent\); color: #fff;/);
    assert.match(read('components/StoryDna.jsx'), /className=\{`pill dna-pill/);
  });
  it('one header style for Genre, Theme and Plot Devices, with inline hints', () => {
    assert.match(pbCss, /\.dna-label \{ font-size: 11px; font-weight: 600; letter-spacing: 0\.05em; text-transform: uppercase; color: var\(--text-muted, #9ca3af\); \}/);
    assert.match(pbCss, /\.dna-hint \{ font-size: 11px; font-weight: normal; text-transform: none; opacity: 0\.7; margin-left: 6px;/);
    assert.match(dna, /className="dna-label">Genre<span className="dna-hint">pick all that apply<\/span>/);
    assert.match(dna, /className="dna-label">Theme<span className="dna-hint">revealed by the climax<\/span>/);
    assert.ok(!/Central Dramatic Question/.test(dna));
    assert.match(dna, /className="dna-label dna-devices-title"[^>]*>Plot Devices</);
    assert.ok(!/<em>—/.test(dna), 'no em-dash notes left in the headers');
  });
  it('Plot Devices: divider above, rows spread name ↔ Yes|No, a tight segmented Yes / No', () => {
    assert.match(pbCss, /\.dna-devices \{[^}]*border-top: 1px solid rgba\(255, 255, 255, 0\.08\); margin-top: 14px; padding-top: 12px;/);
    assert.match(pbCss, /\.dna-toggle-row \{ display: flex; justify-content: space-between; align-items: center;[^}]*padding: 6px 0;/);
    assert.match(pbCss, /\.dna-toggle-label \{ gap: 6px; display: inline-flex; align-items: center; \}/);
    assert.match(pbCss, /\.dna-yn \{ display: inline-flex; border-radius: 4px; overflow: hidden; border: 1px solid rgba\(255, 255, 255, 0\.12\);/);
    assert.match(dna, /<span className="dna-yn" role="radiogroup"/);
  });
});
