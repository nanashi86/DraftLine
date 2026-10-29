import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAST_FOLD_KEY, CAST_FOLD_MIN, CAST_TOP, foldCast, readCastExpanded, writeCastExpanded } from '../src/lib/castFold.js';

const cast = (n) => Array.from({ length: n }, (_, i) => ({ name: `C${i + 1}`, lines: 100 - i }));
const names = (r) => r.shown.map((c) => c.name);
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Characters → Dialogue: the cast list folds after the biggest speakers', () => {
  it('49 speakers: the top 12 by lines, then "+37 more"', () => {
    assert.deepEqual([CAST_TOP, CAST_FOLD_MIN], [12, 15]);
    const r = foldCast(cast(49));
    assert.equal(r.foldable, true);
    assert.deepEqual(names(r), cast(12).map((c) => c.name));
    assert.equal(r.hidden, 37);
  });
  it('15 or fewer never fold', () => {
    for (const n of [0, 3, 15]) {
      const r = foldCast(cast(n));
      assert.equal(r.foldable, false, String(n));
      assert.equal(r.shown.length, n);
      assert.equal(r.hidden, 0);
    }
    assert.equal(foldCast(cast(16)).foldable, true);
  });
  it('a picked character in the fold stays shown, after the top 12', () => {
    const r = foldCast(cast(49), { selected: 'C30' });
    assert.deepEqual(names(r).slice(-2), ['C12', 'C30']);
    assert.equal(r.hidden, 36);
    assert.equal(foldCast(cast(49), { selected: 'C3' }).hidden, 37, 'a top-12 pick adds nothing');
  });
  it('opened: everyone, in order', () => {
    const r = foldCast(cast(49), { expanded: true, selected: 'C30' });
    assert.equal(r.shown.length, 49);
    assert.equal(r.hidden, 0);
    assert.equal(r.foldable, true, 'still foldable: "Show fewer" stays');
  });
  it('opened or folded is remembered; blocked storage reads as folded', () => {
    const m = new Map();
    const local = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    assert.equal(CAST_FOLD_KEY, 'draftline_cast_expanded');
    assert.equal(readCastExpanded(local), false);
    writeCastExpanded(local, CAST_FOLD_KEY, true);
    assert.equal(readCastExpanded(local), true);
    writeCastExpanded(local, CAST_FOLD_KEY, false);
    assert.equal(readCastExpanded(local), false);
    const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    assert.equal(readCastExpanded(blocked), false);
    assert.doesNotThrow(() => writeCastExpanded(blocked, CAST_FOLD_KEY, true));
  });
  it('the tab: pills from foldCast, then a dashed "+N more" / "Show fewer" pill outside the listbox', () => {
    const ui = read('components/DialogueTuner.jsx');
    const css = read('components/DialogueTuner.css');
    assert.match(ui, /<div className="tuner-cast-list" role="listbox" aria-label="Characters">\s*\{cast\.shown\.map/);
    assert.match(ui, /className="pill cast-more"\s*aria-expanded=\{castOpen\}/);
    assert.match(ui, /\{castOpen \? 'Show fewer' : `\+\$\{cast\.hidden\} more`\}/);
    assert.match(css, /\.tuner-cast-list \{ display: contents; \}/);
    assert.match(css, /\.pill\.cast-more \{ border-style: dashed;/);
  });
});
