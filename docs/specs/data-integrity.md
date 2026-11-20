# Data integrity: forward compatibility and unknown-field pass-through

> **Status: investigation complete (November 2026); the fix is specified here and not yet approved for
> implementation.** It is the **prerequisite for Stage 2 (Schedule & Budget)** and for anything later that stores new
> project data (Stage 3 Shoot, Stage 4 Co-Write, Stage 1 Table Read's voice choices). It is engineering groundwork,
> not a product stage. See [`../../ROADMAP.md`](../../ROADMAP.md).
>
> **No code was changed by this investigation.** Experiments ran against the real storage functions with an
> in-memory store only (no IndexedDB, no files, no folder).

## Summary

- **No urgent data-loss risk exists today.** Every field DraftLine writes now survives save, reload, backup, restore,
  duplicate, snapshots and folder sync. 141 existing storage, backup, snapshot and Plan tests pass.
- **One confirmed forward-compatibility hazard.** Today's code drops any project data it doesn't recognise the first
  time it saves. As soon as a newer DraftLine stores something new (a schedule, a budget, locked pages, a voice
  choice), an **older copy of DraftLine that opens the project and saves it once deletes that data**. Through folder
  sync, the stripped copy then counts as the newest and replaces the good one on the other computer.
- This is harmless today, because no newer data exists yet. It has to be fixed **before** Schedule & Budget (or any
  other new stored data) ships, and the fix has to reach writers' devices one release ahead of the first feature that
  relies on it.

## 1. How a project travels

| Path | Code | Keeps fields it doesn't know? |
|---|---|---|
| Editor save (every edit, debounced) | `projectStorage.js` `saveActiveProject` → `toRecord()` | **No.** `toRecord` builds a new record from a fixed list (`META_FIELDS`, `script`, `beats`, `characters`, `storyNotes`, `storyDna`, `production`, plus `revisions` / `isLocked` / `viewOnly` carried from the old record). Anything else is gone. |
| Open a project | `toDoc()` | **No** for project-level and Plan data: `toDoc` copies known fields only, and `normalizeProduction()` keeps only `version: 1` and the four lists + notes per scene. **Yes** for extra properties on script elements (the element objects pass through `migrateBlock`). |
| Plan data | `productionData.js` `normalizeProduction()` | **No.** It rebuilds `{ version: 1, scenes }` from scratch: a `version: 2`, a `schedule` or `budget` inside `production`, or extra per-scene fields (cast overrides, estimates) are dropped. |
| Backup export (`.draftline`) | `backup.js` `createBackup` | **Yes.** It writes the stored record as is. |
| Backup import / restore | `parseBackup` → `restoreProject` | **Yes**, and a backup whose format `version` is newer than this build understands is refused with "made by a newer DraftLine — update DraftLine to open it". |
| Folder sync read | `folderSync.readProject` → `parseBackup` → `importRecord` | **Yes** on arrival (same version gate). |
| Folder sync write | `writeProjectNow` → `serializeBackup` | Writes whatever the library holds, so after an editor save, the stripped record. |
| Duplicate | `duplicateProject` | **Yes** (a deep copy). |
| Snapshots | `revisions.js` `createRevision` / `revisionRecord` | **No.** A snapshot captures named parts only (`script`, `meta`, `beatBoard`, `characters`, `storyNotes`, `storyDna`, `production`); restoring one runs `toDoc`, so Plan data goes through `normalizeProduction` again. |
| Crash journal | `writeJournal` | Known parts only; on recovery it's saved through `saveActiveProject` (above). |

## 2. Findings

### Confirmed safe (experiment and existing tests)

- Every current field round-trips through save → load (experiment 1), backup export → parse (`backup.test.js`),
  restore, duplicate, the crash journal and folder import (`projectStorage.test.js`, `storage.test.js`).
- Saves within one tab are serialised (`serial()` queue) and `updatedAt` only moves forward, so a slow save never lands
  after a newer one in the same tab.
- A backup or synced file in a **newer backup format version** is refused, not half-read.
- Extra properties on script elements (for example future revision marks) survive open and save.
- Extra properties on characters survive too (`normalizeCharacter` keeps the rest of the object).

### Confirmed unsafe (experiment, in-memory store)

A record written by a hypothetical newer build, with `schedule`, `budget`, `shoot`, `coWrite` and `schemaVersion` at
the top level, `production.version: 2` with a `schedule` inside it and extra per-scene fields:

| Step in today's build | Result |
|---|---|
| Arrives by folder sync or restore (`importRecord` / `restoreProject`) | Stored intact |
| Opened (`toDoc`) | `production.version` becomes 1; `production.schedule` and the per-scene extras are gone from the editor's copy |
| **One edit, one save** (`saveActiveProject`) | **Every unknown top-level field is deleted**; `production` is v1 with the four lists only |
| The saved copy's `updatedAt` | Newer than the newer build's copy, so folder sync treats it as the latest and writes it to the folder; the other computer then loads the stripped version |
| A snapshot taken in this build | Doesn't capture the new parts; restoring a newer snapshot drops them too |

`normalizeProduction({ version: 3, scenes: {}, budget: {} })` returns `{ version: 1, scenes: {} }`.

### Untested or unresolved

- **Two tabs, one project.** There is no cross-tab coordination (no `BroadcastChannel` or Web Locks), so two tabs
  editing the same script overwrite each other and the last save wins. This is existing behaviour, not new risk;
  [`co-write.md`](co-write.md) lists cross-tab sync as a possible stepping stone.
- **Two computers editing at the same time through a synced folder.** A newer copy is pulled only when sync turns on
  (start-up, permission granted, the tab coming back); a save writes the file without first checking whether the
  copy on disk has become newer. The public pages already say "the latest save wins"; a pre-write check is a
  candidate improvement.
- **An installed app on an old version.** The service worker updates on the next launch, but a device left offline,
  or an app window kept open for days, can run an older build against newer files. This is the realistic way the
  unsafe scenario above happens.
- **Native apps (future).** Desktop and Android builds would update on their own schedule, so mixed versions become
  more likely, not less.

## 3. Older builds meeting newer data (Schedule, Budget, Shoot, Co-Write)

| Newer data | Where it would live | Today's build, after one save |
|---|---|---|
| Schedule (days, order, day breaks) | `production.schedule` or a new top-level field | Deleted |
| Budget (lines, rates, currency override) | `production.budget` or top-level | Deleted |
| Shoot (locked pages, scene numbers, revision rounds, archive) | top-level `shoot` / per-element marks | Top-level data deleted; per-element marks kept |
| Co-Write (session id, collaborator ids) | top-level | Deleted (and it should never be in a backup anyway, see [`co-write.md`](co-write.md)) |
| Table Read voice choices | `characters[].voice` | **Kept**: `bible.js` `normalizeCharacter` spreads the character's other properties (`...rest`). Stage 1 can store a voice per character without waiting for 4.1, but a narrator voice or reading settings stored elsewhere on the project would not survive. |

## 4. Specification for the fix (when approved)

### 4.1 Unknown-field pass-through

- **`toRecord(doc, now, prev)`**: start from the previous stored record (`prev`, already read in
  `saveActiveProject`), overwrite only the fields this build owns, keep everything else. Fields this build owns and
  wants gone are deleted explicitly, never by omission.
- **`toDoc(rec)`**: keep the unknown remainder on the document (for example `doc.extra`), untouched by the editor, so
  every path that saves a document (journal, snapshot restore, import) can pass it back.
- **`normalizeProduction(raw)`**: keep unknown top-level keys of `production` and unknown keys inside each scene;
  clean only the parts it understands. Never lower `version`.
- **Snapshots**: `createRevision` copies the document's unknown parts too, and `revisionRecord` returns them, so a
  snapshot restores everything it was taken with.
- **Crash journal**: include the unknown remainder.

### 4.2 Schema version and the "newer data" guard

- Add a **project schema version** (`schemaVersion: 2` on the record; `production.version` follows the same rule).
- A build that opens a project with a **higher** schema version than it knows:
  - opens it, shows everything it understands, and keeps the rest (4.1);
  - shows a quiet notice in the status bar: "Made with a newer DraftLine. Update to see everything in it.";
  - **never lowers the version** on save.
- Bump the **backup format version** only for changes an older build could not read safely at all; pass-through
  covers additive changes without refusing the file.

### 4.3 Migration v1 → v2

- Pure function `migrateProject(rec)`: adds `schemaVersion: 2`, leaves all v1 content exactly as it was, and is
  idempotent (running it twice changes nothing).
- Runs on load, never as a bulk rewrite of the library; the migrated record is written on the next ordinary save.

### 4.4 Ship order

1. Release N: pass-through, the version guard and the migration, **with no new data written yet**.
2. Wait for release N to reach installed apps (at least one normal update cycle).
3. Release N+1 or later: the first feature that writes new data (Schedule & Budget).

### 4.5 Regression tests to add

- Round trip a record with unknown top-level, `production`, per-scene, per-element, character and snapshot fields
  through: save, load, snapshot create and restore, backup export and import, restore, duplicate, crash-journal
  recovery, folder import and write. Every unknown field survives byte for byte.
- An older-schema build's save never lowers `schemaVersion` or `production.version`.
- `migrateProject` is idempotent and changes no v1 content.
- A deliberately removed field (by this build) is really removed; pass-through doesn't resurrect it.
- The existing tests keep passing unchanged.

### 4.6 Stale-write safeguards (candidates, separate approval)

- Before a folder write, compare the file's `updatedAt` on disk; if it's newer than the copy this tab loaded, don't
  overwrite: keep both and tell the writer.
- Coordinate tabs with `BroadcastChannel` (free, local): a second tab opening the same script becomes read-only or
  follows the first.

## 5. How the experiment was run

A Node script loaded `projectStorage.js`, `revisions.js`, `backup.js` and `productionData.js` from the repository,
created an in-memory store (`createProjectStore({ indexedDB: undefined })`), and fed it a hand-built "newer" record.
It touched no browser storage, no `.draftline` files and no folder. The script is not committed; the steps above are
enough to rebuild it as the first regression test.
