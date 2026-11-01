import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HINTS, hintTarget, isTouchScreen } from '../src/lib/hints.js';
import { MIN_FIT_ZOOM, MIN_FIT_ZOOM_PHONE, PHONE_MAX_WIDTH, effectiveZoomFor, pageWidthAt } from '../src/lib/zoom.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const app = read('App.jsx');
const css = read('App.css');
const media = (w) => {
  const i = css.indexOf(`@media (max-width: ${w}px) {`);
  return css.slice(i, css.indexOf('\n}', i));
};

describe('Focus on smaller screens: beside B I U S, not in ⋮', () => {
  it('two copies, like Element and B I U S: the top bar’s from 1100px, the writing row’s from 560 to 1099px, ⋮ on phones', () => {
    assert.match(app, /<button ref=\{focusBtnRef\} className="btn btn-focus" hidden=\{inPlan\}/);
    assert.match(app, /\{formatTools\}[\s\S]{0,300}<button ref=\{focusRowBtnRef\} className="btn btn-focus" onClick=\{\(\) => setFocusMode\(true\)\}/);
    assert.match(css, /\.write-tools > \.btn-focus \{ display: none; margin-left: auto; \}/, 'right end of the row; hidden from 1100px up');
    assert.match(media('1099.98'), /\.bar-right > \.btn-focus \{ display: none; \}/);
    assert.match(media('1099.98'), /\.write-tools > \.btn-focus \{ display: inline-flex; \}/);
    assert.match(media('559.98'), /\.write-tools > \.btn-focus \{ display: none; \}/, 'phones: no room, so ⋮');
  });
  it('never greyed out by Viewing (it only hides things); hidden with the row in Focus, Board and Plan', () => {
    assert.doesNotMatch(app, /ref=\{focusRowBtnRef\}[^>]*disabled/);
    assert.match(app, /<div className="write-pane" hidden=\{!showEditor\}>/);
  });
  it('the hint points at the copy that’s showing', () => {
    const el = (shown) => ({ offsetParent: shown ? {} : null });
    const top = el(false);
    const row = el(true);
    const doc = { querySelectorAll: () => [top, row] };
    assert.equal(hintTarget('.btn-focus', doc), row);
    assert.equal(hintTarget('.btn-focus', { querySelectorAll: () => [el(false)] }), null);
    assert.match(read('components/HintCard.jsx'), /const target = hintTarget\(hint\.target\);/);
  });
});

describe('getting out of Focus on a touch screen', () => {
  it('the tip says to tap Exit focus where there’s no Esc key', () => {
    assert.match(HINTS.focus.text, /Press Esc to bring everything back, right where you left it\.$/);
    assert.equal(HINTS.focus.touchText, 'Focus mode clears the screen of everything but your script. No toolbar, no panels, no distractions. Tap Exit focus, top right, to bring everything back, right where you left it.');
    assert.match(read('components/HintCard.jsx'), /hint\.touchText && isTouchScreen\(\) \? hint\.touchText : hint\.text/);
    assert.equal(isTouchScreen({ matchMedia: () => ({ matches: true }) }), true);
    assert.equal(isTouchScreen({ matchMedia: () => ({ matches: false }) }), false);
    assert.equal(isTouchScreen({}), false);
  });
  it('the Exit focus button stays plain to see without hover, and drops “· Esc”', () => {
    assert.match(app, />Exit focus<span className="focus-exit-key"> · Esc<\/span><\/button>/);
    assert.match(css, /@media \(hover: none\) \{\s*\.focus-exit \{ opacity: 0\.85; \}\s*\.focus-exit-key \{ display: none; \}\s*\}/);
  });
});

describe('phones: the whole page fits the screen', () => {
  it('under 560px the fit may go below 50 %, down to the 6 px line floor', () => {
    assert.equal(PHONE_MAX_WIDTH, 560);
    assert.equal(MIN_FIT_ZOOM_PHONE, 0.375);
    for (const [screen, pane] of [[390, 374], [375, 359], [360, 344], [430, 414]]) {
      const z = effectiveZoomFor({ view: 'page', zoom: 1, width: pane, viewport: screen });
      assert.ok(pageWidthAt(z) <= pane, `${screen}px phone: page ${pageWidthAt(z)}px in ${pane}px`);
    }
  });
  it('wider screens keep the 50 % floor (a narrow Split pane scrolls rather than shrinking further)', () => {
    assert.equal(effectiveZoomFor({ view: 'split', zoom: 1, width: 300, viewport: 1400 }), MIN_FIT_ZOOM);
    assert.match(app, /effectiveZoomFor\(\{ view: focusMode \? 'page' : view, zoom, width: scrollerWidth, viewport: globalThis\.innerWidth \?\? Infinity \}\)/);
    assert.match(media('559.98'), /\.scroller \{ padding-left: 8px; padding-right: 8px; \}/);
  });
});
