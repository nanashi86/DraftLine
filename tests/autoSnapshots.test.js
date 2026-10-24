import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUTO_SNAPSHOT_INTERVAL_MS, AUTO_SNAPSHOT_KEEP, autoSnapshotsToPrune, createFolderSync, saveProjectEverywhere, snapshotFromFileText,
} from '../src/lib/folderSync.js';
import { createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { changedSince, createRevision, partsOf } from '../src/lib/revisions.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import { createFakeDirectory } from './helpers/fakeDirectory.js';

const memorySettings = () => {
  const m = new Map();
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } };
};
const doc = (title, text = 'EXT. HARBOR - DAWN') => ({ meta: { title, author: 'Eric' }, blocks: [makeBlock('scene', text)], beats: [] });

/** A linked fake folder whose clock we move by hand (files' "date modified"). */
async function linked() {
  let t = Date.UTC(2026, 9, 22, 13, 0);
  const clock = () => t;
  const dir = createFakeDirectory('DraftLine Projects', { clock });
  const sync = createFolderSync({ settings: memorySettings(), win: { showDirectoryPicker: async () => dir }, now: clock });
  await sync.init();
  await sync.link();
  const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
  return { dir, sync, store, tick: (ms = 60_000) => { t += ms; return t; }, now: () => t };
}
const snapshotNames = (dir) => Object.keys(dir.$.files()).filter((p) => p.startsWith('Snapshots/')).map((p) => p.slice('Snapshots/'.length));

describe('Automatic snapshots: settings', () => {
  it('every 15 minutes, newest 15 kept', () => {
    assert.equal(AUTO_SNAPSHOT_INTERVAL_MS, 15 * 60 * 1000);
    assert.equal(AUTO_SNAPSHOT_KEEP, 15);
  });
});

describe('Automatic snapshots: FIFO retention', () => {
  const f = (name, projectId, auto, lastModified) => ({ name, projectId, auto, lastModified, timestamp: new Date(lastModified).toISOString() });
  it('deletes this script’s oldest automatic snapshots beyond the newest 15, by date modified', () => {
    const files = Array.from({ length: 18 }, (_, i) => f(`a${String(i).padStart(2, '0')}.draftline`, 'A', true, 1000 + i));
    assert.deepEqual(autoSnapshotsToPrune(files, 'A'), ['a00.draftline', 'a01.draftline', 'a02.draftline']);
    assert.deepEqual(autoSnapshotsToPrune(files.slice(0, 15), 'A'), [], 'exactly 15: nothing to delete');
  });
  it('never touches snapshots you took, or another script’s (even one with the same title)', () => {
    const files = [
      ...Array.from({ length: 16 }, (_, i) => f(`Run_${i}.draftline`, 'A', true, 2000 + i)),
      f('Run_mine-old.draftline', 'A', false, 1),
      f('Run_other-script.draftline', 'B', true, 0),
    ];
    assert.deepEqual(autoSnapshotsToPrune(files, 'A'), ['Run_0.draftline']);
  });
});

describe('Automatic snapshots: written to Snapshots/, marked, trimmed to 15', () => {
  it('writes Snapshots/<Title>_<YYYY-MM-DD_HHmm>.draftline marked automatic, readable like any snapshot', async () => {
    const { dir, sync, store, now } = await linked();
    const { record } = await saveProjectEverywhere({ store, sync, data: doc('Run!', 'INT. CAR - NIGHT') });
    const rev = createRevision(toDoc(record), { label: 'Auto-snapshot', now: now() });
    const { path, pruned } = await sync.writeAutoSnapshot(rev, record);
    assert.match(path, /^Snapshots\/Run_\d{4}-\d{2}-\d{2}_\d{4}\.draftline$/);
    assert.deepEqual(pruned, []);
    const back = snapshotFromFileText(dir.$.files()[path]);
    assert.equal(back.rev.auto, true);
    assert.equal(back.projectId, record.id);
    assert.equal(back.rev.script[0].text, 'INT. CAR - NIGHT');
  });
  it('the 16th automatic snapshot deletes the oldest automatic one — yours and other scripts’ stay', async () => {
    const { dir, sync, store, tick } = await linked();
    const { record: run } = await saveProjectEverywhere({ store, sync, data: doc('Run!') });
    const { record: twin } = await saveProjectEverywhere({ store, sync, data: doc('Run!') }); // same title, another script
    const mine = createRevision(toDoc(run), { label: 'Before the rewrite', now: tick() });
    await sync.writeSnapshot(mine, run); // yours: never trimmed
    await sync.writeAutoSnapshot(createRevision(toDoc(twin), { now: tick() }), twin);
    const written = [];
    for (let i = 0; i < 18; i += 1) {
      const { path, pruned } = await sync.writeAutoSnapshot(createRevision(toDoc(run), { label: `Auto ${i}`, now: tick(15 * 60_000) }), run);
      written.push(path.slice('Snapshots/'.length));
      if (i < 15) assert.deepEqual(pruned, [], `no trimming until there are more than 15 (${i + 1})`);
      else assert.deepEqual(pruned, [written[i - 15]], 'the oldest automatic one goes');
    }
    const names = snapshotNames(dir);
    const read = (n) => snapshotFromFileText(dir.$.files()[`Snapshots/${n}`]);
    const runAuto = names.filter((n) => read(n).projectId === run.id && read(n).rev.auto);
    assert.equal(runAuto.length, 15);
    assert.deepEqual(runAuto.sort(), written.slice(3).sort(), 'the newest 15');
    assert.ok(names.some((n) => read(n).rev.id === mine.id), 'your own snapshot is still there');
    assert.ok(names.some((n) => read(n).projectId === twin.id), 'the other “Run!” script’s is still there');
  });
  it('with no folder linked nothing is written', async () => {
    const sync = createFolderSync({ settings: memorySettings(), win: {} });
    await sync.init();
    const rev = createRevision(doc('X'), { now: 1 });
    assert.deepEqual(await sync.writeAutoSnapshot(rev, { id: 'x', title: 'X' }), { path: null, pruned: [] });
  });
});

describe('Automatic snapshots: only when something changed', () => {
  const s = { projectId: 'p', blocks: [], meta: {}, beats: [], characters: [], storyNotes: {}, storyDna: {}, production: {} };
  it('compares by identity against the last automatic snapshot (or opening the script)', () => {
    const base = { projectId: 'p', parts: partsOf(s) };
    assert.equal(changedSince(base, s), false);
    assert.equal(changedSince(base, { ...s, blocks: [...s.blocks] }), true, 'an edit makes new state');
    assert.equal(changedSince(base, { ...s, projectId: 'q' }), true, 'another script');
    assert.equal(changedSince(null, s), true);
  });
});

describe('Automatic snapshots: wiring in the app', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  it('a 15-minute timer while a folder is linked, writing only if the script changed', () => {
    assert.match(app, /setInterval\(\(\) => autoSnapshotRef\.current\(null\), AUTO_SNAPSHOT_INTERVAL_MS\)/);
    assert.match(app, /if \(!force && !changedSince\(autoBaseline\.current, s\)\) return null;/);
    assert.match(app, /autoBaseline\.current = \{ projectId, parts: partsOf\(latest\.current\) \};\s*\}, \[projectId\]\);/, 'opening a script is the baseline');
  });
  it('forced just before an import, a Format Doctor Fix All, and deleting a script', () => {
    const fn = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
    const imp = fn('const importScript = (', 'const printScript = ');
    assert.ok(imp.indexOf("autoSnapshotRef.current(mode === 'append' ? 'append' : 'import', { force: true })") < imp.indexOf('set(incoming, null,'), 'before the script is replaced');
    const fix = fn('const fixIssues = useCallback(', 'const ignoreIssue');
    assert.ok(fix.indexOf("if (bulk) autoSnapshotRef.current('Fix All', { force: true })") < fix.indexOf('applyFixes(blocks, list)'), 'before Fix All');
    assert.match(app, /onFixAll=\{\(\) => fixIssues\(issues, \{ bulk: true \}\)\}/, 'Fix All always counts, however many findings');
    assert.match(app, /onFix=\{\(it\) => fixIssues\(\[it\]\)\}/, 'a single Fix doesn’t snapshot');
    const del = fn('const confirmDelete = async () => {', 'const hardDelete = ');
    assert.ok(del.indexOf("autoSnapshotRef.current('deleting', { force: true })") < del.indexOf('projects.deleteProject(d.id)'), 'before deleting the open script');
    assert.match(del, /folderSync\.writeAutoSnapshot\(rev, \{ id: rec\.id, title: rec\.title, createdAt: rec\.createdAt \}/, 'or another script, from its saved copy');
  });
});
