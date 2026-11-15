// Round 2C: mobile hardening. Script lines measured in one batch when they appear; the phone view
// never disturbs a word the keyboard is composing; the caret survives turning the phone; phone text
// fields are 16px; the page-width copy measures in its real line height.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flushFirstMeasures, measureTextarea, queueFirstMeasure } from '../src/lib/measure.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const editor = read('src/components/Editor.jsx');

/** A fake script line `lines` tall (16px lines) that logs reads and writes; `shown` = laid out. */
const fakeLine = (lines, log, { shown = true, parent = null } = {}) => {
  const style = { _h: '' };
  Object.defineProperty(style, 'height', { get: () => style._h, set: (v) => { log.push('write'); style._h = v; } });
  return { style, dataset: {}, isConnected: true, offsetParent: shown ? {} : null, parentElement: parent,
    get scrollHeight() { log.push('read'); return shown ? lines * 16 + 1 : 0; } };
};

describe('script lines that appear together are measured together', () => {
  it('a batch is all writes, then all reads, then all writes — one layout for every line', () => {
    const log = [];
    globalThis.getComputedStyle = () => ({ lineHeight: '16px', overflowY: 'visible' });
    const els = [fakeLine(3, log), fakeLine(1, log), fakeLine(7, log)];
    els.forEach(queueFirstMeasure);
    flushFirstMeasures();
    assert.deepEqual(log, ['write', 'write', 'write', 'read', 'read', 'read', 'write', 'write', 'write']);
    assert.deepEqual(els.map((e) => e.style.height), ['calc(var(--line) * 3)', 'calc(var(--line) * 1)', 'calc(var(--line) * 7)']);
    flushFirstMeasures(); // nothing left: no work, no layout
    assert.equal(log.length, 9);
    delete globalThis.getComputedStyle;
  });
  it('a line that is not laid out yet (Board view) is marked to measure when shown', () => {
    globalThis.getComputedStyle = () => ({ lineHeight: '16px', overflowY: 'visible' });
    const hidden = fakeLine(2, [], { shown: false });
    queueFirstMeasure(hidden);
    flushFirstMeasures();
    assert.equal(hidden.dataset.stale, '1');
    delete globalThis.getComputedStyle;
  });
  it('measureTextarea: one read, and a line that measures 0 (not laid out) keeps its height', () => {
    globalThis.getComputedStyle = () => ({ lineHeight: '16px' });
    const log = [];
    const shown = fakeLine(4, log);
    assert.equal(measureTextarea(shown, true), true);
    assert.equal(shown.style.height, 'calc(var(--line) * 4)');
    assert.equal(log.filter((x) => x === 'read').length, 1);
    const hidden = fakeLine(4, []);
    hidden.style.height = 'calc(var(--line) * 9)';
    Object.defineProperty(hidden, 'scrollHeight', { get: () => 0 });
    assert.equal(measureTextarea(hidden, true), false);
    assert.equal(hidden.style.height, 'calc(var(--line) * 9)');
    delete globalThis.getComputedStyle;
  });
  it('script lines queue on mount; the editor flushes the queue before the caret is placed', () => {
    const at = read('src/components/AutoTextarea.jsx');
    assert.match(at, /if \(snapToLines\) \{[\s\S]*?if \(!queued\.current\) \{\s*queued\.current = true;\s*queueFirstMeasure\(el\);\s*\} else if \(!measureTextarea\(el, true\)\) \{/);
    assert.ok(editor.indexOf('flushFirstMeasures();') < editor.indexOf('// Apply a caret request after the DOM reflects the latest block structure.'));
  });
  it('other text boxes (Story Bible, Characters, Scene Board) measure exactly as before', () => {
    const at = read('src/components/AutoTextarea.jsx');
    assert.match(at, /\/\/ Hidden \(e\.g\. the editor while Board view is showing\): measure when shown\.\s*if \(!el\.offsetParent\) \{\s*el\.dataset\.stale = '1';\s*return;\s*\}\s*measureTextarea\(el, snapToLines\);/);
  });
});

describe('the phone view never disturbs a word being composed', () => {
  it('composition is followed, and freezes the element\'s views until the word is committed', () => {
    assert.match(editor, /sheet\?\.addEventListener\('compositionstart', start, true\);/);
    assert.match(editor, /sheet\?\.addEventListener\('compositionend', end, true\);/);
    assert.match(editor, /const held = reflow \? frozenViews\[b\.id\] : null;/);
  });
  it('while composing, the view typed in takes the change and the caret is left to the keyboard', () => {
    assert.match(editor, /a === from \? \[a, z \+ delta\] : a > from \? \[a \+ delta, z \+ delta\] : \[a, z\]/);
    assert.match(editor, /if \(composing\.current === p\.id && document\.activeElement === el\) return;/);
    assert.match(editor, /if \(el\.selectionStart !== c \|\| el\.selectionEnd !== e2\) el\.setSelectionRange\(c, e2\);/);
  });
  it('an element being composed keeps the page it started on, so its textarea never moves (bar taps)', () => {
    assert.match(editor, /page: real\.page \?\? 0 \} \};/);
    assert.match(editor, /const broke = divider\(\(heldPage \?\? real\.page \?\? 0\) \+ 1\);/);
  });
  it('the committed word\'s caret is read when the composition ends, and placed once the views are redrawn', () => {
    assert.match(editor, /lastSel\.current = \{ id: a\.dataset\.id, start: a\.selectionStart \+ off, end: a\.selectionEnd \+ off \};/);
    assert.match(editor, /if \(reflow && JSON\.stringify\(reflowSplits\) !== JSON\.stringify\(reflowSplitsRef\.current\)\) return;/);
    assert.doesNotMatch(editor, /splitsMoving/);
  });
  it('the browser regression suite replays the 2B corruption (npm run test:browser)', () => {
    const b = read('tests/browser/composition.browser.js');
    for (const s of ['qququiquiet', 'nnonot now', 'element bar tapped mid-word', 'Input.imeSetComposition']) assert.ok(b.includes(s), s);
    assert.match(read('package.json'), /"test:browser": "node --test tests\/browser\/\*\.browser\.js"/);
  });
  it('the caret goes back on its character when the phone turns (phone view ↔ page)', () => {
    assert.match(editor, /const turned = reflowWas\.current !== reflow;/);
  });
  it('a split speech\'s break is reused until its text, type or page lines change', () => {
    assert.match(editor, /const sig = `\$\{it\.block\.type\}\|\$\{ps\.map\(\(pc\) => pc\.from\)\.join\('\.'\)\}\|\$\{it\.block\.text\}`;/);
  });
});

describe('phones: fields, bar, measurement', () => {
  it('text fields are at least 16px on phone-width touch screens only (script lines excluded)', () => {
    const css = read('src/App.css');
    assert.match(css, /@media \(max-width: 559\.98px\) and \(hover: none\) \{\s*input:is\([^\n]*\),\s*textarea:not\(\.el-input\),\s*select \{ font-size: 16px !important; \}/);
  });
  it('element-bar buttons keep a finger-sized width at large text sizes', () => {
    assert.match(read('src/components/ElementBar.css'), /\.eb-btn \{[^}]*min-width: 38px;/);
  });
  it('the element bar only looks for the cursor\'s row when the line might be under the bar', () => {
    assert.match(read('src/components/ElementBar.jsx'), /if \(!ac && r\.bottom <= t - AIR\) return;/);
  });
});
