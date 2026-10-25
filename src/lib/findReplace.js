// Find & Replace (Ctrl+F / Ctrl+H): every match of a search in the script, and the script with
// some or all of them replaced. Pure: blocks in, matches or new blocks out — the editor highlights,
// App commits (one undo step).
//
// A match is { id, start, end } — offsets into that element's text as stored (the page may show
// it in capitals: Scene Headings, cues and transitions are uppercased on screen, not in the text,
// which is why matching ignores case unless you ask it not to).

import { remapMarks, withMarks } from './formatting.js';

/** Where to look: everywhere, or one kind of element. */
export const FIND_SCOPES = [
  { id: 'all', label: 'All elements', types: null },
  { id: 'scene', label: 'Scene Headings', types: ['scene'] },
  { id: 'action', label: 'Action', types: ['action'] },
  { id: 'character', label: 'Character cues', types: ['character'] },
  { id: 'dialogue', label: 'Dialogue', types: ['dialogue'] },
  { id: 'parenthetical', label: 'Parentheticals', types: ['parenthetical'] },
  { id: 'transition', label: 'Transitions', types: ['transition'] },
];

/** Enough for any real search; a one-letter search in a long script stops here rather than stall. */
export const MATCH_LIMIT = 5000;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD = /[\p{L}\p{N}_'’]/u;

/**
 * Every match of `query` in `blocks`, in script order.
 *   matchCase — exact capitals (off: "ferry" finds "FERRY" and "Ferry")
 *   wholeWord — not inside a longer word ("cat" doesn't find "catch")
 *   scope     — FIND_SCOPES id
 */
export function findMatches(blocks, query, { matchCase = false, wholeWord = false, scope = 'all' } = {}) {
  if (!query) return [];
  const types = FIND_SCOPES.find((s) => s.id === scope)?.types || null;
  const re = new RegExp(escapeRe(query), matchCase ? 'gu' : 'giu');
  const out = [];
  for (const b of blocks) {
    if (types && !types.includes(b.type)) continue;
    const text = b.text || '';
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (end === start) { re.lastIndex++; continue; }
      if (wholeWord && ((start > 0 && WORD.test(text[start - 1])) || (end < text.length && WORD.test(text[end])))) continue;
      out.push({ id: b.id, start, end });
      if (out.length >= MATCH_LIMIT) return out;
    }
  }
  return out;
}

/**
 * The script with `matches` (from findMatches, any subset) replaced by `replacement`.
 * Inline formatting follows the text; notes and everything else about each element stay.
 * Returns { blocks, count } — the same array when nothing changed.
 */
export function replaceMatches(blocks, matches, replacement) {
  if (!matches.length) return { blocks, count: 0 };
  const byId = new Map();
  for (const m of matches) {
    if (!byId.has(m.id)) byId.set(m.id, []);
    byId.get(m.id).push(m);
  }
  let count = 0;
  const next = blocks.map((b) => {
    const ms = byId.get(b.id);
    if (!ms) return b;
    const sorted = [...ms].sort((x, y) => y.start - x.start); // from the end, so earlier offsets hold
    let text = b.text || '';
    let marks = b.marks;
    let last = Infinity;
    for (const m of sorted) {
      if (m.end > last || m.end > text.length) continue; // overlapping or stale
      const next = text.slice(0, m.start) + replacement + text.slice(m.end);
      // One replacement at a time, so formatting between two of them stays exactly where it was.
      if (marks) marks = remapMarks(text, next, marks);
      text = next;
      last = m.start;
      count++;
    }
    if (text === b.text) return b;
    return b.marks ? withMarks({ ...b, text }, marks) : { ...b, text };
  });
  return count ? { blocks: next, count } : { blocks, count: 0 };
}

/** Matches grouped by element: id → [[start, end, isCurrent], …] (for the editor's highlights). */
export function hitsById(matches, current = -1) {
  const map = new Map();
  matches.forEach((m, i) => {
    if (!map.has(m.id)) map.set(m.id, []);
    map.get(m.id).push([m.start, m.end, i === current]);
  });
  return map;
}

/** The match at or after `pos` in element `id` (for "find from the cursor"), else the first. */
export function nearestMatch(matches, blocks, id, pos = 0) {
  if (!matches.length) return -1;
  const order = new Map(blocks.map((b, i) => [b.id, i]));
  const at = order.get(id);
  if (at === undefined) return 0;
  const i = matches.findIndex((m) => {
    const k = order.get(m.id);
    return k > at || (k === at && m.end > pos);
  });
  return i < 0 ? 0 : i;
}
