// Revisions ("Snapshots"): labelled checkpoints of a whole project, kept with it.
//
// A project's `revisions` is a list, oldest first, of
//   { id, label, timestamp, script, storyDna, beatBoard, meta, characters, storyNotes, pages, scenes, words }
// — everything needed to put the project back exactly as it was at that moment: the script
// (every element with its ids, formatting and margin notes), the title page (`meta`), the Beat
// Board, and the Story Bible. `pages` / `scenes` / `words` describe the draft for the list.
//
// Revisions live in the project's record (projectStorage.js), so they're saved to IndexedDB
// with it, switch with it in Projects, and travel inside .draftline backups (backup.js).

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

let counter = 0;
const newRevisionId = (now) => {
  counter += 1;
  return `rev-${now.toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

/** "Draft - Oct 20, 2026, 12:44 PM" — the label a snapshot gets unless you type one. */
export function defaultRevisionLabel(now = new Date(), locale) {
  const when = new Date(now).toLocaleString(locale, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return `Draft - ${when}`;
}

const wordCount = (blocks) => blocks.reduce((n, b) => n + ((b.text || '').match(/\S+/g)?.length || 0), 0);

/**
 * A snapshot of `doc` — the editor's { meta, blocks, beats, characters, storyNotes, storyDna, production } —
 * deep-copied, so later edits never reach it. `pages` is the page count on screen right now.
 */
export function createRevision(doc, { label, now = Date.now(), pages, id } = {}) {
  const blocks = doc.blocks || [];
  return {
    id: id || newRevisionId(now),
    label: (label || '').trim() || defaultRevisionLabel(now),
    timestamp: new Date(now).toISOString(),
    script: clone(blocks),
    storyDna: clone(doc.storyDna),
    beatBoard: clone(doc.beats || []),
    meta: clone(doc.meta || {}),
    characters: clone(doc.characters || []),
    storyNotes: clone(doc.storyNotes),
    ...(doc.production ? { production: clone(doc.production) } : {}),
    pages: Number.isFinite(pages) ? pages : null,
    scenes: blocks.filter((b) => b.type === 'scene' && (b.text || '').trim()).length,
    words: wordCount(blocks),
  };
}

/** Add a revision (newest last). */
export const addRevision = (list, rev) => [...(list || []), rev];

/** Remove a revision by id. */
export const removeRevision = (list, id) => (list || []).filter((r) => r.id !== id);

/** Rename a revision. */
export const relabelRevision = (list, id, label) => (list || []).map((r) => (
  r.id === id && label.trim() ? { ...r, label: label.trim() } : r
));

/** Find one. */
export const getRevision = (list, id) => (list || []).find((r) => r.id === id) || null;

/** Newest first, for the Snapshots panel. */
export const revisionsNewestFirst = (list) => [...(list || [])].sort((a, b) => (
  Date.parse(b.timestamp) - Date.parse(a.timestamp) || (list.indexOf(b) - list.indexOf(a))
));

/** Size of a revision's script as stored (bytes of JSON) — "script size" in the panel. */
export const revisionBytes = (rev) => new TextEncoder().encode(JSON.stringify(rev.script || [])).length;

/** "12 pages · 38 scenes · 9,812 words · 41 KB" */
export function revisionSummary(rev) {
  const parts = [];
  if (Number.isFinite(rev.pages)) parts.push(`${rev.pages} ${rev.pages === 1 ? 'page' : 'pages'}`);
  parts.push(`${rev.scenes ?? 0} ${rev.scenes === 1 ? 'scene' : 'scenes'}`);
  parts.push(`${(rev.words ?? 0).toLocaleString('en-US')} ${rev.words === 1 ? 'word' : 'words'}`);
  const kb = revisionBytes(rev) / 1024;
  parts.push(kb < 1 ? `${revisionBytes(rev)} B` : `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`);
  return parts.join(' · ');
}

const isRevision = (r) => r && typeof r === 'object' && typeof r.id === 'string' && typeof r.label === 'string'
  && typeof r.timestamp === 'string' && !Number.isNaN(Date.parse(r.timestamp))
  && Array.isArray(r.script) && r.script.length > 0
  && r.script.every((b) => b && typeof b.id === 'string' && typeof b.type === 'string' && typeof b.text === 'string');

/** True if `list` is a readable revisions list (missing counts as empty). */
export const validRevisions = (list) => list === undefined || (Array.isArray(list) && list.every(isRevision));

/** Anything stored → a clean revisions list: unreadable entries and repeated ids are dropped. */
export function normalizeRevisions(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter((r) => {
    if (!isRevision(r) || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/**
 * The parts of a project a revision puts back, as a record-shaped object (title page fields at
 * the top level, `script`, `beats` …) for projectStorage's toDoc to read and migrate.
 */
export function revisionRecord(rev) {
  const r = clone(rev);
  return {
    ...(r.meta || {}),
    script: r.script,
    beats: r.beatBoard || [],
    characters: r.characters || [],
    storyNotes: r.storyNotes,
    storyDna: r.storyDna,
    production: r.production, // absent in older snapshots: empty breakdowns
  };
}
