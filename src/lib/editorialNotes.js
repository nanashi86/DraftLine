// Editorial margin notes: one private note per element (block.note), with its history.
//
//   block.note     — the note's current text ('' while a new note is being written)
//   block.noteAt   — when it was last changed (ms)
//   block.noteLog  — earlier versions, oldest first: [{ at, text }] (at most NOTE_LOG_LIMIT)
//
// A "session" is one stretch of editing a note in the Notes drawer. When it ends (another
// note is opened, the drawer closes) and the text changed, the version you started from goes
// into noteLog. Notes never print and are never exported (see notes.js); deleting a note
// deletes its history with it.

import { ELEMENT_META } from './screenplay.js';

export const NOTE_LOG_LIMIT = 50;

export const hasNote = (b) => typeof b?.note === 'string';

/** The element without its note, history or timestamp. */
export function withoutNote(block) {
  const { note, noteAt, noteLog, ...rest } = block; // eslint-disable-line no-unused-vars
  return rest;
}

/**
 * A note's text for a new note: empty, or the selected words quoted — the script text itself
 * is left exactly as it was (notes are non-destructive).
 */
export function quoteSelection(selected) {
  const t = (selected || '').replace(/\s+/g, ' ').trim();
  return t ? `“${t.length > 160 ? `${t.slice(0, 157)}…` : t}” — ` : '';
}

/** Start (or add to) the note on `block`, optionally quoting a selection. */
export function startNote(block, { quote = '', now = Date.now() } = {}) {
  const q = quoteSelection(quote);
  if (hasNote(block)) {
    if (!q) return block;
    const note = block.note.trim() ? `${block.note.replace(/\s+$/, '')}\n${q}` : q;
    return { ...block, note, noteAt: now };
  }
  return { ...block, note: q, noteAt: now };
}

/** Set the note's text (null deletes the note and its history). */
export function setNoteText(block, text, now = Date.now()) {
  if (text === null) return withoutNote(block);
  return { ...block, note: text, noteAt: now };
}

/**
 * End an editing session that began with `startText`. Returns the element to keep:
 * an empty note is dropped; a changed note logs the version it started from.
 */
export function endNoteSession(block, startText, now = Date.now()) {
  if (!hasNote(block)) return block;
  if (!block.note.trim()) return withoutNote(block);
  if (startText == null || block.note === startText || !startText.trim()) return block;
  const log = [...(block.noteLog || []), { at: now, text: startText }].slice(-NOTE_LOG_LIMIT);
  return { ...block, noteLog: log };
}

/** Put an earlier version back (the current text is logged, so nothing is lost). */
export function restoreNoteVersion(block, index, now = Date.now()) {
  const entry = block.noteLog?.[index];
  if (!entry || !hasNote(block)) return block;
  const log = [...block.noteLog];
  if (block.note.trim() && block.note !== entry.text) log.push({ at: now, text: block.note });
  return { ...block, note: entry.text, noteAt: now, noteLog: log.slice(-NOTE_LOG_LIMIT) };
}

/** Earlier versions, newest first, with their index in noteLog. */
export const noteHistory = (block) => (block?.noteLog || []).map((e, index) => ({ ...e, index })).reverse();

const excerpt = (text, n = 70) => {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Every annotated element in script order: { id, type, label, excerpt, note, preview, page }.
 * `pageOf` (optional) maps a block id to its page number.
 */
export function notedLines(blocks, pageOf) {
  return blocks.filter(hasNote).map((b) => ({
    id: b.id,
    type: b.type,
    label: ELEMENT_META[b.type]?.label || b.type,
    excerpt: excerpt(b.text) || '(empty line)',
    note: b.note,
    preview: excerpt(b.note.split('\n').find((l) => l.trim()) || '', 90) || 'Empty note',
    page: pageOf?.[b.id] ?? pageOf?.get?.(b.id) ?? null,
    at: b.noteAt ?? null,
    versions: b.noteLog?.length || 0,
  }));
}

/** The annotated line before / after `id` (wrapping), for the drawer's ‹ › buttons. */
export function adjacentNote(blocks, id, dir) {
  const ids = blocks.filter(hasNote).map((b) => b.id);
  if (!ids.length) return null;
  const i = ids.indexOf(id);
  if (i < 0) return ids[dir < 0 ? ids.length - 1 : 0];
  return ids[(i + (dir < 0 ? -1 : 1) + ids.length) % ids.length];
}
