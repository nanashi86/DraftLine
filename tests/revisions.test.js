import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import {
  addRevision, createRevision, defaultRevisionLabel, getRevision, normalizeRevisions, relabelRevision, removeRevision,
  revisionRecord, revisionSummary, revisionsNewestFirst, validRevisions,
} from '../src/lib/revisions.js';
import { createProjectStore, revisionToDoc, toDoc, toRecord } from '../src/lib/projectStorage.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { defaultStoryNotes } from '../src/lib/bible.js';
import { emptyStoryDna, setAnswer } from '../src/lib/storyDna.js';

const T0 = Date.UTC(2026, 9, 20, 16, 44); // Oct 20, 2026 12:44 PM in New York

function doc() {
  return {
    meta: { title: 'Run!', author: 'Eric Lemaire Jr.', credit: 'Written by', draftVersion: 'Draft 2' },
    blocks: [
      { id: 's1', type: 'scene', text: 'EXT. PORT-AU-PRINCE - NIGHT', note: 'Night shoot?' },
      { id: 'a1', type: 'action', text: 'Fito runs through the market.', marks: { b: [[0, 4]] } },
      { id: 'c1', type: 'character', text: 'FITO' },
      { id: 'd1', type: 'dialogue', text: 'Run!' },
      { id: 's2', type: 'scene', text: 'INT. CHURCH - CONTINUOUS' },
    ],
    beats: [{ id: 'b1', act: 0, title: 'The chase', synopsis: '', tags: ['plot', 'theme'], sceneId: 's1' }],
    characters: [{ id: 'ch1', name: 'FITO', primaryRole: 'protagonist', secondaryRole: 'none', relationship: '', age: '10', traits: '', backstory: '' }],
    storyNotes: defaultStoryNotes(),
    storyDna: setAnswer(emptyStoryDna(), 'protagonist', 'Fito'),
  };
}

describe('Snapshots: creating one', () => {
  it('copies the whole project — script, Story DNA, Beat Board, title page, Bible — with a label and timestamp', () => {
    const d = doc();
    const r = createRevision(d, { label: 'Before rewrite', now: T0, pages: 3 });
    assert.equal(r.label, 'Before rewrite');
    assert.equal(r.timestamp, new Date(T0).toISOString());
    assert.ok(r.id.startsWith('rev-'));
    assert.deepEqual(r.script, d.blocks);
    assert.deepEqual(r.storyDna, d.storyDna);
    assert.deepEqual(r.beatBoard, d.beats);
    assert.deepEqual(r.meta, d.meta);
    assert.deepEqual(r.characters, d.characters);
    assert.deepEqual([r.pages, r.scenes, r.words], [3, 2, 15]);
  });

  it('is a deep copy: later edits never reach it', () => {
    const d = doc();
    const r = createRevision(d, { now: T0 });
    d.blocks[0].text = 'CHANGED';
    d.beats[0].tags.push('subplot');
    d.storyDna.answers.protagonist = 'Someone else';
    assert.equal(r.script[0].text, 'EXT. PORT-AU-PRINCE - NIGHT');
    assert.deepEqual(r.beatBoard[0].tags, ['plot', 'theme']);
    assert.equal(r.storyDna.answers.protagonist, 'Fito');
  });

  it('without a label it is "Draft - [timestamp]"', () => {
    const r = createRevision(doc(), { now: T0, label: '   ' });
    assert.equal(r.label, defaultRevisionLabel(T0));
    assert.match(r.label, /^Draft - Oct 20, 2026, \d{1,2}:44 [AP]M$/);
  });

  it('every snapshot gets its own id', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createRevision(doc(), { now: T0 }).id));
    assert.equal(ids.size, 20);
  });
});

describe('Snapshots: the list', () => {
  const a = createRevision(doc(), { label: 'A', now: T0 });
  const b = createRevision(doc(), { label: 'B', now: T0 + 60_000 });
  const c = createRevision(doc(), { label: 'C', now: T0 + 120_000 });
  const list = addRevision(addRevision(addRevision([], a), b), c);

  it('adds, finds, renames and deletes', () => {
    assert.deepEqual(list.map((r) => r.label), ['A', 'B', 'C']);
    assert.equal(getRevision(list, b.id).label, 'B');
    assert.equal(getRevision(list, 'nope'), null);
    assert.equal(getRevision(relabelRevision(list, b.id, 'Act 2 pass'), b.id).label, 'Act 2 pass');
    assert.deepEqual(removeRevision(list, b.id).map((r) => r.label), ['A', 'C']);
    assert.equal(list.length, 3, 'never mutated');
  });

  it('the panel lists newest first, with pages, scenes, words and size', () => {
    assert.deepEqual(revisionsNewestFirst(list).map((r) => r.label), ['C', 'B', 'A']);
    assert.match(revisionSummary(createRevision(doc(), { now: T0, pages: 3 })), /^3 pages · 2 scenes · 15 words · \d+(\.\d)? (KB|B)$/);
  });

  it('only readable snapshots survive loading', () => {
    const junk = [a, { id: 'x' }, null, { ...b, script: [] }, a, c];
    assert.equal(validRevisions(junk), false);
    assert.deepEqual(normalizeRevisions(junk).map((r) => r.label), ['A', 'C']);
    assert.deepEqual(normalizeRevisions(undefined), []);
    assert.equal(validRevisions(undefined), true);
    assert.equal(validRevisions([a, b]), true);
  });
});

describe('Snapshots: restoring', () => {
  it('gives back the project exactly as it was', () => {
    const d = doc();
    const r = createRevision(d, { now: T0 });
    const back = revisionToDoc(r);
    assert.deepEqual(back.blocks, d.blocks);
    assert.deepEqual(back.beats, d.beats);
    assert.deepEqual(back.characters, d.characters);
    assert.equal(back.meta.title, 'Run!');
    assert.equal(back.meta.draftVersion, 'Draft 2');
    assert.equal(back.storyDna.answers.protagonist, 'Fito');
    assert.ok(!('revisions' in back), 'a snapshot never carries snapshots');
  });

  it('older stored shapes inside a snapshot are migrated like any project', () => {
    const r = createRevision(doc(), { now: T0 });
    r.beatBoard = [{ id: 'old', act: 1, title: 'Legacy card', synopsis: '', tag: 'subplot' }];
    r.storyDna = { genre: 'Noire', flashback: true };
    const back = revisionToDoc(r);
    assert.deepEqual(back.beats[0].tags, ['subplot']);
    assert.deepEqual(back.storyDna.genres, ['Noir']);
    assert.ok(back.storyDna.devices.some((x) => x.id === 'flashback' && x.on));
  });

  it('a restore never touches the snapshot itself', () => {
    const r = createRevision(doc(), { now: T0 });
    const before = JSON.stringify(r);
    const back = revisionToDoc(r);
    back.blocks[0].text = 'EDITED AFTER RESTORE';
    assert.equal(JSON.stringify(r), before);
    assert.equal(revisionRecord(r).script[0].text, 'EXT. PORT-AU-PRINCE - NIGHT');
  });
});

describe('Snapshots: saved with the project', () => {
  it('round-trip through the IndexedDB library', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB(), now: () => T0 });
    const rev = createRevision(doc(), { label: 'First pass', now: T0 });
    const rec = await store.saveActiveProject({ ...doc(), revisions: [rev] });
    const loaded = toDoc(await store.getProject(rec.id));
    assert.deepEqual(loaded.revisions, [rev]);
  });

  it('a save that doesn’t carry snapshots (crash-recovery journal) keeps the stored ones', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB(), now: () => T0 });
    const rev = createRevision(doc(), { label: 'Keep me', now: T0 });
    const rec = await store.saveActiveProject({ ...doc(), revisions: [rev] });
    await store.saveActiveProject({ ...doc(), id: rec.id }); // no `revisions` key
    assert.deepEqual((await store.getProject(rec.id)).revisions.map((r) => r.label), ['Keep me']);
    await store.saveActiveProject({ ...doc(), id: rec.id, revisions: [] }); // an explicit empty list clears them
    assert.deepEqual((await store.getProject(rec.id)).revisions, []);
  });

  it('travel inside .draftline backups and come back on restore', async () => {
    const rev = createRevision(doc(), { label: 'Locked draft', now: T0, pages: 2 });
    const rec = toRecord({ ...doc(), id: 'p1', revisions: [rev] }, T0);
    const { record } = parseBackup(serializeBackup(rec));
    assert.deepEqual(record.revisions, [rev]);
    const store = createProjectStore({ indexedDB: createFakeIndexedDB(), now: () => T0 });
    const { record: restored } = await store.restoreProject(record);
    assert.deepEqual(toDoc(restored).revisions, [rev]);
    assert.deepEqual(revisionToDoc(toDoc(restored).revisions[0]).blocks, doc().blocks);
  });

  it('a backup with damaged snapshots is refused with a clear message', () => {
    const rec = toRecord({ ...doc(), id: 'p1' }, T0);
    rec.revisions = [{ id: 'r', label: 'Broken', timestamp: 'never', script: 'nope' }];
    assert.throws(() => parseBackup(serializeBackup(rec)), /snapshots are damaged/);
  });
});

describe('Snapshots: in the app', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  it('the toolbar has a Snapshot button; the ⋮ menu opens View Snapshots', () => {
    assert.match(app, /className=\{`btn btn-snapshot/);
    assert.match(app, /onSnapshots: \(\) => setDock\(\(d\) => openDock\(d, 'snapshots'\)\)/);
  });
  it('restore offers to snapshot the current draft first, and is one undo step', () => {
    assert.match(app, /const before = createRevision\(s, \{ label: `Before restoring “\$\{rev\.label\}”`, pages: s\.pages \}\);\s*list = addRevision\(list, before\);/);
    assert.match(app, /set\(doc\.blocks\.length \? doc\.blocks : \[makeBlock\('scene'\)\], null, \{ undo: \(\) => applyParts\(before\), redo: \(\) => applyParts\(after\) \}\)/);
    const ui = readFileSync(new URL('../src/components/Snapshots.jsx', import.meta.url), 'utf8');
    assert.match(ui, /useState\(true\)/, 'snapshot-first is on by default');
    assert.match(ui, /Snapshot & Restore/);
  });
});
