// Pure block-editing operations behind Backspace / Delete, so they can be tested
// without a browser. Each returns { blocks, focus: { id, caret } } or null when the
// key should fall through to the browser's normal behaviour.

import { concatMarks, withMarks } from './formatting.js';

const isEmpty = (b) => b.text.trim() === '';

/** A joins B: text, margin notes and inline formatting all carry over. */
function join(a, b) {
  return withMarks({ ...withoutNote(a), text: a.text + b.text, ...mergeNotes(a, b) }, concatMarks(a.marks, a.text.length, b.marks));
}

function mergeNotes(a, b) {
  const notes = [a.note, b.note].map((n) => (n || '').trim()).filter(Boolean);
  return notes.length ? { note: notes.join('\n') } : {};
}

function withoutNote(block) {
  const { note: _n, ...rest } = block; // eslint-disable-line no-unused-vars
  return rest;
}

/**
 * Backspace with the caret at `start`/`end` in blocks[idx].
 *   • Empty element → removed. Focus moves to the end of the element above, or —
 *     when it was the very first element — to the start of the one below, which
 *     becomes line 1 of Page 1.
 *   • Caret at position 0 of a non-empty element → its text is merged onto the end of
 *     the element above (which keeps its own type).
 */
export function backspaceAt(blocks, idx, start, end) {
  const b = blocks[idx];
  if (!b || start !== 0 || end !== 0) return null;

  if (isEmpty(b)) {
    if (blocks.length === 1) return null;
    const next = blocks.slice(0, idx).concat(blocks.slice(idx + 1));
    if (idx === 0) return { blocks: next, focus: { id: blocks[1].id, caret: 0 } };
    return { blocks: next, focus: { id: blocks[idx - 1].id, caret: 'end' } };
  }

  if (idx === 0) return null;
  const prev = blocks[idx - 1];
  if (isEmpty(prev)) {
    // Removing an empty line above is friendlier than merging into nothing.
    return { blocks: blocks.slice(0, idx - 1).concat(blocks.slice(idx)), focus: { id: b.id, caret: 0 } };
  }
  const merged = join(prev, b);
  return {
    blocks: blocks.slice(0, idx - 1).concat([merged], blocks.slice(idx + 1)),
    focus: { id: prev.id, caret: prev.text.length },
  };
}

/**
 * Delete (forward) with the caret at `start`/`end` in blocks[idx].
 *   • Empty element → removed; focus moves to the start of the element below
 *     (or the end of the one above if it was last).
 *   • Caret at the end of a non-empty element → the element below is merged in
 *     (an empty one below is simply removed).
 */
export function deleteAt(blocks, idx, start, end) {
  const b = blocks[idx];
  if (!b || start !== end) return null;

  if (isEmpty(b)) {
    if (blocks.length === 1) return null;
    const next = blocks.slice(0, idx).concat(blocks.slice(idx + 1));
    if (idx < blocks.length - 1) return { blocks: next, focus: { id: blocks[idx + 1].id, caret: 0 } };
    return { blocks: next, focus: { id: blocks[idx - 1].id, caret: 'end' } };
  }

  if (start !== b.text.length || idx === blocks.length - 1) return null;
  const below = blocks[idx + 1];
  if (isEmpty(below)) {
    return { blocks: blocks.slice(0, idx + 1).concat(blocks.slice(idx + 2)), focus: { id: b.id, caret: b.text.length } };
  }
  const merged = join(b, below);
  return {
    blocks: blocks.slice(0, idx).concat([merged], blocks.slice(idx + 2)),
    focus: { id: b.id, caret: b.text.length },
  };
}
