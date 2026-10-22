// Project library: every screenplay lives as one record in IndexedDB.
//
//   database "draftline_db"
//     store "projects"  (keyPath "id")
//       { id, title, author, credit, basedOn, draftVersion, draftDate, contact,
//         titleFont, titleSize, titleBold, script, beats, characters, storyNotes, storyDna, production,
//         pages, scenes, createdAt, updatedAt }
//       characters — the Project Bible's bios [{ id, name, primaryRole, secondaryRole, relationship, age,
//                    description, traits, backstory }] (older ones: a free-text `role`)
//       storyNotes — the Bible's notes { sections: [{ id, title, body }] } (see bible.js)
//       storyDna   — the Bible's story blueprint (see storyDna.js)
//       production — the Plan workspace's per-scene asset lists (see productionData.js); older
//                    projects have none and load with empty breakdowns
//     store "settings"  (keyPath "key")  — { key: 'activeProjectId', value }
//
// IndexedDB has no practical size limit for scripts (unlike localStorage's ~5 MB), writes
// are transactional, and it works offline. Zero dependencies: the native API, wrapped in
// promises. If IndexedDB is unavailable (some private windows, blocked storage) the same
// API runs in memory and `persistent` is false, so the app can warn that nothing is kept.
//
// The pre-library save (localStorage "draftline:script:v2" / its backup / v1) is migrated
// into the first project on first run, and left in place untouched as a safety copy.

import { ELEMENT_META, buildItems, makeBlock, paginate } from './screenplay.js';
import { migrateBlock } from './formatting.js';
import { normalizeBeats, validBeats } from './beats.js';
import { normalizeRevisions, revisionRecord } from './revisions.js';
import { migrateStoryBible, normalizeCharacters, normalizeStoryNotes, validCharacters } from './bible.js';
import { normalizeStoryDna } from './storyDna.js';
import { normalizeProduction } from './productionData.js';
import { newProjectMeta } from './authorDefaults.js';
import { DEFAULT_CREDIT, DEFAULT_TITLE_BOLD, DEFAULT_TITLE_FONT, DEFAULT_TITLE_SIZE } from './titleFonts.js';

export const DB_NAME = 'draftline_db';
export const DB_VERSION = 1;
export const STORE = 'projects';
const SETTINGS = 'settings';

/** localStorage keys from before the library (read once, for migration). */
export const LEGACY_KEYS = ['draftline:script:v2', 'draftline:script:v2:backup', 'draftline:script:v1'];
/** Settings key for the writer's own Story Glossary wording (all projects). */
export const DICTIONARY_KEY = 'structureDictionary';
/** Crash journal: the unsaved state written synchronously when the tab closes mid-save. */
export const JOURNAL_KEY = 'draftline:journal:v1';

/** Title page fields stored on the record (flat, beside the script). */
export const META_FIELDS = [
  'title', 'credit', 'author', 'basedOn', 'draftVersion', 'draftDate', 'contact', 'titleFont', 'titleSize', 'titleBold',
];

export const EMPTY_META = {
  title: '',
  credit: DEFAULT_CREDIT,
  author: '',
  basedOn: '',
  draftVersion: '',
  draftDate: '',
  contact: '',
  titleFont: DEFAULT_TITLE_FONT,
  titleSize: DEFAULT_TITLE_SIZE,
  titleBold: DEFAULT_TITLE_BOLD,
};

export function newProjectId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function validBlocks(blocks) {
  return Array.isArray(blocks) && blocks.length > 0
    && blocks.every((b) => b && typeof b.id === 'string' && ELEMENT_META[b.type] && typeof b.text === 'string');
}

/** Page and scene counts for the library cards (estimated: no on-screen measurement). */
export function projectStats(blocks) {
  const items = buildItems(blocks);
  return {
    pages: paginate(items).pageCount,
    scenes: blocks.filter((b) => b.type === 'scene' && b.text.trim()).length,
  };
}

/** Editor document ({ meta, blocks, beats }) → stored record. */
export function toRecord({
  id, meta = {}, blocks = [], beats = [], characters = [], storyNotes, storyDna, production, revisions, pages, scenes, isLocked,
}, now = Date.now()) {
  const rec = { id: id || newProjectId() };
  for (const k of META_FIELDS) rec[k] = meta[k] ?? EMPTY_META[k];
  rec.script = blocks;
  rec.beats = beats;
  rec.characters = characters;
  rec.storyNotes = normalizeStoryNotes(storyNotes);
  rec.storyDna = normalizeStoryDna(storyDna);
  rec.production = normalizeProduction(production);
  // Snapshots (revisions.js). Left out when the caller doesn't know them — saving then keeps
  // whatever the library already has (see saveActiveProject).
  if (revisions !== undefined) rec.revisions = normalizeRevisions(revisions);
  // Project Lock (Projects → padlock): no deleting, no import or snapshot restore over it. Left out
  // when the caller doesn't say — the editor's saves never do — so saving keeps it (saveActiveProject).
  if (isLocked !== undefined) rec.isLocked = isLocked === true;
  const est = pages == null || scenes == null ? projectStats(blocks) : null;
  rec.pages = pages ?? est.pages;
  rec.scenes = scenes ?? est.scenes;
  rec.createdAt = now;
  rec.updatedAt = now;
  return rec;
}

const pickBible = ({ storyNotes, storyDna }) => ({ storyNotes, storyDna });

/** Stored record → editor document. */
export function toDoc(rec) {
  const meta = { ...EMPTY_META };
  for (const k of META_FIELDS) if (rec[k] !== undefined) meta[k] = rec[k];
  return {
    id: rec.id,
    meta,
    blocks: validBlocks(rec.script) ? rec.script.map(migrateBlock) : [],
    beats: validBeats(rec.beats) ? normalizeBeats(rec.beats) : [],
    characters: validCharacters(rec.characters) ? normalizeCharacters(rec.characters) : [],
    // Notes from before Theme moved to Story DNA hand their Themes text over (bible.js).
    ...pickBible(migrateStoryBible(rec.storyNotes, rec.storyDna)),
    production: normalizeProduction(rec.production),
    revisions: normalizeRevisions(rec.revisions),
    isLocked: rec.isLocked === true,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

/** A snapshot → the editor document it restores (migrated like any stored project). */
export function revisionToDoc(rev) {
  const { revisions, id, createdAt, updatedAt, ...doc } = toDoc(revisionRecord(rev)); // eslint-disable-line no-unused-vars
  return doc;
}

const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

// ---- Backends: the four primitives the library needs --------------------------------

function promised(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Native IndexedDB backend. */
async function idbBackend(idb) {
  const db = await new Promise((resolve, reject) => {
    const r = idb.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(SETTINGS)) d.createObjectStore(SETTINGS, { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('IndexedDB could not be opened'));
    r.onblocked = () => reject(new Error('IndexedDB is blocked by another DraftLine tab'));
  });
  // Another tab upgrading the schema: let it, and stop using this connection.
  db.onversionchange = () => db.close();

  /** Run `fn(store)` in one transaction; resolves with fn's request result once committed. */
  const run = (name, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(name, mode);
    let value;
    const r = fn(t.objectStore(name));
    if (r) promised(r).then((v) => { value = v; }, () => {});
    t.oncomplete = () => resolve(value);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });

  return {
    kind: 'indexeddb',
    getAll: () => run(STORE, 'readonly', (s) => s.getAll()),
    get: (id) => run(STORE, 'readonly', (s) => s.get(id)),
    put: (rec) => run(STORE, 'readwrite', (s) => s.put(rec)),
    del: (id) => run(STORE, 'readwrite', (s) => s.delete(id)),
    getSetting: async (key) => (await run(SETTINGS, 'readonly', (s) => s.get(key)))?.value ?? null,
    setSetting: (key, value) => run(SETTINGS, 'readwrite', (s) => s.put({ key, value })),
  };
}

/** In-memory backend: same API, nothing survives a reload. */
function memoryBackend() {
  const rows = new Map();
  const settings = new Map();
  return {
    kind: 'memory',
    getAll: async () => [...rows.values()].map(clone),
    get: async (id) => (rows.has(id) ? clone(rows.get(id)) : undefined),
    put: async (rec) => { rows.set(rec.id, clone(rec)); },
    del: async (id) => { rows.delete(id); },
    getSetting: async (key) => settings.get(key) ?? null,
    setSetting: async (key, value) => { settings.set(key, value); },
  };
}

// ---- The library ------------------------------------------------------------------------

/**
 * @param {{ indexedDB?: IDBFactory | null, now?: () => number }} options
 *   indexedDB — defaults to the browser's; pass null (or have none) for the memory backend.
 *   now       — clock, injectable for tests.
 */
export function createProjectStore({ indexedDB = globalThis.indexedDB, now = Date.now } = {}) {
  let backendP = null;
  const backend = () => {
    backendP ??= (indexedDB ? idbBackend(indexedDB) : Promise.reject(new Error('no IndexedDB')))
      .catch(() => memoryBackend());
    return backendP;
  };
  // Writes run one after another, so a slow save can never land after a newer one.
  let queue = Promise.resolve();
  const serial = (fn) => {
    const p = queue.then(fn, fn);
    queue = p.catch(() => {});
    return p;
  };
  // updatedAt always moves forward, even for two saves in the same millisecond.
  let lastStamp = 0;
  const stamp = () => {
    lastStamp = Math.max(now(), lastStamp + 1);
    return lastStamp;
  };

  const store = {
    /** True once we know saves reach IndexedDB (false: memory only — warn the writer). */
    async isPersistent() {
      return (await backend()).kind === 'indexeddb';
    },

    /** All projects, most recently edited first. */
    async getAllProjects() {
      const all = await (await backend()).getAll();
      return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    async getProject(id) {
      return (await (await backend()).get(id)) || null;
    },

    /**
     * Insert or update a project. Accepts the editor's { id?, meta, blocks, beats, pages?, scenes? }.
     * Keeps createdAt on updates; returns the stored record.
     */
    saveActiveProject(projectData) {
      return serial(async () => {
        const b = await backend();
        const t = stamp();
        const rec = toRecord(projectData, t);
        if (projectData.id) {
          const prev = await b.get(projectData.id);
          if (prev?.createdAt) rec.createdAt = prev.createdAt;
          // A save that doesn't carry snapshots (crash-recovery journal, older callers) keeps them.
          if (projectData.revisions === undefined && prev?.revisions) rec.revisions = prev.revisions;
          // …and the Project Lock, which only setProjectLock changes.
          if (projectData.isLocked === undefined) rec.isLocked = prev?.isLocked === true;
        } else if (rec.isLocked === undefined) {
          rec.isLocked = false;
        }
        await b.put(rec);
        return rec;
      });
    },

    /**
     * Put a backed-up record (see backup.js) into the library exactly as it was: every field,
     * block ids, beats, Bible and title typography untouched. It keeps its id unless a project
     * with that id is already here — then it comes in beside it under a new id, so restoring
     * never overwrites anything. Returns { record, newId }.
     */
    restoreProject(record) {
      return serial(async () => {
        const b = await backend();
        const rec = clone(record);
        const taken = rec.id && (await b.get(rec.id));
        const newId = !rec.id || !!taken;
        if (newId) rec.id = newProjectId();
        const t = stamp();
        rec.createdAt = Number.isFinite(rec.createdAt) ? rec.createdAt : t;
        rec.updatedAt = t; // newest in the Projects list
        if (rec.pages == null || rec.scenes == null) Object.assign(rec, projectStats(rec.script));
        await b.put(rec);
        return { record: rec, newId };
      });
    },

    /**
     * Take in a newer copy of a project from the synced folder (folderSync.js) exactly as it is —
     * same id, same updatedAt — replacing the browser's older copy. Returns the stored record.
     */
    importRecord(record) {
      return serial(async () => {
        const b = await backend();
        const rec = clone(record);
        if (!rec.id) throw new Error('That script has no id');
        if (rec.pages == null || rec.scenes == null) Object.assign(rec, projectStats(rec.script));
        rec.updatedAt = Number.isFinite(rec.updatedAt) ? rec.updatedAt : stamp();
        lastStamp = Math.max(lastStamp, rec.updatedAt);
        await b.put(rec);
        return rec;
      });
    },

    /** A new, empty project (one blank scene heading), with the writer's author and contact. */
    createProject({ title = 'Untitled', meta = {}, blocks, beats = [], storage } = {}) {
      const script = blocks?.length ? blocks : [makeBlock('scene')];
      const m = storage === undefined ? newProjectMeta(meta) : newProjectMeta(meta, storage);
      return store.saveActiveProject({ meta: { ...EMPTY_META, ...m, title }, blocks: script, beats });
    },

    renameProject(id, title) {
      return serial(async () => {
        const b = await backend();
        const rec = await b.get(id);
        if (!rec) throw new Error('That project no longer exists');
        rec.title = title;
        rec.updatedAt = stamp();
        await b.put(rec);
        return rec;
      });
    },

    /**
     * Project Lock on or off (the Projects drawer's padlock). Stamped as an edit, so the synced
     * folder's copy picks it up and the newest copy wins on another computer. Returns the record.
     */
    setProjectLock(id, locked) {
      return serial(async () => {
        const b = await backend();
        const rec = await b.get(id);
        if (!rec) throw new Error('That project no longer exists');
        rec.isLocked = locked === true;
        rec.updatedAt = stamp();
        await b.put(rec);
        return rec;
      });
    },

    /** Clone a project as "[Title] (Copy)" with a new id. Returns the copy. */
    duplicateProject(id) {
      return serial(async () => {
        const b = await backend();
        const src = await b.get(id);
        if (!src) throw new Error('That project no longer exists');
        const t = stamp();
        // A copy is a fresh working draft: it starts unlocked.
        const copy = { ...clone(src), id: newProjectId(), title: `${src.title?.trim() || 'Untitled'} (Copy)`, createdAt: t, updatedAt: t, isLocked: false };
        await b.put(copy);
        return copy;
      });
    },

    /** Delete a project. Guarded: the last remaining project, and a locked one, can't be deleted. */
    deleteProject(id) {
      return serial(async () => {
        const b = await backend();
        const all = await b.getAll();
        const target = all.find((p) => p.id === id);
        if (!target) return false;
        if (target.isLocked === true) throw new Error(`“${target.title?.trim() || 'Untitled'}” is locked — unlock it in Projects to delete it`);
        if (all.length <= 1) throw new Error('You can’t delete your only script');
        await b.del(id);
        if ((await b.getSetting('activeProjectId')) === id) {
          const next = all.filter((p) => p.id !== id).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))[0];
          await b.setSetting('activeProjectId', next.id);
        }
        return true;
      });
    },

    /** Library-wide settings (not tied to one project), e.g. the Story Glossary wording. */
    async getSetting(key) {
      return (await backend()).getSetting(key);
    },

    setSetting(key, value) {
      return serial(async () => (await backend()).setSetting(key, value));
    },

    async getActiveProjectId() {
      return (await backend()).getSetting('activeProjectId');
    },

    setActiveProjectId(id) {
      return serial(async () => (await backend()).setSetting('activeProjectId', id));
    },
  };
  return store;
}

// ---- First run, migration and crash recovery -------------------------------------------

function readJSON(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The pre-library save, if any: latest → backup → v1. */
export function readLegacyDoc(storage) {
  for (const key of LEGACY_KEYS.slice(0, 2)) {
    const d = readJSON(storage, key);
    if (d && validBlocks(d.blocks)) {
      return { meta: { ...EMPTY_META, ...d.meta }, blocks: d.blocks.map(migrateBlock), beats: validBeats(d.beats) ? normalizeBeats(d.beats) : [] };
    }
  }
  const v1 = readJSON(storage, LEGACY_KEYS[2]);
  if (v1 && validBlocks(v1.blocks)) {
    return { meta: { ...EMPTY_META, title: v1.title || '', author: v1.author || '' }, blocks: v1.blocks.map(migrateBlock), beats: [] };
  }
  return null;
}

/** Write the crash journal (synchronous — safe to call from pagehide). */
export function writeJournal(storage, doc) {
  try {
    storage?.setItem(JOURNAL_KEY, JSON.stringify({ ...doc, journaledAt: Date.now() }));
    return true;
  } catch {
    return false; // too big or blocked: the regular save is still in flight
  }
}

export function clearJournal(storage) {
  try {
    storage?.removeItem(JOURNAL_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Open the library and pick the project to show:
 *   1. empty library → migrate the localStorage script (or create the sample) as project one;
 *   2. a crash journal newer than its stored project → saved into it first;
 *   3. the last active project (or the most recent one).
 * Returns { project (record), migrated, recovered, dictionary (your Story Glossary wording), persistent }.
 */
export async function bootLibrary({ store, storage, makeFirstDoc }) {
  let migrated = false;
  let all = await store.getAllProjects();
  if (!all.length) {
    const legacy = readLegacyDoc(storage);
    const doc = legacy || makeFirstDoc();
    const rec = await store.saveActiveProject(doc);
    await store.setActiveProjectId(rec.id);
    migrated = !!legacy;
    all = [rec];
  }

  let recovered = false;
  const journal = readJSON(storage, JOURNAL_KEY);
  if (journal?.id && validBlocks(journal.blocks)) {
    const target = all.find((p) => p.id === journal.id);
    if (target && (journal.journaledAt || 0) > (target.updatedAt || 0)) {
      await store.saveActiveProject(journal);
      recovered = true;
    }
  }
  clearJournal(storage);

  const activeId = await store.getActiveProjectId();
  const project = (activeId && (await store.getProject(activeId))) || (await store.getAllProjects())[0];
  if (project.id !== activeId) await store.setActiveProjectId(project.id);
  const dictionary = (await store.getSetting(DICTIONARY_KEY)) || {};
  return { project, migrated, recovered, dictionary, persistent: await store.isPersistent() };
}

/** "Last edited" wording for the library cards. */
// "just now", "12 min ago", "3 hr ago", "Yesterday", "Oct 3", "Oct 3, 2025".
export function relativeTime(ts, now = Date.now()) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = new Date(ts);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** The app's library (the browser's IndexedDB). */
export const projects = createProjectStore();

export const getAllProjects = () => projects.getAllProjects();
export const getProject = (id) => projects.getProject(id);
export const saveActiveProject = (data) => projects.saveActiveProject(data);
export const deleteProject = (id) => projects.deleteProject(id);
export const duplicateProject = (id) => projects.duplicateProject(id);
