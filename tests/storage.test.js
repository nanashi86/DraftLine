import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  DESTINATION_KEY, FILES_KEY, HANDLE_KEY, SNAPSHOT_DIR, TRASH_DIR, createFolderSync, isFolderSyncSupported, mergeProjectLists, projectFileName,
  saveProjectEverywhere, scriptSlug, snapshotFileName, snapshotFileText, snapshotFromFileText, snapshotPath, snapshotStamp, storageStatus,
  trashFileName,
} from '../src/lib/folderSync.js';
import { deleteWarning } from '../src/lib/deleteConfirm.js';
import { createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { parseBackup } from '../src/lib/backup.js';
import { createRevision } from '../src/lib/revisions.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import { createFakeDirectory } from './helpers/fakeDirectory.js';

const memorySettings = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { map: m, get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } };
};
/** A window whose folder picker hands back `dir` (or is cancelled). */
const pickerWindow = (dir, { cancel = false } = {}) => ({
  picked: 0,
  async showDirectoryPicker(opts) {
    this.picked += 1;
    this.opts = opts;
    if (cancel) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    return dir;
  },
});
const doc = (title, text = 'EXT. HARBOR - DAWN') => ({ meta: { title, author: 'Eric' }, blocks: [makeBlock('scene', text)], beats: [] });

async function linked(opts = {}) {
  const dir = createFakeDirectory('DraftLine Projects', opts);
  const settings = memorySettings();
  const sync = createFolderSync({ settings, win: pickerWindow(dir) });
  await sync.init();
  await sync.link();
  return { dir, settings, sync };
}

describe('Folder sync: browsers without showDirectoryPicker (Safari, Firefox, phones)', () => {
  it('reports unsupported and stays on browser storage — never throws, never prompts', async () => {
    assert.equal(isFolderSyncSupported({}), false);
    assert.equal(isFolderSyncSupported({ showDirectoryPicker() {} }), true);
    const settings = memorySettings({ [DESTINATION_KEY]: 'folder' });
    const sync = createFolderSync({ settings, win: {} });
    const s = await sync.init();
    assert.deepEqual([s.supported, s.ready, s.active, s.needsPermission, s.destination], [false, true, false, false, 'browser']);
    assert.equal(await sync.link(), false);
  });
  it('saves still go to IndexedDB; the folder is skipped', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const sync = createFolderSync({ settings: memorySettings(), win: {} });
    await sync.init();
    const { record, folder } = await saveProjectEverywhere({ store, sync, data: doc('Run!') });
    assert.equal(folder, 'skipped');
    assert.equal((await store.getProject(record.id)).title, 'Run!');
  });
  it('the Storage Destination block hides the Synced Folder option when unsupported', async () => {
    const { readFileSync } = await import('node:fs');
    const ui = readFileSync(new URL('../src/components/StorageDestination.jsx', import.meta.url), 'utf8');
    assert.match(ui, /\{sync\.supported && \(/);
    assert.match(ui, /Synced Folder \(Google Drive \/ Local Disk\)/);
    assert.match(ui, /Browser Storage \(IndexedDB\)/);
  });
});

describe('Folder sync: linking, permissions and start-up', () => {
  it('Link Folder asks for read-write, stores the handle under draftline_synced_directory_handle and goes active', async () => {
    const { dir, settings, sync } = await linked();
    const s = sync.getState();
    assert.deepEqual([s.active, s.folderName, s.destination, s.permission], [true, 'DraftLine Projects', 'folder', 'granted']);
    assert.equal(settings.map.get(HANDLE_KEY), dir);
    assert.equal(settings.map.get(DESTINATION_KEY), 'folder');
  });
  it('a cancelled picker changes nothing', async () => {
    const settings = memorySettings();
    const sync = createFolderSync({ settings, win: pickerWindow(createFakeDirectory(), { cancel: true }) });
    await sync.init();
    assert.equal(await sync.link(), false);
    assert.equal(sync.getState().active, false);
    assert.equal(settings.map.has(HANDLE_KEY), false);
  });
  it('on start-up: granted → active; "prompt" → waits for a click, without throwing or prompting', async () => {
    const dir = createFakeDirectory();
    const settings = memorySettings({ [HANDLE_KEY]: dir, [DESTINATION_KEY]: 'folder' });
    let s = await createFolderSync({ settings, win: pickerWindow(dir) }).init();
    assert.deepEqual([s.active, s.needsPermission], [true, false]);

    dir.$.root.permission = 'prompt';
    const sync = createFolderSync({ settings, win: pickerWindow(dir) });
    s = await sync.init();
    assert.deepEqual([s.active, s.needsPermission, s.permission, s.folderName], [false, true, 'prompt', 'DraftLine Projects']);
    assert.equal(await sync.writeProject({ id: 'x', title: 'X', script: [makeBlock('scene')] }), 'skipped');
    // The status bar click: handle.requestPermission({ mode: 'readwrite' })
    assert.equal(await sync.requestPermission(), true);
    assert.equal(sync.getState().active, true);
  });
  it('Browser Storage turns writing off but remembers the folder; Disconnect forgets it', async () => {
    const { settings, sync } = await linked();
    await sync.setDestination('browser');
    assert.deepEqual([sync.getState().active, sync.getState().linked], [false, true]);
    await sync.setDestination('folder');
    assert.equal(sync.getState().active, true);
    await sync.disconnect();
    assert.deepEqual([sync.getState().active, sync.getState().linked, sync.getState().folderName], [false, false, null]);
    assert.equal(settings.map.get(HANDLE_KEY), null);
  });
});

describe('Folder sync: dual save — IndexedDB first, then the folder', () => {
  it('one save lands in IndexedDB and as <slug>.draftline in the folder, as a normal backup file', async () => {
    const { dir, sync } = await linked();
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const order = [];
    const { record, folder } = await saveProjectEverywhere({
      store, sync, data: doc('What Happened to Haiti?'), options: { actMode: 3 }, onLocal: () => order.push('indexeddb'),
    });
    order.push('folder');
    assert.equal(folder, 'written');
    assert.deepEqual(order, ['indexeddb', 'folder']);
    assert.equal((await store.getProject(record.id)).title, 'What Happened to Haiti?');
    const files = dir.$.files();
    assert.deepEqual(Object.keys(files), ['What-Happened-to-Haiti.draftline']);
    const back = parseBackup(files['What-Happened-to-Haiti.draftline']);
    assert.equal(back.record.id, record.id);
    assert.equal(back.actMode, 3);
    assert.match(files['What-Happened-to-Haiti.draftline'], /^\{\n {2}"format": "draftline-backup"/, 'formatted JSON');
  });
  it('if the browser save fails, nothing is written to the folder', async () => {
    const { dir, sync } = await linked();
    const store = { saveActiveProject: async () => { throw new Error('quota'); } };
    await assert.rejects(saveProjectEverywhere({ store, sync, data: doc('X') }), /quota/);
    assert.deepEqual(dir.$.files(), {});
  });
  it('a failed folder write keeps the browser copy and pauses sync with a reason', async () => {
    const { dir, sync } = await linked();
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    dir.$.root.failWrites = new Error('The drive was disconnected');
    const { record, folder } = await saveProjectEverywhere({ store, sync, data: doc('Run!') });
    assert.equal(folder, 'error');
    assert.ok(await store.getProject(record.id));
    assert.equal(sync.getState().error, 'The drive was disconnected');
    assert.equal(storageStatus({ sync: sync.getState() }).label, 'Folder sync paused');
    dir.$.root.failWrites = null;
    assert.equal(await sync.writeProject(record), 'written');
    assert.equal(sync.getState().error, null);
  });
  it('permission withdrawn mid-session → "Click to allow folder sync"', async () => {
    const { dir, sync } = await linked();
    dir.$.root.permission = 'prompt';
    assert.equal(await sync.writeProject({ id: 'a', title: 'A', script: [makeBlock('scene')] }), 'error');
    assert.equal(sync.getState().needsPermission, true);
    assert.equal(storageStatus({ sync: sync.getState() }).action, 'permission');
  });
  it('rapid saves of one script are coalesced to the newest; a rename replaces the old file DraftLine wrote', async () => {
    const { dir, sync, settings } = await linked();
    const base = { id: 'p1', script: [makeBlock('scene')] };
    const results = await Promise.all([1, 2, 3].map((n) => sync.writeProject({ ...base, title: 'Run!', updatedAt: n })));
    assert.ok(results.includes('written'));
    assert.equal(parseBackup(dir.$.files()['Run.draftline']).record.updatedAt, 3);
    await sync.writeProject({ ...base, title: 'Run Fito Run', updatedAt: 4 });
    assert.deepEqual(Object.keys(dir.$.files()), ['Run-Fito-Run.draftline']);
    assert.deepEqual(settings.map.get(FILES_KEY), { p1: 'Run-Fito-Run.draftline' });
  });
  it('two different scripts with one title get two files; files DraftLine didn’t write are never touched', async () => {
    const { dir, sync } = await linked();
    await dir.$.put('notes.txt', 'mine');
    await dir.$.put('Draft.draftline', 'not json — someone else’s file');
    await sync.listProjects();
    await sync.writeProject({ id: 'aaaaaa11', title: 'Draft', script: [makeBlock('scene')] });
    assert.equal(dir.$.files()['Draft.draftline'], 'not json — someone else’s file');
    await sync.writeProject({ id: 'bbbbbb22', title: 'Draft', script: [makeBlock('scene')] });
    assert.deepEqual(Object.keys(dir.$.files()).sort(), ['Draft-aaaaaa.draftline', 'Draft-bbbbbb.draftline', 'Draft.draftline', 'notes.txt']);
  });
});

describe('Folder sync: finding scripts in the folder', () => {
  it('lists every top-level .draftline script, skipping Snapshots/ and anything unreadable', async () => {
    const { dir, sync } = await linked();
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const { record: a } = await saveProjectEverywhere({ store, sync, data: doc('Run!') });
    const rev = createRevision(toDoc(a), { now: Date.parse('2026-10-21T10:12:00Z') });
    await sync.writeSnapshot(rev, a);
    await dir.$.put('broken.draftline', '{');
    const found = await sync.listProjects();
    assert.deepEqual(found.map((f) => [f.fileName, f.record.id]), [['Run.draftline', a.id]]);
  });
  it('merges with the browser library by id: folder-only scripts appear, the newest copy wins', () => {
    const local = [{ id: 'a', title: 'A', updatedAt: 5 }, { id: 'b', title: 'B (old)', updatedAt: 1 }];
    const folder = [
      { fileName: 'B.draftline', record: { id: 'b', title: 'B (from Drive)', updatedAt: 9 } },
      { fileName: 'C.draftline', record: { id: 'c', title: 'C', updatedAt: 3 } },
      { fileName: 'A.draftline', record: { id: 'a', title: 'A (older)', updatedAt: 2 } },
    ];
    const merged = mergeProjectLists(local, folder);
    assert.deepEqual(merged.map((r) => [r.id, r.title, r.source]), [
      ['b', 'B (from Drive)', 'folder-newer'], ['a', 'A', 'browser'], ['c', 'C', 'folder'],
    ]);
  });
});

describe('Folder sync: snapshots subfolder', () => {
  it('names files <slug>_<YYYY-MM-DD_HHmm>.draftline in Snapshots/, adding _2 within the same minute', () => {
    const at = new Date(2026, 9, 21, 6, 12, 30); // local time
    assert.equal(snapshotStamp(at), '2026-10-21_0612');
    assert.equal(scriptSlug('What Happened to Haiti?'), 'What-Happened-to-Haiti');
    assert.equal(snapshotFileName('What Happened to Haiti?', at), 'What-Happened-to-Haiti_2026-10-21_0612.draftline');
    const taken = new Set(['Run_2026-10-21_0612.draftline', 'Run_2026-10-21_0612_2.draftline']);
    assert.equal(snapshotFileName('Run!', at, (n) => taken.has(n)), 'Run_2026-10-21_0612_3.draftline');
    assert.equal(snapshotPath('Run_2026-10-21_0612.draftline'), 'Snapshots/Run_2026-10-21_0612.draftline');
    assert.equal(SNAPSHOT_DIR, 'Snapshots');
    assert.equal(projectFileName('Run!', 'p1'), 'Run.draftline');
  });
  it('writes a snapshot as a restorable file, lists it for its script only, and deletes it', async () => {
    const { dir, sync } = await linked();
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const { record: run } = await saveProjectEverywhere({ store, sync, data: doc('Run!', 'INT. CAR - NIGHT') });
    const { record: other } = await saveProjectEverywhere({ store, sync, data: doc('Other') });
    const at = new Date(2026, 9, 21, 6, 12);
    const rev = createRevision(toDoc(run), { label: 'Before the rewrite', now: at.getTime(), pages: 3 });
    const path = await sync.writeSnapshot(rev, run);
    assert.equal(path, 'Snapshots/Run_2026-10-21_0612.draftline');
    await sync.writeSnapshot(createRevision(toDoc(other), { now: at.getTime() }), other);

    const text = dir.$.files()[path];
    assert.equal(parseBackup(text).record.script[0].text, 'INT. CAR - NIGHT', 'opens with Open like any backup');
    const back = snapshotFromFileText(text);
    assert.equal(back.projectId, run.id);
    assert.deepEqual([back.rev.id, back.rev.label, back.rev.timestamp, back.rev.pages], [rev.id, 'Before the rewrite', rev.timestamp, 3]);
    assert.deepEqual(back.rev.script, rev.script);

    const listed = await sync.listSnapshots(run.id);
    assert.deepEqual(listed.map((s) => s.rev.id), [rev.id]);
    assert.equal(await sync.removeSnapshot(rev.id, run.id), 1);
    assert.deepEqual(await sync.listSnapshots(run.id), []);
    assert.equal((await sync.listSnapshots(other.id)).length, 1);
  });
  it('nothing goes to the folder while sync is off', async () => {
    const sync = createFolderSync({ settings: memorySettings(), win: pickerWindow(createFakeDirectory()) });
    await sync.init();
    const rev = createRevision(doc('X'));
    assert.equal(await sync.writeSnapshot(rev, { id: 'x', title: 'X' }), null);
    assert.deepEqual(await sync.listSnapshots('x'), []);
    assert.equal(snapshotFileText(rev, { id: 'x', title: 'X' }).includes('"snapshot"'), true);
  });
});

describe('Folder sync: the status bar indicator', () => {
  it('browser · synced · syncing · reconnect · paused · not saved', () => {
    assert.equal(storageStatus({}).label, 'Saved locally');
    const on = { active: true, folderName: 'DraftLine Projects' };
    assert.deepEqual(storageStatus({ sync: on }), {
      label: 'Synced: DraftLine Projects', tone: 'synced', action: 'settings', title: 'Saved in this browser and to the folder “DraftLine Projects”',
    });
    assert.equal(storageStatus({ sync: { ...on, syncing: true } }).label, 'Syncing…');
    assert.equal(storageStatus({ dirty: true, sync: on }).label, 'Saving…');
    assert.deepEqual(
      [storageStatus({ sync: { needsPermission: true, folderName: 'X' } }).label, storageStatus({ sync: { needsPermission: true } }).action],
      ['Click to allow folder sync', 'permission'],
    );
    assert.equal(storageStatus({ saveOk: false, sync: on }).tone, 'error');
  });
});

describe('Folder sync: safety and the newer copy from another computer', () => {
  it('a file that appears after the folder was read (Drive syncing it in) is still never overwritten', async () => {
    const { dir, sync } = await linked();
    await sync.listProjects(); // the folder was read while empty
    await dir.$.put('Run.draftline', 'a file Drive just synced in that isn’t a script');
    assert.equal(await sync.writeProject({ id: 'p9', title: 'Run!', script: [makeBlock('scene')] }), 'written');
    assert.equal(dir.$.files()['Run.draftline'], 'a file Drive just synced in that isn’t a script');
    assert.ok(Object.keys(dir.$.files()).includes('Run-p9.draftline'));
  });
  it('another script synced in under the same name keeps its file; this one gets its own', async () => {
    const { dir, sync } = await linked();
    await sync.listProjects();
    const theirs = { id: 'laptopA', title: 'Run!', script: [makeBlock('scene', 'INT. A')], updatedAt: 7 };
    const { serializeBackup } = await import('../src/lib/backup.js');
    await dir.$.put('Run.draftline', serializeBackup(theirs));
    await sync.writeProject({ id: 'here', title: 'Run!', script: [makeBlock('scene')] });
    assert.equal(parseBackup(dir.$.files()['Run.draftline']).record.id, 'laptopA');
    assert.equal(parseBackup(dir.$.files()['Run-here.draftline']).record.id, 'here');
  });
  it('a newer folder copy goes into the browser library as-is (same id, same updatedAt)', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const old = await store.saveActiveProject(doc('Run!', 'INT. OLD'));
    const newer = { ...old, script: [makeBlock('scene', 'INT. NEW')], updatedAt: old.updatedAt + 60_000 };
    const rec = await store.importRecord(newer);
    assert.deepEqual([rec.id, rec.updatedAt], [old.id, newer.updatedAt]);
    assert.equal((await store.getProject(old.id)).script[0].text, 'INT. NEW');
    const next = await store.saveActiveProject({ id: old.id, ...doc('Run!') });
    assert.ok(next.updatedAt > newer.updatedAt, 'later saves still move forward');
  });
});

describe('Folder sync: wired into the app', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const drawer = readFileSync(new URL('../src/components/ProjectsDrawer.jsx', import.meta.url), 'utf8');
  it('auto-save goes through the dual save: IndexedDB, then the folder', () => {
    assert.match(app, /return saveProjectEverywhere\(\{\s*store: projects,\s*sync: folderSync,/);
    assert.match(app, /useEffect\(\(\) => \{\s*folderSync\.init\(\);\s*\}, \[\]\);/);
  });
  it('snapshots are also written to <folder>/Snapshots, listed from it, restorable and deletable', () => {
    assert.match(app, /folderSync\.writeSnapshot\(rev, \{ id: s\.projectId, title: s\.meta\.title, createdAt: s\.createdAt \}, s\.fileOptions\)/);
    assert.match(app, /folderSync\.listSnapshots\(projectId\)\.then/);
    assert.match(app, /const rev = getRevision\(s\.revisions, id\) \|\| getRevision\(s\.folderSnaps, id\);/);
    assert.match(app, /folderSync\.removeSnapshot\(id, s\.projectId\)/);
    assert.match(app, /revisions=\{allSnapshots\}/);
  });
  it('Projects lists folder scripts too and opens the newest copy', () => {
    assert.match(app, /mergeProjectLists\(await projects\.getAllProjects\(\), await folderSync\.listProjects\(\)\)/);
    assert.match(app, /if \(fromFolder\) rec = await projects\.importRecord\(there\);/);
    assert.match(drawer, /<StorageDestination/);
    assert.match(drawer, /Newer in folder/);
  });
  it('the status bar indicator: click allows folder sync, or opens the storage settings', () => {
    assert.match(app, /const saveStatus = storageStatus\(\{ saveOk: saved\.ok, dirty, sync \}\);/);
    assert.match(app, /if \(saveStatus\.action === 'permission'\) \{\s*folderSync\.requestPermission\(\)/);
    assert.match(app, /setDrawerOpen\(true\);\s*setFocusStorage\(\(n\) => n \+ 1\);/);
  });
  it('deleting a script takes its folder file out too (or the folder would bring it back) — after the dialog is confirmed', () => {
    assert.match(app, /await projects\.deleteProject\(d\.id\);\s*setLibraryRev\(\(n\) => n \+ 1\);\s*const folder = await folderSync\.removeProject\(d\.id\);/);
  });
});

describe('Deleting a script: a confirmation dialog, Trash instead of erasing', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const modal = readFileSync(new URL('../src/components/DeleteProjectModal.jsx', import.meta.url), 'utf8');

  it('the dialog: title, warning, Cancel, and a red Permanently Delete that works straight away — no typing', () => {
    assert.equal(deleteWarning('The Last Ferry', { synced: true }),
      "This will permanently remove 'The Last Ferry' from this browser and delete the .draftline file from your synced drive folder.");
    assert.equal(deleteWarning('The Last Ferry'), "This will permanently remove 'The Last Ferry' from this browser.");
    assert.match(modal, /<h2 id="dp-title">Delete Screenplay\?<\/h2>/);
    assert.ok(!/<input|DELETE_WORD|isDeleteConfirmed|typed/.test(modal), 'no text field, nothing to type');
    assert.match(modal, /<button type="button" className="btn dp-delete" onClick=\{onConfirm\} disabled=\{busy\}>\{busy \? 'Deleting…' : 'Permanently Delete'\}<\/button>/,
      'one click deletes (disabled only while a deletion is already running)');
    assert.match(modal, /<button ref=\{cancelRef\} type="button" className="btn dp-cancel" onClick=\{onCancel\} disabled=\{busy\}>Cancel<\/button>/);
    assert.match(modal, /cancelRef\.current\?\.focus\(\);/, 'Cancel has focus when it opens: a stray Enter never deletes');
    assert.match(modal, /onCancel=\{\(e\) => \{\s*e\.preventDefault\(\);\s*if \(!busy\) onCancel\(\);/, 'Esc cancels');
    const css = readFileSync(new URL('../src/components/DeleteProjectModal.css', import.meta.url), 'utf8');
    assert.match(css, /\.dp-modal \.dp-delete \{[^}]*background: #b5402c;/, 'red, and specific enough to beat .btn');
    assert.ok(!/\.dp-field/.test(css), 'the field’s styles are gone too');
  });
  it('the app: the Projects menu only opens the dialog — nothing is deleted until Permanently Delete', () => {
    const open = /const deleteProject = async \(id, title\) => \{([\s\S]*?)\n {2}\};/.exec(app)[1];
    assert.ok(!/deleteProject\(|removeProject|confirm\(/.test(open), 'no deletion and no window.confirm before the dialog');
    assert.match(open, /setPendingDelete\(\{ id, title, stage: 'confirm', failed: \[\], busy: false \}\);/);
    assert.ok(!/window\.confirm\(`Delete/.test(app));
    assert.match(app, /onConfirm=\{confirmDelete\}/);
    assert.match(app, /onDelete=\{deleteProject\}/);
    // The drawer's own refresh runs when the menu item returns — before the dialog is answered — so
    // the app tells it to re-read once the deletion has actually happened.
    assert.match(app, /await projects\.deleteProject\(d\.id\);\s*setLibraryRev\(\(n\) => n \+ 1\);/);
    assert.match(app, /libraryRev=\{libraryRev\}/);
    const drawerSrc = readFileSync(new URL('../src/components/ProjectsDrawer.jsx', import.meta.url), 'utf8');
    assert.match(drawerSrc, /\}, \[open, loadProjects, syncKey, libraryRev\]\);/);
  });
  it('the folder file is moved into Trash/ (verified copy first), not erased', async () => {
    const { dir, sync } = await linked({ clock: () => 7 });
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const { record } = await saveProjectEverywhere({ store, sync, data: doc('The Last Ferry') });
    const keep = (await saveProjectEverywhere({ store, sync, data: doc('Run!') })).record;
    const name = Object.keys(dir.$.files()).find((f) => /^the-last-ferry/i.test(f));
    const text = dir.$.files()[name];
    const r = await sync.removeProject(record.id);
    assert.deepEqual([r.removed, r.failed], [0, []]);
    assert.equal(r.trashed.length, 1);
    assert.match(r.trashed[0], new RegExp(`^${TRASH_DIR}/${name.replace(/\.draftline$/, '')}_deleted_\\d{4}-\\d\\d-\\d\\d_\\d{4}\\.draftline$`));
    const files = dir.$.files();
    assert.equal(files[name], undefined, 'gone from the top level, so it won’t come back');
    assert.equal(files[r.trashed[0]], text, 'the whole file, unchanged, in Trash');
    const order = dir.$.log.map(([k, p]) => `${k} ${p}`);
    assert.ok(order.indexOf(`write ${r.trashed[0]}`) < order.indexOf(`remove ${name}`), 'copied before the original is removed');
    assert.deepEqual((await sync.listProjects()).map((f) => f.record.id), [keep.id], 'Trash is never read back in');
  });
  it('Trash names never overwrite: a second deletion of the same name gets _2', () => {
    const taken = new Set(['the-last-ferry_deleted_2026-10-21_1540.draftline']);
    assert.equal(trashFileName('the-last-ferry.draftline', new Date(2026, 9, 21, 15, 40), (n) => taken.has(n)), 'the-last-ferry_deleted_2026-10-21_1540_2.draftline');
  });
  it('if the move fails, the original stays put and nothing is erased — hard deletion only when asked', async () => {
    const { dir, sync } = await linked();
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const { record } = await saveProjectEverywhere({ store, sync, data: doc('Run!') });
    const name = Object.keys(dir.$.files())[0];
    dir.$.root.failWrites = new Error('disk full');
    const r = await sync.removeProject(record.id);
    assert.deepEqual([r.trashed, r.removed, r.failed], [[], 0, [name]]);
    assert.ok(dir.$.files()[name], 'still there');
    assert.ok(!dir.$.log.some(([k]) => k === 'remove'), 'nothing removed');
    const hard = await sync.removeProject(record.id, { hard: true });
    assert.deepEqual([hard.removed, hard.failed], [1, []]);
    assert.equal(dir.$.files()[name], undefined);
    assert.match(modal, /Couldn’t move the file to Trash/);
    assert.match(app, /if \(folder\.failed\.length\) \{\s*setPendingDelete\(\{ \.\.\.d, stage: 'hard', failed: folder\.failed, busy: false \}\);/);
    assert.match(app, /folderSync\.removeProject\(d\.id, \{ hard: true \}\)/, 'only from the second confirmation');
    assert.equal((app.match(/hard: true/g) || []).length, 1);
  });
});
