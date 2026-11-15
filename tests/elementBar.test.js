// Round 2A: the phone element bar (components/ElementBar.jsx, lib/mobile.js). It stands in for Tab
// and Alt+1…8 on a phone keyboard, switching the line through the editor's own setType.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ELEMENT_BAR, elementBarTop, keyboardUp, scrollToClear, showElementBar } from '../src/lib/mobile.js';
import { ELEMENT_TYPES } from '../src/lib/screenplay.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('element bar: what it offers', () => {
  it('Scene · Action · Character · Dialogue · ( ) · Transition, all real element types', () => {
    assert.deepEqual(ELEMENT_BAR.map((b) => b.type), ['scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition']);
    for (const b of ELEMENT_BAR) assert.ok(ELEMENT_TYPES.includes(b.type), b.type);
    assert.deepEqual(ELEMENT_BAR.map((b) => b.label), ['Scene', 'Action', 'Character', 'Dialogue', '( )', 'Transition']);
    assert.deepEqual(ELEMENT_BAR.map((b) => b.short), ['Scene', 'Action', 'Char', 'Dial', '( )', 'Trans']);
  });
});

describe('element bar: when it shows', () => {
  const on = { phone: true, touch: true, writing: true, editor: true, locked: false };
  it('on a phone-width touch screen with the cursor in the script', () => assert.equal(showElementBar(on), true));
  it('never on a desktop, a tablet, a narrow desktop window, away from the script, on the Board or Plan, or while Viewing', () => {
    assert.equal(showElementBar({ ...on, phone: false }), false);
    assert.equal(showElementBar({ ...on, touch: false }), false);
    assert.equal(showElementBar({ ...on, writing: false }), false);
    assert.equal(showElementBar({ ...on, editor: false }), false);
    assert.equal(showElementBar({ ...on, locked: true }), false);
  });
});

describe('element bar: where it sits', () => {
  it('on the keyboard\'s top edge when the keyboard is up', () => {
    assert.equal(elementBarTop({ vv: { offsetTop: 0, height: 364 }, innerHeight: 664, statusH: 30, barH: 44 }), 320);
    // iOS pans the page when the keyboard opens: the visible area starts lower down
    assert.equal(elementBarTop({ vv: { offsetTop: 120, height: 364 }, innerHeight: 664, statusH: 30, barH: 44 }), 440);
  });
  it('just above the status bar with no keyboard, and without visualViewport', () => {
    assert.equal(elementBarTop({ vv: { offsetTop: 0, height: 664 }, innerHeight: 664, statusH: 30, barH: 44 }), 590);
    assert.equal(elementBarTop({ vv: null, innerHeight: 664, statusH: 30, barH: 44 }), 590);
  });
  it('keyboardUp: only when the visible area is well short of the window', () => {
    assert.equal(keyboardUp({ vv: { offsetTop: 0, height: 364 }, innerHeight: 664 }), true);
    assert.equal(keyboardUp({ vv: { offsetTop: 0, height: 600 }, innerHeight: 664 }), false);
    assert.equal(keyboardUp({ vv: null, innerHeight: 664 }), false);
  });
  it('scrollToClear: scroll only by what the line (or its suggestions) needs', () => {
    assert.equal(scrollToClear(300, 312), 0);
    assert.equal(scrollToClear(330.2, 312), 19);
  });
});

describe('element bar: the editor and the app', () => {
  const editor = read('src/components/Editor.jsx');
  const app = read('src/App.jsx');
  const bar = read('src/components/ElementBar.jsx');
  const css = read('src/components/ElementBar.css');
  it('switching goes through the editor\'s own setType, keeping the cursor and selection (like Alt+1…8)', () => {
    assert.match(app, /editorRef\.current\?\.setType\(activeId, t, \{ keepCaret: true \}\)/);
    assert.match(editor, /setType\(id, type, \{ keepCaret = false \} = \{\}\) \{[\s\S]*?if \(el\) setTypeAt\(idx, type, el\.selectionStart, el\.selectionEnd\);\s*else setTypeAt\(idx, type\);/);
  });
  it('Element ▾ and Alt+1…8 behave exactly as before (no keepCaret, no selection end)', () => {
    assert.match(app, /else editorRef\.current\?\.setType\(activeId, v\);/);
    assert.match(editor, /setTypeAt\(idx, altType, start\);/);
  });
  it('the buttons never take the focus, so the keyboard stays up', () => {
    assert.match(bar, /tabIndex=\{-1\}/);
    assert.match(bar, /onPointerDown=\{keep\}\s*onMouseDown=\{keep\}/);
    assert.match(bar, /const keep = \(e\) => e\.preventDefault\(\);/);
  });
  it('the current element is marked (aria-pressed and the accent rule)', () => {
    assert.match(bar, /aria-pressed=\{type === b\.type\}/);
    assert.match(css, /\.eb-btn\.is-on::after \{/);
  });
  it('shown only through showElementBar, and only watched on a phone-width touch screen', () => {
    assert.match(app, /\{showElementBar\(\{\s*phone: phoneWidth, touch: touchUi, writing: writingOnPhone, editor: showEditor && !!activeBlock, locked: isLocked,\s*\}\) && \(/);
    assert.match(app, /if \(!phoneWidth \|\| !touchUi\) \{\s*setWritingOnPhone\(false\);\s*return undefined;/);
  });
  it('the extra scroll room only exists while the bar is up', () => {
    assert.match(css, /^\.has-element-bar \.scroller \{ padding-bottom: max\(30vh, var\(--eb-clear, 0px\)\); \}/m);
    assert.match(bar, /classList\.add\('has-element-bar'\)[\s\S]*classList\.remove\('has-element-bar'\)/);
  });
});
