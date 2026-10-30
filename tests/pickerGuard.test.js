import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createPickerGuard } from '../src/lib/pickerGuard.js';

/** A tiny stand-in for document: listeners by type, and dispatch. */
function fakeDoc() {
  const on = {};
  return {
    addEventListener: (t, f) => { (on[t] ||= []).push(f); },
    removeEventListener: (t, f) => { on[t] = (on[t] || []).filter((g) => g !== f); },
    fire: (t, e) => (on[t] || []).forEach((f) => f(e)),
    count: () => Object.values(on).reduce((n, l) => n + l.length, 0),
  };
}
const select = () => {
  const s = { tag: 'select' };
  s.closest = (sel) => (sel === 'select' ? s : null);
  return s;
};
const other = { closest: () => null };

describe('pickerGuard: knows when a native dropdown list is open', () => {
  it('a press on a <select> opens it; picking (change) closes it', () => {
    const doc = fakeDoc();
    const g = createPickerGuard(doc);
    const s = select();
    assert.equal(g.isOpen(), false);
    doc.fire('mousedown', { target: s });
    assert.equal(g.isOpen(), true);
    doc.fire('change', { target: s });
    assert.equal(g.isOpen(), false);
  });
  it('a second press on the same <select> closes it; a press anywhere else closes it', () => {
    const doc = fakeDoc();
    const g = createPickerGuard(doc);
    const s = select();
    doc.fire('mousedown', { target: s });
    doc.fire('mousedown', { target: s });
    assert.equal(g.isOpen(), false);
    doc.fire('mousedown', { target: s });
    doc.fire('mousedown', { target: other });
    assert.equal(g.isOpen(), false);
  });
  it('pressing another <select> moves it there', () => {
    const doc = fakeDoc();
    const g = createPickerGuard(doc);
    const a = select();
    const b = select();
    doc.fire('mousedown', { target: a });
    doc.fire('mousedown', { target: b });
    assert.equal(g.isOpen(), true);
    doc.fire('focusout', { target: a });
    assert.equal(g.isOpen(), true, 'the old one losing focus doesn’t close the new one');
    doc.fire('focusout', { target: b });
    assert.equal(g.isOpen(), false);
  });
  it('the keyboard: Space / Enter / F4 / Alt+↓ open; Escape / Enter / Tab close', () => {
    const doc = fakeDoc();
    const g = createPickerGuard(doc);
    const s = select();
    for (const k of [{ key: ' ' }, { key: 'F4' }, { key: 'ArrowDown', altKey: true }]) {
      doc.fire('keydown', { target: s, ...k });
      assert.equal(g.isOpen(), true, k.key);
      doc.fire('keydown', { target: s, key: 'Escape' });
      assert.equal(g.isOpen(), false);
    }
    doc.fire('keydown', { target: s, key: 'Enter' });
    assert.equal(g.isOpen(), true);
    doc.fire('keydown', { target: s, key: 'Tab' });
    assert.equal(g.isOpen(), false);
    doc.fire('keydown', { target: other, key: ' ' });
    assert.equal(g.isOpen(), false, 'keys elsewhere don’t count');
  });
  it('dispose removes every listener', () => {
    const doc = fakeDoc();
    const g = createPickerGuard(doc);
    assert.equal(doc.count(), 4);
    g.dispose();
    assert.equal(doc.count(), 0);
  });
});

describe('InfoTip: hover intent, and never behind a dropdown list', () => {
  const ui = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
  const tip = ui.slice(ui.indexOf('export function InfoTip('), ui.indexOf('function YesNo('));
  it('opens after a 350 ms hover, not on contact; leaving cancels it', () => {
    assert.match(ui, /export const TIP_HOVER_DELAY = 350;/);
    assert.match(tip, /hoverTimer\.current = setTimeout\(show, TIP_HOVER_DELAY\);/);
    assert.match(tip, /onMouseEnter=\{hoverIn\}\s*onMouseLeave=\{hoverOut\}/);
    assert.match(tip, /const hoverOut = \(\) => \{\s*clearTimeout\(hoverTimer\.current\);\s*setOpen\(false\);/);
    assert.match(tip, /useEffect\(\(\) => \(\) => clearTimeout\(hoverTimer\.current\), \[\]\);/, 'no timer left behind');
  });
  it('stays closed while a dropdown list is open', () => {
    assert.match(tip, /const show = \(\) => \{\s*if \(!nativePickerOpen\(\)\) setOpen\(true\);/);
    assert.match(ui, /import \{ nativePickerOpen \} from '\.\.\/lib\/pickerGuard\.js';/);
    assert.match(ui, /\nnativePickerOpen\(\);\n/, 'the guard starts listening when the module loads');
  });
  it('keyboard focus shows it at once; a click’s focus doesn’t (the click opens the Glossary)', () => {
    assert.match(tip, /onFocus=\{\(e\) => \{\s*if \(e\.target\.matches\(':focus-visible'\)\) show\(\);/);
    assert.match(tip, /onClick=\{\(\) => onOpen\(entry\.id\)\}/);
  });
  it('any click closes it, along with scroll, resize and Escape', () => {
    assert.match(tip, /window\.addEventListener\('pointerdown', hide, true\);/);
    assert.match(tip, /window\.removeEventListener\('pointerdown', hide, true\);/);
    assert.match(tip, /window\.addEventListener\('scroll', hide, true\);/);
  });
});

describe('the cue bio card follows the same rule', () => {
  const card = readFileSync(new URL('../src/components/CueBioCard.jsx', import.meta.url), 'utf8');
  it('a hover never opens it while a dropdown list is open; clicking a cue still does', () => {
    assert.match(card, /import \{ nativePickerOpen \} from '\.\.\/lib\/pickerGuard\.js';/);
    assert.match(card, /\nnativePickerOpen\(\);\n/, 'the guard starts listening when the module loads');
    assert.match(card, /t\.open = setTimeout\(\(\) => \{\s*if \(!nativePickerOpen\(\)\) dispatch\(\{ type: 'timer', cueId: id \}\);\s*\}, CUE_CARD_DELAY\);/);
    assert.match(card, /dispatch\(\{ type: 'click', cueId: input\.dataset\.id \}\)/);
  });
  it('the app has no other hover-opened card: every other hover handler only highlights or pauses', () => {
    // If a new file starts reacting to hover, decide whether it opens a card (then guard it) and add it here.
    const dir = new URL('../src/components/', import.meta.url);
    const hover = readdirSync(dir).filter((f) => /\.jsx?$/.test(f))
      .filter((f) => /onMouseEnter|onPointerEnter|'mouseover'|'mouseenter'|'pointerenter'/.test(readFileSync(new URL(f, dir), 'utf8')))
      .sort();
    assert.deepEqual(hover, [
      'CueBioCard.jsx', // card: guarded (above)
      'DialogueTuner.jsx', // highlights the speech in the script
      'Editor.jsx', // moves the autocomplete highlight
      'Select.jsx', // moves the dropdown's active-row highlight
      'StoryDna.jsx', // ⓘ cards: guarded
      'SupportCallouts.js', // pauses a corner toast's timer
    ]);
  });
});
