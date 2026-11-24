// Shared production elements (Stage 2, Phase 2): one identity for a thing a production needs — the
// Black SUV, the ferry passengers, a rain-soaked coat — used by every scene that needs it.
//
// Stored inside project.production (no storage of its own; it travels with the project everywhere):
//
//   production.elements: { [elementId]: { id, category, name, from? } }   ← the registry
//   production.scenes[sceneHeadingId]:
//     links: { [category]: [{ id, qty?, note? }] }   ← what this scene needs: SOURCE OF TRUTH
//     extras / props / wardrobe / vehicles: [name…]  ← the four lists older DraftLines know: a PROJECTION
//     unlinked?: [{ id, category, name, qty?, note? }] ← links an older build's edit set aside (recoverable)
//
// Categories: eight since Phase 2 (CATEGORIES). Older builds know four lists, so each category projects
// into one of them (Hair & Makeup, Special Effects and Visual Effects into "Wardrobe & SFX", Stunts into
// "Vehicles & Stunts"): an older build still shows and keeps every item, and carries `links` and
// `elements` through untouched (lib/passThrough.js). Nothing is classified by its text: an item that came
// from the old "Wardrobe & SFX" list starts in Wardrobe with `from: 'wardrobe'` (it may be an effect),
// one from "Vehicles & Stunts" in Vehicles with `from: 'vehicles'`, until the writer says otherwise.
//
// The quantity and note are this scene's (20 extras here, 10 there: never added up). A quantity is a
// positive whole number or absent: absent means "not said", never 0 or 1.
//
// reconcile() runs whenever production is read (productionData.normalizeProduction). For each scene and
// each of the four lists it compares the stored names with the projection of the scene's links:
//   - the same (any order, any capitals): the links stand — the normal case, nothing changes;
//   - different (an older build edited the list): links whose name is still there stay; a name that's
//     gone takes its link to `unlinked` (with its quantity and note, recoverable, never dropped); a name
//     that comes back to the same scene's list gets that link back from `unlinked` (same identity,
//     quantity and note); any other new name links to the one element of that name in the list's
//     categories, or to a new element — and when several elements share that name (kept separate on
//     purpose) it doesn't guess: a new one.
// A project from before Phase 2 is the extreme case (no links at all): that's the migration. Element ids
// it creates come from the category and the name, so every tab, computer, snapshot and backup migrates
// the same project to the same ids, and opening a project writes nothing.

import { addUnknownFields } from './passThrough.js';

/** The eight categories, in the Breakdowns order, and the older list each one projects into. */
export const CATEGORIES = [
  { id: 'extras', label: 'Background / Extras', legacy: 'extras', placeholder: 'e.g. Ferry passengers' },
  { id: 'props', label: 'Props & Set Dressing', legacy: 'props', placeholder: 'e.g. Marie’s suitcase' },
  { id: 'wardrobe', label: 'Wardrobe', legacy: 'wardrobe', placeholder: 'e.g. Rain-soaked coat' },
  { id: 'makeup', label: 'Hair & Makeup', legacy: 'wardrobe', placeholder: 'e.g. Bruised cheek' },
  { id: 'vehicles', label: 'Vehicles', legacy: 'vehicles', placeholder: 'e.g. The ferry SAINTE-ROSE' },
  { id: 'stunts', label: 'Stunts', legacy: 'vehicles', placeholder: 'e.g. Fall from the gangway' },
  { id: 'sfx', label: 'Special Effects', legacy: 'wardrobe', placeholder: 'e.g. Rain on the deck' },
  { id: 'vfx', label: 'Visual Effects', legacy: 'wardrobe', placeholder: 'e.g. Storm sky extension' },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const CATEGORY_SET = new Set(CATEGORY_IDS);
/** The four lists every DraftLine since Plan knows, and their labels there. */
export const LEGACY_LISTS = [
  { id: 'extras', label: 'Background / Extras' },
  { id: 'props', label: 'Props & Set Dressing' },
  { id: 'wardrobe', label: 'Wardrobe & SFX' },
  { id: 'vehicles', label: 'Vehicles & Stunts' },
];
export const LEGACY_IDS = LEGACY_LISTS.map((l) => l.id);
const LEGACY_OF = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.legacy]));
const CATEGORIES_OF = Object.fromEntries(LEGACY_IDS.map((l) => [l, CATEGORIES.filter((c) => c.legacy === l).map((c) => c.id)]));
/** Where an item typed into an older list starts: its first category (the mixed lists remember `from`). */
const DEFAULT_OF = { extras: 'extras', props: 'props', wardrobe: 'wardrobe', vehicles: 'vehicles' };
const MIXED = new Set(['wardrobe', 'vehicles']);

const ELEMENT_KEYS = new Set(['id', 'category', 'name', 'from']);
const LINK_KEYS = new Set(['id', 'qty', 'note']);

export const cleanName = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
/** Names that differ only by capitals or spacing are the same name. */
export const nameKey = (v) => cleanName(v).toLowerCase();
export const legacyOf = (category) => LEGACY_OF[category] || null;
export const categoriesOf = (legacy) => CATEGORIES_OF[legacy] || [];
const plainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A short, stable hash (FNV-1a, 32 bits) for ids made from content. */
function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
/** A new element id (a writer's new element: random). */
export const newElementId = () => `el-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Stored registry → { [id]: element }. Unreadable entries are left out; a newer build's fields kept. */
export function normalizeElements(raw) {
  const out = {};
  if (!plainObject(raw)) return out;
  for (const [id, e] of Object.entries(raw)) {
    if (!id || id === '__proto__' || !plainObject(e) || e.id !== id || !cleanName(e.name)) continue;
    const el = { id, category: typeof e.category === 'string' && e.category ? e.category : 'props', name: cleanName(e.name) };
    if (MIXED.has(e.from)) el.from = e.from;
    addUnknownFields(el, e, ELEMENT_KEYS);
    out[id] = el;
  }
  return out;
}

function normalizeLink(raw) {
  if (!plainObject(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const link = { id: raw.id };
  if (Number.isInteger(raw.qty) && raw.qty > 0) link.qty = raw.qty;
  if (typeof raw.note === 'string' && raw.note.trim()) link.note = raw.note.trim();
  addUnknownFields(link, raw, LINK_KEYS);
  return link;
}
const hasDetail = (link) => link.qty !== undefined || link.note !== undefined;

/** What the projection of `links` (scene) is for older list `legacy`: names, once each (any case). */
export function projectNames(links, elements, legacy) {
  const seen = new Set();
  const out = [];
  for (const cat of categoriesOf(legacy)) {
    for (const l of links[cat] || []) {
      const name = elements[l.id]?.name;
      const key = nameKey(name);
      if (name && !seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
  }
  return out;
}
const sameNames = (a, b) => a.length === b.length && a.every((x) => b.some((y) => nameKey(y) === nameKey(x)));

/**
 * Bring links and lists together (see the header). `production` has clean lists (`scene[legacy]`, raw
 * `links`, `unlinked`) and a normalized `elements`; both are updated in place, deterministically.
 */
export function reconcile(production) {
  const { elements, scenes } = production;
  const ids = Object.keys(scenes).sort();
  // Elements by category and name, for linking a name.
  const byName = new Map();
  const index = (el) => {
    const k = `${el.category}\n${nameKey(el.name)}`;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(el.id);
  };
  for (const el of Object.values(elements)) index(el);
  // The spelling a shared element gets when it's first made from several scenes' items (migration):
  // the one used most, then one with capitals, then the earliest — so every scene keeps reading as it did.
  const spellings = new Map();
  for (const sid of ids) {
    for (const legacy of LEGACY_IDS) {
      for (const name of Array.isArray(scenes[sid][legacy]) ? scenes[sid][legacy] : []) {
        const k = `${legacy}\n${nameKey(name)}`;
        if (!spellings.has(k)) spellings.set(k, new Map());
        const m = spellings.get(k);
        m.set(name, (m.get(name) || 0) + 1);
      }
    }
  }
  const preferred = (legacy, name) => {
    const m = spellings.get(`${legacy}\n${nameKey(name)}`);
    if (!m) return name;
    return [...m.entries()].sort((a, b) => b[1] - a[1] || Number(b[0] !== b[0].toLowerCase()) - Number(a[0] !== a[0].toLowerCase()))[0][0];
  };
  const create = (category, name, seed, from) => {
    const base = `el-${fnv(`${seed}\n${category}\n${nameKey(name)}`)}`;
    let id = base;
    for (let n = 2; elements[id]; n += 1) id = `${base}-${n}`;
    const el = { id, category, name: cleanName(name) };
    if (from) el.from = from;
    elements[id] = el;
    index(el);
    return id;
  };

  for (const sid of ids) {
    const s = scenes[sid];
    const raw = plainObject(s.links) ? s.links : {};
    const links = {};
    const unlinked = Array.isArray(s.unlinked) ? s.unlinked.filter(plainObject) : [];
    const setAside = (link, category) => {
      const name = elements[link.id]?.name || '';
      unlinked.push({ ...link, category, ...(name ? { name } : {}) });
    };
    // Clean links: known categories, existing elements, each element once (in its own category).
    const placed = new Set();
    for (const [cat, list] of Object.entries(raw)) {
      if (!CATEGORY_SET.has(cat)) {
        links[cat] = list; // a newer build's category: kept exactly as it was
        continue;
      }
      for (const item of Array.isArray(list) ? list : []) {
        const link = normalizeLink(item);
        if (!link) continue;
        const el = elements[link.id];
        if (!el) { // its element is gone (e.g. dropped by an old build): the name list re-links it
          if (hasDetail(link)) setAside(link, cat);
          continue;
        }
        if (placed.has(link.id)) continue;
        placed.add(link.id);
        const home = CATEGORY_SET.has(el.category) ? el.category : cat;
        (links[home] ||= []).push(link);
      }
    }
    // Each older list against its projection.
    for (const legacy of LEGACY_IDS) {
      const stored = Array.isArray(s[legacy]) ? s[legacy] : [];
      const projected = projectNames(links, elements, legacy);
      if (sameNames(projected, stored)) continue;
      const keep = new Set(stored.map(nameKey));
      for (const cat of categoriesOf(legacy)) {
        if (!links[cat]) continue;
        links[cat] = links[cat].filter((l) => {
          if (keep.has(nameKey(elements[l.id].name))) return true;
          setAside(l, cat);
          return false;
        });
      }
      const have = new Set(projectNames(links, elements, legacy).map(nameKey));
      for (const name of stored) {
        const key = nameKey(name);
        if (have.has(key)) continue;
        have.add(key);
        // Set aside from this very scene and list earlier (an older build removed it, then it came back:
        // its undo, or typed again): the same identity, with its quantity and note. Certain, not a guess.
        const back = unlinked.findIndex((u) => categoriesOf(legacy).includes(u.category) && nameKey(u.name) === key && typeof u.id === 'string' && !placed.has(u.id));
        if (back >= 0) {
          const { category, name: was, ...rest } = unlinked.splice(back, 1)[0];
          const link = normalizeLink(rest);
          if (!elements[link.id]) { // its element was dropped (a DraftLine from before Phase 0): it comes back as it was
            elements[link.id] = { id: link.id, category, name: cleanName(was) || cleanName(name) };
            if (MIXED.has(legacy) && category === DEFAULT_OF[legacy]) elements[link.id].from = legacy;
            index(elements[link.id]);
          }
          placed.add(link.id);
          (links[elements[link.id].category] ||= []).push(link);
          continue;
        }
        const matches = categoriesOf(legacy).flatMap((cat) => byName.get(`${cat}\n${key}`) || []).filter((id) => !placed.has(id));
        const taken = categoriesOf(legacy).flatMap((cat) => byName.get(`${cat}\n${key}`) || []);
        let id;
        if (matches.length === 1 && taken.length === 1) id = matches[0]; // the one element of that name
        else if (!taken.length) id = create(DEFAULT_OF[legacy], preferred(legacy, name), '', MIXED.has(legacy) ? legacy : undefined);
        else id = create(DEFAULT_OF[legacy], name, `${sid}\n${legacy}`, MIXED.has(legacy) ? legacy : undefined); // several share the name: don't guess
        placed.add(id);
        (links[elements[id].category] ||= []).push({ id });
      }
    }
    for (const [cat, list] of Object.entries(links)) if (CATEGORY_SET.has(cat) && !list.length) delete links[cat];
    if (Object.keys(links).length) s.links = links;
    else delete s.links;
    // Set-aside links: every one is kept (no limit: an identity, quantity or note is never dropped to save
    // space). Only an exact copy of another is left out, so reconciling again never adds anything.
    const seenAside = new Set();
    const aside = unlinked.filter((u) => {
      const k = JSON.stringify(u);
      if (seenAside.has(k)) return false;
      seenAside.add(k);
      return true;
    });
    if (aside.length) s.unlinked = aside;
    else delete s.unlinked;
    for (const legacy of LEGACY_IDS) s[legacy] = projectNames(links, elements, legacy);
  }
  return production;
}

// ---- What the scenes need (derived, never stored) ------------------------------------------------

/** A scene's needs by category: [{ id, name, category, from?, qty?, note? }], in the scene's order. */
export function sceneNeeds(scene, elements) {
  const out = Object.fromEntries(CATEGORY_IDS.map((c) => [c, []]));
  for (const cat of CATEGORY_IDS) {
    for (const l of scene?.links?.[cat] || []) {
      const el = elements?.[l.id];
      if (!el) continue;
      out[cat].push({ id: el.id, name: el.name, category: cat, ...(el.from ? { from: el.from } : {}), ...(l.qty !== undefined ? { qty: l.qty } : {}), ...(l.note !== undefined ? { note: l.note } : {}) });
    }
  }
  return out;
}
