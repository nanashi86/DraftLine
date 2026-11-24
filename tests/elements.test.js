// Stage 2, Phase 2A: shared production elements (lib/elements.js, productionData.js).
//
//   - Migration from the four lists: lossless, deterministic, idempotent; capitals and spacing aside, a
//     name is one element; spelling variants and quantities in text are left alone.
//   - The eight categories project into the four lists older builds know; their edits are reconciled
//     without guessing, and nothing they'd drop is lost.
//   - Element operations (add / reuse, remove here, rename, reclassify, separate, merge, delete), each
//     undoable by slice; unused elements keep their identity.
//   - Shooting-day requirements and elementUsage by identity; quantities never added up.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addAsset, addNeed, applySlice, attachScene, changedParts, deleteElement, mergeElements, normalizeProduction, reclassifyElement,
  removeAsset, removeNeed, renameClashes, renameElement, scenesNeeding, separateNeed, setNeed, setSceneEntry, setSceneNotes, sliceOf, undoAttach,
} from '../src/lib/productionData.js';
import { CATEGORIES, CATEGORY_IDS, LEGACY_IDS, legacyOf, needLabel, needText, sceneNeeds } from '../src/lib/elements.js';
import { createProjectStore, revisionToDoc, toDoc } from '../src/lib/projectStorage.js';
import { createRevision } from '../src/lib/revisions.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { addDay, elementUsage, moveScene, scheduleModel } from '../src/lib/schedule.js';
import { breakdownCsv, buildBreakdown } from '../src/lib/productionEngine.js';
import { parseFountain } from '../src/lib/fountain.js';
import { analyzeScript, makeBlock } from '../src/lib/screenplay.js';

const N = normalizeProduction;
const el = (p, sid, list, name) => {
  const s = p.scenes[sid];
  return CATEGORY_IDS.flatMap((c) => s.links?.[c] || []).find((l) => p.elements[l.id].name.toLowerCase() === name.toLowerCase() && legacyOf(p.elements[l.id].category) === list);
};
const idOf = (p, sid, list, name) => el(p, sid, list, name)?.id;
/** What an older DraftLine (Phase 0 – 1.5) saves: it knows the four lists and notes, carries the rest. */
function olderBuildEdit(p, sid, list, names) {
  const raw = JSON.parse(JSON.stringify(p));
  raw.scenes[sid] ||= {};
  raw.scenes[sid][list] = names;
  return raw;
}

const LEGACY = {
  version: 1,
  scenes: {
    s3: { vehicles: ['Black SUV', 'Ferry SAINTE-ROSE'], wardrobe: ['Rain-soaked coat', 'Squib (blood)'], extras: ['Ferry passengers (12)'], props: ['Life jacket, orange'], notes: 'Night shoot' },
    s17: { vehicles: ['black  suv'], extras: ['Ferry passengers (20)'], props: ['Life jackets'] },
    s42: { vehicles: ['Black SUV'], wardrobe: ['rain-soaked COAT'] },
  },
};

describe('migration from the four lists', () => {
  const p = N(LEGACY);
  it('every item becomes a link to an element; the four lists read exactly as before', () => {
    assert.deepEqual(p.scenes.s3.vehicles, ['Black SUV', 'Ferry SAINTE-ROSE']);
    assert.deepEqual(p.scenes.s3.wardrobe, ['Rain-soaked coat', 'Squib (blood)']);
    assert.deepEqual(p.scenes.s3.props, ['Life jacket, orange'], 'a comma inside an item is never split');
    assert.equal(p.scenes.s3.notes, 'Night shoot');
    assert.deepEqual(p.scenes.s17.vehicles, ['Black SUV'], 'shown by the element’s name');
  });
  it('the same name in the same list, capitals and spacing aside, is one element across scenes', () => {
    const suv = idOf(p, 's3', 'vehicles', 'Black SUV');
    assert.ok(suv);
    assert.equal(idOf(p, 's17', 'vehicles', 'black suv'), suv);
    assert.equal(idOf(p, 's42', 'vehicles', 'Black SUV'), suv);
    assert.equal(idOf(p, 's42', 'wardrobe', 'rain-soaked coat'), idOf(p, 's3', 'wardrobe', 'Rain-soaked coat'));
  });
  it('spelling variants, plurals and quantities in text are left alone', () => {
    assert.notEqual(idOf(p, 's17', 'props', 'Life jackets'), idOf(p, 's3', 'props', 'Life jacket, orange'));
    assert.notEqual(idOf(p, 's17', 'extras', 'Ferry passengers (20)'), idOf(p, 's3', 'extras', 'Ferry passengers (12)'));
    assert.equal(el(p, 's3', 'extras', 'Ferry passengers (12)').qty, undefined, 'no quantity invented');
  });
  it('the mixed lists are not guessed: Wardrobe & SFX → Wardrobe, Vehicles & Stunts → Vehicles, remembered', () => {
    const squib = p.elements[idOf(p, 's3', 'wardrobe', 'Squib (blood)')];
    assert.deepEqual([squib.category, squib.from], ['wardrobe', 'wardrobe']);
    const suv = p.elements[idOf(p, 's3', 'vehicles', 'Black SUV')];
    assert.deepEqual([suv.category, suv.from], ['vehicles', 'vehicles']);
    const extra = p.elements[idOf(p, 's3', 'extras', 'Ferry passengers (12)')];
    assert.equal(extra.from, undefined);
  });
  it('deterministic and idempotent: the same ids every time, nothing new on a second pass', () => {
    assert.deepEqual(N(LEGACY), p);
    assert.deepEqual(N(p), p);
    assert.deepEqual(N(JSON.parse(JSON.stringify(p))), p);
    assert.equal(Object.keys(p.elements).length, 8, 'one element per distinct item, no duplicates');
  });
  it('another tab (or computer) migrating the same project reaches the same result; opening it writes nothing', async () => {
    const store = createProjectStore({ indexedDB: undefined });
    const rec = await store.saveActiveProject({ meta: { title: 'Ferry' }, blocks: [makeBlock('scene', 'EXT. HARBOR - DAWN')], production: LEGACY });
    const before = await store.getProject(rec.id);
    assert.deepEqual(toDoc(before).production, toDoc(await store.getProject(rec.id)).production, 'two tabs open the same project the same way');
    assert.equal((await store.getProject(rec.id)).updatedAt, before.updatedAt, 'nothing written by opening');
  });
});

describe('the eight categories and older builds', () => {
  const ids = CATEGORIES.map((c) => c.id);
  it('eight categories, in the Breakdowns order, each projecting into one of the four older lists', () => {
    assert.deepEqual(ids, ['extras', 'props', 'wardrobe', 'makeup', 'vehicles', 'stunts', 'sfx', 'vfx']);
    assert.deepEqual(CATEGORIES.map((c) => c.label), ['Background / Extras', 'Props & Set Dressing', 'Wardrobe', 'Hair & Makeup', 'Vehicles', 'Stunts', 'Special Effects', 'Visual Effects']);
    assert.deepEqual(Object.fromEntries(ids.map((c) => [c, legacyOf(c)])), {
      extras: 'extras', props: 'props', wardrobe: 'wardrobe', makeup: 'wardrobe', vehicles: 'vehicles', stunts: 'vehicles', sfx: 'wardrobe', vfx: 'wardrobe',
    });
    assert.deepEqual(LEGACY_IDS, ['extras', 'props', 'wardrobe', 'vehicles']);
  });
  const withNew = () => {
    let p = N({ version: 1, scenes: { s1: { notes: '' } } });
    for (const [cat, name] of [['makeup', 'Bruised cheek'], ['stunts', 'Fall from the gangway'], ['sfx', 'Rain on deck'], ['vfx', 'Storm sky']]) {
      p = addNeed(p, 's1', cat, { name }).production;
    }
    return setNeed(p, 's1', idOf(p, 's1', 'vehicles', 'Fall from the gangway'), { qty: 2, note: 'Two takes' });
  };
  it('new categories show in the older lists (Hair & Makeup, effects → Wardrobe & SFX; Stunts → Vehicles & Stunts)', () => {
    const p = withNew();
    assert.deepEqual(p.scenes.s1.wardrobe, ['Bruised cheek', 'Rain on deck', 'Storm sky']);
    assert.deepEqual(p.scenes.s1.vehicles, ['Fall from the gangway']);
  });
  it('an older build saving without touching them: everything comes back, categories, quantities, notes', () => {
    const p = withNew();
    const back = N(olderBuildEdit(p, 's1', 'props', ['Thermos'])); // it edited another list only
    assert.deepEqual(back.scenes.s1.links.stunts, p.scenes.s1.links.stunts);
    assert.deepEqual(back.scenes.s1.links.vfx, p.scenes.s1.links.vfx);
    assert.equal(el(back, 's1', 'vehicles', 'Fall from the gangway').qty, 2);
    assert.deepEqual(back.scenes.s1.props, ['Thermos']);
  });
  it('an older build removing an item: its link, quantity and note are set aside (recoverable), not dropped', () => {
    const p = withNew();
    const gone = idOf(p, 's1', 'vehicles', 'Fall from the gangway');
    const back = N(olderBuildEdit(p, 's1', 'vehicles', []));
    assert.equal(back.scenes.s1.links.stunts, undefined);
    assert.deepEqual(back.scenes.s1.unlinked, [{ id: gone, qty: 2, note: 'Two takes', category: 'stunts', name: 'Fall from the gangway' }]);
    assert.ok(back.elements[gone], 'the element keeps its identity');
    assert.deepEqual(N(back), back, 'and settles');
  });
  it('an older build adding a name: linked to the one element of that name, or a new one — never a guess', () => {
    let p = withNew();
    p = addNeed(p, 's2', 'props', { name: 'Thermos' }).production;
    const thermos = idOf(p, 's2', 'props', 'Thermos');
    const back = N(olderBuildEdit(p, 's1', 'props', ['thermos']));
    assert.equal(idOf(back, 's1', 'props', 'thermos'), thermos, 'the one Thermos');
    // two Thermos kept separate on purpose: a name typed in an older build matches neither
    const sep = separateNeed(back, 's1', thermos).production;
    const again = N(olderBuildEdit(sep, 's3', 'props', ['Thermos']));
    const ids3 = idOf(again, 's3', 'props', 'Thermos');
    assert.ok(ids3 && ids3 !== thermos && ids3 !== idOf(sep, 's1', 'props', 'Thermos'));
    assert.deepEqual(N(again), again);
  });
  it('an item an older build removed, then brought back to the same scene: the same identity, quantity and note', () => {
    const p = withNew();
    const fall = idOf(p, 's1', 'vehicles', 'Fall from the gangway');
    const removed = N(olderBuildEdit(p, 's1', 'vehicles', []));
    const before = p.scenes.s1.vehicles;
    const back = N(olderBuildEdit(removed, 's1', 'vehicles', before)); // its undo there, or typed again
    assert.equal(idOf(back, 's1', 'vehicles', 'Fall from the gangway'), fall);
    assert.deepEqual(back.scenes.s1.links.stunts, p.scenes.s1.links.stunts, 'quantity, note and category as they were');
    assert.equal(back.scenes.s1.unlinked, undefined, 'taken back out of the set-aside list');
    assert.deepEqual(N(back), back, 'settles');
    assert.equal(Object.keys(back.elements).length, Object.keys(p.elements).length, 'no new element');
  });
  it('no limit on set-aside links: 60 items an older build removed all keep identity, quantity and note, and all come back', () => {
    let p = N({ version: 1, scenes: { s1: { notes: '' } } });
    const names = Array.from({ length: 60 }, (_, i) => `Prop ${String(i + 1).padStart(2, '0')}`);
    for (const name of names) p = addNeed(p, 's1', 'props', { name }).production;
    names.forEach((name, i) => { p = setNeed(p, 's1', idOf(p, 's1', 'props', name), { qty: i + 1, note: `note ${i + 1}` }); });
    const before = Object.fromEntries(names.map((n) => [n, el(p, 's1', 'props', n)]));
    const removed = N(olderBuildEdit(p, 's1', 'props', []));
    assert.equal(removed.scenes.s1.unlinked.length, 60, 'all 60 set aside');
    assert.deepEqual(N(removed), removed, 'deterministic and idempotent');
    assert.deepEqual(N(JSON.parse(JSON.stringify(removed))), removed, 'the same from a stored copy');
    const back = N(olderBuildEdit(removed, 's1', 'props', names));
    for (const n of names) assert.deepEqual(el(back, 's1', 'props', n), before[n], n);
    assert.equal(back.scenes.s1.unlinked, undefined);
    assert.equal(Object.keys(back.elements).length, 60, 'no new elements');
    // Deleting one everywhere clears its set-aside link; the other 59 stay set aside.
    const del = deleteElement(removed, before['Prop 07'].id);
    assert.equal(del.scenes.s1.unlinked.length, 59);
    assert.ok(!del.scenes.s1.unlinked.some((u) => u.id === before['Prop 07'].id));
  });
  it('deleted everywhere on purpose: an older build typing that name again makes a new element, not the old one', () => {
    const p = withNew();
    const fall = idOf(p, 's1', 'vehicles', 'Fall from the gangway');
    const removed = N(olderBuildEdit(p, 's1', 'vehicles', [])); // set aside in s1
    const deleted = deleteElement(removed, fall);
    assert.equal(deleted.scenes.s1.unlinked, undefined, 'its set-aside link goes too');
    const typed = N(olderBuildEdit(deleted, 's1', 'vehicles', ['Fall from the gangway']));
    assert.notEqual(idOf(typed, 's1', 'vehicles', 'Fall from the gangway'), fall);
  });
  it('an older build renaming an item: the old link is set aside with its details, the new name linked', () => {
    let p = withNew();
    p = setNeed(p, 's1', idOf(p, 's1', 'wardrobe', 'Storm sky'), { note: 'Wide shots only' });
    const back = N(olderBuildEdit(p, 's1', 'wardrobe', ['Bruised cheek', 'Rain on deck', 'Stormy sky']));
    assert.equal(back.scenes.s1.unlinked.at(-1).name, 'Storm sky');
    assert.equal(back.scenes.s1.unlinked.at(-1).note, 'Wide shots only');
    assert.ok(idOf(back, 's1', 'wardrobe', 'Stormy sky'));
  });
  it('a DraftLine from before Phase 0 dropping links and elements: the names are kept and linked again', () => {
    const p = withNew();
    const stripped = { version: 1, scenes: { s1: { ...Object.fromEntries(LEGACY_IDS.map((l) => [l, p.scenes.s1[l]])), notes: '' } } };
    const back = N(stripped);
    assert.deepEqual(LEGACY_IDS.map((l) => back.scenes.s1[l]), LEGACY_IDS.map((l) => p.scenes.s1[l]), 'every name survives');
  });
  it('forward compatible: a newer build’s category, element and link fields are kept', () => {
    let p = withNew();
    const raw = JSON.parse(JSON.stringify(p));
    const [first] = Object.keys(raw.elements);
    raw.elements[first].vendor = 'v1';
    raw.scenes.s1.links.makeup[0].look = 'L2';
    raw.scenes.s1.links.drones = [{ id: 'x' }];
    p = N(raw);
    assert.equal(p.elements[first].vendor, 'v1');
    assert.equal(p.scenes.s1.links.makeup[0].look, 'L2');
    assert.deepEqual(p.scenes.s1.links.drones, [{ id: 'x' }]);
    assert.equal(N({ ...p, version: 4 }).version, 4);
  });
});

describe('element operations', () => {
  const base = () => N(LEGACY);
  it('reuse: adding a name that exists links that element (one identity), unless asked to keep it separate', () => {
    const p = base();
    const suv = idOf(p, 's3', 'vehicles', 'Black SUV');
    const r = addNeed(p, 's9', 'vehicles', { name: 'BLACK suv' });
    assert.equal(r.id, suv);
    const sep = addNeed(r.production, 's10', 'vehicles', { name: 'Black SUV', reuse: false });
    assert.notEqual(sep.id, suv);
    assert.deepEqual(addAsset(p, 's9', 'vehicles', 'black suv').scenes.s9.vehicles, ['Black SUV'], 'the four-list add reuses too');
  });
  it('removing from one scene leaves the others; the element stays registered and is reused later', () => {
    const p = base();
    const suv = idOf(p, 's3', 'vehicles', 'Black SUV');
    let q = removeNeed(p, 's3', suv);
    assert.ok(!q.scenes.s3.vehicles.includes('Black SUV'));
    assert.deepEqual(scenesNeeding(q, suv).sort(), ['s17', 's42']);
    for (const sid of ['s17', 's42']) q = removeNeed(q, sid, suv);
    assert.ok(q.elements[suv], 'unused, still registered');
    assert.equal(addNeed(q, 's5', 'vehicles', { name: 'Black SUV' }).id, suv, 'reused with the same identity');
    assert.deepEqual(removeAsset(p, 's3', 'vehicles', 'black suv').scenes.s3.vehicles, ['Ferry SAINTE-ROSE']);
  });
  it('rename everywhere; a clash with another element of that name is reported for the writer', () => {
    const p = base();
    const suv = idOf(p, 's3', 'vehicles', 'Black SUV');
    const q = renameElement(p, suv, 'Black Tahoe');
    for (const sid of ['s3', 's17', 's42']) assert.ok(q.scenes[sid].vehicles.includes('Black Tahoe'));
    assert.equal(idOf(q, 's17', 'vehicles', 'Black Tahoe'), suv, 'same identity');
    assert.deepEqual(renameClashes(p, suv, 'ferry sainte-rose'), ['s3']);
  });
  it('quantities and notes are per scene: a positive whole number or none; never 0, never invented', () => {
    const p = base();
    const pax = idOf(p, 's3', 'extras', 'Ferry passengers (12)');
    let q = setNeed(p, 's3', pax, { qty: 12, note: 'Mixed ages' });
    assert.deepEqual([el(q, 's3', 'extras', 'Ferry passengers (12)').qty, el(q, 's3', 'extras', 'Ferry passengers (12)').note], [12, 'Mixed ages']);
    q = setNeed(q, 's3', pax, { qty: 0 });
    assert.equal(el(q, 's3', 'extras', 'Ferry passengers (12)').qty, undefined);
    assert.equal(setNeed(q, 's3', pax, { qty: 2.5 }).scenes.s3.links.extras[0].qty, undefined);
    assert.equal(el(q, 's3', 'extras', 'Ferry passengers (12)').note, 'Mixed ages', 'untouched when not given');
  });
  it('reclassify moves every scene’s link, and sorts the element out of its mixed list', () => {
    const p = base();
    const coat = idOf(p, 's3', 'wardrobe', 'Rain-soaked coat');
    const squib = idOf(p, 's3', 'wardrobe', 'Squib (blood)');
    const q = reclassifyElement(p, squib, 'sfx');
    assert.equal(q.elements[squib].category, 'sfx');
    assert.equal(q.elements[squib].from, undefined);
    assert.deepEqual(q.scenes.s3.links.sfx, [{ id: squib }]);
    assert.deepEqual(q.scenes.s3.wardrobe, ['Rain-soaked coat', 'Squib (blood)'], 'older builds still see it in Wardrobe & SFX');
    const moved = reclassifyElement(p, coat, 'makeup');
    assert.deepEqual(['s3', 's42'].map((sid) => moved.scenes[sid].links.makeup?.[0]?.id), [coat, coat], 'every scene that uses it');
    const toStunts = reclassifyElement(p, idOf(p, 's3', 'vehicles', 'Black SUV'), 'stunts');
    assert.deepEqual(toStunts.scenes.s17.vehicles, ['Black SUV']);
  });
  it('separate here: this scene gets its own element (same name), kept apart from then on', () => {
    const p = setNeed(base(), 's17', idOf(base(), 's17', 'vehicles', 'Black SUV'), { qty: 2 });
    const suv = idOf(p, 's3', 'vehicles', 'Black SUV');
    const r = separateNeed(p, 's17', suv);
    assert.ok(r.id && r.id !== suv);
    assert.equal(idOf(r.production, 's17', 'vehicles', 'Black SUV'), r.id);
    assert.equal(el(r.production, 's17', 'vehicles', 'Black SUV').qty, 2, 'its quantity comes along');
    assert.equal(idOf(r.production, 's3', 'vehicles', 'Black SUV'), suv);
    assert.deepEqual(N(r.production), r.production, 'identity wins over the matching name');
  });
  it('merge: scenes move to the kept element; differing quantities in one scene are asked, never chosen; notes kept side by side', () => {
    let p = base();
    p = addNeed(p, 's17', 'vehicles', { name: 'SUV (black)' }).production;
    const a = idOf(p, 's17', 'vehicles', 'SUV (black)');
    const b = idOf(p, 's17', 'vehicles', 'Black SUV');
    p = setNeed(setNeed(p, 's17', a, { qty: 3, note: 'chase' }), 's17', b, { qty: 2, note: 'parked' });
    const ask = mergeElements(p, a, b);
    assert.deepEqual(ask.conflicts, [{ sceneId: 's17', into: 2, from: 3 }]);
    assert.deepEqual(ask.production, N(p), 'nothing changed');
    const done = mergeElements(p, a, b, { s17: 3 });
    assert.equal(done.production.elements[a], undefined);
    assert.deepEqual(el(done.production, 's17', 'vehicles', 'Black SUV'), { id: b, qty: 3, note: 'parked · chase' });
    assert.deepEqual(done.production.scenes.s17.vehicles, ['Black SUV']);
    assert.equal(mergeElements(p, a, idOf(p, 's3', 'props', 'Life jacket, orange')).error, 'category');
  });
  it('delete everywhere: out of every scene and the registry; undo by slice puts back exactly that', () => {
    const p = base();
    const suv = idOf(p, 's3', 'vehicles', 'Black SUV');
    const q = deleteElement(p, suv);
    assert.equal(q.elements[suv], undefined);
    assert.deepEqual(scenesNeeding(q, suv), []);
    const { sceneIds, elementIds } = changedParts(p, q);
    assert.deepEqual(sceneIds.sort(), ['s17', 's3', 's42']);
    const undone = applySlice(q, sliceOf(p, sceneIds, elementIds));
    assert.deepEqual(undone, p);
    assert.deepEqual(applySlice(undone, sliceOf(q, sceneIds, elementIds)), q, 'redo');
  });
  it('undo of an add that created an element takes the element back too; other changes since stay', () => {
    const p = base();
    const added = addAsset(p, 's3', 'props', 'Flare gun');
    const { sceneIds, elementIds } = changedParts(p, added);
    assert.equal(elementIds.length, 1);
    const later = addAsset(added, 's42', 'props', 'Rope'); // a later step
    const undone = applySlice(later, sliceOf(p, sceneIds, elementIds));
    assert.ok(!Object.values(undone.elements).some((e) => e.name === 'Flare gun'), 'no stray element');
    assert.ok(undone.scenes.s42.props.includes('Rope'), 'the later change stays');
  });
  it('undo of an element step never takes back Production Notes typed since in that scene', () => {
    const p = base();
    const added = addAsset(p, 's3', 'props', 'Flare gun');
    const { sceneIds, elementIds } = changedParts(p, added);
    const typed = setSceneNotes(added, 's3', 'Night shoot · flare at 2am');
    const undone = applySlice(typed, sliceOf(p, sceneIds, elementIds));
    assert.equal(undone.scenes.s3.notes, 'Night shoot · flare at 2am');
    assert.ok(!undone.scenes.s3.props.includes('Flare gun'));
    const fresh = addAsset(N({ version: 1, scenes: {} }), 'sNew', 'props', 'Rope');
    const parts = changedParts({ version: 1, scenes: {} }, fresh);
    const noted = setSceneNotes(fresh, 'sNew', 'Bring two');
    const back = applySlice(noted, sliceOf({ version: 1, scenes: {} }, parts.sceneIds, parts.elementIds));
    assert.equal(back.scenes.sNew.notes, 'Bring two', 'a scene the step created keeps notes typed since');
    assert.deepEqual(back.scenes.sNew.props, []);
  });
});

describe('unattached breakdowns, snapshots and backups', () => {
  it('a breakdown whose heading left keeps its links; attaching joins by identity, conflicting details set aside', () => {
    let p = N(LEGACY);
    const suv = idOf(p, 's3', 'vehicles', 'Black SUV');
    p = setNeed(setNeed(p, 's3', suv, { qty: 1 }), 's17', suv, { qty: 2 });
    const out = attachScene(p, 's3', 's17'); // s3's heading left; attach it to s17
    assert.equal(out.scenes.s3, undefined);
    assert.equal(el(out, 's17', 'vehicles', 'Black SUV').qty, 2, 'the scene’s own detail stays');
    assert.deepEqual(out.scenes.s17.unlinked.map((u) => [u.id, u.qty]), [[suv, 1]], 'the other is recoverable');
    assert.ok(out.scenes.s17.vehicles.includes('Ferry SAINTE-ROSE'));
    const undone = undoAttach(out, { fromId: 's3', fromEntry: p.scenes.s3, toId: 's17', toBefore: p.scenes.s17, toAfter: out.scenes.s17 });
    assert.deepEqual(undone.scenes.s3, p.scenes.s3);
    assert.deepEqual(undone.scenes.s17.links, p.scenes.s17.links);
  });
  it('snapshots and backups keep everything: links, quantities, notes, new categories, the registry', () => {
    let p = addNeed(N(LEGACY), 's3', 'vfx', { name: 'Storm sky' }).production;
    p = setNeed(p, 's3', idOf(p, 's3', 'extras', 'Ferry passengers (12)'), { qty: 12, note: 'Mixed' });
    const doc = { meta: { title: 'F' }, blocks: [makeBlock('scene', 'EXT. HARBOR')], production: p };
    assert.deepEqual(revisionToDoc(createRevision(doc)).production, p);
    const store = createProjectStore({ indexedDB: undefined });
    return store.saveActiveProject(doc).then((rec) => {
      assert.deepEqual(toDoc(parseBackup(serializeBackup(rec)).record).production, p);
    });
  });
  it('setSceneEntry keeps the projection consistent (no false "older build" edits)', () => {
    const p = N(LEGACY);
    const q = setSceneEntry(p, 's99', p.scenes.s3);
    assert.deepEqual(q.scenes.s99.links, p.scenes.s3.links);
    assert.equal(q.scenes.s99.unlinked, undefined);
  });
});

describe('scheduling: needs by identity, quantities never added up', () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const blocks = parseFountain(read('tests/browser/stripboard-fixture.fountain')).blocks.map((b) => makeBlock(b.type, b.text));
  const analysis = analyzeScript(blocks);
  const sceneIds = blocks.filter((b) => b.type === 'scene' && b.text.trim()).map((b) => b.id);
  const [A, B, C] = sceneIds;
  it('one element on a day, whatever number of its scenes; each scene’s quantity beside it; moves with the scenes', () => {
    let p = N({ version: 1, scenes: { [A]: { extras: ['Passengers'] }, [B]: { extras: ['passengers'] }, [C]: { extras: ['Passengers'] } } });
    const pax = idOf(p, A, 'extras', 'Passengers');
    p = setNeed(setNeed(p, A, pax, { qty: 20 }), B, pax, { qty: 12 });
    const rows = buildBreakdown({ blocks, analysis, production: p });
    assert.deepEqual(sceneNeeds(p.scenes[A], p.elements).extras.map((n) => [n.name, n.qty]), [['Passengers', 20]]);
    let s = addDay(null);
    const d1 = s.dayId;
    s = s.schedule;
    const add2 = addDay(s);
    const d2 = add2.dayId;
    s = moveScene(moveScene(moveScene(add2.schedule, A, d1), B, d1), C, d2);
    const day1 = scheduleModel(rows, s).days[0].requirements.extras;
    assert.equal(day1.length, 1, 'once');
    assert.deepEqual(day1[0].uses.map((u) => u.qty), [20, 12], 'never 32');
    assert.deepEqual(elementUsage(rows, s).get(pax).days, [1, 2]);
    assert.deepEqual(elementUsage(rows, moveScene(s, C, d1)).get(pax).days, [1], 'moving the scene moves the need');
    assert.deepEqual(elementUsage(rows, null).get(pax).scenes.map((u) => u.qty), [20, 12, undefined]);
  });
  it('an element no scene needs isn’t in the requirements or usage (but is still in the registry)', () => {
    let p = N({ version: 1, scenes: { [A]: { props: ['Radio'] } } });
    const radio = idOf(p, A, 'props', 'Radio');
    p = removeNeed(p, A, radio);
    const rows = buildBreakdown({ blocks, analysis, production: p });
    assert.equal(elementUsage(rows, null).has(radio), false);
    assert.ok(p.elements[radio]);
  });
  it('a day lists each element once with each scene’s own quantity and note, and the CSV has the eight categories', () => {
    let p = N({ version: 1, scenes: { [A]: { extras: ['Passengers'] }, [B]: { extras: ['Passengers'] } } });
    const pax = idOf(p, A, 'extras', 'Passengers');
    p = setNeed(setNeed(p, A, pax, { qty: 20, note: 'wet' }), B, pax, { qty: 12 });
    p = addNeed(p, A, 'vfx', { name: 'Storm sky' }).production;
    const rows = buildBreakdown({ blocks, analysis, production: p });
    assert.equal(needText({ name: 'Passengers', qty: 20, note: 'wet' }), 'Passengers ×20 (wet)');
    assert.equal(needText({ name: 'Storm sky' }), 'Storm sky');
    const one = addDay(null);
    const sched = moveScene(moveScene(one.schedule, A, one.dayId), B, one.dayId);
    const req = scheduleModel(rows, sched).days[0].requirements;
    assert.equal(needLabel(req.extras[0]), 'Passengers · sc 1 ×20 (wet), sc 2 ×12');
    assert.equal(needLabel(req.vfx[0]), 'Storm sky', 'nothing said, just the name');
    const lines = breakdownCsv(rows).trim().split('\r\n');
    assert.ok(lines[0].includes(`Speaking Cast,${CATEGORIES.map((c) => c.label).join(',')}`), lines[0]);
    assert.match(lines[1], /Passengers ×20 \(wet\)/);
    assert.match(lines[1], /Storm sky/);
    assert.match(lines[2], /Passengers ×12/);
  });
});
