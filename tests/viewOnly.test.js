import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCK_COMBO, isLockShortcut, lockBadge, lockedKeyAction } from '../src/lib/lock.js';
import { SHORTCUTS } from '../src/lib/shortcuts.js';
import { createProjectStore, toDoc, toRecord } from '../src/lib/projectStorage.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { createFolderSync, saveProjectEverywhere } from '../src/lib/folderSync.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import { createFakeDirectory } from './helpers/fakeDirectory.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const key = (k, o = {}) => ({ key: k, code: o.code ?? (k.length === 1 ? `Key${k.toUpperCase()}` : k), ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });

describe('Viewing mode: shortcut and badge', () => {
  it('Ctrl+Alt+L and Cmd+Option+L toggle it (matched on the L key, so Option+L’s "¬" still counts)', () => {
    assert.ok(isLockShortcut(key('l', { ctrlKey: true, altKey: true })));
    assert.ok(isLockShortcut(key('¬', { code: 'KeyL', metaKey: true, altKey: true })));
    assert.ok(!isLockShortcut(key('l', { ctrlKey: true })));
    assert.ok(!isLockShortcut(key('l', { altKey: true })));
    assert.ok(!isLockShortcut(key('L', { ctrlKey: true, altKey: true, shiftKey: true })));
    assert.match(SHORTCUTS[LOCK_COMBO], /Viewing/);
  });
  it('the badge: a muted "Editing" when unlocked, an amber "Viewing" when locked; the tooltip says what a click does', () => {
    assert.deepEqual(lockBadge(false), { label: 'Editing', icon: 'unlocked', title: 'Switch to Viewing (read only) — Ctrl+Alt+L', className: 'status-lock' });
    assert.deepEqual(lockBadge(true), { label: 'Viewing', icon: 'locked', title: 'Switch to Editing — Ctrl+Alt+L', className: 'status-lock is-locked' });
    assert.ok(!/View Only|'Edit'/.test(read('lib/lock.js')), 'the old labels are gone');
    const css = read('App.css');
    assert.match(css, /\.status-lock\.is-locked \{[^}]*rgba\(224, 164, 88/);
  });
});

describe('Viewing mode: what still works on a locked script', () => {
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

describe('Viewing mode: wiring', () => {
  const app = read('App.jsx');
  const editor = read('components/Editor.jsx');
  it('isLocked lives in the app, starting from the script’s saved viewOnly; the shortcut and the badge both toggle it', () => {
    assert.match(app, /const \[isLocked, setIsLocked\] = useState\(initialDoc\.viewOnly === true\);/);
    assert.match(app, /if \(isLockShortcut\(e\)\) \{\s*e\.preventDefault\(\);\s*toggleLock\(\);/);
    assert.match(app, /<LockBadge locked=\{isLocked\} onToggle=\{toggleLock\} \/>/);
    // right after the save indicator
    assert.match(app, /\{saveStatus\.label\}<\/span>\s*<\/button>\s*<LockBadge/);
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
    assert.match(app, /className="doc-switch-btn"\s*data-projects-toggle\s*onClick=\{\(\) => setDrawerOpen\(\(o\) => !o\)\}/);
    assert.match(app, /e\.code === 'KeyP'\) \{\s*e\.preventDefault\(\);\s*setDrawerOpen\(\(o\) => !o\);/);
  });
});

describe('Viewing mode: saved with the script', () => {
  const app = read('App.jsx');
  const newStore = () => createProjectStore({ indexedDB: createFakeIndexedDB() });
  const doc = (title, extra = {}) => ({ meta: { title }, blocks: [makeBlock('scene', 'INT. CAR - NIGHT')], beats: [], ...extra });

  it('new scripts start editable; scripts saved before Viewing was stored open editable', async () => {
    const rec = await newStore().saveActiveProject(doc('Run!'));
    assert.equal(rec.viewOnly, false);
    assert.equal(toDoc(rec).viewOnly, false);
    assert.equal(toDoc({ id: 'old', script: [] }).viewOnly, false, 'no viewOnly property → editable');
    assert.equal('viewOnly' in toRecord(doc('A')), false, 'toRecord sets it only when told');
    assert.equal(toRecord(doc('A', { viewOnly: true })).viewOnly, true);
  });

  it('toggling it is an ordinary save: stored on the record, stamped as an edit, and kept by saves that don’t say', async () => {
    const store = newStore();
    const rec = await store.saveActiveProject(doc('Run!'));
    const on = await store.saveActiveProject(doc('Run!', { id: rec.id, viewOnly: true }));
    assert.equal(on.viewOnly, true);
    assert.ok(on.updatedAt > rec.updatedAt, 'newest copy wins in the synced folder and on other computers');
    assert.equal((await store.getProject(rec.id)).viewOnly, true);
    const journal = await store.saveActiveProject(doc('Run! (journal)', { id: rec.id })); // an older crash journal: no viewOnly
    assert.equal(journal.viewOnly, true);
    assert.equal((await store.saveActiveProject(doc('Run!', { id: rec.id, viewOnly: false }))).viewOnly, false);
  });

  it('is separate from the Project Lock (padlock): each keeps its own value', async () => {
    const store = newStore();
    const rec = await store.saveActiveProject(doc('A', { viewOnly: true }));
    const padlocked = await store.setProjectLock(rec.id, true);
    assert.equal(padlocked.viewOnly, true);
    const edited = await store.saveActiveProject(doc('A', { id: rec.id, viewOnly: false }));
    assert.equal(edited.isLocked, true);
    assert.equal(edited.viewOnly, false);
  });

  it('a duplicate starts editable', async () => {
    const store = newStore();
    const a = await store.saveActiveProject(doc('A', { viewOnly: true }));
    assert.equal((await store.duplicateProject(a.id)).viewOnly, false);
  });

  it('opening a script with viewOnly: true starts in Viewing (on load and on switching)', () => {
    assert.equal(toDoc({ id: 'x', script: [], viewOnly: true }).viewOnly, true);
    assert.match(app, /const \[isLocked, setIsLocked\] = useState\(initialDoc\.viewOnly === true\);/);
    assert.match(app, /setIsLocked\(doc\.viewOnly === true\); \/\/ each script opens in its own saved Viewing state/);
  });

  it('the app saves it like any edit: it makes the script unsaved and goes out with the next save', () => {
    assert.match(app, /\|\| saved\.viewOnly !== isLocked;/);
    assert.match(app, /viewOnly: isLocked,\s*createdAt/);
    assert.match(app, /production: s\.production, revisions: s\.revisions, viewOnly: s\.viewOnly,/);
    assert.match(app, /revisions, isLocked, saveNow\]\);/, 'the debounced auto-save runs on a toggle');
    assert.match(app, /production: s\.production, viewOnly: s\.viewOnly,\s*\}\);/, 'the crash journal carries it');
  });

  it('.draftline backups and the synced folder’s file keep it', async () => {
    const store = newStore();
    const rec = await store.saveActiveProject(doc('A', { viewOnly: true }));
    const parsed = parseBackup(serializeBackup(rec)).record;
    assert.equal(parsed.viewOnly, true);
    assert.equal(toDoc(parsed).viewOnly, true);
    const dir = createFakeDirectory();
    const sync = createFolderSync({ settings: { get: async () => null, set: async () => {} }, win: { showDirectoryPicker: async () => dir } });
    await sync.init();
    await sync.link();
    await sync.writeProject(rec);
    const [inFolder] = await sync.listProjects();
    assert.equal(inFolder.record.viewOnly, true);
    const { record } = await saveProjectEverywhere({ store, sync, data: { ...toDoc(rec), id: rec.id, viewOnly: false } });
    assert.equal(record.viewOnly, false, 'a toggle reaches the folder too');
    const [after] = await sync.listProjects();
    assert.equal(after.record.viewOnly, false);
  });
});
