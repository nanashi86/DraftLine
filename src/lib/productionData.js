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

export const PRODUCTION_VERSION = 1;

// Forward compatibility (lib/passThrough.js, docs/specs/data-integrity.md): a newer DraftLine may store
// more in `production` (a schedule, a budget) or in a scene's entry. Those keys are carried through
// unchanged, and a higher `version` is never lowered, so an older copy saving the project loses nothing.
const PRODUCTION_KEYS = new Set(['version', 'scenes', 'castNumbers', 'schedule']);

/** The tag lists on every scene's breakdown (Production Notes is free text beside them). */
export const PRODUCTION_BUCKETS = [
  { id: 'extras', label: 'Background / Extras', placeholder: 'e.g. Ferry passengers (12)' },
  { id: 'props', label: 'Props & Set Dressing', placeholder: 'e.g. Marie’s suitcase' },
  { id: 'wardrobe', label: 'Wardrobe & SFX', placeholder: 'e.g. Rain-soaked coat' },
  { id: 'vehicles', label: 'Vehicles & Stunts', placeholder: 'e.g. The ferry SAINTE-ROSE' },
];
const BUCKET_IDS = PRODUCTION_BUCKETS.map((b) => b.id);
const SCENE_KEYS = new Set([...BUCKET_IDS, 'notes']);

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
const sceneIsEmpty = (s) => BUCKET_IDS.every((k) => !s[k].length) && !s.notes.trim()
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
    addUnknownFields(scene, s, SCENE_KEYS);
    if (!sceneIsEmpty(scene)) out.scenes[id] = scene;
  }
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

/** The breakdown stored for one scene (empty lists when there's none). */
export const sceneAssets = (production, sceneId) => ({ ...emptyScene(), ...(production?.scenes?.[sceneId] || {}) });

function withScene(production, sceneId, change) {
  const p = normalizeProduction(production);
  const next = change(sceneAssets(p, sceneId));
  const scenes = { ...p.scenes };
  if (sceneIsEmpty(next)) delete scenes[sceneId];
  else scenes[sceneId] = next;
  return { ...p, scenes };
}

/** Add an item to a scene's list (ignored if blank or already there, any case). */
export function addAsset(production, sceneId, bucket, text) {
  if (!BUCKET_IDS.includes(bucket) || !cleanItem(text)) return normalizeProduction(production);
  return withScene(production, sceneId, (s) => ({ ...s, [bucket]: cleanList([...s[bucket], text]) }));
}
export function removeAsset(production, sceneId, bucket, text) {
  if (!BUCKET_IDS.includes(bucket)) return normalizeProduction(production);
  return withScene(production, sceneId, (s) => ({ ...s, [bucket]: s[bucket].filter((x) => x !== text) }));
}
export function setSceneNotes(production, sceneId, notes) {
  return withScene(production, sceneId, (s) => ({ ...s, notes: typeof notes === 'string' ? notes : '' }));
}

/** Replace one list on one scene (Plan's undo / redo of a tag added or removed: only that list). */
export function setSceneBucket(production, sceneId, bucket, list) {
  if (!BUCKET_IDS.includes(bucket)) return normalizeProduction(production);
  return withScene(production, sceneId, (s) => ({ ...s, [bucket]: cleanList(list) }));
}

/** Replace a scene's whole stored entry, or remove it with null (attach / remove and their undo). */
export function setSceneEntry(production, sceneId, entry) {
  const p = normalizeProduction(production);
  const scenes = { ...p.scenes };
  if (entry) scenes[sceneId] = entry;
  else delete scenes[sceneId];
  return normalizeProduction({ ...p, scenes });
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
  const to = sceneAssets(p, toId);
  const merged = { ...from, ...to };
  for (const k of BUCKET_IDS) merged[k] = cleanList([...to[k], ...from[k]]);
  merged.notes = [to.notes, from.notes].map((n) => n.trim()).filter(Boolean).join('\n\n');
  return setSceneEntry(setSceneEntry(p, toId, merged), fromId, null);
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
  const now = p.scenes[toId];
  if (!now) return p;
  const before = { ...emptyScene(), ...(toBefore || {}) };
  const after = { ...emptyScene(), ...(toAfter || {}) };
  const next = { ...now };
  for (const k of BUCKET_IDS) {
    const added = new Set(after[k].filter((x) => !before[k].includes(x)).map((x) => x.toLowerCase()));
    next[k] = now[k].filter((x) => !added.has(x.toLowerCase()));
  }
  if (now.notes === after.notes) next.notes = before.notes;
  const empty = BUCKET_IDS.every((k) => !next[k].length) && !next.notes.trim() && !toBefore;
  return setSceneEntry(p, toId, empty ? null : next);
}
