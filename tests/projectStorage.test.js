import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeIndexedDB, createFakeStorage } from './helpers/fakeIndexedDB.js';
import {
  DB_NAME, JOURNAL_KEY, STORE, bootLibrary, createProjectStore, projectStats, toDoc, writeJournal,
} from '../src/lib/projectStorage.js';
import { makeBlock } from '../src/lib/screenplay.js';

/** A store on a fresh fake IndexedDB, with a clock the test controls. */
function setup() {
  const idb = createFakeIndexedDB();
  let t = 1_000;
  const clock = { tick: (ms = 1000) => { t += ms; } };
  const store = createProjectStore({ indexedDB: idb, now: () => t });
  return { idb, store, clock };
}

const doc = (title, extra = {}) => ({
  meta: { title, author: 'Eric Lemaire Jr.' },
  blocks: [makeBlock('scene', 'INT. CINEUS RESIDENCE - DAY'), makeBlock('action', `${title} begins.`)],
  beats: [],
  ...extra,
});

describe('project library: create and list', () => {
  it('saves new projects to the "projects" store with the full schema', async () => {
    const { idb, store } = setup();
    const rec = await store.saveActiveProject(doc('What Happened to Haiti?'));
    assert.ok(rec.id);
    const [row] = idb.dump(DB_NAME, STORE);
    for (const k of ['id', 'title', 'author', 'credit', 'draftVersion', 'draftDate', 'contact', 'titleFont', 'titleSize', 'script', 'beats', 'createdAt', 'updatedAt']) {
      assert.ok(k in row, k);
    }
    assert.equal(row.title, 'What Happened to Haiti?');
    assert.equal(row.script.length, 2);
    assert.equal(row.scenes, 1);
    assert.equal(row.pages, 1);
  });

  it('getAllProjects lists most recently edited first', async () => {
    const { store, clock } = setup();
    const a = await store.saveActiveProject(doc('Run!'));
    clock.tick();
    await store.saveActiveProject(doc('The Last Ferry'));
    clock.tick();
    await store.saveActiveProject({ ...doc('Run!'), id: a.id }); // editing Run! moves it to the top
    assert.deepEqual((await store.getAllProjects()).map((p) => p.title), ['Run!', 'The Last Ferry']);
  });

  it('updates keep createdAt and move updatedAt forward', async () => {
    const { store, clock } = setup();
    const a = await store.saveActiveProject(doc('Run!'));
    clock.tick(5000);
    const b = await store.saveActiveProject({ ...doc('Run! (draft 2)'), id: a.id });
    assert.equal(b.createdAt, a.createdAt);
    assert.ok(b.updatedAt > a.updatedAt);
    assert.equal((await store.getAllProjects()).length, 1);
  });

  it('createProject makes a blank script with one scene heading', async () => {
    const { store } = setup();
    const rec = await store.createProject({ title: 'New One' });
    assert.equal(rec.title, 'New One');
    assert.deepEqual(rec.script.map((b) => b.type), ['scene']);
  });
});

describe('project library: switching', () => {
  it('getProject loads the full state back as an editor document', async () => {
    const { store } = setup();
    const src = doc('Run!', { beats: [{ id: 'k1', act: 0, title: 'Opening', synopsis: '', tags: ['plot', 'theme'] }] });
    src.blocks[1].marks = { b: [[0, 4]] };
    src.blocks[1].note = 'check this';
    const rec = await store.saveActiveProject(src);
    const back = toDoc(await store.getProject(rec.id));
    assert.equal(back.meta.title, 'Run!');
    assert.equal(back.meta.credit, 'Written by'); // defaults fill unset title-page fields
    assert.deepEqual(back.blocks, src.blocks);
    assert.deepEqual(back.beats, src.beats);
  });

  it('remembers the active project, and boot opens it', async () => {
    const { store, clock } = setup();
    const storage = createFakeStorage();
    const a = await store.saveActiveProject(doc('Run!'));
    clock.tick();
    const b = await store.saveActiveProject(doc('The Last Ferry'));
    await store.setActiveProjectId(a.id);
    let boot = await bootLibrary({ store, storage, makeFirstDoc: () => doc('unused') });
    assert.equal(boot.project.id, a.id);
    await store.setActiveProjectId(b.id);
    boot = await bootLibrary({ store, storage, makeFirstDoc: () => doc('unused') });
    assert.equal(boot.project.id, b.id);
    assert.equal(boot.persistent, true);
  });

  it('serialises saves: the last write always wins', async () => {
    const { store } = setup();
    const a = await store.saveActiveProject(doc('v0'));
    await Promise.all(['v1', 'v2', 'v3'].map((t) => store.saveActiveProject({ ...doc(t), id: a.id })));
    assert.equal((await store.getProject(a.id)).title, 'v3');
  });
});

describe('project library: duplicate, rename, delete', () => {
  it('duplicates as "[Title] (Copy)" with its own id and an independent script', async () => {
    const { store } = setup();
    const a = await store.saveActiveProject(doc('Run!'));
    const c = await store.duplicateProject(a.id);
    assert.notEqual(c.id, a.id);
    assert.equal(c.title, 'Run! (Copy)');
    assert.deepEqual(c.script, a.script);
    await store.saveActiveProject({ ...toDoc(c), blocks: [makeBlock('action', 'changed')] });
    assert.equal((await store.getProject(a.id)).script.length, 2, 'original untouched');
    assert.equal((await store.getAllProjects()).length, 2);
  });

  it('renames', async () => {
    const { store } = setup();
    const a = await store.saveActiveProject(doc('Run'));
    await store.renameProject(a.id, 'Run!');
    assert.equal((await store.getProject(a.id)).title, 'Run!');
  });

  it('deletes, but never the only project', async () => {
    const { store } = setup();
    const a = await store.saveActiveProject(doc('Run!'));
    await assert.rejects(store.deleteProject(a.id), /only script/);
    const b = await store.saveActiveProject(doc('The Last Ferry'));
    assert.equal(await store.deleteProject(b.id), true);
    assert.equal(await store.getProject(b.id), null);
    assert.deepEqual((await store.getAllProjects()).map((p) => p.id), [a.id]);
  });

  it('deleting the active project hands "active" to the most recent remaining one', async () => {
    const { store, clock } = setup();
    const a = await store.saveActiveProject(doc('A'));
    clock.tick();
    const b = await store.saveActiveProject(doc('B'));
    clock.tick();
    const c = await store.saveActiveProject(doc('C'));
    await store.setActiveProjectId(c.id);
    await store.deleteProject(c.id);
    assert.equal(await store.getActiveProjectId(), b.id);
    assert.ok(a.id);
  });
});

describe('project library: first run', () => {
  it('migrates the existing localStorage script into the first project (old save left in place)', async () => {
    const { store } = setup();
    const old = {
      version: 2,
      meta: { title: 'What Happened to Haiti?', author: 'Eric' },
      blocks: [{ id: 'x1', type: 'scene', text: 'EXT. PORT-AU-PRINCE - DAY' }, { id: 'x2', type: 'action', text: 'Smoke.', underline: [[0, 5]] }],
      beats: [],
    };
    const storage = createFakeStorage({ 'draftline:script:v2': JSON.stringify(old) });
    const boot = await bootLibrary({ store, storage, makeFirstDoc: () => doc('Sample') });
    assert.equal(boot.migrated, true);
    assert.equal(boot.project.title, 'What Happened to Haiti?');
    assert.deepEqual(boot.project.script[1].marks, { u: [[0, 5]] }); // older underline format upgraded
    assert.equal(await store.getActiveProjectId(), boot.project.id);
    assert.ok(storage.getItem('draftline:script:v2'), 'the old save is kept as a safety copy');
    // Runs once: a second boot doesn't migrate again.
    const again = await bootLibrary({ store, storage, makeFirstDoc: () => doc('Sample') });
    assert.equal(again.migrated, false);
    assert.equal((await store.getAllProjects()).length, 1);
  });

  it('with nothing to migrate, starts with the sample', async () => {
    const { store } = setup();
    const boot = await bootLibrary({ store, storage: createFakeStorage(), makeFirstDoc: () => doc('The Last Ferry') });
    assert.equal(boot.migrated, false);
    assert.equal(boot.project.title, 'The Last Ferry');
  });

  it('recovers unsaved work from the crash journal when it is newer than the stored project', async () => {
    const { store } = setup();
    const storage = createFakeStorage();
    const a = await store.saveActiveProject(doc('Run!'));
    await store.setActiveProjectId(a.id);
    writeJournal(storage, { ...doc('Run! — typed just before the tab closed'), id: a.id });
    const boot = await bootLibrary({ store, storage, makeFirstDoc: () => doc('x') });
    assert.equal(boot.recovered, true);
    assert.equal(boot.project.title, 'Run! — typed just before the tab closed');
    assert.equal(storage.getItem(JOURNAL_KEY), null);
  });

  it('falls back to memory (and says so) when IndexedDB is unavailable', async () => {
    const store = createProjectStore({ indexedDB: null });
    const rec = await store.saveActiveProject(doc('Run!'));
    assert.equal((await store.getProject(rec.id)).title, 'Run!');
    assert.equal(await store.isPersistent(), false);
  });
});

describe('project stats', () => {
  it('counts pages and scenes for the library cards', () => {
    const blocks = [];
    for (let s = 0; s < 3; s++) {
      blocks.push(makeBlock('scene', `INT. ROOM ${s} - DAY`));
      for (let k = 0; k < 20; k++) blocks.push(makeBlock('action', 'Line one.\nLine two.'));
    }
    const st = projectStats(blocks);
    assert.equal(st.scenes, 3);
    assert.ok(st.pages >= 3, `pages ${st.pages}`);
  });
});
