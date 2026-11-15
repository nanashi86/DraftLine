// The phone writing view (Editor `reflow`): the script drawn to the phone's width at a reading size.
// Only the drawing changes — the pagination still comes from page-width measurement of a hidden copy
// (PageMeasure), never from the phone's own lines — and it only exists on a phone-width touch screen.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const editor = read('src/components/Editor.jsx');
const css = read('src/components/Editor.css');
const app = read('src/App.jsx');

describe('phone view: when it shows', () => {
  it('only on a phone-width touch screen (the Round 1 queries), never on a desktop or tablet', () => {
    assert.match(app, /const phoneView = phoneWidth && touchUi;/);
    assert.match(app, /reflow=\{phoneView\}/);
    assert.match(read('src/lib/mobile.js'), /export const PHONE_QUERY = '\(max-width: 559\.98px\)';/);
  });
  it('every phone-view rule is scoped to .sheet.is-reflow or the hidden copy', () => {
    const block = css.slice(css.indexOf('/* ---- The phone writing view'));
    const sels = [...block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
    assert.ok(sels.length > 20);
    for (const sel of sels) {
      for (const part of sel.split(/,(?![^(]*\))/)) assert.match(part.trim(), /\.sheet\.is-reflow|\.page-measure|\.scroller:has\(\.sheet\.is-reflow\)|\.focus-mode \.sheet\.is-reflow/, part);
    }
  });
  it('no prototype switches or test hooks remain', () => {
    for (const src of [editor, app]) assert.doesNotMatch(src, /naiveMeasure|noMeasure|splitMode|__dlExpose|__dlLayout|phoneview|PROTOTYPE/);
  });
});

describe('phone view: pagination comes only from the page-width copy', () => {
  it('the visible lines get a no-op observer', () => {
    assert.match(editor, /const viewObserve = reflow \? NO_OBSERVE : observe;/);
    assert.match(editor, /const NO_OBSERVE = \(\) => \{\};/);
    assert.equal((editor.match(/observe=\{viewObserve\}/g) || []).length, 1, 'dual rows');
    assert.match(editor, /observe=\{i === 0 \? viewObserve : undefined\}/);
  });
  it('the hidden copy is measured at 100% page geometry by its own observer, after the first paint', () => {
    assert.match(editor, /const MEASURE_LINE_PX = 16;/);
    assert.match(editor, /<div className="sheet" style=\{\{ '--in': `\$\{MEASURE_LINE_PX \* 6\}px` \}\}>/);
    assert.match(editor, /changes\[key\] = Math\.max\(1, Math\.round\(h \/ MEASURE_LINE_PX\)\);/);
    assert.match(editor, /\{reflow && measureOn && <PageMeasure items=\{items\} observe=\{observeMeasure\} textRefs=\{measureText\} \/>\}/);
    assert.match(editor, /requestAnimationFrame\(\(\) => \{ t = setTimeout\(\(\) => setMeasureOn\(true\), 0\); \}\); \/\/ after the first paint/);
    assert.match(css, /\.page-measure \{[^}]*visibility: hidden;[^}]*pointer-events: none;/);
  });
  it('the page itself is unchanged: page cards, grid margins and clipped seam views as before', () => {
    assert.match(editor, /\{!reflow && Array\.from\(\{ length: pageCount \}/);
    assert.match(editor, /marginLines=\{reflow \? \(i \? 0 : lead\(b\)\) : \(pc \? pc\.marginLines : real\.marginLines\)\}/);
    assert.match(editor, /style=\{reflow \? undefined : \{\s*'--in': `\$\{linePxFor\(zoom\) \* 6\}px`,/);
  });
});

describe('phone view: a speech split across a page', () => {
  it('shows one view per page holding exactly that page\'s words', () => {
    assert.match(editor, /at\.push\(Math\.max\(at\[i - 2\] \?\? 1, Math\.min\(len - 1, offsetAtLine\(div, ps\[i\]\.from\)\)\)\);/);
    assert.match(editor, /const value = span \? block\.text\.slice\(from, to\) : block\.text;/);
  });
  it('editing a page view always writes the whole element back', () => {
    assert.match(editor, /onText\(block\.id, block\.text\.slice\(0, from\) \+ e\.target\.value \+ block\.text\.slice\(to\), from \+ e\.target\.selectionEnd\)/);
  });
  it('keys see whole-element positions; Backspace and Delete cross the break through the typing path', () => {
    assert.match(editor, /const start = el\.selectionStart \+ off;\s*const end = el\.selectionEnd \+ off;/);
    assert.match(editor, /onTextChange\(id, text\.slice\(0, at\) \+ text\.slice\(at \+ 1\)\);/);
  });
});

describe('phone view: status bar and notes', () => {
  it('no zoom controls in the phone view (no page to zoom); page count stays', () => {
    assert.match(app, /\{!phoneView && \(\s*<span className="status-zoom">/);
    assert.match(app, /`p\. \$\{currentPage\} of \$\{layout\.pageCount\}`/);
  });
  it('note marks keep their 16px look with a larger invisible tap area', () => {
    assert.match(css, /\.sheet\.is-reflow :is\(\.note-mark, \.note-add\)::before \{\s*content: '';\s*position: absolute;\s*inset: -12px/);
    assert.match(css, /\.sheet\.is-reflow \.note-mark,\s*\.sheet\.is-reflow \.note-add \{[^}]*width: 16px;\s*height: 16px;/);
  });
});
