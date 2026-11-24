// Stage 2, Phase 0B: Plan data that's safe to build Scheduling on.
//   - Plan edits are undo steps that take back only their own change.
//   - Breakdowns whose heading left the script are kept, listed, and attached or removed on purpose.
//   - Production cast numbers can be fixed: they never change meaning once fixed.
//   - A schedule (and fixed cast numbers) survive every path a project travels, and an older copy of
//     DraftLine changing the script around them leaves nothing inconsistent that can't be shown.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRODUCTION_VERSION, addAsset, attachScene, castNumbers, extendCastNumbers, freezeCastNumbers, normalizeCastNumbers,
  normalizeProduction, renameCastNumber, sceneAssets, setSceneBucket, setSceneEntry, setSceneNotes, undoAttach, unattachedScenes,
} from '../src/lib/productionData.js';
import { buildBreakdown } from '../src/lib/productionEngine.js';
import { analyzeScript, makeBlock } from '../src/lib/screenplay.js';
import { createProjectStore, isNewerProject, revisionToDoc, toDoc, toRecord } from '../src/lib/projectStorage.js';
import { createRevision } from '../src/lib/revisions.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { createFolderSync } from '../src/lib/folderSync.js';
import { createFakeDirectory } from './helpers/fakeDirectory.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const B = (id, type, text) => ({ ...makeBlock(type, text), id });
const script = () => [
  B('s1', 'scene', 'INT. FERRY - DAY'), B('c1', 'character', 'MARIE'), B('d1', 'dialogue', 'Sit.'),
  B('c2', 'character', 'MARIE'), B('d2', 'dialogue', 'Eat.'), B('c3', 'character', 'THEO'), B('d3', 'dialogue', 'No.'),
  B('s2', 'scene', 'EXT. PIER - NIGHT'), B('a2', 'action', 'Ropes.'), B('c4', 'character', 'AUGUSTIN'), B('d4', 'dialogue', 'Hold on!'),
  B('s3', 'scene', 'INT. CABIN - NIGHT'), B('c5', 'character', 'THEO'), B('d5', 'dialogue', 'Tell me.'),
];
const withProps = () => {
  let p = addAsset(null, 's1', 'props', 'Suitcase');
  p = addAsset(p, 's2', 'props', 'Rope');
  p = addAsset(p, 's2', 'extras', 'Dock workers (4)');
  return setSceneNotes(p, 's2', 'Permit for the pier');
};

describe('Plan edits as undo steps: each takes back only its own change', () => {
  it('a tag list is restored on its own: other lists and notes typed since are untouched', () => {
    let p = withProps();
    const before = sceneAssets(p, 's2').props;
    p = addAsset(p, 's2', 'props', 'Lantern');
    const after = sceneAssets(p, 's2').props;
    p = setSceneNotes(p, 's2', 'Permit for the pier · call the harbour master'); // typed after, not an undo step
    p = addAsset(p, 's1', 'props', 'Thermos'); // another scene
    const undone = setSceneBucket(p, 's2', 'props', before);
    assert.deepEqual(sceneAssets(undone, 's2').props, ['Rope']);
    assert.equal(sceneAssets(undone, 's2').notes, 'Permit for the pier · call the harbour master');
    assert.deepEqual(sceneAssets(undone, 's1').props, ['Suitcase', 'Thermos']);
    assert.deepEqual(sceneAssets(setSceneBucket(undone, 's2', 'props', after), 's2').props, ['Rope', 'Lantern'], 'redo');
  });
  it('a removed scene entry comes back exactly; nothing else moves', () => {
    const p = withProps();
    const entry = p.scenes.s2;
    const gone = setSceneEntry(p, 's2', null);
    assert.equal(gone.scenes.s2, undefined);
    assert.deepEqual(setSceneEntry(gone, 's2', entry), p);
  });
  it('the app records Plan edits on the one undo history, by their own change, and labels them', () => {
    const app = read('src/App.jsx');
    assert.match(app, /const planStep = \(forward, back, label\) => \{\s*set\(\(b\) => b\.slice\(\), null, \{/);
    assert.match(app, /planStep\(\(p\) => setSceneBucket\(p, id, bucket, after\), \(p\) => setSceneBucket\(p, id, bucket, before\), what\)/);
    assert.match(app, /onAdd=\{\(id, bucket, text\) => editTag\(id, bucket, text, true\)\}/);
    assert.match(app, /onRemove=\{\(id, bucket, text\) => editTag\(id, bucket, text, false\)\}/);
    assert.match(app, /notify\(`Undone: \$\{label\}`\)/);
  });
  it('Production Notes keep the browser’s own text undo (Ctrl+Z there never undoes the script)', () => {
    assert.match(read('src/App.jsx'), /!\(t\.tagName === 'TEXTAREA' && t\.closest\?\.\('\.board, \.plan'\)\)/);
  });
});

describe('Unattached breakdowns: kept, listed, attached or removed on purpose', () => {
  it('a heading deleted or turned into Action leaves its breakdown unattached, never deleted', () => {
    const p = withProps();
    assert.deepEqual(unattachedScenes(p, script()), []);
    const merged = script().filter((b) => b.id !== 's2'); // Backspace merged scene 2 into scene 1
    assert.deepEqual(unattachedScenes(p, merged).map((u) => u.id), ['s2']);
    assert.deepEqual(unattachedScenes(p, merged)[0].entry.props, ['Rope']);
    const asAction = script().map((b) => (b.id === 's2' ? { ...b, type: 'action' } : b));
    assert.deepEqual(unattachedScenes(p, asAction).map((u) => u.id), ['s2']);
    assert.deepEqual(normalizeProduction(p).scenes.s2.props, ['Rope'], 'still stored');
  });
  it('the heading back (undo in Write): attached again by itself', () => {
    const p = withProps();
    assert.deepEqual(unattachedScenes(p, script()), []);
    assert.equal(buildBreakdown({ blocks: script(), analysis: analyzeScript(script()), production: p })[1].props[0], 'Rope');
  });
  it('an empty heading (being retyped) is still its scene', () => {
    const blank = script().map((b) => (b.id === 's2' ? { ...b, text: '' } : b));
    assert.deepEqual(unattachedScenes(withProps(), blank), []);
  });
  it('attach: items join the scene’s (no duplicates, the scene’s first), notes follow after a blank line', () => {
    let p = withProps();
    p = addAsset(p, 's1', 'props', 'rope'); // already there, other case
    p = setSceneNotes(p, 's1', 'Ferry booked');
    const out = attachScene(p, 's2', 's1');
    assert.deepEqual(out.scenes.s1.props, ['Suitcase', 'rope']);
    assert.deepEqual(out.scenes.s1.extras, ['Dock workers (4)']);
    assert.equal(out.scenes.s1.notes, 'Ferry booked\n\nPermit for the pier');
    assert.equal(out.scenes.s2, undefined);
    assert.deepEqual(attachScene(p, 's2', 's2'), normalizeProduction(p), 'onto itself: nothing');
    assert.deepEqual(attachScene(p, 'nope', 's1'), normalizeProduction(p));
  });
  it('fields a newer DraftLine stored on the entry travel with it (the scene’s own win)', () => {
    const p = normalizeProduction({ version: 1, scenes: { a: { props: ['X'], estMinutes: 30 }, b: { props: ['Y'], estMinutes: 10 } } });
    assert.equal(attachScene(p, 'a', 'b').scenes.b.estMinutes, 10);
    assert.equal(attachScene(p, 'a', 'c').scenes.c.estMinutes, 30);
  });
  it('undo of attach is precise: items and notes written since are kept', () => {
    let p = withProps();
    const fromEntry = p.scenes.s2;
    const toBefore = p.scenes.s1;
    p = attachScene(p, 's2', 's1');
    const toAfter = p.scenes.s1;
    p = addAsset(p, 's1', 'props', 'Lantern'); // added after attaching
    let back = undoAttach(p, { fromId: 's2', fromEntry, toId: 's1', toBefore, toAfter });
    assert.deepEqual(back.scenes.s2, fromEntry);
    assert.deepEqual(back.scenes.s1.props, ['Suitcase', 'Lantern']);
    assert.equal(back.scenes.s1.notes, '', 'notes untouched since: back to before');
    p = setSceneNotes(p, 's1', 'Rewritten since');
    back = undoAttach(p, { fromId: 's2', fromEntry, toId: 's1', toBefore, toAfter });
    assert.equal(back.scenes.s1.notes, 'Rewritten since', 'notes edited since: kept');
  });
  it('undo of attach to a scene that had no breakdown leaves it without one', () => {
    let p = withProps();
    const fromEntry = p.scenes.s2;
    p = attachScene(p, 's2', 's3');
    const back = undoAttach(p, { fromId: 's2', fromEntry, toId: 's3', toBefore: null, toAfter: p.scenes.s3 });
    assert.equal(back.scenes.s3, undefined);
    assert.deepEqual(back.scenes.s2, fromEntry);
  });
  it('the app: a quiet note in the summary line, Review opens the dialog, both actions are undo steps', () => {
    const ui = read('src/components/planning/PlanningWorkspace.jsx');
    assert.match(ui, /no longer attached/);
    assert.match(ui, /className="plan-clear" onClick=\{\(e\) => setReviewing\(e\.currentTarget\)\}>Review<\/button>/);
    assert.match(ui, /\{unattached\.length > 0 && onAttach && \(/, 'nothing shows when there are none');
    const app = read('src/App.jsx');
    assert.match(app, /const attachUnattached = \(fromId, toId\) => \{/);
    assert.match(app, /\(p\) => undoAttach\(p, \{ fromId, fromEntry, toId, toBefore, toAfter \}\)/);
    assert.match(app, /const removeUnattached = \(id\) => \{/);
    const modal = read('src/components/planning/UnattachedModal.jsx');
    assert.match(modal, />Attach<\/button>/);
    assert.match(modal, />Remove<\/button>/);
  });
});

describe('Production cast numbers', () => {
  const blocks = script();
  const a = analyzeScript(blocks);
  it('before production scheduling: live, 1 = most lines (unchanged behaviour)', () => {
    assert.deepEqual([...castNumbers(a)], [['MARIE', 1], ['THEO', 2], ['AUGUSTIN', 3]]);
    assert.equal(normalizeProduction(withProps()).castNumbers, undefined, 'nothing stored');
  });
  it('fixed: numbers keep their meaning when line counts change', () => {
    const fixed = freezeCastNumbers(a);
    assert.deepEqual(fixed, { MARIE: 1, THEO: 2, AUGUSTIN: 3 });
    const more = [...blocks, B('c9', 'character', 'AUGUSTIN'), B('d9', 'dialogue', 'Now!'), B('c10', 'character', 'AUGUSTIN'), B('d10', 'dialogue', 'Go!')];
    const a2 = analyzeScript(more);
    assert.equal(a2.characterList[0].name, 'AUGUSTIN', 'Augustin now has the most lines');
    assert.deepEqual([...castNumbers(a2, fixed)], [['MARIE', 1], ['THEO', 2], ['AUGUSTIN', 3]]);
  });
  it('a new speaking character gets the next free number, stored so it never shifts', () => {
    const fixed = { MARIE: 1, THEO: 2, AUGUSTIN: 3 };
    const more = [...blocks, B('c9', 'character', 'GRANDMÈRE'), B('d9', 'dialogue', 'Slower.')];
    const ext = extendCastNumbers(fixed, analyzeScript(more));
    assert.deepEqual(ext, { MARIE: 1, THEO: 2, AUGUSTIN: 3, 'GRANDMÈRE': 4 });
    assert.equal(extendCastNumbers(ext, analyzeScript(more)), ext, 'nobody new: the same object (nothing to store)');
    assert.equal(extendCastNumbers(null, a), null, 'not fixed: nothing happens');
  });
  it('a character who stops speaking keeps a retired number that’s never reused', () => {
    const fixed = { MARIE: 1, THEO: 2, AUGUSTIN: 3 };
    const noAug = blocks.filter((b) => !['c4', 'd4'].includes(b.id));
    const withNew = [...noAug, B('c9', 'character', 'JOVENEL'), B('d9', 'dialogue', 'Hi.')];
    assert.deepEqual(extendCastNumbers(fixed, analyzeScript(withNew)), { MARIE: 1, THEO: 2, AUGUSTIN: 3, JOVENEL: 4 });
  });
  it('hand-retyped cues look like a new character: a new number, the old one retired (never silently swapped)', () => {
    const fixed = { MARIE: 1, THEO: 2, AUGUSTIN: 3 };
    const retyped = blocks.map((b) => (b.type === 'character' && b.text === 'THEO' ? { ...b, text: 'THEODORE' } : b));
    assert.deepEqual(extendCastNumbers(fixed, analyzeScript(retyped)), { MARIE: 1, THEO: 2, AUGUSTIN: 3, THEODORE: 4 });
  });
  it('Rename keeps the number; renaming into a character who has one keeps theirs and retires the old', () => {
    const fixed = { MARIE: 1, THEO: 2, AUGUSTIN: 3 };
    assert.deepEqual(renameCastNumber(fixed, 'Theo', 'Theodore'), { MARIE: 1, THEODORE: 2, AUGUSTIN: 3 });
    assert.equal(renameCastNumber(fixed, 'THEO', 'MARIE'), fixed);
    assert.equal(renameCastNumber(fixed, 'NOBODY', 'X'), fixed);
    assert.equal(renameCastNumber(null, 'THEO', 'X'), null);
    assert.deepEqual(renameCastNumber(renameCastNumber(fixed, 'THEO', 'THEODORE'), 'THEODORE', 'THEO'), fixed, 'undo');
  });
  it('stored safely: whole positive numbers, each used once, names in capitals', () => {
    assert.deepEqual(normalizeCastNumbers({ marie: 1, THEO: 1, AUGUSTIN: 0, X: 2.5, Y: '3', Z: 4 }), { MARIE: 1, Z: 4 });
    assert.equal(normalizeCastNumbers({}), null);
    assert.equal(normalizeCastNumbers([1, 2]), null);
    assert.deepEqual(normalizeProduction({ version: 1, scenes: {}, castNumbers: { MARIE: 1 } }).castNumbers, { MARIE: 1 });
  });
  it('every Plan view uses the fixed numbers once there are some', () => {
    const more = [...blocks, B('c9', 'character', 'AUGUSTIN'), B('d9', 'dialogue', 'Now!'), B('c10', 'character', 'AUGUSTIN'), B('d10', 'dialogue', 'Go!')];
    const rows = buildBreakdown({ blocks: more, analysis: analyzeScript(more), production: { version: 1, scenes: {}, castNumbers: { MARIE: 1, THEO: 2, AUGUSTIN: 3 } } });
    assert.deepEqual(rows[1].cast, [{ name: 'AUGUSTIN', number: 3 }]);
  });
  it('the app: new speakers stored as they appear, a rename carries the number (in its undo step)', () => {
    const app = read('src/App.jsx');
    assert.match(app, /if \(!production\.castNumbers\) return;\s*const next = extendCastNumbers\(production\.castNumbers, analysis\);/);
    assert.match(app, /const castAfter = renameCastNumber\(castBefore, oldName, newName\);/);
    assert.match(app, /dir === 'undo' \? renameCastNumber\(cur, newName, oldName\) : renameCastNumber\(cur, oldName, newName\)/);
  });
});

describe('Schedule data: stored safely, and older copies can’t leave it inconsistent', () => {
  const SCHEDULE = { days: [{ id: 'd1', date: '2027-05-12', note: '', sceneIds: ['s3', 's1'] }, { id: 'd2', date: null, note: 'Pier', sceneIds: ['s2'] }], pagesTarget: 40 };
  const withSchedule = () => ({ ...withProps(), schedule: JSON.parse(JSON.stringify(SCHEDULE)), castNumbers: { MARIE: 1, THEO: 2, AUGUSTIN: 3 } });
  async function project(store) {
    const base = await store.createProject({ title: 'Scheduled' });
    const rec = { ...base, script: script(), production: withSchedule(), updatedAt: base.updatedAt + 1 };
    return store.importRecord(rec);
  }
  const check = (rec, msg) => {
    assert.deepEqual(rec.production.schedule, SCHEDULE, `${msg}: schedule`);
    assert.deepEqual(rec.production.castNumbers, { MARIE: 1, THEO: 2, AUGUSTIN: 3 }, `${msg}: cast numbers`);
    assert.deepEqual(rec.production.scenes.s2.props, ['Rope'], `${msg}: breakdown`);
  };
  it('save and reopen, duplicate, backup and restore, snapshot, linked folder', async () => {
    const store = createProjectStore({ indexedDB: undefined });
    const rec = await project(store);
    check(await store.saveActiveProject(toDoc(rec)), 'save');
    check(toRecord(toDoc(rec), 1), 'reopen');
    check(await store.duplicateProject(rec.id), 'duplicate');
    const { record } = parseBackup(serializeBackup(rec));
    check((await store.restoreProject(record)).record, 'backup');
    const rev = createRevision(toDoc(rec), { label: 'Before', now: 1 });
    check({ production: revisionToDoc(JSON.parse(JSON.stringify(rev))).production }, 'snapshot');
    const dir = createFakeDirectory();
    const sync = createFolderSync({ settings: { get: async () => null, set: async () => {} }, win: { showDirectoryPicker: async () => dir } });
    await sync.init();
    await sync.link();
    await sync.writeProject(rec);
    check(await sync.readProject(rec.id), 'folder');
  });
  it('needs no format bump: it isn’t “newer”, so every copy since November 19 edits it normally', () => {
    assert.equal(PRODUCTION_VERSION, 1);
    assert.equal(isNewerProject({ production: withSchedule() }), false);
  });
  it('an older copy deleting or merging a scheduled scene: the schedule keeps pointing at it, harmlessly', async () => {
    // Older copies (from November 19) carry `schedule` through untouched. If one deletes scene 2 (merging
    // it into scene 1), the schedule still names s2 and its breakdown is unattached: both are kept and
    // shown, nothing is lost, and nothing that can't exist is created (an older copy never writes a
    // schedule, so it can't put a scene on two days or invent a day).
    const store = createProjectStore({ indexedDB: undefined });
    const rec = await project(store);
    const doc = toDoc(rec);
    const saved = await store.saveActiveProject({ ...doc, blocks: doc.blocks.filter((b) => b.id !== 's2') });
    assert.deepEqual(saved.production.schedule, SCHEDULE, 'schedule kept as it was');
    assert.deepEqual(unattachedScenes(saved.production, saved.script).map((u) => u.id), ['s2'], 'its breakdown is listed for Review');
    const headings = new Set(saved.script.filter((b) => b.type === 'scene').map((b) => b.id));
    assert.deepEqual(saved.production.schedule.days.flatMap((d) => d.sceneIds).filter((id) => !headings.has(id)), ['s2'],
      'the one stale reference Scheduling will show as “no longer in the script”');
  });
  it('a project with no schedule and no fixed numbers is stored exactly as before', () => {
    const p = withProps();
    assert.deepEqual(Object.keys(normalizeProduction(p)).sort(), ['scenes', 'version']);
    assert.deepEqual(toRecord({ id: 'x', meta: {}, blocks: script(), production: p }, 1).production, normalizeProduction(p));
  });
});
