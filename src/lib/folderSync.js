// Folder sync: keep every script as a .draftline file in a folder the writer picks — a Google
// Drive / Dropbox / OneDrive folder on their computer, or any local folder — using the browser's
// File System Access API (Chrome, Edge, Opera, Arc… on desktop).
//
//   [Your folder]/
//     The-Last-Ferry.draftline                  ← the script, rewritten on every auto-save
//     What-Happened-to-Haiti.draftline
//     Snapshots/
//       The-Last-Ferry_2026-10-21_0612.draftline ← one file per snapshot
//
// IndexedDB stays the ground truth: every save goes there first (instant, offline-safe), and only
// then to the folder. If the folder write fails (permission withdrawn, drive unplugged) the
// script is still safe in the browser and the status bar says sync is paused.
//
// Files are ordinary .draftline backups (backup.js), so any of them also opens with Open on
// another computer. Scripts are matched by the project id inside the file, never by file name:
// renaming a script, two scripts with the same title, or the same script edited on two
// computers through Drive all resolve by id, and the newest `updatedAt` wins.
//
// Browsers without showDirectoryPicker (Safari, Firefox, phones) never see the folder option.

import { BACKUP_EXT, createBackup, parseBackup, serializeBackup, backupFileName } from './backup.js';
import { revisionRecord } from './revisions.js';

/** Settings keys (in the library's IndexedDB settings store). */
export const HANDLE_KEY = 'draftline_synced_directory_handle';
export const DESTINATION_KEY = 'draftline_storage_destination'; // 'browser' | 'folder'
export const FILES_KEY = 'draftline_synced_files'; // { [projectId]: fileName } — files DraftLine wrote
/** Snapshot files live in this subfolder (visible in Explorer / Finder / Drive, unlike a dot-folder). */
export const SNAPSHOT_DIR = 'Snapshots';
export const TRASH_DIR = 'Trash'; // deleted scripts' files go here, not away (only top-level files are scripts)
const RW = { mode: 'readwrite' };

/** Can this browser link a folder at all? */
export const isFolderSyncSupported = (win = globalThis) => typeof win?.showDirectoryPicker === 'function';

/** "What Happened to Haiti?" → "What-Happened-to-Haiti" (the same slug as Backup Project). */
export const scriptSlug = (title) => backupFileName(title).slice(0, -BACKUP_EXT.length);

/**
 * The script's file name in the folder: "<slug>.draftline", or "<slug>-<id>.draftline" when a
 * different script already has that name. `ownerOf(name)` → the project id using a name, or null.
 */
export function projectFileName(title, id, ownerOf = () => null) {
  const base = scriptSlug(title);
  const tag = String(id).replace(/[^a-z0-9]/gi, '').slice(0, 6);
  const candidates = [`${base}${BACKUP_EXT}`, `${base}-${tag}${BACKUP_EXT}`];
  for (let n = 2; n < 100; n += 1) candidates.push(`${base}-${tag}-${n}${BACKUP_EXT}`);
  return candidates.find((name) => {
    const owner = ownerOf(name);
    return owner == null || owner === id;
  });
}

/** ownerOf() value for a file that exists but isn't a DraftLine script: never overwritten. */
export const FOREIGN = '#not-a-draftline-script';

const pad = (n) => String(n).padStart(2, '0');

/** Local time as YYYY-MM-DD_HHmm. */
export function snapshotStamp(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** "<slug>_<YYYY-MM-DD_HHmm>.draftline"; a second snapshot in the same minute gets "_2", "_3"… */
export function snapshotFileName(title, date, exists = () => false) {
  const stem = `${scriptSlug(title)}_${snapshotStamp(date)}`;
  let name = `${stem}${BACKUP_EXT}`;
  for (let n = 2; exists(name); n += 1) name = `${stem}_${n}${BACKUP_EXT}`;
  return name;
}

/** "<file stem>_deleted_<YYYY-MM-DD_HHmm>.draftline" in Trash; "_2", "_3"… if that's taken. */
export function trashFileName(name, date, exists = () => false) {
  const stem = `${name.replace(new RegExp(`\\${BACKUP_EXT}$`, 'i'), '')}_deleted_${snapshotStamp(date)}`;
  let out = `${stem}${BACKUP_EXT}`;
  for (let n = 2; exists(out); n += 1) out = `${stem}_${n}${BACKUP_EXT}`;
  return out;
}
export const trashPath = (name) => `${TRASH_DIR}/${name}`;

/** Where a snapshot file goes, relative to the linked folder. */
export const snapshotPath = (name) => `${SNAPSHOT_DIR}/${name}`;

const SNAPSHOT_FIELDS = ['id', 'label', 'timestamp', 'pages', 'scenes', 'words'];

/**
 * A snapshot as a file: a normal .draftline backup of the script as it was (so it opens anywhere),
 * plus a `snapshot` block saying which snapshot of which script it is.
 */
export function snapshotFileText(rev, project, options = {}) {
  const record = {
    ...revisionRecord(rev),
    id: project.id,
    title: rev.meta?.title ?? project.title ?? '',
    revisions: [],
    createdAt: project.createdAt,
    updatedAt: Date.parse(rev.timestamp),
  };
  if (Number.isFinite(rev.pages)) record.pages = rev.pages;
  if (Number.isFinite(rev.scenes)) record.scenes = rev.scenes;
  const backup = createBackup(record, options);
  backup.snapshot = { projectId: project.id };
  for (const k of SNAPSHOT_FIELDS) backup.snapshot[k] = rev[k] ?? null;
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/** A snapshot file → { projectId, rev } (the revision shape revisions.js uses). Throws if it isn't one. */
export function snapshotFromFileText(text) {
  const { record } = parseBackup(text);
  const s = JSON.parse(String(text).replace(/^\uFEFF/, '')).snapshot;
  if (!s || typeof s.id !== 'string' || typeof s.label !== 'string' || Number.isNaN(Date.parse(s.timestamp))) {
    throw new Error('Not a DraftLine snapshot file');
  }
  const { script, beats, characters, storyNotes, storyDna, production, ...rest } = record;
  const meta = {};
  for (const k of ['title', 'credit', 'author', 'basedOn', 'draftVersion', 'draftDate', 'contact', 'titleFont', 'titleSize', 'titleBold']) {
    if (rest[k] !== undefined) meta[k] = rest[k];
  }
  return {
    projectId: s.projectId ?? record.id,
    rev: {
      id: s.id, label: s.label, timestamp: s.timestamp, script, beatBoard: beats || [], meta, characters: characters || [],
      storyNotes, storyDna, ...(production ? { production } : {}), pages: s.pages ?? null, scenes: s.scenes ?? 0, words: s.words ?? 0,
    },
  };
}

/** Status bar wording for where the open script is saved. `action`: what a click on it does. */
export function storageStatus({ saveOk = true, dirty = false, sync = {} }) {
  if (!saveOk) return { label: 'Not saved — browser storage blocked or full', tone: 'error', action: 'settings' };
  if (sync.needsPermission) {
    return { label: 'Click to allow folder sync', tone: 'warn', action: 'permission', title: `Let DraftLine write to “${sync.folderName}” again` };
  }
  if (dirty) return { label: 'Saving…', tone: 'pending', action: 'settings' };
  if (sync.active && sync.error) {
    return { label: 'Folder sync paused', tone: 'warn', action: 'settings', title: `Saved in this browser, but not to “${sync.folderName}”: ${sync.error}` };
  }
  if (sync.active && sync.syncing) return { label: 'Syncing…', tone: 'pending', action: 'settings' };
  if (sync.active) {
    return { label: `Synced: ${sync.folderName}`, tone: 'synced', action: 'settings', title: `Saved in this browser and to the folder “${sync.folderName}”` };
  }
  return { label: 'Saved locally', tone: 'ok', action: 'settings', title: 'Saved in this browser · click for storage options' };
}

/** Projects list = the browser library plus scripts only in the folder; for the same id, the newest copy. */
export function mergeProjectLists(local = [], folder = []) {
  const byId = new Map(local.map((r) => [r.id, { ...r, source: 'browser' }]));
  for (const { record, fileName } of folder) {
    const mine = byId.get(record.id);
    if (!mine) byId.set(record.id, { ...record, source: 'folder', fileName });
    else if ((record.updatedAt || 0) > (mine.updatedAt || 0)) byId.set(record.id, { ...record, source: 'folder-newer', fileName });
    else byId.set(record.id, { ...mine, fileName });
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Save a project: to IndexedDB first (the ground truth), then — when folder sync is on — to its
 * file. `onLocal(record)` runs as soon as the browser copy is safe. Resolves
 * { record, folder: 'written' | 'skipped' | 'error' }. If the browser save fails, nothing is
 * written to the folder (it throws, as the library does).
 */
export async function saveProjectEverywhere({ store, sync, data, options, onLocal }) {
  const record = await store.saveActiveProject(data);
  onLocal?.(record);
  const folder = sync ? await sync.writeProject(record, options) : 'skipped';
  return { record, folder };
}

const isDraftline = (name) => new RegExp(`\\${BACKUP_EXT}$`, 'i').test(name);

async function writeText(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  try {
    await w.write(text);
    await w.close();
  } catch (e) {
    await w.abort?.().catch?.(() => {});
    throw e;
  }
}

async function readText(fh) {
  const f = await fh.getFile();
  return { text: await f.text(), lastModified: f.lastModified ?? 0, size: f.size ?? 0 };
}

async function listFiles(dir) {
  const out = [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === 'file' && isDraftline(name)) out.push([name, entry]);
  }
  return out;
}

/**
 * The folder-sync controller (one per app). `settings` is the library's settings store
 * ({ get(key), set(key, value) }); `win` provides showDirectoryPicker.
 *
 * State (getState / subscribe, for React's useSyncExternalStore):
 *   supported       — the browser can link folders
 *   destination     — 'browser' | 'folder' (the writer's choice)
 *   folderName      — the linked folder's name, or null
 *   permission      — 'granted' | 'prompt' | 'denied' | null
 *   active          — isFolderSyncActive: folder chosen, linked and writable
 *   needsPermission — folder chosen and linked, but the browser wants a click to allow writing
 *   syncing, lastSyncedAt, error
 */
export function createFolderSync({ settings, win = globalThis, now = () => Date.now() } = {}) {
  let handle = null;
  const listeners = new Set();
  const index = new Map(); // top-level file name → project id
  const cache = new Map(); // file name → { lastModified, size, record | null }
  let owned = {}; // projectId → file name DraftLine wrote (so a renamed script's old file can go)

  const derive = (s) => {
    const linked = !!handle;
    const active = s.supported && s.destination === 'folder' && linked && s.permission === 'granted';
    const needsPermission = s.supported && s.destination === 'folder' && linked && s.permission !== 'granted';
    return { ...s, linked, active, needsPermission };
  };
  let state = derive({
    supported: isFolderSyncSupported(win), ready: false, destination: 'browser', folderName: null, permission: null,
    syncing: false, lastSyncedAt: null, error: null, persisted: true,
  });
  const emit = (patch) => {
    state = derive({ ...state, ...patch });
    listeners.forEach((fn) => fn());
  };
  const isActive = () => state.active;

  const failed = (e) => {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') emit({ permission: 'prompt', syncing: false });
    else emit({ error: e?.message || 'the folder couldn’t be written', syncing: false });
    return 'error';
  };

  // ---- Reading the folder ----
  /** Every script file at the top of the folder (Snapshots/ and other subfolders are skipped). */
  async function scan() {
    if (!handle) return [];
    const found = [];
    const names = new Set();
    for (const [name, fh] of await listFiles(handle)) {
      names.add(name);
      try {
        const f = await fh.getFile();
        const c = cache.get(name);
        let record;
        if (c && c.lastModified === f.lastModified && c.size === f.size) record = c.record;
        else {
          try {
            const text = await f.text();
            const isSnapshot = !!JSON.parse(text.replace(/^\uFEFF/, '')).snapshot;
            record = isSnapshot ? null : parseBackup(text).record;
          } catch {
            record = null; // not a DraftLine script (or damaged): left alone, never overwritten
          }
          cache.set(name, { lastModified: f.lastModified, size: f.size, record });
        }
        if (record) {
          index.set(name, record.id);
          found.push({ fileName: name, record });
        } else index.set(name, null);
      } catch {
        /* unreadable entry: skip */
      }
    }
    for (const n of [...index.keys()]) if (!names.has(n)) index.delete(n);
    return found;
  }

  /** Who a top-level file belongs to: null (no such file), a project id, or FOREIGN. */
  async function ownerOnDisk(name) {
    let fh;
    try {
      fh = await handle.getFileHandle(name);
    } catch (e) {
      if (e?.name === 'NotFoundError') return null;
      throw e;
    }
    try {
      const { text } = await readText(fh);
      if (JSON.parse(text.replace(/^\uFEFF/, '')).snapshot) return FOREIGN;
      return parseBackup(text).record.id || FOREIGN;
    } catch {
      return FOREIGN;
    }
  }

  // ---- Writes run one at a time; a newer save of the same script replaces a queued one ----
  const pending = new Map();
  let draining = null;
  const drain = async () => {
    while (pending.size) {
      const [id, job] = pending.entries().next().value;
      pending.delete(id);
      try {
        job.resolve(await job.run());
      } catch (e) {
        job.resolve(failed(e));
      }
    }
    draining = null;
  };
  const enqueue = (key, run) => new Promise((resolve) => {
    const prev = pending.get(key);
    if (prev) prev.resolve('skipped'); // superseded by this newer save
    pending.set(key, { run, resolve });
    draining ??= drain();
  });

  async function writeProjectNow(record, options) {
    if (!isActive()) return 'skipped';
    emit({ syncing: true });
    const ownerOf = (n) => (index.has(n) ? index.get(n) ?? FOREIGN : null);
    let name = projectFileName(record.title, record.id, ownerOf);
    // A name not yet known to be this script's: look at the disk first, so a file someone else put
    // there (or another script's, synced in from another computer) is never overwritten.
    for (let i = 0; i < 5 && index.get(name) !== record.id; i += 1) {
      const owner = await ownerOnDisk(name);
      if (owner === null || owner === record.id) break;
      index.set(name, owner === FOREIGN ? null : owner);
      name = projectFileName(record.title, record.id, ownerOf);
    }
    await writeText(handle, name, serializeBackup(record, options));
    index.set(name, record.id);
    cache.delete(name);
    // Renamed: the file DraftLine wrote under the old title goes (only that one, and only if it's still this script).
    const old = owned[record.id];
    if (old && old !== name && index.get(old) === record.id) {
      await handle.removeEntry(old).catch(() => {});
      index.delete(old);
      cache.delete(old);
    }
    if (old !== name) {
      owned = { ...owned, [record.id]: name };
      settings.set(FILES_KEY, owned)?.catch?.(() => {});
    }
    emit({ syncing: false, error: null, lastSyncedAt: now() });
    return 'written';
  }

  async function snapshotsDir(create) {
    try {
      return await handle.getDirectoryHandle(SNAPSHOT_DIR, { create });
    } catch (e) {
      if (!create && e?.name === 'NotFoundError') return null;
      throw e;
    }
  }

  async function trashDir() {
    return handle.getDirectoryHandle(TRASH_DIR, { create: true });
  }

  /**
   * Move one top-level file into Trash/: copy it, read the copy back to check it matches, and only
   * then remove the original. Throws (leaving the original exactly where it was) if any step fails.
   */
  async function moveToTrash(name) {
    const fh = await handle.getFileHandle(name);
    const { text } = await readText(fh);
    const dir = await trashDir();
    const taken = new Set((await listFiles(dir)).map(([n]) => n));
    const dest = trashFileName(name, now(), (n) => taken.has(n));
    await writeText(dir, dest, text);
    const back = await readText(await dir.getFileHandle(dest));
    if (back.text !== text) throw new Error(`The copy of ${name} in ${TRASH_DIR} didn't match`);
    await handle.removeEntry(name);
    return trashPath(dest);
  }

  async function adopt(h, permission) {
    handle = h;
    index.clear();
    cache.clear();
    let persisted = true;
    try {
      await settings.set(HANDLE_KEY, h);
    } catch {
      persisted = false; // works for this session; the next visit asks for the folder again
    }
    await settings.set(DESTINATION_KEY, 'folder');
    owned = {};
    await Promise.resolve(settings.set(FILES_KEY, owned)).catch(() => {});
    emit({ destination: 'folder', folderName: h.name, permission, error: null, persisted });
    if (permission === 'granted') await scan().catch(() => []);
  }

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Start-up: bring back the linked folder. Never prompts (that needs a click), never throws. */
    async init() {
      if (!state.supported) {
        emit({ ready: true });
        return state;
      }
      try {
        const [h, dest, files] = await Promise.all([settings.get(HANDLE_KEY), settings.get(DESTINATION_KEY), settings.get(FILES_KEY)]);
        let permission = null;
        if (h && typeof h.queryPermission === 'function') {
          handle = h;
          permission = await h.queryPermission(RW).catch(() => 'prompt');
        }
        owned = files && typeof files === 'object' ? files : {};
        emit({ ready: true, destination: dest === 'folder' && handle ? 'folder' : 'browser', folderName: handle?.name ?? null, permission });
        if (isActive()) await scan();
      } catch {
        emit({ ready: true });
      }
      return state;
    },

    /** Link Folder / Change Folder: the browser's folder picker. Resolves false if cancelled. */
    async link() {
      if (!state.supported) return false;
      let h;
      try {
        h = await win.showDirectoryPicker({ id: 'draftline-sync', mode: 'readwrite' });
      } catch (e) {
        if (e?.name === 'AbortError') return false;
        throw e;
      }
      let permission = await h.queryPermission(RW).catch(() => 'prompt');
      if (permission !== 'granted') permission = await h.requestPermission(RW).catch(() => 'denied');
      await adopt(h, permission);
      return permission === 'granted';
    },

    /** The status bar's "Click to allow folder sync" (must run inside the click). */
    async requestPermission() {
      if (!handle) return false;
      const permission = await handle.requestPermission(RW).catch(() => 'denied');
      emit({ permission, error: null });
      if (permission === 'granted') await scan().catch(() => []);
      return permission === 'granted';
    },

    /** Browser Storage ⇄ Synced Folder. Choosing the folder with none linked opens the picker. */
    async setDestination(dest) {
      if (dest === 'folder') {
        if (!handle) return this.link();
        await settings.set(DESTINATION_KEY, 'folder');
        emit({ destination: 'folder' });
        if (state.permission !== 'granted') return this.requestPermission();
        await scan().catch(() => []);
        return true;
      }
      await settings.set(DESTINATION_KEY, 'browser');
      emit({ destination: 'browser', error: null });
      return true;
    },

    /** Forget the folder (its files stay where they are). */
    async disconnect() {
      handle = null;
      index.clear();
      cache.clear();
      owned = {};
      await settings.set(HANDLE_KEY, null);
      await settings.set(DESTINATION_KEY, 'browser');
      await Promise.resolve(settings.set(FILES_KEY, owned)).catch(() => {});
      emit({ destination: 'browser', folderName: null, permission: null, error: null, syncing: false });
    },

    /** Write a stored project record to its file. Resolves 'written' | 'skipped' | 'error'. */
    writeProject(record, options) {
      if (!isActive() || !record?.id) return Promise.resolve('skipped');
      return enqueue(`p:${record.id}`, () => writeProjectNow(record, options));
    },

    /** Scripts in the folder: [{ fileName, record }], one per project id (the newest copy). */
    async listProjects() {
      if (!isActive()) return [];
      try {
        const newest = new Map();
        for (const f of await scan()) {
          const cur = newest.get(f.record.id);
          if (!cur || (f.record.updatedAt || 0) > (cur.record.updatedAt || 0)) newest.set(f.record.id, f);
        }
        return [...newest.values()];
      } catch (e) {
        failed(e);
        return [];
      }
    },

    /** The newest copy of project `id` in the folder, or null. */
    async readProject(id) {
      const f = (await this.listProjects()).find((x) => x.record.id === id);
      return f ? f.record : null;
    },

    /**
     * Take project `id`'s files out of the folder (deleting the script in DraftLine), so they don't
     * bring it back. They're moved into Trash/, never deleted — unless `hard` is true, which only
     * the writer's explicit second confirmation passes (after a move failed).
     * Resolves { trashed: [paths], removed: n, failed: [file names left in place] }.
     */
    async removeProject(id, { hard = false } = {}) {
      const result = { trashed: [], removed: 0, failed: [] };
      if (!isActive()) return result;
      await scan().catch(() => []);
      for (const [name, pid] of [...index]) {
        if (pid !== id) continue;
        try {
          if (hard) {
            await handle.removeEntry(name);
            result.removed += 1;
          } else {
            result.trashed.push(await moveToTrash(name));
          }
          index.delete(name);
          cache.delete(name);
        } catch {
          result.failed.push(name);
        }
      }
      if (!result.failed.length) {
        const { [id]: _gone, ...rest } = owned; // eslint-disable-line no-unused-vars
        owned = rest;
        settings.set(FILES_KEY, owned)?.catch?.(() => {});
      }
      return result;
    },

    /** Snapshot → Snapshots/<slug>_<YYYY-MM-DD_HHmm>.draftline. Resolves the path, or null. */
    writeSnapshot(rev, project, options) {
      if (!isActive()) return Promise.resolve(null);
      return enqueue(`s:${rev.id}`, async () => {
        emit({ syncing: true });
        const dir = await snapshotsDir(true);
        const names = new Set((await listFiles(dir)).map(([n]) => n));
        const name = snapshotFileName(rev.meta?.title ?? project.title, rev.timestamp, (n) => names.has(n));
        await writeText(dir, name, snapshotFileText(rev, project, options));
        emit({ syncing: false, error: null, lastSyncedAt: now() });
        return snapshotPath(name);
      }).then((r) => (r === 'error' || r === 'skipped' ? null : r));
    },

    /** Snapshot files for project `id`: [{ fileName, rev }], newest first. */
    async listSnapshots(projectId) {
      if (!isActive()) return [];
      try {
        const dir = await snapshotsDir(false);
        if (!dir) return [];
        const out = [];
        for (const [name, fh] of await listFiles(dir)) {
          try {
            const { projectId: pid, rev } = snapshotFromFileText((await readText(fh)).text);
            if (pid === projectId) out.push({ fileName: name, rev });
          } catch {
            /* not a snapshot file */
          }
        }
        return out.sort((a, b) => Date.parse(b.rev.timestamp) - Date.parse(a.rev.timestamp));
      } catch (e) {
        failed(e);
        return [];
      }
    },

    /** Delete the snapshot file(s) for snapshot `revId` of project `projectId`. Resolves how many. */
    async removeSnapshot(revId, projectId) {
      if (!isActive()) return 0;
      const dir = await snapshotsDir(false).catch(() => null);
      if (!dir) return 0;
      let n = 0;
      for (const { fileName, rev } of await this.listSnapshots(projectId)) {
        if (rev.id === revId) await dir.removeEntry(fileName).then(() => { n += 1; }, () => {});
      }
      return n;
    },
  };
}
