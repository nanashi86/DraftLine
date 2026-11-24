# Data integrity: forward compatibility and unknown-field pass-through

> **Status: core protections implemented (commit 43013af, November 19, 2026). This document is authoritative.** It
> is the **prerequisite for Stage 2 (Schedule & Budget)** and for anything later that stores new project data (Stage 3
> Shoot, Stage 4 Co-Write). (Stage 1 Table Read shipped storing its voice choices on the device, not in the project.) Engineering groundwork, not a product stage. See
> [`../../ROADMAP.md`](../../ROADMAP.md).
>
> §0 is what's built now. §1–3 are the November 2026 investigation that led to it (the **before** state); §4 was the
> plan, now mostly done.

## 0. What's implemented now

| Protection | Where | Tests |
|---|---|---|
| **Unknown-field pass-through.** Fields this build doesn't know are kept on every save, duplicate, backup, restore, snapshot and folder write. Known fields always win; only plain JSON data is carried (no functions, cycles or prototype keys). | `lib/passThrough.js`; `projectStorage.js` `RECORD_FIELDS`, `toRecord` / `toDoc` (`extra`), `saveActiveProject` (merges the stored record's unknown fields); `productionData.js` `normalizeProduction` (unknown `production` and per-scene keys); `revisions.js` (snapshots capture `extra`) | `tests/dataIntegrity.test.js` cases 1–8 |
| **Project format version.** Records carry `schemaVersion` (`PROJECT_SCHEMA_VERSION = 1`); records without it read as 1 and only gain the field on their next save. `PRODUCTION_VERSION` stays 1 and is never lowered. **No format bump was needed.** | `projectStorage.js` | case 6 |
| **Newer-version guard.** A project with a higher `schemaVersion` or `production.version` opens **read-only** (status bar: Read-only, a plain message; reading, printing and exporting still work). The library refuses to save over it (`NewerProjectError`), no crash journal is written for it, and journal recovery skips it. | `projectStorage.js` `isNewerProject`, `saveActiveProject`, `bootLibrary`; `App.jsx` (`newerProject`); `LockBadge.jsx` | cases 9–10 |
| **Two tabs or windows, one project (Phase 1.5).** Every write gives the record a new `writeId`; its version is `updatedAt:writeId`. Each tab's library remembers the version it has of each project (`track`, its own writes); a save is refused with a `ConflictError` (nothing written) unless the stored version is still that one. The check and the write are **one IndexedDB readwrite transaction**, and browsers run those one at a time across tabs, so two near-simultaneous saves can't both win. Rename, lock, folder import and delete make new versions too. | `projectStorage.js` `revisionOf`, `saveActiveProject`, `update` (backend), `ConflictError` | `tests/tabSafety.test.js`; `tests/browser/multiTab.browser.js` |
| **Conflict choices are checked too.** **Keep this version** writes only if the stored version is still the one shown, and the replaced version becomes a snapshot *in the same transaction* (`snapshotPrevious`); **Use the other tab's version** adds this tab's document as a snapshot to the stored record, under the same check (`keepStoredWithSnapshot`). If a third tab saved meanwhile, nothing is written and the dialog asks again with the newer version. A failed write changes nothing, and the dialog stays. | `projectStorage.js`; `App.jsx` (`resolveTabKeepMine` / `resolveTabUseTheirs`); `SyncConflictModal.jsx` (`source="tab"`) | same |
| **Clean tabs follow; busy tabs ask.** A `BroadcastChannel` message after every write (and a re-check whenever a tab comes back into view) lets a tab with nothing unsaved (no unsaved change, save in flight, word mid-composition or field being typed in) take the newer version in place: view, scroll, zoom and caret kept, undo history replaced (no undo back into the older version), one quiet toast however many saves arrive. A tab with unsaved changes stops saving that script and asks. These messages only speed things up: the transaction is the guarantee. | `lib/tabSync.js`; `App.jsx` (`checkOtherTabs`, `adoptFromOtherTab`) | same |
| **Deleted in another tab.** Never brought back by an autosave (the save is refused); the writer chooses **Restore it** (`restoreDeleted`, only while it's still gone) or lets it go, told plainly when that drops unsaved changes. | `projectStorage.js` `restoreDeleted`; `App.jsx` | same |
| **Crash journals, one per tab.** `draftline:journal:v2:<tabId>`, carrying the version the tab started from. At start-up: nothing saved since → restored (marked `recoveredJournal`, so never twice); saved since → kept as a snapshot ("Unsaved changes from a closed tab", id `journal-<jid>`, so never twice); script deleted since → kept and offered (Restore or discard). A journal is removed only after its state is in the library; one whose tab is still open (it holds a Web Lock for its lifetime) is left alone. The shared v1 journal of older builds keeps its old rule. | `projectStorage.js` `writeJournal`, `reconcileJournals`, `bootLibrary`; `tabSync.js` `holdTabLock`, `openTabs` | same |
| **Linked-folder stale-write guard.** Before overwriting a script's file, DraftLine checks the copy there (only reading it when it changed since DraftLine last wrote it). It doesn't overwrite a **newer DraftLine's** file, or a file **saved elsewhere** since this browser was last in step with it (exact match, so a computer whose clock runs behind is still caught). The writer chooses **Keep this version** or **Use the folder's version**; the other becomes a snapshot. | `folderSync.js` `checkBeforeWrite`, `adopt`, `saveProjectEverywhere`; `App.jsx`; `SyncConflictModal.jsx` | folder-sync cases |
| **Folder writes across tabs.** Each script's check-and-write holds a browser-wide Web Lock (`draftline-folder:<id>`), and writes only if the record is still the library's current version, so an older save finishing late is skipped, never written over a newer file. Files written by any tab of this browser are recognised by their exact version (`draftline_folder_written`), so a tab that took another tab's version doesn't see a false "changed somewhere else". | `folderSync.js` `withFileLock`, `setCurrentCheck`, `WRITTEN_KEY` | `tests/tabSafety.test.js` folder cases |

### Still not protected (known limits)

- **Copies of DraftLine from before 43013af** have none of this and still strip unknown fields when they save. Nothing
  new can protect an old build. This is why the first feature that writes new data must ship at least one release
  after these protections (§4.4), so installed apps have updated.
- **Windows left open across a deploy.** The service worker loads the newest app whenever a window opens online, but
  an already-open window keeps running the old code until it's reloaded, and an offline launch uses the cached app.
  There's no "new version" notice yet. A quiet one in the status bar is a candidate improvement.
- **Two tabs: an older DraftLine still open.** Builds from before Phase 1.5 don't check versions: an old tab can still
  save over a newer version. New tabs notice (its save changes `updatedAt`) and keep their own unsaved work, but if no
  new tab has unsaved changes at that moment, the old tab's save wins. Old windows reload onto the new version when
  they next open a panel (the stale-build reload), which keeps the window short.
- **Two tabs without IndexedDB** (some private windows): storage is in memory per tab, so nothing is shared and
  nothing is kept anyway. Without `BroadcastChannel` a tab notices later (when it tries to save, or comes back into
  view); without Web Locks a journal from a hidden-but-open tab may be reconciled early (lossless: at worst a false
  "changed in another tab" when that tab next saves) and folder writes aren't serialised across tabs (folder sync
  itself needs Chrome or Edge, which have Web Locks).
- **The browser dies before the journal is written** (power loss, a killed process): the last half-second of typing can
  be lost, as before. The journal is a backstop, not a guarantee.
- **Folder conflict detection** relies on the folder copy's `updatedAt` and file timestamps. A sync service that
  delivers changes late can still produce a conflict after the fact; DraftLine then asks rather than overwriting.

## Summary (investigation, before the fix)

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

- **Two tabs, one project.** *(Resolved in Phase 1.5: see §0.)* Before it, two tabs editing the same script
  overwrote each other and the last save won.
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
| Table Read voice choices *(as shipped: kept on the device in localStorage, not in the project; see `table-read.md`)* | `characters[].voice` | **Kept**: `bible.js` `normalizeCharacter` spreads the character's other properties (`...rest`). Stage 1 can store a voice per character without waiting for 4.1, but a narrator voice or reading settings stored elsewhere on the project would not survive. |

## 4. Specification for the fix (§0 shows what's done)

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
- Coordinate tabs with `BroadcastChannel` (free, local). *Done in Phase 1.5, without making a second tab read-only: a
  version check in the write, with messages so clean tabs follow and busy ones ask (§0).*

## 5. How the experiment was run

A Node script loaded `projectStorage.js`, `revisions.js`, `backup.js` and `productionData.js` from the repository,
created an in-memory store (`createProjectStore({ indexedDB: undefined })`), and fed it a hand-built "newer" record.
It touched no browser storage, no `.draftline` files and no folder. The script is not committed; the steps above are
enough to rebuild it as the first regression test.
