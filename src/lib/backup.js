// DraftLine project backups (.draftline): one JSON file holding everything a project is.
//
//   {
//     "format": "draftline-backup",
//     "version": 1,
//     "app": "DraftLine 0.11.0",
//     "exportedAt": "2026-10-19T23:59:00.000Z",
//     "project": { …the stored project record, verbatim… },
//     "board": { "actMode": 3 | 4 },
//     "dictionary": { …your Story Glossary wording… }
//   }
//
// `project` is the same record the library keeps in IndexedDB (see projectStorage.js), so a
// backup carries every field, including ones a newer DraftLine adds:
//   • script     — every element with its id, type, text, inline formatting (marks), margin
//                  note and dual-dialogue flag
//   • title page — title, credit, author, based on, draft version / date, contact, and the
//                  title typography (titleFont, titleSize, titleBold), and whether the PDF and
//                  printout show scene numbers (showSceneNumbers)
//   • beats      — Scene Board cards in board order: act column / Act 2 lane, title, synopsis,
//                  colour tags (`tags: string[]`; older backups' single `tag` is read as one) and
//                  linked scene
//   • characters, storyNotes, storyDna — the Project Bible
//   • revisions  — Snapshots: labelled checkpoints of the whole project (revisions.js)
// Block ids are kept, so cards stay linked to their scenes after a restore.
//
// `board.actMode` is the 3- or 4-act view the board was in. `dictionary` holds the writer's
// own Story Glossary wording; a restore only adds terms the library has no wording for.

import { normalizeStoryDna } from './storyDna.js';
import { normalizeProduction } from './productionData.js';
import { normalizeStoryNotes, validCharacters } from './bible.js';
import { validBeats } from './beats.js';
import { validBlocks } from './projectStorage.js';
import { validRevisions } from './revisions.js';

export const BACKUP_FORMAT = 'draftline-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_EXT = '.draftline';
export const BACKUP_MIME = 'application/json;charset=utf-8';

export const isBackupFile = (name) => /\.draftline$/i.test(name || '');

/** A safe file name: "What Happened to Haiti?" → "What-Happened-to-Haiti.draftline". */
export function backupFileName(title) {
  const base = String(title || '').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'Untitled';
  return `${base}${BACKUP_EXT}`;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

/** The backup object for a stored project record. */
export function createBackup(record, { actMode, dictionary, appVersion = '', now = new Date() } = {}) {
  if (!record || !Array.isArray(record.script)) throw new Error('Nothing to back up');
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: appVersion ? `DraftLine ${appVersion}` : 'DraftLine',
    exportedAt: now.toISOString(),
    project: clone(record),
  };
  if (actMode === 3 || actMode === 4) backup.board = { actMode };
  if (dictionary && Object.keys(dictionary).length) backup.dictionary = clone(dictionary);
  return backup;
}

/** The backup as the file's text (pretty-printed, so it diffs and reads sensibly). */
export function serializeBackup(record, options) {
  return `${JSON.stringify(createBackup(record, options), null, 2)}\n`;
}

/**
 * Read a .draftline file. Returns { record, actMode, dictionary, exportedAt, app } or throws an
 * Error whose message can be shown to the writer. The record is returned exactly as stored —
 * nothing is dropped or rewritten — after checking that each part is something DraftLine reads.
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('This .draftline file is damaged (it isn’t valid JSON).');
  }
  if (!data || data.format !== BACKUP_FORMAT || !data.project) {
    throw new Error('This isn’t a DraftLine backup.');
  }
  if (!Number.isInteger(data.version) || data.version < 1) throw new Error('This backup has no valid format version.');
  if (data.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer DraftLine — update DraftLine to open it.');
  }
  const record = data.project;
  if (!validBlocks(record.script)) throw new Error('This backup’s script is damaged.');
  if (record.beats !== undefined && !validBeats(record.beats)) throw new Error('This backup’s Scene Board is damaged.');
  if (record.characters !== undefined && !validCharacters(record.characters)) throw new Error('This backup’s character bios are damaged.');
  if (!validRevisions(record.revisions)) throw new Error('This backup’s snapshots are damaged.');
  // These two normalise anything older; reading them here just proves they're readable.
  normalizeStoryNotes(record.storyNotes);
  normalizeStoryDna(record.storyDna);
  normalizeProduction(record.production); // Plan breakdowns: none in older backups, which is fine
  const actMode = data.board?.actMode === 3 || data.board?.actMode === 4 ? data.board.actMode : null;
  const dictionary = data.dictionary && typeof data.dictionary === 'object' && !Array.isArray(data.dictionary) ? data.dictionary : {};
  return { record, actMode, dictionary, exportedAt: data.exportedAt || null, app: data.app || null };
}

/** Your library's dictionary wording plus any terms only the backup has wording for. */
export function mergeBackupDictionary(current = {}, incoming = {}) {
  const out = { ...current };
  let added = 0;
  for (const [id, entry] of Object.entries(incoming)) {
    if (out[id] === undefined && entry && typeof entry === 'object') {
      out[id] = entry;
      added += 1;
    }
  }
  return { dictionary: out, added };
}
