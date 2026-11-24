// Project library: every screenplay lives as one record in IndexedDB.
//
//   database "draftline_db"
//     store "projects"  (keyPath "id")
//       { id, title, author, credit, basedOn, draftVersion, draftDate, contact,
//         titleFont, titleSize, titleBold, showSceneNumbers, fdxIncludeNotes, script, beats, characters, storyNotes, storyDna, production,
//         pages, scenes, createdAt, updatedAt }
//       characters — the Project Bible's bios [{ id, name, primaryRole, secondaryRole, relationship, age,
//                    gender, description, traits, backstory }] (older ones: a free-text `role`)
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
import { createRevision, normalizeRevisions, revisionRecord } from './revisions.js';
import { migrateStoryBible, normalizeCharacters, normalizeStoryNotes, validCharacters } from './bible.js';
import { normalizeStoryDna } from './storyDna.js';
import { PRODUCTION_VERSION, normalizeProduction } from './productionData.js';
import { addUnknownFields, unknownFields } from './passThrough.js';
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
/** Crash journal (before Phase 1.5: one for every tab, read once and cleared). */
export const JOURNAL_KEY = 'draftline:journal:v1';
/** Crash journals now: one per tab, `${JOURNAL_PREFIX}${tabId}`, each naming the version it started from. */
export const JOURNAL_PREFIX = 'draftline:journal:v2:';

/** Title page fields stored on the record (flat, beside the script). */
export const META_FIELDS = [
  'title', 'credit', 'author', 'basedOn', 'draftVersion', 'draftDate', 'contact', 'titleFont', 'titleSize', 'titleBold',
  'showSceneNumbers', // export setting: scene numbers in the PDF and printout (off = spec, on = production)
  'fdxIncludeNotes', // export setting: margin notes go into .fdx files as Final Draft Script Notes (off = private)
];

/**
 * The project format this build writes. Records saved before the field existed read as 1; nothing
 * about their content changes. A newer DraftLine that changes the format in a way an older copy must
 * not edit raises it, and this build then opens such a project read-only and never saves over it
 * (isNewerProject, saveActiveProject). Additive changes don't need a raise: unknown fields are
 * carried through every save (lib/passThrough.js). docs/specs/data-integrity.md.
 */
export const PROJECT_SCHEMA_VERSION = 1;

/** Every top-level record field this build understands; anything else is carried through untouched. */
export const RECORD_FIELDS = new Set([
  'id', ...META_FIELDS, 'script', 'beats', 'characters', 'storyNotes', 'storyDna', 'production', 'revisions',
  'isLocked', 'viewOnly', 'pages', 'scenes', 'createdAt', 'updatedAt', 'schemaVersion',
  'writeId', // which save wrote this version (see revisionOf)
  'recoveredJournal', // a crash journal restored into this version (so restoring it again is a no-op)
]);

// ---- Versions: two tabs (or windows) on one project ---------------------------------------
//
// Every write gives the record a new `writeId`. A version is "updatedAt:writeId": a save from an older
// DraftLine (which doesn't know writeId and carries it over unchanged) still changes updatedAt, so it
// still counts as a new version. Each tab's store remembers the version of every project it last read
// into the editor or wrote itself (track / its own writes); a save of a tracked project is refused
// with a ConflictError unless the stored version is still that one. The check and the write happen in
// one IndexedDB transaction, and IndexedDB runs readwrite transactions one at a time across tabs, so
// two near-simultaneous saves can't both win. docs/specs/data-integrity.md has the whole design.

/** The stored version of a record: "updatedAt:writeId" (null for none). */
export const revisionOf = (rec) => (rec ? `${Number.isFinite(rec.updatedAt) ? rec.updatedAt : 0}:${rec.writeId || ''}` : null);

export const newWriteId = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * The project changed since this tab last had it: saved in another tab or window ('changed', with the
 * stored record as `stored`), or deleted there ('deleted'). Nothing was written.
 */
export class ConflictError extends Error {
  constructor(kind, stored = null) {
    super(kind === 'deleted' ? 'This script was deleted in another tab or window' : 'This script was changed in another tab or window');
    this.name = 'ConflictError';
    this.kind = kind;
    this.stored = stored;
  }
}

/** Two snapshot lists as one: every snapshot once (by id), in the order first seen. */
const unionRevisions = (...lists) => normalizeRevisions(lists.flatMap((l) => (Array.isArray(l) ? l : [])));

/** The record's project format (1 for records from before `schemaVersion` existed). */
export const projectSchemaOf = (rec) => (Number.isInteger(rec?.schemaVersion) && rec.schemaVersion > 0 ? rec.schemaVersion : 1);

/**
 * Was this project saved by a newer DraftLine in a format this build mustn't write? Then it opens
 * read-only (view, print and export still work) and saves are refused.
 */
export function isNewerProject(rec) {
  if (!rec || typeof rec !== 'object') return false;
  if (projectSchemaOf(rec) > PROJECT_SCHEMA_VERSION) return true;
  const v = rec.production?.version;
  return Number.isInteger(v) && v > PRODUCTION_VERSION;
}

/** Thrown by saveActiveProject instead of overwriting a newer DraftLine's project. */
export class NewerProjectError extends Error {
  constructor(title = '') {
    super(`“${title || 'Untitled'}” was saved by a newer version of DraftLine. Update DraftLine to edit it.`);
    this.name = 'NewerProjectError';
    this.code = 'NEWER_PROJECT';
  }
}

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
  showSceneNumbers: false, // spec scripts go out unnumbered; production drafts turn this on
  fdxIncludeNotes: false, // margin notes stay private unless the writer includes them in a Final Draft export
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
  id, meta = {}, blocks = [], beats = [], characters = [], storyNotes, storyDna, production, revisions, pages, scenes, isLocked, viewOnly, extra,
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
  // Viewing (status bar badge, Ctrl+Alt+L): no edits while it's on. Unlike the Project Lock it's part
  // of the editor's document, so every editor save sends it; left out (an older crash journal) it's kept.
  if (viewOnly !== undefined) rec.viewOnly = viewOnly === true;
  const est = pages == null || scenes == null ? projectStats(blocks) : null;
  rec.pages = pages ?? est.pages;
  rec.scenes = scenes ?? est.scenes;
  rec.createdAt = now;
  rec.updatedAt = now;
  rec.schemaVersion = PROJECT_SCHEMA_VERSION;
  // A newer DraftLine's fields, as the document carried them in (toDoc's `extra`). Never over a known field.
  addUnknownFields(rec, extra, RECORD_FIELDS);
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
    viewOnly: rec.viewOnly === true, // scripts from before the Viewing setting was saved open editable
    // Fields from a newer DraftLine: kept beside the document and handed back on save, untouched.
    extra: unknownFields(rec, RECORD_FIELDS),
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

/** A snapshot → the editor document it restores (migrated like any stored project). */
export function revisionToDoc(rev) {
  const { revisions, id, createdAt, updatedAt, ...doc } = toDoc(revisionRecord(rev)); // eslint-disable-line no-unused-vars
  // A newer DraftLine's fields captured with the snapshot come back too (never as known fields).
  doc.extra = unknownFields(rev?.extra, RECORD_FIELDS);
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

  /**
   * Read one project and write it back in ONE readwrite transaction: `fn(prev)` (synchronous) returns
   * { put } to store, { remove: true } to delete, or nothing to leave it; throwing aborts and
   * rejects with that error. Resolves with fn's return value once committed.
   */
  const update = (id, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    let out;
    let failure = null;
    const r = s.get(id);
    r.onsuccess = () => {
      try {
        out = fn(r.result);
        if (out?.put) s.put(out.put);
        else if (out?.remove) s.delete(id);
      } catch (e) {
        failure = e;
        try { t.abort(); } catch { /* already finished */ }
      }
    };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(failure || t.error);
    t.onabort = () => reject(failure || t.error || new Error('Transaction aborted'));
  });

  return {
    kind: 'indexeddb',
    update,
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
    update: async (id, fn) => {
      const out = fn(rows.has(id) ? clone(rows.get(id)) : undefined);
      if (out?.put) rows.set(id, clone(out.put));
      else if (out?.remove) rows.delete(id);
      return out;
    },
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
  // This tab's version of each project it has in hand (see revisionOf): set by track() when the editor
  // takes a record in, and by every write this store makes. Saves of a tracked project check it.
  const bases = new Map();
  // Every write this store makes, for whoever listens (App tells the other tabs: lib/tabSync.js).
  const listeners = new Set();
  const told = (m) => {
    for (const fn of listeners) {
      try { fn(m); } catch { /* a listener's problem isn't the save's */ }
    }
  };
  const wrote = (rec) => {
    if (rec?.id) {
      bases.set(rec.id, revisionOf(rec));
      told({ type: 'saved', id: rec.id, revision: revisionOf(rec) });
    }
    return rec;
  };
  /** The checks a guarded save makes against the stored record (in the write's transaction). */
  const guardAgainst = (id, prev, expect) => {
    if (expect === undefined) return;
    if (!prev) throw new ConflictError('deleted');
    if (revisionOf(prev) !== expect) throw new ConflictError('changed', prev);
  };
  /** The saved record for the editor's document `projectData`, merged with what's stored (prev). */
  const merged = (projectData, prev, t) => {
    const rec = toRecord(projectData, t);
    rec.writeId = newWriteId();
    if (prev) {
      // Never write over a project a newer DraftLine saved in a format this build doesn't know.
      if (isNewerProject(prev)) throw new NewerProjectError(prev.title);
      // Fields this build doesn't know (a newer DraftLine's) survive the save, even when the caller
      // didn't carry them (the crash journal, older call sites). The document's own copy wins.
      addUnknownFields(rec, unknownFields(prev, RECORD_FIELDS), RECORD_FIELDS);
      if (prev.createdAt) rec.createdAt = prev.createdAt;
      // A save that doesn't carry snapshots (crash-recovery journal, older callers) keeps them.
      if (projectData.revisions === undefined && prev.revisions) rec.revisions = prev.revisions;
      // …and the Project Lock, which only setProjectLock changes.
      if (projectData.isLocked === undefined) rec.isLocked = prev.isLocked === true;
      if (projectData.viewOnly === undefined) rec.viewOnly = prev.viewOnly === true;
    } else {
      if (rec.isLocked === undefined) rec.isLocked = false;
      if (rec.viewOnly === undefined) rec.viewOnly = false;
    }
    return rec;
  };
  /** A snapshot of a whole stored record (script, Board, Bible, characters, Plan, unknown fields). */
  const snapshotOf = (rec, label) => createRevision(toDoc(rec), { label, pages: rec.pages });

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

    /** Hear about every write this store makes: fn({ type: 'saved' | 'deleted', id, revision }). → unsubscribe */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** This tab now has `rec` in the editor: later saves of it check that it's still the stored version. */
    track(rec) {
      if (rec?.id) bases.set(rec.id, revisionOf(rec)); // a read: nothing to tell other tabs
    },
    /** The version of project `id` this tab has in hand (null: not tracked). */
    baseOf(id) {
      return bases.get(id) ?? null;
    },
    /** Stop checking project `id` (it was deleted or closed here). */
    forget(id) {
      bases.delete(id);
    },

    /**
     * Insert or update a project. Accepts the editor's { id?, meta, blocks, beats, pages?, scenes? }.
     * Keeps createdAt on updates; returns the stored record.
     *
     * A project this tab tracks is only written if the stored version is still the one this tab has
     * (options.expect overrides it; null means "don't check"): otherwise a ConflictError, and nothing is
     * written. options.snapshotPrevious (a label): the stored version is kept as a snapshot in the new
     * one — the "Keep this version" of a conflict, decided against exactly what's being replaced.
     */
    saveActiveProject(projectData, { expect, snapshotPrevious = null, recoveredJournal = null } = {}) {
      return serial(async () => {
        const b = await backend();
        const t = stamp();
        const id = projectData.id;
        if (!id) {
          const rec = merged(projectData, null, t);
          await b.put(rec);
          return wrote(rec);
        }
        const check = expect !== undefined ? (expect ?? undefined) : bases.get(id);
        const out = await b.update(id, (prev) => {
          guardAgainst(id, prev, check);
          const rec = merged(projectData, prev, t);
          if (recoveredJournal) rec.recoveredJournal = recoveredJournal;
          if (snapshotPrevious && prev) rec.revisions = unionRevisions(prev.revisions, rec.revisions, [snapshotOf(prev, snapshotPrevious)]);
          return { put: rec };
        });
        return wrote(out.put);
      });
    },

    /**
     * "Use the other version" of a conflict: the stored record stays as it is, with this tab's
     * document added as a snapshot (and this tab's snapshots kept) — only if the stored version is
     * still `expect` (else a ConflictError: ask again). Returns the stored record, now tracked.
     */
    keepStoredWithSnapshot(id, doc, { expect, label }) {
      return serial(async () => {
        const b = await backend();
        const t = stamp();
        const out = await b.update(id, (prev) => {
          guardAgainst(id, prev, expect);
          if (isNewerProject(prev)) throw new NewerProjectError(prev.title);
          const mine = createRevision(doc, { label, pages: doc.pages });
          const rec = { ...prev, revisions: unionRevisions(prev.revisions, doc.revisions, [mine]), updatedAt: t, writeId: newWriteId() };
          return { put: rec };
        });
        return wrote(out.put);
      });
    },

    /**
     * Add `revision` to project `id`'s snapshots (crash recovery), whatever its version, unless it's
     * already there (same id: recovering twice adds it once). Returns the record, or null if the
     * project is gone. Doesn't track it: this tab hasn't taken that version into its editor.
     */
    addSnapshot(id, revision) {
      return serial(async () => {
        const b = await backend();
        const t = stamp();
        const out = await b.update(id, (prev) => {
          if (!prev) return { gone: true };
          if (isNewerProject(prev)) throw new NewerProjectError(prev.title);
          if ((prev.revisions || []).some((r) => r?.id === revision.id)) return { same: prev };
          return { put: { ...prev, revisions: unionRevisions(prev.revisions, [revision]), updatedAt: t, writeId: newWriteId() } };
        });
        if (out.put) told({ type: 'saved', id, revision: revisionOf(out.put) });
        return out.gone ? null : out.put || out.same;
      });
    },

    /**
     * A project deleted in another tab, brought back from this tab's document (the writer chose
     * Restore). Only while it's still gone: if it came back meanwhile, a ConflictError('changed').
     */
    restoreDeleted(projectData) {
      return serial(async () => {
        const b = await backend();
        const t = stamp();
        const out = await b.update(projectData.id, (prev) => {
          if (prev) throw new ConflictError('changed', prev);
          return { put: merged(projectData, null, t) };
        });
        return wrote(out.put);
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
        rec.writeId = newWriteId();
        if (rec.pages == null || rec.scenes == null) Object.assign(rec, projectStats(rec.script));
        await b.put(rec);
        return { record: wrote(rec), newId };
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
        rec.writeId = newWriteId(); // a version of its own in this browser (other tabs see the change)
        await b.put(rec);
        return wrote(rec);
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
        const t = stamp();
        const out = await b.update(id, (rec) => {
          if (!rec) throw new Error('That project no longer exists');
          return { put: { ...rec, title, updatedAt: t, writeId: newWriteId() } };
        });
        return wrote(out.put);
      });
    },

    /**
     * Project Lock on or off (the Projects drawer's padlock). Stamped as an edit, so the synced
     * folder's copy picks it up and the newest copy wins on another computer. Returns the record.
     */
    setProjectLock(id, locked) {
      return serial(async () => {
        const b = await backend();
        const t = stamp();
        const out = await b.update(id, (rec) => {
          if (!rec) throw new Error('That project no longer exists');
          return { put: { ...rec, isLocked: locked === true, updatedAt: t, writeId: newWriteId() } };
        });
        return wrote(out.put);
      });
    },

    /** Clone a project as "[Title] (Copy)" with a new id. Returns the copy. */
    duplicateProject(id) {
      return serial(async () => {
        const b = await backend();
        const src = await b.get(id);
        if (!src) throw new Error('That project no longer exists');
        const t = stamp();
        // A copy is a fresh working draft: it starts unlocked and editable.
        const copy = {
          ...clone(src), id: newProjectId(), title: `${src.title?.trim() || 'Untitled'} (Copy)`, createdAt: t, updatedAt: t, isLocked: false, viewOnly: false,
          writeId: newWriteId(),
        };
        delete copy.recoveredJournal;
        await b.put(copy);
        told({ type: 'saved', id: copy.id, revision: revisionOf(copy) });
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
        bases.delete(id);
        told({ type: 'deleted', id, revision: null });
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
/**
 * Journal the editor's unsaved state synchronously (the tab is being hidden or closed mid-save).
 * With `tabId`, the tab's own journal: { jid, id, base (the version it started from), journaledAt, … };
 * without, the shared one older builds wrote (JOURNAL_KEY).
 */
export function writeJournal(storage, doc, { tabId = null, base = null } = {}) {
  try {
    const at = Date.now();
    const entry = tabId ? { ...doc, jid: `${tabId}-${at.toString(36)}`, base, journaledAt: at } : { ...doc, journaledAt: at };
    storage?.setItem(tabId ? `${JOURNAL_PREFIX}${tabId}` : JOURNAL_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false; // too big or blocked: the regular save is still in flight
  }
}

/** Remove this tab's journal (its save went through), or the shared one with no tabId. */
export function clearJournal(storage, tabId = null) {
  try {
    storage?.removeItem(tabId ? `${JOURNAL_PREFIX}${tabId}` : JOURNAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Every journal key in `storage`: the shared one, then each tab's. */
function journalKeys(storage) {
  const keys = [];
  try {
    for (let i = 0; i < (storage?.length || 0); i += 1) {
      const k = storage.key(i);
      if (k === JOURNAL_KEY || k?.startsWith(JOURNAL_PREFIX)) keys.push(k);
    }
  } catch { /* storage blocked: nothing to recover */ }
  return keys;
}

const tabOfKey = (key) => (key.startsWith(JOURNAL_PREFIX) ? key.slice(JOURNAL_PREFIX.length) : null);

/**
 * Crash journals left by tabs that are gone, reconciled with the library. Never over newer work:
 *   - nothing saved since the tab's version (`base`): its state is saved into the project (restored);
 *   - saved since (another tab): its state becomes a snapshot of the project, which is left as it is;
 *   - the project is gone (deleted elsewhere): the journal is kept and returned in `orphans`, for the
 *     writer to restore or discard on purpose;
 *   - the shared journal of an older build: its old rule (restored when newer than the project).
 * A journal is removed only once its state is in the library. Doing this twice changes nothing more
 * (recoveredJournal / the snapshot's id). `liveTabs`: tabs still open, whose journals are left alone.
 */
export async function reconcileJournals({ store, storage, liveTabs = new Set() }) {
  const out = { recovered: null, preserved: 0, orphans: [] };
  const entries = [];
  for (const key of journalKeys(storage)) {
    const tab = tabOfKey(key);
    if (tab && liveTabs.has(tab)) continue;
    const j = readJSON(storage, key);
    if (!j?.id || !validBlocks(j.blocks)) {
      try { storage.removeItem(key); } catch { /* ignore */ }
      continue;
    }
    entries.push({ key, j, legacy: !tab });
  }
  entries.sort((a, b) => (a.j.journaledAt || 0) - (b.j.journaledAt || 0));
  for (const { key, j, legacy } of entries) {
    const drop = () => {
      try { storage.removeItem(key); } catch { /* ignore */ }
    };
    try {
      const target = await store.getProject(j.id);
      if (!target) {
        if (!legacy) out.orphans.push({ key, journal: j });
        else drop(); // an older build's journal for a project that's gone: as before
        continue;
      }
      if (isNewerProject(target)) continue; // never into a newer format; kept for a later DraftLine
      if (legacy) {
        if ((j.journaledAt || 0) > (target.updatedAt || 0)) {
          out.recovered = await store.saveActiveProject(j, { expect: null });
        }
        drop();
        continue;
      }
      const snapId = `journal-${j.jid}`;
      if (target.recoveredJournal === j.jid || (target.revisions || []).some((r) => r?.id === snapId)) {
        drop(); // already in the library
        continue;
      }
      if (j.base && revisionOf(target) === j.base) {
        try {
          out.recovered = await store.saveActiveProject(j, { expect: j.base, recoveredJournal: j.jid });
          drop();
          continue;
        } catch (e) {
          if (e?.name !== 'ConflictError') throw e; // changed this instant: keep it as a snapshot instead
        }
      }
      const label = `Unsaved changes from a closed tab · ${new Date(j.journaledAt || Date.now()).toLocaleString()}`;
      const rev = createRevision(j, { label, id: snapId, now: j.journaledAt || Date.now() });
      if (await store.addSnapshot(j.id, rev)) {
        out.preserved += 1;
        drop();
      }
    } catch {
      /* storage failed: the journal stays, and is tried again next time */
    }
  }
  return out;
}

/**
 * Open the library and pick the project to show:
 *   1. empty library → migrate the localStorage script (or create the sample) as project one;
 *   2. crash journals from closed tabs → reconciled (reconcileJournals);
 *   3. the last active project (or the most recent one).
 * Returns { project (record), migrated, recovered, preserved, orphans, dictionary, persistent }.
 */
export async function bootLibrary({ store, storage, makeFirstDoc, liveTabs }) {
  let migrated = false;
  let fresh = false; // nothing here and nothing to migrate: a brand-new writer (lib/hints.js onboardHints)
  if (!(await store.getAllProjects()).length) {
    const legacy = readLegacyDoc(storage);
    const doc = legacy || makeFirstDoc();
    const rec = await store.saveActiveProject(doc);
    await store.setActiveProjectId(rec.id);
    migrated = !!legacy;
    fresh = !legacy;
  }

  const journals = await reconcileJournals({ store, storage, liveTabs });
  const activeId = await store.getActiveProjectId();
  const project = (activeId && (await store.getProject(activeId))) || (await store.getAllProjects())[0];
  if (project.id !== activeId) await store.setActiveProjectId(project.id);
  const dictionary = (await store.getSetting(DICTIONARY_KEY)) || {};
  return {
    project, migrated, fresh, recovered: !!journals.recovered, preserved: journals.preserved, orphans: journals.orphans,
    dictionary, persistent: await store.isPersistent(),
  };
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
