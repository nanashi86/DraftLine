import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCK_COMBO, isLockShortcut, lockBadge, lockedKeyAction } from '../src/lib/lock.js';
import { SHORTCUTS } from '../src/lib/shortcuts.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const key = (k, o = {}) => ({ key: k, code: o.code ?? (k.length === 1 ? `Key${k.toUpperCase()}` : k), ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });

describe('View Only lock: shortcut and badge', () => {
  it('Ctrl+Alt+L and Cmd+Option+L toggle it (matched on the L key, so Option+L’s "¬" still counts)', () => {
    assert.ok(isLockShortcut(key('l', { ctrlKey: true, altKey: true })));
    assert.ok(isLockShortcut(key('¬', { code: 'KeyL', metaKey: true, altKey: true })));
    assert.ok(!isLockShortcut(key('l', { ctrlKey: true })));
    assert.ok(!isLockShortcut(key('l', { altKey: true })));
    assert.ok(!isLockShortcut(key('L', { ctrlKey: true, altKey: true, shiftKey: true })));
    assert.match(SHORTCUTS[LOCK_COMBO], /View Only/);
  });
  it('the badge: a muted "Edit" when unlocked, an amber "View Only" when locked, with the tooltips asked for', () => {
    assert.deepEqual(lockBadge(false), { label: 'Edit', icon: 'unlocked', title: 'Lock Script (View Mode) — Ctrl+Alt+L', className: 'status-lock' });
    assert.deepEqual(lockBadge(true), { label: 'View Only', icon: 'locked', title: 'Unlock Script (Edit Mode) — Ctrl+Alt+L', className: 'status-lock is-locked' });
    const css = read('App.css');
    assert.match(css, /\.status-lock\.is-locked \{[^}]*rgba\(224, 164, 88/);
  });
});

describe('View Only lock: what still works on a locked script', () => {
  it('typing, deleting, Enter, Tab, paste, cut, undo/redo, B/I/U, element types and dual dialogue are blocked', () => {
    for (const e of [
      key('a'), key(' ', { code: 'Space' }), key('('), key('Enter'), key('Backspace'), key('Delete'), key('Tab'),
      key('v', { ctrlKey: true }), key('x', { metaKey: true }), key('z', { ctrlKey: true }), key('Z', { ctrlKey: true, shiftKey: true }),
      key('y', { ctrlKey: true }), key('b', { ctrlKey: true }), key('i', { metaKey: true }), key('u', { ctrlKey: true }),
      key('X', { ctrlKey: true, shiftKey: true }), key('\\', { code: 'Backslash', ctrlKey: true }),
      key('¡', { code: 'Digit1', altKey: true }), key('∂', { code: 'KeyD', altKey: true }),
    ]) assert.equal(lockedKeyAction(e), 'blocked', JSON.stringify([e.key, e.code]));
  });
  it('copying, selecting, moving the caret and margin notes still work', () => {
    for (const e of [key('c', { ctrlKey: true }), key('a', { metaKey: true }), key('ArrowLeft'), key('End'), key('PageDown'),
      key('ArrowDown', { shiftKey: true }), key('Escape')]) assert.equal(lockedKeyAction(e), 'native', e.key);
    assert.equal(lockedKeyAction(key('ArrowUp')), 'nav');
    assert.equal(lockedKeyAction(key('˜', { code: 'KeyN', altKey: true })), 'note');
  });
});

describe('View Only lock: wiring', () => {
  const app = read('App.jsx');
  const editor = read('components/Editor.jsx');
  it('isLocked lives in the app, off by default; the shortcut and the badge both toggle it', () => {
    assert.match(app, /const \[isLocked, setIsLocked\] = useState\(false\);/);
    assert.match(app, /if \(isLockShortcut\(e\)\) \{\s*e\.preventDefault\(\);\s*toggleLock\(\);/);
    assert.match(app, /<LockBadge locked=\{isLocked\} onToggle=\{toggleLock\} \/>/);
    // right after the save indicator
    assert.match(app, /\{saveStatus\.label\}\s*<\/button>\s*<LockBadge/);
  });
  it('locking makes every script line read-only and marks the page', () => {
    assert.match(app, /locked=\{isLocked\}\s*onLockedEdit=\{notifyLocked\}/);
    assert.match(editor, /readOnly=\{locked\}/);
    assert.match(editor, /className=\{`sheet\$\{locked \? ' is-locked' : ''\}`\}\s*data-locked=\{locked \? 'true' : 'false'\}\s*aria-readonly=\{locked\}/);
    assert.equal((editor.match(/locked=\{locked\}/g) || []).length, 3, 'single and dual-dialogue lines');
  });
  it('the editor swallows changing keys and every change path refuses while locked', () => {
    assert.match(editor, /if \(lockedRef\.current\) \{\s*const act = lockedKeyAction\(e\);\s*if \(act === 'native'\) return;\s*if \(act === 'blocked'\) \{\s*e\.preventDefault\(\);/);
    for (const fn of ['commit', 'toggleDual', 'formatAt']) {
      assert.match(editor, new RegExp(`const ${fn} = useCallback\\(\\([^)]*\\) => \\{\\s*if \\(lockedRef\\.current\\) \\{\\s*onLockedEditRef\\.current\\?\\.\\(\\);\\s*return;`), fn);
    }
    assert.match(editor, /if \(!activeBlock \|\| locked\) return \[\];/, 'no autocomplete');
  });
  it('the Element dropdown, B I U S, undo and redo are disabled while locked; hover bio cards are untouched', () => {
    assert.match(app, /const editControlsEnabled = elementControlsEnabled && !isLocked;/);
    assert.equal((app.match(/disabled=\{!editControlsEnabled\}/g) || []).length, 2);
    assert.match(app, /disabled=\{!canUndo \|\| isLocked\}/);
    assert.match(app, /disabled=\{!canRedo \|\| isLocked\}/);
    assert.match(app, /if \(isLocked\) notifyLocked\(\);\s*else if/);
    assert.ok(!/locked/i.test(read('components/CueBioCard.jsx')));
  });
});

describe('Header: the red D opens About DraftLine', () => {
  const app = read('App.jsx');
  const brand = app.slice(app.indexOf('className={`brand'), app.indexOf('<BrandMark />'));
  it('clicking it opens the About modal, not Projects', () => {
    assert.match(brand, /onClick=\{\(\) => setHelpKind\('about'\)\}/);
    assert.match(brand, /aria-label="About DraftLine"/);
    assert.ok(!/setDrawerOpen/.test(brand));
    assert.match(app, /\{helpKind && \(\s*<HelpModal/);
  });
  it('Projects stays on the title’s ▾ and Alt+P', () => {
    assert.match(app, /className="doc-switch-btn"\s*onClick=\{\(\) => setDrawerOpen\(\(o\) => !o\)\}/);
    assert.match(app, /e\.code === 'KeyP'\) \{\s*e\.preventDefault\(\);\s*setDrawerOpen\(\(o\) => !o\);/);
  });
});
