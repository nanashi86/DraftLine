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
//     { version: 1, scenes: { [sceneHeadingId]: { extras: [], props: [], wardrobe: [], vehicles: [], notes: '' } } }
//
// Asset lists are keyed by the scene heading's element id, which stays the same as the heading is
// edited or the scene moves, so a scene keeps its props wherever it ends up. Projects saved before
// planning existed simply have no `production` and load with empty breakdowns.


export const PRODUCTION_VERSION = 1;

/** The tag lists on every scene's breakdown (Production Notes is free text beside them). */
export const PRODUCTION_BUCKETS = [
  { id: 'extras', label: 'Background / Extras', placeholder: 'e.g. Ferry passengers (12)' },
  { id: 'props', label: 'Props & Set Dressing', placeholder: 'e.g. Marie’s suitcase' },
  { id: 'wardrobe', label: 'Wardrobe & SFX', placeholder: 'e.g. Rain-soaked coat' },
  { id: 'vehicles', label: 'Vehicles & Stunts', placeholder: 'e.g. The ferry SAINTE-ROSE' },
];
const BUCKET_IDS = PRODUCTION_BUCKETS.map((b) => b.id);

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
const sceneIsEmpty = (s) => BUCKET_IDS.every((k) => !s[k].length) && !s.notes.trim();

/** Anything stored (or nothing) → a clean production object. Unreadable parts are dropped, never thrown on. */
export function normalizeProduction(raw) {
  const out = emptyProduction();
  const scenes = raw && typeof raw === 'object' && raw.scenes && typeof raw.scenes === 'object' && !Array.isArray(raw.scenes) ? raw.scenes : {};
  for (const [id, s] of Object.entries(scenes)) {
    if (!id || !s || typeof s !== 'object') continue;
    const scene = emptyScene();
    for (const k of BUCKET_IDS) scene[k] = cleanList(s[k]);
    scene.notes = typeof s.notes === 'string' ? s.notes : '';
    if (!sceneIsEmpty(scene)) out.scenes[id] = scene;
  }
  return out;
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
