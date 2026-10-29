import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { remeasureTextareas } from '../src/lib/measure.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// A textarea whose content is `lines` tall (16px lines), recording the order of reads and writes.
const fakeArea = (lines, log, parent) => {
  const style = { _h: 'calc(var(--line) * 5)' };
  Object.defineProperty(style, 'height', { get: () => style._h, set: (v) => { log.push('write'); style._h = v; } });
  return {
    style, dataset: { stale: '1' }, offsetParent: {}, parentElement: parent,
    get scrollHeight() { log.push('read'); return lines * 16 + 1; },
  };
};

describe('Script lines are measured again when Courier Prime arrives', () => {
  it('remeasureTextareas: all writes, then all reads, then all writes — one layout, not one per line', () => {
    const log = [];
    const scroller = { scrollTop: 900, scrollHeight: 5000, clientHeight: 800, parentElement: null };
    globalThis.getComputedStyle = (el) => (el === scroller ? { overflowY: 'auto' } : { lineHeight: '16px', overflowY: 'visible' });
    const els = [fakeArea(4, log, scroller), fakeArea(5, log, scroller), fakeArea(1, log, scroller)];
    const hidden = { ...fakeArea(2, [], scroller), offsetParent: null };
    const changed = remeasureTextareas([...els, hidden]);
    assert.deepEqual(log, ['write', 'write', 'write', 'read', 'read', 'read', 'write', 'write', 'write']);
    assert.deepEqual(els.map((e) => e.style.height), ['calc(var(--line) * 4)', 'calc(var(--line) * 5)', 'calc(var(--line) * 1)']);
    assert.equal(changed, 2, 'the 5-line paragraph that really is 4 lines, and the 1-liner');
    assert.equal(scroller.scrollTop, 900, 'the page stays where it was');
    assert.equal(els[0].dataset.stale, undefined);
    assert.equal(hidden.style.height, 'calc(var(--line) * 5)', 'hidden lines wait until shown');
    delete globalThis.getComputedStyle;
  });

  it('the editor re-measures every script line once fonts are ready, and whenever a Courier face finishes loading', () => {
    const editor = read('src/components/Editor.jsx');
    assert.match(editor, /fonts\.ready\.then\(remeasure, \(\) => \{\}\);/);
    assert.match(editor, /if \(!e\?\.fontfaces \|\| e\.fontfaces\.some\(\(f\) => \/Courier\/i\.test\(f\.family\)\)\) remeasure\(\);/);
    assert.match(editor, /fonts\.addEventListener\?\.\('loadingdone', onDone\);/);
    assert.match(editor, /remeasureTextareas\(lines\);/);
  });

  it('Courier Prime ships with DraftLine (no Google Fonts request), blocking rather than swapping', () => {
    const css = read('src/index.css');
    assert.equal((css.match(/@font-face \{ font-family: 'Courier Prime';[^}]*font-display: block;/g) || []).length, 4);
    assert.doesNotMatch(read('index.html'), /family=Courier\+Prime/);
  });
});
