import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProjectStore, toDoc, toRecord } from '../src/lib/projectStorage.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { createFolderSync, saveProjectEverywhere } from '../src/lib/folderSync.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import { createFakeDirectory } from './helpers/fakeDirectory.js';

const newStore = () => createProjectStore({ indexedDB: createFakeIndexedDB() });
const doc = (title) => ({ meta: { title }, blocks: [makeBlock('scene', 'INT. CAR - NIGHT')], beats: [] });
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Project Lock: data model and store', () => {
  it('new scripts start unlocked; toDoc always says', async () => {
    const store = newStore();
    const rec = await store.saveActiveProject(doc('Run!'));
    assert.equal(rec.isLocked, false);
    assert.equal(toDoc(rec).isLocked, false);
    assert.equal(toDoc({ id: 'old', script: [] }).isLocked, false, 'scripts from before the lock existed');
  });
  it('setProjectLock flips it, stamps it as an edit, and the editor’s ordinary saves keep it', async () => {
    const store = newStore();
    const rec = await store.saveActiveProject(doc('Run!'));
    const locked = await store.setProjectLock(rec.id, true);
    assert.equal(locked.isLocked, true);
    assert.ok(locked.updatedAt > rec.updatedAt, 'newest copy wins in the synced folder');
    const saved = await store.saveActiveProject({ ...doc('Run! (rewrite)'), id: rec.id }); // the editor never sends isLocked
    assert.equal(saved.isLocked, true);
    assert.equal((await store.getProject(rec.id)).isLocked, true);
    assert.equal((await store.setProjectLock(rec.id, false)).isLocked, false);
  });
  it('a locked script can’t be deleted (the store refuses too)', async () => {
    const store = newStore();
    const a = await store.saveActiveProject(doc('A'));
    await store.saveActiveProject(doc('B'));
    await store.setProjectLock(a.id, true);
    await assert.rejects(() => store.deleteProject(a.id), /locked — unlock it/);
    assert.ok(await store.getProject(a.id));
    await store.setProjectLock(a.id, false);
    assert.equal(await store.deleteProject(a.id), true);
  });
  it('a duplicate starts unlocked', async () => {
    const store = newStore();
    const a = await store.saveActiveProject(doc('A'));
    await store.setProjectLock(a.id, true);
    const copy = await store.duplicateProject(a.id);
    assert.equal(copy.isLocked, false);
  });
  it('the lock travels in backups and in the synced folder’s file', async () => {
    const store = newStore();
    const a = await store.saveActiveProject(doc('A'));
    const locked = await store.setProjectLock(a.id, true);
    assert.equal(toDoc(parseBackup(serializeBackup(locked)).record).isLocked, true);
    const dir = createFakeDirectory();
    const sync = createFolderSync({ settings: { get: async () => null, set: async () => {} }, win: { showDirectoryPicker: async () => dir } });
    await sync.init();
    await sync.link();
    await sync.writeProject(locked);
    const [inFolder] = await sync.listProjects();
    assert.equal(inFolder.record.isLocked, true);
    const { record } = await saveProjectEverywhere({ store, sync, data: { ...toDoc(locked), id: a.id } });
    assert.equal(record.isLocked, true, 'saving everywhere keeps it');
  });
  it('toRecord sets it only when told', () => {
    assert.equal('isLocked' in toRecord(doc('A')), false);
    assert.equal(toRecord({ ...doc('A'), isLocked: true }).isLocked, true);
  });
});

describe('Project Lock: the padlock in Projects', () => {
  const drawer = read('components/ProjectsDrawer.jsx');
  const css = read('components/ProjectsDrawer.css');
  it('a padlock just left of ⋮ on every card', () => {
    const lock = drawer.indexOf('className={`pd-lock');
    assert.ok(lock > 0 && lock < drawer.indexOf('<div className="pd-more"'));
    assert.match(drawer, /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*if \(!busy\) act\(\(\) => onToggleLock\(p\.id\)\);/, 'toggles without opening the script');
  });
  it('locked: a closed amber Lock, "Project locked (Deletions and overwrites disabled)"; unlocked: a muted open lock, "Lock project"', () => {
    assert.match(drawer, /title=\{p\.isLocked \? 'Project locked \(Deletions and overwrites disabled\)' : 'Lock project'\}/);
    assert.match(drawer, /\? <Lock size=\{14\} strokeWidth=\{2\} aria-hidden \/>\s*: <LockOpen size=\{14\}/);
    assert.match(css, /\.pd-lock\.is-locked \{ color: var\(--accent-amber\); \}/);
    assert.match(css, /\.pd-lock \{[^}]*color: #52525b;/, 'zinc-600');
    assert.match(css, /\.pd-lock:hover \{ color: #a1a1aa;/, 'zinc-400 on hover');
    assert.match(drawer, /aria-pressed=\{p\.isLocked === true\}/);
  });
  it('⋮ → Delete… is disabled while locked, and says why', () => {
    assert.match(drawer, /disabled: count <= 1 \|\| p\.isLocked === true,\s*hint: p\.isLocked \? 'locked'/);
  });
});

describe('Project Lock: guards in the app', () => {
  const app = read('App.jsx');
  const modal = read('components/ImportModal.jsx');
  it('import / paste-import into a locked script makes a new script instead (Append too)', () => {
    const fn = app.slice(app.indexOf('const importScript = ('), app.indexOf('const printScript = '));
    const guard = fn.indexOf('if (projectLocked) {');
    assert.ok(guard > 0 && guard < fn.indexOf('set(incoming)') && guard < fn.indexOf('set((prev) => [...prev, ...incoming])'));
    assert.match(fn, /openAsNewProject\(\s*\{ meta: \{ \.\.\.EMPTY_META, \.\.\.newProjectMeta\(\{ title \}\), \.\.\.titlePage, title \}, blocks: incoming, beats: \[\] \}/);
    assert.match(modal, /\{locked \? 'Load as New Script' : 'Load into Editor'\}/);
    assert.match(modal, /\{!locked && \(\s*<button[\s\S]*?Append/);
    assert.match(app, /locked=\{projectLocked\}/);
  });
  it('deleting asks the store first; restoring a snapshot over a locked script is refused', () => {
    assert.match(app, /const deleteProject = async \(id, title\) => \{\s*if \(\(await projects\.getProject\(id\)\)\?\.isLocked\) \{/);
    const restore = app.slice(app.indexOf('const restoreSnapshot = useCallback('), app.indexOf('const restoreBackup = '));
    assert.ok(restore.indexOf('if (s.projectLocked) {') < restore.indexOf('set(doc.blocks.length'));
  });
  it('the lock is the open script’s own, read on opening and written by the padlock (and to the folder)', () => {
    assert.match(app, /setProjectLocked\(doc\.isLocked === true\);/);
    assert.match(app, /const rec = await projects\.setProjectLock\(id, cur\.isLocked !== true\);\s*folderSync\.writeProject\(rec, latest\.current\.fileOptions\);/);
  });
});
