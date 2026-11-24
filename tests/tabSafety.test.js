// Phase 1.5: one project open in two tabs (or windows) never loses work (docs/specs/data-integrity.md).
//
// Each "tab" is its own createProjectStore on ONE fake IndexedDB (tests/helpers/fakeIndexedDB.js runs
// readwrite transactions one at a time across connections, as browsers do, and can abort), so these
// exercise the real check-and-write. Journals use a fake localStorage; folders a fake directory.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JOURNAL_PREFIX, bootLibrary, createProjectStore, reconcileJournals, revisionOf, toDoc, writeJournal,
} from '../src/lib/projectStorage.js';
import { createFolderSync, saveProjectEverywhere, withFileLock } from '../src/lib/folderSync.js';
import { addDay, moveScene } from '../src/lib/schedule.js';
import { createTabSync, openTabs } from '../src/lib/tabSync.js';
import { createRevision } from '../src/lib/revisions.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { createFakeIndexedDB, createFakeStorage } from './helpers/fakeIndexedDB.js';
import { createFakeDirectory } from './helpers/fakeDirectory.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const doc = (text, extra = {}) => ({ meta: { title: 'Ferry' }, blocks: [makeBlock('scene', 'INT. FERRY - DAY'), makeBlock('action', text)], beats: [], ...extra });
const textOf = (rec) => rec.script[1].text;
/** Two tabs: two stores on one database. */
function twoTabs() {
  const idb = createFakeIndexedDB();
  let t = 1_000_000;
  const clock = () => (t += 7);
  return { idb, a: createProjectStore({ indexedDB: idb, now: clock }), b: createProjectStore({ indexedDB: idb, now: clock }) };
}
/** Tab `store` opens project `id` into its editor. */
const open = async (store, id) => {
  const rec = await store.getProject(id);
  store.track(rec);
  return rec;
};
const edit = (rec, text) => ({ ...toDoc(rec), id: rec.id, blocks: [rec.script[0], { ...rec.script[1], text }] });

describe('the version check in the write itself', () => {
  it('a tab saving over a version it never had is refused, and nothing is written', async () => {
    const { a, b } = twoTabs();
    const p = await a.saveActiveProject(doc('one'));
    const inB = await open(b, p.id);
    const bSaved = await b.saveActiveProject(edit(inB, 'B wrote this'));
    await assert.rejects(a.saveActiveProject(edit(p, 'A, stale')), (e) => e.name === 'ConflictError' && e.kind === 'changed' && textOf(e.stored) === 'B wrote this');
    assert.equal(textOf(await a.getProject(p.id)), 'B wrote this', 'B’s version is untouched');
    assert.equal(revisionOf(await a.getProject(p.id)), revisionOf(bSaved));
  });
  it('every write is a new version, so a tab’s own saves follow each other freely', async () => {
    const { a } = twoTabs();
    const p = await a.saveActiveProject(doc('one'));
    const p2 = await a.saveActiveProject(edit(p, 'two'));
    const p3 = await a.saveActiveProject(edit(p2, 'three'));
    assert.notEqual(revisionOf(p), revisionOf(p2));
    assert.notEqual(p2.writeId, p3.writeId);
    // two saves started back to back, the second before the first has finished
    const [x, y] = await Promise.all([a.saveActiveProject(edit(p3, 'four')), a.saveActiveProject(edit(p3, 'five'))]);
    assert.equal(textOf(y), 'five');
    assert.notEqual(revisionOf(x), revisionOf(y));
  });
  it('two tabs saving at the same instant: exactly one wins, the other is refused', async () => {
    const { a, b } = twoTabs();
    const p = await a.saveActiveProject(doc('one'));
    await open(b, p.id);
    const results = await Promise.allSettled([a.saveActiveProject(edit(p, 'A')), b.saveActiveProject(edit(p, 'B'))]);
    assert.deepEqual(results.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
    const won = results.find((r) => r.status === 'fulfilled').value;
    assert.equal(textOf(await a.getProject(p.id)), textOf(won));
    assert.equal(results.find((r) => r.status === 'rejected').reason.name, 'ConflictError');
  });
  it('an older DraftLine’s save (writeId carried over, updatedAt changed) still counts as a new version', async () => {
    const { idb, a } = twoTabs();
    const p = await a.saveActiveProject(doc('one'));
    const old = createProjectStore({ indexedDB: idb, now: () => 9_000_000 });
    // An older build: reads, writes back with its own updatedAt, keeps fields it doesn't know (writeId).
    const raw = await old.getProject(p.id);
    await new Promise((resolve) => {
      const r = idb.open('draftline_db', 1);
      r.onsuccess = () => {
        const t = r.result.transaction('projects', 'readwrite');
        t.objectStore('projects').put({ ...raw, script: [raw.script[0], { ...raw.script[1], text: 'old build' }], updatedAt: 9_000_000 });
        t.oncomplete = resolve;
      };
    });
    await assert.rejects(a.saveActiveProject(edit(p, 'A')), (e) => e.kind === 'changed' && textOf(e.stored) === 'old build');
  });
  it('deleted in another tab: refused (no silent resurrection), until Restore', async () => {
    const { a, b } = twoTabs();
    await a.saveActiveProject(doc('other script'));
    const p = await a.saveActiveProject(doc('one'));
    await open(b, p.id);
    await b.deleteProject(p.id);
    await assert.rejects(a.saveActiveProject(edit(p, 'A')), (e) => e.kind === 'deleted');
    assert.equal(await a.getProject(p.id), null);
    const back = await a.restoreDeleted(edit(p, 'A, restored'));
    assert.equal(textOf(back), 'A, restored');
    await assert.rejects(b.restoreDeleted(edit(p, 'B too')), (e) => e.kind === 'changed', 'only while it’s gone');
  });
  it('rename and lock are versions too; the tab that made them isn’t tripped', async () => {
    const { a, b } = twoTabs();
    const p = await a.saveActiveProject(doc('one'));
    await open(b, p.id);
    const renamed = await a.renameProject(p.id, 'Ferry II');
    const locked = await a.setProjectLock(p.id, true);
    assert.notEqual(revisionOf(renamed), revisionOf(p));
    assert.equal(locked.isLocked, true);
    const saved = await a.saveActiveProject({ ...edit(locked, 'A after lock'), meta: { title: 'Ferry II' } });
    assert.equal(saved.isLocked, true, 'the lock stays');
    await assert.rejects(b.saveActiveProject(edit(p, 'B, stale')), (e) => e.kind === 'changed', 'a stale tab can’t undo the lock or the rename');
  });
});

describe('resolving a conflict is itself checked', () => {
  it('Keep this version: written only over the version shown, which becomes a snapshot of it (whole project)', async () => {
    const { a, b } = twoTabs();
    const p = await a.saveActiveProject(doc('one', { production: { version: 1, scenes: {}, schedule: moveScene(addDay(null).schedule, 'x', null) } }));
    const inB = await open(b, p.id);
    const sched = addDay(null);
    await b.saveActiveProject({ ...edit(inB, 'B'), production: { version: 1, scenes: {}, schedule: sched.schedule }, extra: { futureField: 7 } });
    const err = await a.saveActiveProject(edit(p, 'A')).catch((e) => e);
    const kept = await a.saveActiveProject(edit(p, 'A'), { expect: revisionOf(err.stored), snapshotPrevious: 'Other tab’s version' });
    assert.equal(textOf(kept), 'A');
    const snap = kept.revisions.find((r) => r.label === 'Other tab’s version');
    assert.equal(snap.script[1].text, 'B');
    assert.deepEqual(snap.production.schedule.days.map((d) => d.id), sched.schedule.days.map((d) => d.id), 'schedule kept');
    assert.equal(snap.extra.futureField, 7, 'a newer DraftLine’s fields kept');
    assert.equal(kept.futureField, 7, '…and still on the record');
  });
  it('a third tab saving while the dialog is open: the choice is refused, nothing is overwritten, ask again', async () => {
    const { idb, a, b } = twoTabs();
    const c = createProjectStore({ indexedDB: idb });
    const p = await a.saveActiveProject(doc('one'));
    await open(b, p.id);
    const shown = await b.saveActiveProject(edit(p, 'B'));
    await open(c, p.id);
    await c.saveActiveProject(edit(shown, 'C, meanwhile'));
    await assert.rejects(a.saveActiveProject(edit(p, 'A'), { expect: revisionOf(shown), snapshotPrevious: 'x' }), (e) => textOf(e.stored) === 'C, meanwhile');
    await assert.rejects(a.keepStoredWithSnapshot(p.id, edit(p, 'A'), { expect: revisionOf(shown), label: 'y' }), (e) => e.kind === 'changed');
    assert.equal(textOf(await a.getProject(p.id)), 'C, meanwhile');
  });
  it('Use the other version: stored left as it is, this tab’s version (and its snapshots) added', async () => {
    const { a, b } = twoTabs();
    const p = await a.saveActiveProject({ ...doc('one'), revisions: [] });
    const inB = await open(b, p.id);
    const theirs = await b.saveActiveProject(edit(inB, 'B'));
    const mine = { ...edit(p, 'A'), revisions: [createRevision(toDoc(p), { label: 'A’s own snapshot', id: 'r-a' })] };
    const rec = await a.keepStoredWithSnapshot(p.id, mine, { expect: revisionOf(theirs), label: 'This tab’s version' });
    assert.equal(textOf(rec), 'B');
    assert.deepEqual(rec.revisions.map((r) => r.label), ['A’s own snapshot', 'This tab’s version']);
    assert.equal(rec.revisions[1].script[1].text, 'A');
  });
  it('a snapshot that can’t be stored changes nothing (the stored version and this tab’s state both stay)', async () => {
    const { a, b } = twoTabs();
    const p = await a.saveActiveProject(doc('one'));
    const inB = await open(b, p.id);
    const theirs = await b.saveActiveProject(edit(inB, 'B'));
    // A snapshot whose content can't be cloned into storage: the transaction aborts.
    const bad = { ...edit(p, 'A'), revisions: [{ ...createRevision(toDoc(p), { label: 'x', id: 'bad' }), fn: () => {} }] };
    await assert.rejects(a.keepStoredWithSnapshot(p.id, bad, { expect: revisionOf(theirs), label: 'z' }));
    assert.equal(revisionOf(await a.getProject(p.id)), revisionOf(theirs), 'nothing written');
  });
});

describe('crash journals: one per tab, reconciled without overwriting newer work', () => {
  const setup = async () => {
    const { a, b } = twoTabs();
    const storage = createFakeStorage();
    const p = await a.saveActiveProject(doc('saved'));
    return { a, b, storage, p };
  };
  it('nothing saved since the tab’s version: its unsaved state is restored', async () => {
    const { a, storage, p } = await setup();
    writeJournal(storage, edit(p, 'typed before the tab closed'), { tabId: 'tab1', base: revisionOf(p) });
    const out = await reconcileJournals({ store: a, storage });
    assert.equal(textOf(out.recovered), 'typed before the tab closed');
    assert.equal(storage.getItem(`${JOURNAL_PREFIX}tab1`), null, 'removed once it’s in the library');
  });
  it('saved since by another tab: the journal becomes a snapshot; the newer version stays', async () => {
    const { a, b, storage, p } = await setup();
    writeJournal(storage, edit(p, 'closed tab’s work'), { tabId: 'tab1', base: revisionOf(p) });
    await open(b, p.id);
    await b.saveActiveProject(edit(p, 'B, newer'));
    const out = await reconcileJournals({ store: a, storage });
    const rec = await a.getProject(p.id);
    assert.equal(textOf(rec), 'B, newer');
    assert.equal(out.preserved, 1);
    assert.equal(rec.revisions.at(-1).script[1].text, 'closed tab’s work');
    assert.match(rec.revisions.at(-1).label, /^Unsaved changes from a closed tab/);
  });
  it('two tabs’ journals both survive (no shared key)', async () => {
    const { a, storage, p } = await setup();
    writeJournal(storage, edit(p, 'tab one'), { tabId: 'one', base: revisionOf(p) });
    writeJournal(storage, edit(p, 'tab two'), { tabId: 'two', base: revisionOf(p) });
    await reconcileJournals({ store: a, storage });
    const rec = await a.getProject(p.id);
    const all = [textOf(rec), ...rec.revisions.map((r) => r.script[1]?.text)];
    assert.ok(all.includes('tab one') && all.includes('tab two'), JSON.stringify(all));
  });
  it('an open tab’s journal (written when it was hidden) is left alone', async () => {
    const { a, storage, p } = await setup();
    writeJournal(storage, edit(p, 'still open'), { tabId: 'live', base: revisionOf(p) });
    await reconcileJournals({ store: a, storage, liveTabs: new Set(['live']) });
    assert.equal(textOf(await a.getProject(p.id)), 'saved');
    assert.notEqual(storage.getItem(`${JOURNAL_PREFIX}live`), null);
  });
  it('reconciling twice (or after a crash mid-way) adds nothing more', async () => {
    const { a, b, storage, p } = await setup();
    writeJournal(storage, edit(p, 'once'), { tabId: 'tab1', base: revisionOf(p) });
    await open(b, p.id);
    await b.saveActiveProject(edit(p, 'B'));
    const key = `${JOURNAL_PREFIX}tab1`;
    const kept = storage.getItem(key);
    await reconcileJournals({ store: a, storage });
    storage.setItem(key, kept); // as if the page died before removing it
    await reconcileJournals({ store: a, storage });
    const rec = await a.getProject(p.id);
    assert.equal(rec.revisions.filter((r) => r.script[1]?.text === 'once').length, 1);
    assert.equal(storage.getItem(key), null);
    // …and a restored journal isn't restored twice
    const q = await a.saveActiveProject(doc('q'));
    writeJournal(storage, edit(q, 'q typed'), { tabId: 'tab2', base: revisionOf(q) });
    const k2 = `${JOURNAL_PREFIX}tab2`;
    const kept2 = storage.getItem(k2);
    await reconcileJournals({ store: a, storage });
    storage.setItem(k2, kept2);
    await reconcileJournals({ store: a, storage });
    const q2 = await a.getProject(q.id);
    assert.equal(textOf(q2), 'q typed');
    assert.equal(q2.revisions.length, 0, 'no duplicate snapshot');
  });
  it('a snapshot that fails to store: the journal stays, and is tried again next time', async () => {
    const { a, b, storage, p } = await setup();
    writeJournal(storage, edit(p, 'precious'), { tabId: 'tab1', base: revisionOf(p) });
    await open(b, p.id);
    await b.saveActiveProject(edit(p, 'B'));
    const failing = { ...a, getProject: a.getProject, saveActiveProject: a.saveActiveProject, addSnapshot: async () => { throw new Error('QuotaExceededError'); } };
    const first = await reconcileJournals({ store: failing, storage });
    assert.equal(first.preserved, 0);
    assert.notEqual(storage.getItem(`${JOURNAL_PREFIX}tab1`), null, 'not removed');
    const second = await reconcileJournals({ store: a, storage });
    assert.equal(second.preserved, 1);
    assert.equal(storage.getItem(`${JOURNAL_PREFIX}tab1`), null);
  });
  it('a journal for a script deleted since: kept, and handed back for the writer to decide', async () => {
    const { a, storage, p } = await setup();
    await a.saveActiveProject(doc('another'));
    writeJournal(storage, edit(p, 'orphaned work'), { tabId: 'tab1', base: revisionOf(p) });
    await a.deleteProject(p.id);
    const boot = await bootLibrary({ store: a, storage, makeFirstDoc: () => doc('x') });
    assert.equal(boot.orphans.length, 1);
    assert.equal(boot.orphans[0].journal.blocks[1].text, 'orphaned work');
    assert.equal(await a.getProject(p.id), null, 'not brought back on its own');
    assert.notEqual(storage.getItem(`${JOURNAL_PREFIX}tab1`), null, 'still kept');
  });
});

describe('linked folder: no stale write, no false conflict from another tab', () => {
  async function setup() {
    const { a, b } = twoTabs();
    const dir = createFakeDirectory();
    const settings = new Map();
    const shared = { get: async (k) => settings.get(k) ?? null, set: async (k, v) => { settings.set(k, v); } };
    const mutex = { tail: Promise.resolve(), log: [] };
    const locks = { request: (name, fn) => { const run = mutex.tail.then(() => fn()); mutex.tail = run.catch(() => {}); return run; } };
    const mk = (store) => {
      const sync = createFolderSync({ settings: shared, win: { showDirectoryPicker: async () => dir }, locks });
      sync.setCurrentCheck(async (rec) => revisionOf(await store.getProject(rec.id)) === revisionOf(rec));
      return sync;
    };
    const sa = mk(a);
    const sb = mk(b);
    await sa.init();
    await sa.link();
    await sb.init();
    return { a, b, sa, sb };
  }
  it('an older save finishing late is skipped: the newer version stays in the folder', async () => {
    const { a, b, sa, sb } = await setup();
    const p = await a.saveActiveProject(doc('one'));
    const r1 = await a.saveActiveProject(edit(p, 'A1'));
    await open(b, p.id);
    const r2 = await saveProjectEverywhere({ store: b, sync: sb, data: edit(r1, 'B2') });
    assert.equal(r2.folder, 'written');
    assert.equal(await sa.writeProject(r1), 'skipped', 'A’s write of the older version, arriving after B’s');
    assert.equal(textOf(await sb.readProject(p.id)), 'B2');
  });
  it('a file another tab of this browser wrote is ours: the next save there isn’t a false conflict', async () => {
    const { a, b, sa, sb } = await setup();
    const p = await a.saveActiveProject(doc('one'));
    assert.equal((await saveProjectEverywhere({ store: a, sync: sa, data: edit(p, 'A1') })).folder, 'written');
    const inB = await open(b, p.id);
    const fromB = await saveProjectEverywhere({ store: b, sync: sb, data: edit(inB, 'B2') });
    assert.equal(fromB.folder, 'written', 'B: A’s file was this browser’s');
    a.track(fromB.record); // A takes B's version in (clean tab)
    const next = await saveProjectEverywhere({ store: a, sync: sa, data: edit(fromB.record, 'A3') });
    assert.equal(next.folder, 'written', 'A: B’s file was this browser’s');
    assert.equal(textOf(await sb.readProject(p.id)), 'A3');
  });
  it('folder writes for one script hold a lock shared by every tab', async () => {
    const order = [];
    const locks = { request: async (name, fn) => { order.push(name); return fn(); } };
    await withFileLock('p1', async () => 'x', locks);
    assert.deepEqual(order, ['draftline-folder:p1']);
  });
});

describe('cross-tab messages and open tabs', () => {
  it('a message about another project, or this tab’s own, is not passed on', () => {
    const sent = [];
    class Ch { constructor() { Ch.last = this; } postMessage(m) { sent.push(m); } close() {} }
    const got = [];
    const t = createTabSync({ tabId: 'me', onMessage: (m) => got.push(m), Channel: Ch });
    t.announce('saved', 'p1', '1:w');
    assert.deepEqual(sent, [{ type: 'saved', id: 'p1', revision: '1:w', from: 'me' }]);
    Ch.last.onmessage({ data: { type: 'saved', id: 'p1', from: 'me' } });
    Ch.last.onmessage({ data: { type: 'bogus', id: 'p1', from: 'x' } });
    Ch.last.onmessage({ data: { type: 'deleted', id: 'p2', from: 'x' } });
    assert.deepEqual(got, [{ type: 'deleted', id: 'p2', from: 'x' }]);
  });
  it('without BroadcastChannel or Web Locks nothing breaks (the write check still protects)', async () => {
    const t = createTabSync({ tabId: 'me', onMessage() {}, Channel: undefined });
    t.announce('saved', 'p', 'r');
    t.close();
    assert.equal(await openTabs(undefined), null);
    assert.deepEqual([...(await openTabs({ query: async () => ({ held: [{ name: 'draftline-tab:a' }, { name: 'other' }] }) }))], ['a']);
  });
});

describe('the app wiring', () => {
  const app = read('src/App.jsx');
  it('every save of the open script is checked; a refused save opens the choice, and nothing saves meanwhile', () => {
    assert.match(app, /if \(tabConflictRef\.current\?\.id === s\.projectId\) return Promise\.resolve\(null\);/);
    assert.match(app, /if \(e\?\.name === 'ConflictError'\) \{\s*if \(latest\.current\.projectId === s\.projectId\) onTabConflictRef\.current\?\.\(e, s\.projectId\);/);
    assert.match(app, /projects\.track\(rec\); \/\/ this tab's version of it/);
  });
  it('a clean tab takes the newer version in place; a busy one never does', () => {
    assert.match(app, /if \(latest\.current\.dirty \|\| savingRef\.current > 0 \|\| composingRef\.current\) return false;/);
    assert.match(app, /if \(tabIsClean\(\)\) adoptFromOtherTab\(stored\);/);
    assert.match(app, /reset\(bl\); \/\/ the other tab's version replaces the history here too/);
  });
  it('choices are written against the version shown', () => {
    assert.match(app, /projects\.saveActiveProject\(doc, \{ expect: c\.seen, snapshotPrevious: label \}\)/);
    assert.match(app, /projects\.keepStoredWithSnapshot\(c\.id, doc, \{ expect: c\.seen, label \}\)/);
  });
  it('the journal is this tab’s, and names the version it started from', () => {
    assert.match(app, /\{ tabId: TAB_ID, base: projects\.baseOf\(s\.projectId\) \}/);
    assert.match(app, /clearJournal\(LOCAL, TAB_ID\);/);
  });
});
