// Forward compatibility and stale-write protection (docs/specs/data-integrity.md). Every test uses
// in-memory storage and a fake folder: no real library, no real files.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NewerProjectError, PROJECT_SCHEMA_VERSION, RECORD_FIELDS, bootLibrary, createProjectStore, isNewerProject, projectSchemaOf,
  revisionToDoc, toDoc, toRecord, writeJournal,
} from '../src/lib/projectStorage.js';
import { PRODUCTION_VERSION, addAsset, normalizeProduction, removeAsset, setSceneNotes } from '../src/lib/productionData.js';
import { addUnknownFields, jsonCopy, unknownFields } from '../src/lib/passThrough.js';
import { createRevision } from '../src/lib/revisions.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { createFolderSync, saveProjectEverywhere } from '../src/lib/folderSync.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { createFakeDirectory } from './helpers/fakeDirectory.js';

const memoryStore = () => createProjectStore({ indexedDB: undefined });
const memorySettings = () => {
  const m = new Map();
  return { map: m, get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } };
};
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

/** Fields a hypothetical newer DraftLine adds: top level, inside production, and per scene. */
const FUTURE = {
  schedule: { days: [{ id: 'd1', label: 'Day 1', scenes: ['s1'] }] },
  budget: { currency: 'USD', lines: [{ id: 'b1', category: 'cast', amount: 1200 }] },
  coWrite: { sessionHint: null, invited: 2 },
};
const futureProduction = (sceneId) => ({
  version: PRODUCTION_VERSION, scenes: { [sceneId]: { extras: [], props: ['Suitcase'], wardrobe: [], vehicles: [], notes: '', castOverrides: ['MARIE'], estMinutes: 30 } },
  schedule: { order: [sceneId] },
});

async function projectWithFuture(store) {
  const base = await store.createProject({ title: 'Future' });
  const sceneId = base.script[0].id;
  const rec = { ...base, ...JSON.parse(JSON.stringify(FUTURE)), production: futureProduction(sceneId), updatedAt: base.updatedAt + 1 };
  return { rec: await store.importRecord(rec), sceneId };
}
const assertFuture = (rec, sceneId, msg) => {
  assert.deepEqual(rec.schedule, FUTURE.schedule, `${msg}: schedule`);
  assert.deepEqual(rec.budget, FUTURE.budget, `${msg}: budget`);
  assert.deepEqual(rec.coWrite, FUTURE.coWrite, `${msg}: coWrite`);
  assert.deepEqual(rec.production.schedule, { order: [sceneId] }, `${msg}: production.schedule`);
  assert.deepEqual(rec.production.scenes[sceneId].castOverrides, ['MARIE'], `${msg}: scene castOverrides`);
  assert.equal(rec.production.scenes[sceneId].estMinutes, 30, `${msg}: scene estMinutes`);
};
const edit = (doc, text) => ({ ...doc, blocks: doc.blocks.map((b, i) => (i ? b : { ...b, text })) });

describe('passThrough: only plain data, never over known fields', () => {
  it('copies plain JSON deeply and drops what isn’t JSON', () => {
    const src = { a: 1, b: 'x', c: [1, { d: true }], e: null, f: () => 1, g: undefined, h: NaN, i: new Date(0), j: Symbol('s') };
    const c = jsonCopy(src);
    assert.deepEqual(c, { a: 1, b: 'x', c: [1, { d: true }], e: null });
    c.c[1].d = false;
    assert.equal(src.c[1].d, true, 'a copy, not a reference');
  });
  it('never copies prototype keys, cycles or known fields', () => {
    const evil = JSON.parse('{"__proto__": {"polluted": true}, "constructor": 1, "ok": 2, "title": "hijack"}');
    const cyc = { x: 1 };
    cyc.self = cyc;
    const out = unknownFields({ ...evil, cyc }, new Set(['title']));
    assert.deepEqual(Object.keys(out).sort(), ['cyc', 'ok']);
    assert.deepEqual(out.cyc, { x: 1 }, 'the cycle is cut');
    assert.equal({}.polluted, undefined);
    const target = { title: 'Mine' };
    addUnknownFields(target, { title: 'theirs', schedule: 1 }, new Set(['title']));
    assert.deepEqual(target, { title: 'Mine', schedule: 1 });
  });
});

describe('Unknown fields survive every path', () => {
  it('1 · save and reopen', async () => {
    const store = memoryStore();
    const { rec, sceneId } = await projectWithFuture(store);
    const saved = await store.saveActiveProject(edit(toDoc(rec), 'EXT. HARBOR - DUSK'));
    assertFuture(saved, sceneId, 'after save');
    assertFuture(toRecord(toDoc(saved), 1), sceneId, 'after reopen and save again');
  });
  it('2 · duplicate', async () => {
    const store = memoryStore();
    const { rec, sceneId } = await projectWithFuture(store);
    assertFuture(await store.duplicateProject(rec.id), sceneId, 'duplicate');
  });
  it('3 · backup and restore', async () => {
    const store = memoryStore();
    const { rec, sceneId } = await projectWithFuture(store);
    const { record } = parseBackup(serializeBackup(rec));
    const { record: restored } = await store.restoreProject(record);
    assertFuture(restored, sceneId, 'restored');
  });
  it('4 · snapshots capture and give back a newer build’s fields', async () => {
    const store = memoryStore();
    const { rec, sceneId } = await projectWithFuture(store);
    const doc = toDoc(rec);
    const rev = createRevision(doc, { label: 'Before', now: 1 });
    assert.deepEqual(rev.extra.schedule, FUTURE.schedule);
    assert.deepEqual(rev.production.schedule, { order: [sceneId] });
    const back = revisionToDoc(JSON.parse(JSON.stringify(rev)));
    assert.deepEqual(back.extra, unknownFields(rec, RECORD_FIELDS));
    assert.deepEqual(back.production.scenes[sceneId].castOverrides, ['MARIE']);
    const hijack = revisionToDoc({ ...rev, extra: { id: 'other', isLocked: true, schedule: 1 } });
    assert.deepEqual(hijack.extra, { schedule: 1 }, 'a snapshot can’t set known fields through extra');
  });
  it('5 · the linked folder’s file keeps them, and a newer file taken in keeps them', async () => {
    const store = memoryStore();
    const { rec, sceneId } = await projectWithFuture(store);
    const dir = createFakeDirectory();
    const sync = createFolderSync({ settings: memorySettings(), win: { showDirectoryPicker: async () => dir } });
    await sync.init();
    await sync.link();
    assert.equal(await sync.writeProject(rec), 'written');
    assertFuture(await sync.readProject(rec.id), sceneId, 'folder file');
  });
  it('6 · records from before schemaVersion read as format 1 and only gain the field on save', async () => {
    const store = memoryStore();
    const old = { ...(await store.createProject({ title: 'Old' })) };
    delete old.schemaVersion;
    assert.equal(projectSchemaOf(old), 1);
    assert.equal(isNewerProject(old), false);
    const before = JSON.parse(JSON.stringify(old));
    const saved = await store.saveActiveProject(toDoc(old));
    assert.equal(saved.schemaVersion, PROJECT_SCHEMA_VERSION);
    for (const k of ['title', 'script', 'beats', 'characters', 'storyNotes', 'storyDna', 'production']) {
      assert.deepEqual(saved[k], before[k], `${k} unchanged`);
    }
    assert.deepEqual(toRecord(toDoc(saved), 5).script, saved.script, 'saving twice changes nothing more');
  });
  it('7 · repeated save cycles', async () => {
    const store = memoryStore();
    const { rec, sceneId } = await projectWithFuture(store);
    let cur = rec;
    for (let i = 0; i < 5; i++) cur = await store.saveActiveProject(edit(toDoc(cur), `EXT. HARBOR - TAKE ${i}`));
    assertFuture(cur, sceneId, 'after 5 saves');
  });
  it('8 · editing known fields (and saves that carry no extras, like the crash journal) keep unknown ones', async () => {
    const store = memoryStore();
    const { rec, sceneId } = await projectWithFuture(store);
    const doc = toDoc(rec);
    let p = addAsset(doc.production, sceneId, 'props', 'Lantern');
    p = setSceneNotes(p, sceneId, 'Night');
    p = removeAsset(p, sceneId, 'props', 'Suitcase');
    assert.deepEqual(p.scenes[sceneId].castOverrides, ['MARIE'], 'editing a scene keeps its other fields');
    const { extra, ...noExtra } = doc; // eslint-disable-line no-unused-vars
    const saved = await store.saveActiveProject({ ...noExtra, production: p, meta: { ...doc.meta, title: 'Renamed' } });
    assert.equal(saved.title, 'Renamed');
    assert.deepEqual(saved.production.scenes[sceneId].props, ['Lantern']);
    assertFuture(saved, sceneId, 'after editing');
  });
  it('normalizeProduction keeps unknown keys, never lowers a version, and still cleans what it knows', () => {
    const n = normalizeProduction({ version: 3, scenes: { s1: { props: ['Gun', 'gun', 7], budgetLine: 'b1' } }, budget: { total: 5 } });
    assert.equal(n.version, 3);
    assert.deepEqual(n.budget, { total: 5 });
    const { links, ...lists } = n.scenes.s1; // links: Phase 2's shared elements (tests/elements.test.js)
    assert.deepEqual(lists, { extras: [], props: ['Gun'], wardrobe: [], vehicles: [], notes: '', budgetLine: 'b1' });
    assert.equal(n.elements[links.props[0].id].name, 'Gun');
    assert.deepEqual(normalizeProduction({ scenes: { s1: { onlyFuture: 1 } } }).scenes.s1.onlyFuture, 1, 'a scene with only newer data is kept');
    assert.deepEqual(Object.keys(normalizeProduction(JSON.parse('{"scenes":{"__proto__":{"props":["x"]}}}')).scenes), []);
  });
});

describe('9 · a project saved by a newer DraftLine', () => {
  const newer = async (store, patch) => {
    const base = await store.createProject({ title: 'From the future' });
    return store.importRecord({ ...base, ...patch, updatedAt: base.updatedAt + 1 });
  };
  it('is recognised by its project format or its production version', async () => {
    const store = memoryStore();
    assert.equal(isNewerProject(await newer(store, { schemaVersion: PROJECT_SCHEMA_VERSION + 1 })), true);
    assert.equal(isNewerProject(await newer(store, { production: { version: PRODUCTION_VERSION + 1, scenes: {} } })), true);
    assert.equal(isNewerProject(await newer(store, { schemaVersion: PROJECT_SCHEMA_VERSION })), false);
  });
  it('still opens: toDoc reads everything it understands', async () => {
    const store = memoryStore();
    const rec = await newer(store, { schemaVersion: 99, schedule: { days: 3 } });
    const doc = toDoc(rec);
    assert.ok(doc.blocks.length);
    assert.deepEqual(doc.extra.schedule, { days: 3 });
  });
  it('10 · is never saved over: the library refuses, and the record is unchanged', async () => {
    const store = memoryStore();
    const rec = await newer(store, { schemaVersion: 99, schedule: { days: 3 } });
    const before = JSON.stringify(await store.getProject(rec.id));
    await assert.rejects(store.saveActiveProject(edit(toDoc(rec), 'INT. NOWHERE')), (e) => e instanceof NewerProjectError && e.code === 'NEWER_PROJECT');
    assert.equal(JSON.stringify(await store.getProject(rec.id)), before);
  });
  it('a crash journal from this build doesn’t land on it either', async () => {
    const store = memoryStore();
    const rec = await newer(store, { schemaVersion: 99 });
    await store.setActiveProjectId(rec.id);
    const storage = memoryStorage();
    writeJournal(storage, { ...toDoc(rec), id: rec.id, blocks: [makeBlock('scene', 'INT. JOURNAL')] });
    const boot = await bootLibrary({ store, storage, makeFirstDoc: () => ({}) });
    assert.equal(boot.recovered, false);
    assert.equal((await store.getProject(rec.id)).script[0].text, rec.script[0].text);
  });
  it('the app opens it read-only and skips saving it', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /if \(s\.newerProject\) return Promise\.resolve\(null\);/);
    assert.match(app, /setIsLocked\(doc\.viewOnly === true \|\| newer\);/);
    assert.match(app, /if \(!s\.dirty \|\| s\.newerProject\) return;/, 'no crash journal for it');
    assert.match(app, /if \(newerProject\) \{\s*notifyNewer\(\);\s*return;\s*\}/, 'Viewing can’t be switched off');
  });
});

describe('Folder sync never overwrites a copy saved elsewhere, or by a newer DraftLine', () => {
  async function setup() {
    const store = memoryStore();
    const dir = createFakeDirectory();
    const sync = createFolderSync({ settings: memorySettings(), win: { showDirectoryPicker: async () => dir } });
    await sync.init();
    await sync.link();
    const rec = await store.createProject({ title: 'Shared' });
    assert.equal(await sync.writeProject(rec), 'written');
    return { store, dir, sync, rec };
  }
  /** Another computer (through Drive) replaces the file with its own save. */
  const writeRaw = async (dir, name, record) => {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(serializeBackup(record));
    await w.close();
  };
  const fileNameOf = async (sync, id) => sync.ownedFiles()[id];

  it('our own earlier write isn’t a conflict (saves keep flowing)', async () => {
    const { store, sync, rec } = await setup();
    for (let i = 0; i < 3; i++) {
      const r = await saveProjectEverywhere({ store, sync, data: { ...edit(toDoc(rec), `EXT. A ${i}`), id: rec.id } });
      assert.equal(r.folder, 'written');
    }
  });
  it('a copy saved on another computer since: not overwritten, reported as a conflict, until adopted', async () => {
    const { store, dir, sync, rec } = await setup();
    const name = await fileNameOf(sync, rec.id);
    const theirs = { ...(await sync.readProject(rec.id)), script: [makeBlock('scene', 'EXT. THEIR VERSION')], updatedAt: rec.updatedAt + 50_000 };
    await writeRaw(dir, name, theirs);
    const r = await saveProjectEverywhere({ store, sync, data: { ...edit(toDoc(rec), 'EXT. MY VERSION'), id: rec.id } });
    assert.equal(r.folder, 'conflict');
    assert.equal(r.record.script[0].text, 'EXT. MY VERSION', 'this browser’s copy is saved');
    assert.equal((await sync.readProject(rec.id)).script[0].text, 'EXT. THEIR VERSION', 'the folder copy is untouched');
    assert.match(sync.getState().error, /changed there from somewhere else/);
    // Still a conflict on the next save, even though this browser's copy is now "newer"
    const again = await saveProjectEverywhere({ store, sync, data: { ...edit(toDoc(r.record), 'EXT. MY VERSION 2'), id: rec.id } });
    assert.equal(again.folder, 'conflict');
    // The writer chooses to keep theirs or mine: adopt, and writing resumes
    sync.adopt(rec.id, theirs.updatedAt);
    const after = await saveProjectEverywhere({ store, sync, data: { ...edit(toDoc(again.record), 'EXT. MY VERSION 3'), id: rec.id } });
    assert.equal(after.folder, 'written');
    assert.equal(sync.getState().error, null);
  });
  it('a computer whose clock runs behind is still caught (exact match, not newer-than)', async () => {
    const { store, dir, sync, rec } = await setup();
    const name = await fileNameOf(sync, rec.id);
    const theirs = { ...(await sync.readProject(rec.id)), script: [makeBlock('scene', 'EXT. BEHIND')], updatedAt: rec.updatedAt - 60_000 };
    await writeRaw(dir, name, theirs);
    const r = await saveProjectEverywhere({ store, sync, data: { ...edit(toDoc(rec), 'EXT. MINE'), id: rec.id } });
    assert.equal(r.folder, 'conflict');
  });
  it('first write in a session: only a folder copy newer than this save’s starting point conflicts', async () => {
    const store = memoryStore();
    const dir = createFakeDirectory();
    const rec = await store.createProject({ title: 'Fresh' });
    const sync = createFolderSync({ settings: memorySettings(), win: { showDirectoryPicker: async () => dir } });
    await sync.init();
    await sync.link();
    await writeRaw(dir, 'Fresh.draftline', { ...rec, updatedAt: rec.updatedAt - 10 }); // an older copy: fine to replace
    const ok = await saveProjectEverywhere({ store, sync, data: { ...edit(toDoc(rec), 'EXT. NEW'), id: rec.id } });
    assert.equal(ok.folder, 'written');
    const sync2 = createFolderSync({ settings: memorySettings(), win: { showDirectoryPicker: async () => dir } });
    await sync2.init();
    await sync2.link();
    const name = sync.ownedFiles()[rec.id];
    await writeRaw(dir, name, { ...ok.record, script: [makeBlock('scene', 'EXT. ELSEWHERE')], updatedAt: ok.record.updatedAt + 1000 });
    const stale = await store.getProject(rec.id);
    const r = await saveProjectEverywhere({ store, sync: sync2, data: { ...edit(toDoc(stale), 'EXT. STALE TAB'), id: rec.id } });
    assert.equal(r.folder, 'conflict');
  });
  it('a newer DraftLine’s file is never overwritten', async () => {
    const { store, dir, sync, rec } = await setup();
    const name = await fileNameOf(sync, rec.id);
    await writeRaw(dir, name, { ...(await sync.readProject(rec.id)), schemaVersion: 99, updatedAt: rec.updatedAt + 1 });
    const r = await saveProjectEverywhere({ store, sync, data: { ...edit(toDoc(rec), 'EXT. OLD BUILD'), id: rec.id } });
    assert.equal(r.folder, 'newer');
    assert.equal((await sync.readProject(rec.id)).schemaVersion, 99);
  });
  it('the app asks which version to keep, and keeps the other as a snapshot', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /if \(\(folder === 'conflict' \|\| folder === 'newer'\) && latest\.current\.projectId === s\.projectId\) onFolderGuardRef\.current\?\.\(folder, s\.projectId\);/);
    assert.match(app, /const keepMyVersion = \(\) => \{[\s\S]*?folderSync\.adopt\(there\.id, there\.updatedAt\);[\s\S]*?setRevisions\(\(list\) => addRevision\(list, theirs\)\);/);
    assert.match(app, /const useFolderVersion = async \(\) => \{[\s\S]*?createRevision\(s,[\s\S]*?projects\.importRecord\(\{ \.\.\.there, revisions: \[\.\.\.theirsList, mine\] \}\);/);
    for (const where of [/async function localCopy[\s\S]*?folderSync\.adopt\(there\.id, there\.updatedAt\);/, /if \(fromFolder\) \{\s*folderSync\.adopt/, /pullNewer\.current = async \(there\) => \{\s*folderSync\.adopt/]) {
      assert.match(app, where, 'taking in the folder copy puts writes back in step');
    }
  });
});
