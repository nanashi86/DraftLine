// Snapshot ↔ current draft comparison: what changed in the script, element by element and,
// inside a changed element, word by word.
//
// Pure and dependency-free, so it runs in a Web Worker (scriptDiff.worker.js) for long
// scripts and in node:test as is. Nothing here mutates its input: the blocks it's handed are
// only read, and the result is plain data with copies of the text it shows.
//
// The diff itself is Myers' O(ND) algorithm in its linear-space form (the "middle snake"
// bisection, as in diff-match-patch): first over whole elements (same type + same text =
// equal), then, inside each replaced run, over words for the elements that pair up.

/**
 * Myers diff of two integer sequences. Returns ops in order: [op, aIndex, bIndex] with op
 * 0 = equal (a[i] === b[j]), -1 = only in a (deleted), 1 = only in b (added).
 */
export function myers(a, b) {
  const out = [];
  run(a, 0, a.length, b, 0, b.length, out);
  return out;
}

function run(a, a0, a1, b, b0, b1, out) {
  // Common prefix and suffix first: most edits are local, so this is usually most of the work.
  while (a0 < a1 && b0 < b1 && a[a0] === b[b0]) out.push([0, a0++, b0++]);
  const tail = [];
  while (a0 < a1 && b0 < b1 && a[a1 - 1] === b[b1 - 1]) tail.push([0, --a1, --b1]);
  if (a0 === a1) for (let j = b0; j < b1; j++) out.push([1, -1, j]);
  else if (b0 === b1) for (let i = a0; i < a1; i++) out.push([-1, i, -1]);
  else {
    const snake = middle(a, a0, a1, b, b0, b1);
    if (snake) {
      run(a, a0, a0 + snake[0], b, b0, b0 + snake[1], out);
      run(a, a0 + snake[0], a1, b, b0 + snake[1], b1, out);
    } else {
      for (let i = a0; i < a1; i++) out.push([-1, i, -1]);
      for (let j = b0; j < b1; j++) out.push([1, -1, j]);
    }
  }
  for (let k = tail.length - 1; k >= 0; k--) out.push(tail[k]);
}

/** The point (x, y), relative to a0 / b0, where the forward and reverse searches meet. */
function middle(a, a0, a1, b, b0, b1) {
  const n = a1 - a0;
  const m = b1 - b0;
  const max = Math.ceil((n + m) / 2);
  const off = max;
  const len = 2 * max + 2;
  const v1 = new Int32Array(len).fill(-1);
  const v2 = new Int32Array(len).fill(-1);
  v1[off + 1] = 0;
  v2[off + 1] = 0;
  const delta = n - m;
  const front = delta % 2 !== 0; // which search detects the overlap
  let k1start = 0; let k1end = 0; let k2start = 0; let k2end = 0;
  for (let d = 0; d < max; d++) {
    for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      const i1 = off + k1;
      let x1 = k1 === -d || (k1 !== d && v1[i1 - 1] < v1[i1 + 1]) ? v1[i1 + 1] : v1[i1 - 1] + 1;
      let y1 = x1 - k1;
      while (x1 < n && y1 < m && a[a0 + x1] === b[b0 + y1]) { x1++; y1++; }
      v1[i1] = x1;
      if (x1 > n) k1end += 2;
      else if (y1 > m) k1start += 2;
      else if (front) {
        const i2 = off + delta - k1;
        if (i2 >= 0 && i2 < len && v2[i2] !== -1 && x1 >= n - v2[i2]) return [x1, y1];
      }
    }
    for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      const i2 = off + k2;
      let x2 = k2 === -d || (k2 !== d && v2[i2 - 1] < v2[i2 + 1]) ? v2[i2 + 1] : v2[i2 - 1] + 1;
      let y2 = x2 - k2;
      while (x2 < n && y2 < m && a[a1 - x2 - 1] === b[b1 - y2 - 1]) { x2++; y2++; }
      v2[i2] = x2;
      if (x2 > n) k2end += 2;
      else if (y2 > m) k2start += 2;
      else if (!front) {
        const i1 = off + delta - k2;
        if (i1 >= 0 && i1 < len && v1[i1] !== -1) {
          const x1 = v1[i1];
          const y1 = off + x1 - i1;
          if (x1 >= n - x2) return [x1, y1];
        }
      }
    }
  }
  return null;
}

/** Strings → small integers, shared across both sides, so the diff compares numbers. */
function encoder() {
  const ids = new Map();
  return (s) => {
    let id = ids.get(s);
    if (id === undefined) { id = ids.size; ids.set(s, id); }
    return id;
  };
}

/**
 * What a word diff moves around: words and single punctuation marks, each carrying the spaces
 * after it (so "old " is one piece and spaces never get matched on their own), plus any
 * leading spaces.
 */
export const tokenize = (text) => (text || '').match(/^\s+|[\p{L}\p{N}'’_-]+\s*|[^\s\p{L}\p{N}]\s*/gu) || [];

/**
 * Word diff of two strings: [{ op: 'eq' | 'del' | 'add', text }], neighbouring pieces of the
 * same kind merged. A lone space between two changes is folded into them, so a rewritten
 * phrase reads as one strike-through and one insertion rather than a checkerboard.
 */
export function diffWords(oldText, newText) {
  const enc = encoder();
  const a = tokenize(oldText);
  const b = tokenize(newText);
  const ops = myers(a.map(enc), b.map(enc));
  const raw = ops.map(([op, i, j]) => (op === 0 ? { op: 'eq', text: a[i] } : op < 0 ? { op: 'del', text: a[i] } : { op: 'add', text: b[j] }));
  // Spaces wedged between changes: move them into both sides of the change.
  const tidy = [];
  for (let k = 0; k < raw.length; k++) {
    const s = raw[k];
    const prev = tidy[tidy.length - 1];
    const next = raw[k + 1];
    if (s.op === 'eq' && /^\s+$/.test(s.text) && prev && prev.op !== 'eq' && next && next.op !== 'eq') {
      tidy.push({ op: 'del', text: s.text }, { op: 'add', text: s.text });
    } else tidy.push(s);
  }
  // Group each changed stretch as all of its deletions, then all of its additions.
  const out = [];
  let del = '';
  let add = '';
  const flush = () => {
    // "walks " → "runs ": the shared trailing space isn't part of the change.
    let ws = '';
    if (del && add) {
      const m = /\s+$/.exec(del);
      const n = /\s+$/.exec(add);
      if (m && n) {
        ws = m[0].length <= n[0].length ? m[0] : n[0];
        if (add.endsWith(ws) && del.endsWith(ws)) { del = del.slice(0, -ws.length); add = add.slice(0, -ws.length); } else ws = '';
      }
    }
    if (del) out.push({ op: 'del', text: del });
    if (add) out.push({ op: 'add', text: add });
    if (ws) out.push({ op: 'eq', text: ws });
    del = ''; add = '';
  };
  for (const s of tidy) {
    if (s.op === 'del') del += s.text;
    else if (s.op === 'add') add += s.text;
    else {
      flush();
      const last = out[out.length - 1];
      if (last?.op === 'eq') last.text += s.text;
      else out.push({ op: 'eq', text: s.text });
    }
  }
  flush();
  return out;
}

/** How alike two texts are, 0–1, by shared words (for pairing a deleted element with an added one). */
export function similarity(x, y) {
  const wa = (x || '').toLowerCase().match(/[\p{L}\p{N}'’]+/gu) || [];
  const wb = (y || '').toLowerCase().match(/[\p{L}\p{N}'’]+/gu) || [];
  if (!wa.length && !wb.length) return 1;
  if (!wa.length || !wb.length) return 0;
  const count = new Map();
  for (const w of wa) count.set(w, (count.get(w) || 0) + 1);
  let shared = 0;
  for (const w of wb) {
    const c = count.get(w);
    if (c) { shared++; count.set(w, c - 1); }
  }
  return (2 * shared) / (wa.length + wb.length);
}

const PAIR_MIN = 0.35; // below this, a delete + an add read better as two separate rows

const view = (b) => ({ id: b.id, type: b.type, text: b.text || '', ...(b.dual ? { dual: true } : {}) });

/**
 * Inside one replaced run (deleted elements `dels`, added `adds`, both in order): which ones are
 * the same element edited. Same element id first (a snapshot keeps every element's id), then, in
 * order, the most alike pair above PAIR_MIN. Returns rows in script order.
 */
function pairRun(dels, adds) {
  const pairOf = new Map(); // del index → add index
  const addIds = new Map(adds.map((b, j) => [b.id, j]));
  dels.forEach((b, i) => {
    const j = addIds.get(b.id);
    if (j !== undefined) pairOf.set(i, j);
  });
  // Order-preserving: pairs by id must not cross; drop the ones that would.
  let lastJ = -1;
  for (const i of [...pairOf.keys()].sort((x, y) => x - y)) {
    if (pairOf.get(i) <= lastJ) pairOf.delete(i);
    else lastJ = pairOf.get(i);
  }
  // Fill the gaps between id pairs by likeness, still in order.
  const anchors = [[-1, -1], ...[...pairOf.entries()].sort((x, y) => x[0] - y[0]), [dels.length, adds.length]];
  for (let s = 0; s + 1 < anchors.length; s++) {
    const [i0, j0] = anchors[s];
    const [i1, j1] = anchors[s + 1];
    let jFrom = j0 + 1;
    for (let i = i0 + 1; i < i1 && jFrom < j1; i++) {
      let best = -1;
      let bestScore = PAIR_MIN;
      for (let j = jFrom; j < j1 && j < jFrom + 8; j++) { // a short look-ahead keeps big rewrites linear
        const sc = similarity(dels[i].text, adds[j].text) + (dels[i].type === adds[j].type ? 0.05 : 0);
        if (sc >= bestScore) { best = j; bestScore = sc; if (sc >= 1) break; }
      }
      if (best >= 0) { pairOf.set(i, best); jFrom = best + 1; }
    }
  }
  const rows = [];
  let j = 0;
  const pairs = [...pairOf.entries()].sort((x, y) => x[0] - y[0]);
  let p = 0;
  for (let i = 0; i < dels.length; i++) {
    const target = p < pairs.length && pairs[p][0] === i ? pairs[p][1] : null;
    if (target === null) { rows.push({ kind: 'del', old: view(dels[i]), new: null }); continue; }
    while (j < target) rows.push({ kind: 'add', old: null, new: view(adds[j++]) });
    rows.push(changed(dels[i], adds[j++]));
    p++;
  }
  while (j < adds.length) rows.push({ kind: 'add', old: null, new: view(adds[j++]) });
  return rows;
}

function changed(o, n) {
  return {
    kind: 'change',
    old: view(o),
    new: view(n),
    typeChanged: o.type !== n.type,
    words: (o.text || '') === (n.text || '') ? [{ op: 'eq', text: n.text || '' }] : diffWords(o.text, n.text),
  };
}

/**
 * Compare a snapshot's script with the current one.
 * Returns { rows, stats } where each row is one element of the comparison, in script order:
 *   { kind: 'same',   old, new }                       unchanged (same type and text)
 *   { kind: 'del',    old, new: null }                 only in the snapshot
 *   { kind: 'add',    old: null, new }                 only in the current draft
 *   { kind: 'change', old, new, typeChanged, words }   the same element, retyped and/or edited
 * `old` / `new` are { id, type, text } copies; `words` is diffWords(old.text, new.text).
 * stats: { added, deleted, changed, same } counts of rows.
 */
export function diffScripts(oldBlocks = [], newBlocks = []) {
  const enc = encoder();
  const key = (b) => enc(`${b.type}\u0000${b.text || ''}${b.dual ? '\u0000dual' : ''}`);
  const ops = myers(oldBlocks.map(key), newBlocks.map(key));
  const rows = [];
  let dels = [];
  let adds = [];
  const flush = () => {
    if (dels.length || adds.length) rows.push(...pairRun(dels, adds));
    dels = []; adds = [];
  };
  for (const [op, i, j] of ops) {
    if (op === 0) {
      flush();
      rows.push({ kind: 'same', old: view(oldBlocks[i]), new: view(newBlocks[j]) });
    } else if (op < 0) dels.push(oldBlocks[i]);
    else adds.push(newBlocks[j]);
  }
  flush();
  const stats = { added: 0, deleted: 0, changed: 0, same: 0 };
  for (const r of rows) {
    if (r.kind === 'add') stats.added++;
    else if (r.kind === 'del') stats.deleted++;
    else if (r.kind === 'change') stats.changed++;
    else stats.same++;
  }
  return { rows, stats };
}

/**
 * What the comparison shows: changed rows with `context` unchanged rows around each, and
 * the longer unchanged stretches folded into { kind: 'fold', from, to, count } markers that
 * the view can open. `open` is a Set of fold start indices already opened.
 */
export function foldRows(rows, { context = 2, open = new Set() } = {}) {
  const keep = new Array(rows.length).fill(false);
  rows.forEach((r, i) => {
    if (r.kind === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
  });
  const out = [];
  let i = 0;
  while (i < rows.length) {
    if (keep[i] || rows[i].kind !== 'same') { out.push({ ...rows[i], index: i }); i++; continue; }
    let j = i;
    while (j < rows.length && !keep[j] && rows[j].kind === 'same') j++;
    if (open.has(i) || j - i <= 1) for (let k = i; k < j; k++) out.push({ ...rows[k], index: k });
    else out.push({ kind: 'fold', from: i, to: j, count: j - i });
    i = j;
  }
  return out;
}
