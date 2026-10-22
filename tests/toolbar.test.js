import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isOnBar, moreMenuItems } from '../src/lib/toolbar.js';

const noop = () => {};
const handlers = { onBible: noop, onCharacters: noop, onSnapshots: noop, onNotes: noop, onShortcuts: noop, onSample: noop, onAbout: noop };
const shape = (items) => items.map((it) => (it.divider ? '---' : `${it.label}${it.hint ? ` [${it.hint}]` : ''}`));

/** A fake element: shown or display:none, at a horizontal position. */
const el = (left, right, shown = true) => ({
  offsetParent: shown ? {} : null,
  getBoundingClientRect: () => ({ left, right, width: right - left, height: 30 }),
});
const bar = el(0, 1400);

describe('⋮ menu', () => {
  it('when the toolbar shows both panels: Snapshots · Notes — Shortcuts — About (Load Sample is in File ▾)', () => {
    assert.deepEqual(shape(moreMenuItems({ ...handlers, charactersOnBar: true, bibleOnBar: true, snapshotCount: 3, noteCount: 7 })), [
      'View Snapshots [3]', 'Margin Notes [7]', '---', 'Keyboard Shortcuts [Ctrl+/]', '---', 'About DraftLine',
    ]);
  });
  it('adds Story Bible on top only while the toolbar has tucked it away', () => {
    assert.deepEqual(shape(moreMenuItems({ ...handlers, charactersOnBar: true, bibleOnBar: false })), [
      'Story Bible [Alt+I]', '---', 'View Snapshots [0]', 'Margin Notes [0]', '---', 'Keyboard Shortcuts [Ctrl+/]', '---',
      'About DraftLine',
    ]);
  });
  it('adds Characters on top only while the toolbar has it out of view', () => {
    assert.deepEqual(shape(moreMenuItems({ ...handlers, charactersOnBar: false, bibleOnBar: true })).slice(0, 2), [
      'Characters [Alt+C]', '---',
    ]);
  });
  it('adds both, in toolbar order, when neither is on the toolbar (narrow, scrolled bar)', () => {
    assert.deepEqual(shape(moreMenuItems({ ...handlers, charactersOnBar: false, bibleOnBar: false })).slice(0, 3), [
      'Story Bible [Alt+I]', 'Characters [Alt+C]', '---',
    ]);
  });
  it('items do what they say', () => {
    const calls = [];
    const h = Object.fromEntries(Object.keys(handlers).map((k) => [k, () => calls.push(k)]));
    moreMenuItems({ ...h, charactersOnBar: false, bibleOnBar: false }).filter((i) => !i.divider).forEach((i) => i.onSelect());
    assert.deepEqual(calls, ['onBible', 'onCharacters', 'onSnapshots', 'onNotes', 'onShortcuts', 'onAbout']);
  });
});

describe('isOnBar', () => {
  it('a button inside the visible bar is on it', () => assert.equal(isOnBar(el(1200, 1300), bar), true));
  it('a button hidden by a breakpoint is not', () => assert.equal(isOnBar(el(1200, 1300, false), bar), false));
  it('a button scrolled out of a narrow bar is not', () => assert.equal(isOnBar(el(1380, 1480), bar), false));
  it('nothing to measure → not on the bar', () => {
    assert.equal(isOnBar(null, bar), false);
    assert.equal(isOnBar(el(0, 0), bar), false);
  });
});

describe('toolbar & About wiring', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const about = readFileSync(new URL('../src/components/HelpModal.jsx', import.meta.url), 'utf8');
  const bar = app.slice(app.indexOf('<header className="bar"'), app.indexOf('</header>'));

  it('there is no standalone Dual button; the Element dropdown carries Dual Dialogue', () => {
    assert.ok(!/>\s*Dual\s*</.test(bar), 'no "Dual" button');
    assert.match(bar, /ELEMENT_MENU\.map/);
    assert.match(bar, /e\.target\.value === DUAL_SHORTCUT\.action\) editorRef\.current\?\.toggleDual\(activeId\)/);
  });
  it('Alt+D still toggles dual dialogue from the keyboard', () => {
    const editor = readFileSync(new URL('../src/components/Editor.jsx', import.meta.url), 'utf8');
    assert.match(editor, /e\.altKey && !mod && e\.code === 'KeyD'/);
  });
  it('the ⋮ menu is built as it opens, from what the toolbar is showing', () => {
    assert.match(bar, /items=\{\(\) => moreMenuItems\(\{/);
    assert.match(bar, /bibleOnBar: inPlan \|\| isOnBar\(bibleBtnRef\.current, barRef\.current\)/, 'never in ⋮ while in Plan');
    assert.match(bar, /charactersOnBar: inPlan \|\| isOnBar\(charactersBtnRef\.current, barRef\.current\)/);
  });
  it('the right-hand order: workspace tools (Focus · Story Bible · Characters, or Plan’s), then Snapshot · ⋮', () => {
    const right = bar.slice(bar.indexOf('bar-group bar-right'));
    const pos = ['btn-plan-fold', 'btn-plan-export', '>Focus<', 'Story Bible\n', 'Characters\n', 'btn-snapshot', 'btn-kebab'].map((k) => right.indexOf(k));
    assert.ok(pos.every((p) => p > 0), JSON.stringify(pos));
    assert.deepEqual([...pos].sort((a, b) => a - b), pos);
    assert.ok(!/>\s*Dialogue\s*</.test(right), 'no separate Dialogue toolbar button');
  });
  it('About points to .draftline and has a Backup Project button', () => {
    assert.match(about, /Export \(\.draftline \/ \.fountain \/ \.fdx\)/);
    assert.match(about, /Backup Project \(\.draftline\)/);
    assert.match(about, /onClick=\{onBackup\}/);
    assert.match(app, /onBackup=\{backupProject\}/);
  });
});
