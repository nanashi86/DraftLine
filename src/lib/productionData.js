// Production planning data (the Plan workspace): what's stored — the asset lists the writer adds
// to each scene. Small on purpose: it's loaded with the app (saving, backups); the breakdown
// arithmetic lives in productionEngine.js, loaded with the Plan workspace.
//
// The breakdown of every scene is derived from the script
// each time — nothing about the script is copied or changed — plus the asset lists the writer adds.
//
//   Derived (never stored):   scene number, slugline, INT / EXT, time of day, day or night,
//                             length in page eighths, speaking cast (with cast numbers)
//   Stored (project.production, saved in the .draftline file):
//     { version: 1, scenes: { [sceneHeadingId]: { extras: [], props: [], wardrobe: [], vehicles: [], notes: '' } },
//       castNumbers?: { [CUE NAME]: n }, schedule?: { days: [...], pagesTarget } }   (schedule: lib/schedule.js)
//
// castNumbers (optional): production cast numbers, fixed once production scheduling begins. Until then
// there is none, and cast numbers follow the script (most lines = 1). Once fixed, a number never
// changes meaning: new speaking characters get the next number, a rename (Characters → Rename) keeps
// it, and a character who no longer speaks keeps theirs too (retired, never reused). Only an explicit
// Renumber replaces them all. See productionEngine.js castNumbers.
//
// Unattached breakdowns: a breakdown is attached to its scene heading's id. When that heading leaves
// the script (deleted, merged into the scene above, turned into Action), its breakdown is kept, never
// deleted, and comes back by itself if the heading does (undo). Plan lists the ones still unattached
// (unattachedScenes) so the writer can attach them to another scene or remove them, on purpose.
//
// Asset lists are keyed by the scene heading's element id, which stays the same as the heading is
// edited or the scene moves, so a scene keeps its props wherever it ends up. Projects saved before
// planning existed simply have no `production` and load with empty breakdowns.


import { isEmptySchedule, normalizeSchedule } from './schedule.js';
import { addUnknownFields, jsonCopy } from './passThrough.js';
import {
  CATEGORY_IDS, categoriesOf, cleanName, legacyOf, nameKey, newElementId, normalizeElements, projectNames, reconcile,
} from './elements.js';

export const PRODUCTION_VERSION = 1;

// Forward compatibility (lib/passThrough.js, docs/specs/data-integrity.md): a newer DraftLine may store
// more in `production` (a schedule, a budget) or in a scene's entry. Those keys are carried through
// unchanged, and a higher `version` is never lowered, so an older copy saving the project loses nothing.
const PRODUCTION_KEYS = new Set(['version', 'scenes', 'castNumbers', 'schedule', 'elements']);

/**
 * The four name lists on every scene's breakdown, as every DraftLine since Plan stores them (Production
 * Notes is free text beside them). Since Phase 2 they're the projection of the scene's links to shared
 * elements in eight categories (lib/elements.js), which are the source of truth.
 */
export const PRODUCTION_BUCKETS = [
  { id: 'extras', label: 'Background / Extras', placeholder: 'e.g. Ferry passengers (12)' },
  { id: 'props', label: 'Props & Set Dressing', placeholder: 'e.g. Marie’s suitcase' },
  { id: 'wardrobe', label: 'Wardrobe & SFX', placeholder: 'e.g. Rain-soaked coat' },
  { id: 'vehicles', label: 'Vehicles & Stunts', placeholder: 'e.g. The ferry SAINTE-ROSE' },
];
const BUCKET_IDS = PRODUCTION_BUCKETS.map((b) => b.id);
const SCENE_KEYS = new Set([...BUCKET_IDS, 'notes', 'links', 'unlinked']);

export const emptyProduction = () => ({ version: PRODUCTION_VERSION, scenes: {} });
const emptyScene = () => ({ extras: [], props: [], wardrobe: [], vehicles: [], notes: '' });

const cleanItem = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
function cleanList(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const item = cleanItem(raw);
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
const sceneIsEmpty = (s) => BUCKET_IDS.every((k) => !s[k].length) && !s.notes.trim() && !s.links && !s.unlinked
  && !Object.keys(s).some((k) => !SCENE_KEYS.has(k)); // a newer build's data keeps the entry

/** Anything stored (or nothing) → a clean production object. Unreadable parts are dropped, never thrown on. */
export function normalizeProduction(raw) {
  const out = emptyProduction();
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (obj && Number.isInteger(obj.version) && obj.version > PRODUCTION_VERSION) out.version = obj.version;
  const scenes = obj && obj.scenes && typeof obj.scenes === 'object' && !Array.isArray(obj.scenes) ? obj.scenes : {};
  for (const [id, s] of Object.entries(scenes)) {
    if (!id || !s || typeof s !== 'object' || Array.isArray(s) || id === '__proto__') continue;
    const scene = emptyScene();
    for (const k of BUCKET_IDS) scene[k] = cleanList(s[k]);
    scene.notes = typeof s.notes === 'string' ? s.notes : '';
    if (s.links && typeof s.links === 'object' && !Array.isArray(s.links)) scene.links = jsonCopy(s.links);
    if (Array.isArray(s.unlinked)) scene.unlinked = jsonCopy(s.unlinked);
    addUnknownFields(scene, s, SCENE_KEYS);
    out.scenes[id] = scene;
  }
  // Shared elements: the registry, and every scene's links brought together with its lists (elements.js).
  out.elements = normalizeElements(obj?.elements);
  reconcile(out);
  for (const [id, scene] of Object.entries(out.scenes)) if (sceneIsEmpty(scene)) delete out.scenes[id];
  if (!Object.keys(out.elements).length) delete out.elements;
  const cast = normalizeCastNumbers(obj?.castNumbers);
  if (cast) out.castNumbers = cast;
  // lib/schedule.js: null when there are no days. A schedule in a shape this version doesn't know (a
  // newer DraftLine's) is kept exactly as it is, never dropped: scheduleIsReadable says so, and the
  // Stripboard then leaves scheduling off rather than overwrite it.
  if (obj?.schedule !== undefined) {
    const schedule = normalizeSchedule(obj.schedule);
    if (schedule) out.schedule = schedule;
    else if (!isEmptySchedule(obj.schedule)) out.schedule = jsonCopy(obj.schedule);
  }
  if (obj) addUnknownFields(out, obj, PRODUCTION_KEYS);
  return out;
}

/** Stored cast numbers → { NAME: n } (positive whole numbers, each used once), or null when none. */
export function normalizeCastNumbers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  const used = new Set();
  for (const [name, n] of Object.entries(raw)) {
    const key = cleanItem(name).toUpperCase();
    if (!key || key === '__PROTO__' || !Number.isInteger(n) || n < 1 || used.has(n) || key in out) continue;
    out[key] = n;
    used.add(n);
  }
  return Object.keys(out).length ? out : null;
}

// ---- Changing what scenes need (always through links: lib/elements.js) ---------------------------
//
// Every change below edits links and elements, then writes each scene's four lists from its links
// (project) before normalizing, so the lists never look like an older build's edit (reconcile).

/** A working copy, `fn(draft)` changes its links / elements, then lists projected and normalized. */
function change(production, fn) {
  const draft = jsonCopy(normalizeProduction(production));
  draft.elements ||= {};
  const out = fn(draft);
  for (const scene of Object.values(draft.scenes)) {
    scene.links ||= {};
    for (const legacy of BUCKET_IDS) scene[legacy] = projectNames(scene.links, draft.elements, legacy);
  }
  const p = normalizeProduction(draft);
  return out === undefined ? p : { ...out, production: p };
}
const sceneOf = (draft, sceneId) => (draft.scenes[sceneId] ||= { ...emptyScene(), links: {} });
const linksIn = (scene, category) => ((scene.links ||= {})[category] ||= []);
/** Elements in `categories` named `name` (any capitals or spacing). */
const named = (draft, categories, name) => Object.values(draft.elements || {})
  .filter((e) => categories.includes(e.category) && nameKey(e.name) === nameKey(name)).map((e) => e.id);
const placedIn = (scene, id) => CATEGORY_IDS.some((c) => (scene.links?.[c] || []).some((l) => l.id === id));

/**
 * Scene `sceneId` needs an element in `category`: an existing one ({ id }), or by name ({ name }):
 * the one element of that name in the category if there's exactly one (reuse: false makes a new one
 * anyway, kept separate), else a new one. Already there: nothing changes. → { production, id }
 */
export function addNeed(production, sceneId, category, { id = null, name = '', reuse = true, from } = {}) {
  if (!CATEGORY_IDS.includes(category)) return { production: normalizeProduction(production), id: null };
  let picked = null;
  const r = change(production, (d) => {
    const scene = sceneOf(d, sceneId);
    if (id) {
      if (!d.elements[id]) return {};
      picked = id;
    } else {
      const clean = cleanName(name);
      if (!clean) return {};
      const same = reuse ? named(d, [category], clean) : [];
      if (same.length === 1) picked = same[0];
      else {
        picked = newElementId();
        d.elements[picked] = { id: picked, category, name: clean, ...(from ? { from } : {}) };
      }
    }
    const el = d.elements[picked];
    if (!placedIn(scene, picked)) linksIn(scene, el.category).push({ id: picked });
    return {};
  });
  return { production: r.production, id: picked };
}

/** Scene `sceneId` no longer needs element `id` (other scenes keep it; the element stays registered). */
export function removeNeed(production, sceneId, id) {
  return change(production, (d) => {
    const scene = d.scenes[sceneId];
    if (!scene?.links) return;
    for (const c of Object.keys(scene.links)) if (Array.isArray(scene.links[c])) scene.links[c] = scene.links[c].filter((l) => l?.id !== id);
  });
}

/**
 * This scene's quantity and note for element `id`: { qty } a positive whole number, or null to say
 * none (never 0); { note } text, or '' for none. Fields not given are left as they are.
 */
export function setNeed(production, sceneId, id, { qty, note } = {}) {
  return change(production, (d) => {
    const scene = d.scenes[sceneId];
    for (const c of CATEGORY_IDS) {
      for (const l of scene?.links?.[c] || []) {
        if (l.id !== id) continue;
        if (qty !== undefined) {
          if (Number.isInteger(qty) && qty > 0) l.qty = qty;
          else delete l.qty;
        }
        if (note !== undefined) {
          if (typeof note === 'string' && note.trim()) l.note = note.trim();
          else delete l.note;
        }
      }
    }
  });
}

/** Rename element `id` everywhere (its identity stays; every scene shows the new name). */
export function renameElement(production, id, name) {
  const clean = cleanName(name);
  return change(production, (d) => {
    if (d.elements[id] && clean) d.elements[id].name = clean;
  });
}

/** Scenes where renaming element `id` to `name` would meet another element of that name in the same list. */
export function renameClashes(production, id, name) {
  const p = normalizeProduction(production);
  const el = p.elements?.[id];
  if (!el) return [];
  const legacy = legacyOf(el.category);
  const others = named(p, categoriesOf(legacy), name).filter((x) => x !== id);
  return Object.entries(p.scenes).filter(([, s]) => placedIn(s, id) && others.some((o) => placedIn(s, o))).map(([sid]) => sid);
}

/** Move element `id` (and every scene's link to it) to `category`; it's sorted now (`from` goes). */
export function reclassifyElement(production, id, category) {
  if (!CATEGORY_IDS.includes(category)) return normalizeProduction(production);
  return change(production, (d) => {
    const el = d.elements[id];
    if (!el) return;
    for (const scene of Object.values(d.scenes)) {
      for (const c of CATEGORY_IDS) {
        const list = scene.links?.[c];
        if (!list || c === category) continue;
        const moving = list.filter((l) => l.id === id);
        if (!moving.length) continue;
        scene.links[c] = list.filter((l) => l.id !== id);
        linksIn(scene, category).push(...moving);
      }
    }
    el.category = category;
    delete el.from;
  });
}

/** This scene gets its own copy of element `id` (same name and category), keeping its quantity and note. → { production, id } */
export function separateNeed(production, sceneId, id) {
  const copy = newElementId();
  const r = change(production, (d) => {
    const el = d.elements[id];
    const scene = d.scenes[sceneId];
    if (!el || !scene || !placedIn(scene, id)) return {};
    d.elements[copy] = { ...jsonCopy(el), id: copy };
    for (const c of CATEGORY_IDS) for (const l of scene.links?.[c] || []) if (l.id === id) l.id = copy;
    return {};
  });
  return { production: r.production, id: r.production.elements?.[copy] ? copy : null };
}

/**
 * Merge element `fromId` into `intoId` (same category): every scene that needed `fromId` needs
 * `intoId`, and `fromId` leaves the registry. Where a scene needed both, its two requirements meet:
 * notes are kept side by side ("a · b"); quantities that differ are NOT chosen for the writer — they come
 * back in `conflicts` ([{ sceneId, into, from }]) and nothing changes, until `resolve[sceneId]` says
 * which quantity (a number, or null for none). → { production, conflicts, error? }
 */
export function mergeElements(production, fromId, intoId, resolve = {}) {
  const p = normalizeProduction(production);
  const a = p.elements?.[fromId];
  const b = p.elements?.[intoId];
  if (!a || !b || fromId === intoId) return { production: p, conflicts: [], error: 'missing' };
  if (a.category !== b.category) return { production: p, conflicts: [], error: 'category' };
  const conflicts = [];
  for (const [sid, s] of Object.entries(p.scenes)) {
    const la = (s.links?.[a.category] || []).find((l) => l.id === fromId);
    const lb = (s.links?.[a.category] || []).find((l) => l.id === intoId);
    if (la && lb && la.qty !== undefined && lb.qty !== undefined && la.qty !== lb.qty && !(sid in resolve)) {
      conflicts.push({ sceneId: sid, into: lb.qty, from: la.qty });
    }
  }
  if (conflicts.length) return { production: p, conflicts };
  const next = change(p, (d) => {
    for (const [sid, s] of Object.entries(d.scenes)) {
      const list = s.links?.[a.category];
      if (!list) continue;
      const la = list.find((l) => l.id === fromId);
      if (!la) continue;
      const lb = list.find((l) => l.id === intoId);
      if (!lb) {
        la.id = intoId;
        continue;
      }
      if (sid in resolve) {
        if (Number.isInteger(resolve[sid]) && resolve[sid] > 0) lb.qty = resolve[sid];
        else delete lb.qty;
      } else if (lb.qty === undefined && la.qty !== undefined) lb.qty = la.qty;
      const notes = [lb.note, la.note].filter(Boolean);
      if (notes.length) lb.note = [...new Set(notes)].join(' · ');
      s.links[a.category] = list.filter((l) => l !== la);
    }
    delete d.elements[fromId];
  });
  return { production: next, conflicts: [] };
}

/** Delete element `id` everywhere: out of every scene and the registry (an explicit, undoable choice). */
export function deleteElement(production, id) {
  return change(production, (d) => {
    for (const scene of Object.values(d.scenes)) {
      for (const c of Object.keys(scene.links || {})) if (Array.isArray(scene.links[c])) scene.links[c] = scene.links[c].filter((l) => l?.id !== id);
      // …and its set-aside links: deleted on purpose, it never comes back through an older build's list.
      if (Array.isArray(scene.unlinked)) scene.unlinked = scene.unlinked.filter((u) => u?.id !== id);
    }
    delete d.elements[id];
  });
}

/** Scenes that need element `id`: [sceneId…] (attached or not). */
export const scenesNeeding = (production, id) => Object.entries(normalizeProduction(production).scenes)
  .filter(([, s]) => placedIn(s, id)).map(([sid]) => sid);

/** Every element some scene links to (attached or not): an element outside this set is unused. */
export function linkedIds(production) {
  const out = new Set();
  for (const s of Object.values(normalizeProduction(production).scenes)) {
    for (const c of CATEGORY_IDS) for (const l of s.links?.[c] || []) if (l?.id) out.add(l.id);
  }
  return out;
}

// ---- Undo: exactly the parts a step changed --------------------------------------------------------

/**
 * What an element step can change in a scene: its links and set-aside links (its four lists are their
 * projection). Never its Production Notes or anything else, so undoing a step never takes back notes
 * typed since (each step undoes only its own change).
 */
const needsOf = (scene) => ({ links: jsonCopy(scene?.links || {}), unlinked: jsonCopy(scene?.unlinked || []) });

/** Those parts of some scenes, and some elements (null where there's none), for applySlice. */
export function sliceOf(production, sceneIds = [], elementIds = []) {
  const p = normalizeProduction(production);
  return {
    scenes: Object.fromEntries(sceneIds.map((id) => [id, needsOf(p.scenes[id])])),
    elements: Object.fromEntries(elementIds.map((id) => [id, p.elements?.[id] ? jsonCopy(p.elements[id]) : null])),
  };
}
/** Put those scenes' links and those elements back as they were in a slice (everything else as it is now). */
export function applySlice(production, slice) {
  return change(production, (d) => {
    for (const [id, el] of Object.entries(slice.elements || {})) {
      if (el) d.elements[id] = jsonCopy(el);
      else delete d.elements[id];
    }
    for (const [id, part] of Object.entries(slice.scenes || {})) {
      const scene = sceneOf(d, id);
      scene.links = jsonCopy(part?.links || {});
      if (part?.unlinked?.length) scene.unlinked = jsonCopy(part.unlinked);
      else delete scene.unlinked;
    }
  });
}
/** Every scene (by its links) and element that differs between two productions (what a step changed). */
export function changedParts(before, after) {
  const a = normalizeProduction(before);
  const b = normalizeProduction(after);
  const differs = (x, y) => JSON.stringify(x ?? null) !== JSON.stringify(y ?? null);
  const sceneIds = [...new Set([...Object.keys(a.scenes), ...Object.keys(b.scenes)])].filter((id) => differs(needsOf(a.scenes[id]), needsOf(b.scenes[id])));
  const elementIds = [...new Set([...Object.keys(a.elements || {}), ...Object.keys(b.elements || {})])].filter((id) => differs(a.elements?.[id], b.elements?.[id]));
  return { sceneIds, elementIds };
}

// ---- The four lists (Breakdowns' tags until the eight categories show, and older callers) -----------

/** The breakdown stored for one scene (empty lists when there's none). */
export const sceneAssets = (production, sceneId) => ({ ...emptyScene(), ...(production?.scenes?.[sceneId] || {}) });

/**
 * Add an item to one of the four lists by name: the one element of that name among the list's
 * categories if there's exactly one (and the scene doesn't have it), else a new one — in Wardrobe or
 * Vehicles for the two mixed lists, remembering where it was typed (`from`). Blank or there: nothing.
 */
export function addAsset(production, sceneId, bucket, text) {
  if (!BUCKET_IDS.includes(bucket) || !cleanItem(text)) return normalizeProduction(production);
  const p = normalizeProduction(production);
  if (sceneAssets(p, sceneId)[bucket].some((x) => nameKey(x) === nameKey(text))) return p;
  const same = named(p, categoriesOf(bucket), text);
  if (same.length === 1) return addNeed(p, sceneId, p.elements[same[0]].category, { id: same[0] }).production;
  const mixed = bucket === 'wardrobe' || bucket === 'vehicles';
  return addNeed(p, sceneId, bucket, { name: text, reuse: false, ...(mixed ? { from: bucket } : {}) }).production;
}
/** Remove the item named `text` from one of the four lists (every element it stands for, in this scene only). */
export function removeAsset(production, sceneId, bucket, text) {
  if (!BUCKET_IDS.includes(bucket)) return normalizeProduction(production);
  return change(production, (d) => {
    const scene = d.scenes[sceneId];
    if (!scene?.links) return;
    for (const c of categoriesOf(bucket)) {
      if (scene.links[c]) scene.links[c] = scene.links[c].filter((l) => nameKey(d.elements[l.id]?.name) !== nameKey(text));
    }
  });
}
export function setSceneNotes(production, sceneId, notes) {
  return change(production, (d) => {
    sceneOf(d, sceneId).notes = typeof notes === 'string' ? notes : '';
  });
}

/**
 * Replace one of the four lists by names (older callers). Names already there keep their elements
 * (and quantities, notes); new ones link as addAsset does; ones left out are removed from this scene.
 */
export function setSceneBucket(production, sceneId, bucket, list) {
  if (!BUCKET_IDS.includes(bucket)) return normalizeProduction(production);
  const want = cleanList(list);
  let p = normalizeProduction(production);
  for (const name of sceneAssets(p, sceneId)[bucket]) if (!want.some((x) => nameKey(x) === nameKey(name))) p = removeAsset(p, sceneId, bucket, name);
  for (const name of want) p = addAsset(p, sceneId, bucket, name);
  return p;
}

/** Replace a scene's whole stored entry, or remove it with null (attach / remove and their undo). */
export function setSceneEntry(production, sceneId, entry) {
  return change(production, (d) => {
    if (entry) d.scenes[sceneId] = jsonCopy(entry);
    else delete d.scenes[sceneId];
  });
}

/**
 * Breakdowns whose scene heading isn't in the script any more (deleted, merged, turned into Action):
 * [{ id, entry }] in the stored order. Kept, never deleted; a heading that comes back (undo) takes its
 * breakdown back by itself. An empty heading still counts as its scene.
 */
export function unattachedScenes(production, blocks) {
  const headings = new Set((blocks || []).filter((b) => b.type === 'scene').map((b) => b.id));
  return Object.entries(normalizeProduction(production).scenes)
    .filter(([id]) => !headings.has(id))
    .map(([id, entry]) => ({ id, entry }));
}

/**
 * Attach an unattached breakdown to scene `toId`: its lists join that scene's (no duplicates, the
 * scene's own items first), its notes follow the scene's after a blank line, and the unattached entry
 * goes. Fields a newer DraftLine stored are kept (the scene's own win).
 */
export function attachScene(production, fromId, toId) {
  const p = normalizeProduction(production);
  const from = p.scenes[fromId];
  if (!from || fromId === toId) return p;
  return change(p, (d) => {
    const f = d.scenes[fromId];
    const to = sceneOf(d, toId);
    const merged = { ...f, ...to, links: jsonCopy(to.links || {}) };
    const aside = [...(to.unlinked || []), ...(f.unlinked || [])];
    // Its elements join the scene's (by identity); one the scene already has keeps the scene's own
    // quantity and note, and the other's are set aside (recoverable), never dropped.
    for (const [cat, list] of Object.entries(f.links || {})) {
      if (!CATEGORY_IDS.includes(cat)) {
        if (!(cat in merged.links)) merged.links[cat] = list;
        continue;
      }
      for (const l of list) {
        const there = CATEGORY_IDS.flatMap((c) => merged.links[c] || []).find((x) => x.id === l.id);
        if (!there) linksIn(merged, cat).push(l);
        else if ((l.qty !== undefined && l.qty !== there.qty) || (l.note !== undefined && l.note !== there.note)) {
          aside.push({ ...l, category: cat, name: d.elements[l.id]?.name || '' });
        }
      }
    }
    if (aside.length) merged.unlinked = aside;
    merged.notes = [to.notes, f.notes].map((n) => (n || '').trim()).filter(Boolean).join('\n\n');
    d.scenes[toId] = merged;
    delete d.scenes[fromId];
  });
}

// ---- Cast numbers ---------------------------------------------------------------------------------

/**
 * Cast numbers, as on a call sheet → Map name → number.
 *   No fixed numbers (before production scheduling): 1 is the character with the most lines, and the
 *   numbers follow the script as it changes (analysis order).
 *   Fixed numbers (production.castNumbers): each character keeps theirs; a speaking character without
 *   one is shown with the next free number after the highest ever given (fixCastNumbers stores it).
 */
export function castNumbers(analysis, fixed = null) {
  const list = (analysis?.characterList || []).map((c) => c.name);
  if (!fixed) return new Map(list.map((name, i) => [name, i + 1]));
  const out = new Map(Object.entries(fixed));
  let next = Math.max(0, ...out.values());
  for (const name of list) if (!out.has(name)) out.set(name, ++next);
  return out;
}

/** Fix the cast numbers as they are now (the first shooting day, or Renumber): { NAME: n }. */
export const freezeCastNumbers = (analysis) => Object.fromEntries(castNumbers(analysis));

/**
 * Fixed numbers plus the next free number for every speaking character who has none yet, or the same
 * object when nobody is new (so it can be stored only when it changes). Nobody is ever renumbered.
 */
export function extendCastNumbers(fixed, analysis) {
  if (!fixed) return fixed;
  const all = castNumbers(analysis, fixed);
  if (all.size === Object.keys(fixed).length) return fixed;
  return Object.fromEntries(all);
}

/**
 * A character renamed (Characters → Rename): the number goes with them. Renamed into a character who
 * already has a number, that one is kept and the old name's number is retired (never reused).
 */
export function renameCastNumber(fixed, oldName, newName) {
  const from = String(oldName || '').trim().toUpperCase();
  const to = String(newName || '').trim().toUpperCase();
  if (!fixed || !from || !to || from === to || !(from in fixed) || to in fixed) return fixed;
  const out = {};
  for (const [name, n] of Object.entries(fixed)) out[name === from ? to : name] = n;
  return out;
}

// ---- Undoing an attach precisely -----------------------------------------------------------------

/**
 * Take back attachScene(fromId → toId) without touching anything written since: the unattached
 * breakdown comes back as it was; the scene loses only the items the attach added (items the writer
 * added since stay), and gets its old notes back only if they haven't been edited since.
 *   fromEntry — the unattached entry before; toBefore / toAfter — the scene's entry before and after
 */
export function undoAttach(production, { fromId, fromEntry, toId, toBefore, toAfter }) {
  let p = normalizeProduction(production);
  if (!p.scenes[fromId]) p = setSceneEntry(p, fromId, fromEntry);
  if (!p.scenes[toId]) return p;
  const ids = (entry) => new Set(CATEGORY_IDS.flatMap((c) => (entry?.links?.[c] || []).map((l) => l.id)));
  const before = ids(toBefore);
  const added = [...ids(toAfter)].filter((id) => !before.has(id));
  return change(p, (d) => {
    const now = d.scenes[toId];
    for (const c of CATEGORY_IDS) if (now.links?.[c]) now.links[c] = now.links[c].filter((l) => !added.includes(l.id));
    if (now.notes === (toAfter?.notes ?? '')) now.notes = toBefore?.notes ?? '';
    if (JSON.stringify(now.unlinked || []) === JSON.stringify(toAfter?.unlinked || [])) {
      if (toBefore?.unlinked) now.unlinked = jsonCopy(toBefore.unlinked);
      else delete now.unlinked;
    }
    const empty = !toBefore && !CATEGORY_IDS.some((c) => now.links?.[c]?.length) && !now.notes.trim() && !now.unlinked;
    if (empty) delete d.scenes[toId];
  });
}
