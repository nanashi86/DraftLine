// Inline formatting: bold, italic, underline and strikethrough, stored beside the text as
// character ranges — never inside it:
//
//   block.marks = { b: [[start, end], …], i: […], u: […], s: […] }   (end exclusive)
//
// Plain text keeps the textarea editor, autocomplete, pagination and every classifier
// working on ordinary strings. Ranges follow the text through edits (remapMarks) and the
// importers/exporters translate them to and from:
//
//   style          Fountain / Markdown   HTML                 Final Draft <Text Style="…">
//   b  bold        **text**              <b>, <strong>        Bold
//   i  italic      *text*                <i>, <em>            Italic
//   u  underline   _text_                <u>                  Underline
//   s  strike      ~~text~~              <s>, <strike>, <del> Strikeout
//
// Styles are independent, so any combination works (***bold italic***, _**both**_ …).

export const STYLES = ['b', 'i', 'u', 's'];

export const STYLE_INFO = {
  b: { label: 'Bold', fdx: 'Bold', md: '**', keys: 'Ctrl+B' },
  i: { label: 'Italic', fdx: 'Italic', md: '*', keys: 'Ctrl+I' },
  u: { label: 'Underline', fdx: 'Underline', md: '_', keys: 'Ctrl+U' },
  s: { label: 'Strikethrough', fdx: 'Strikeout', md: '~~', keys: 'Ctrl+Shift+X' },
};

// ---- Ranges -----------------------------------------------------------------

/** Sorted, merged, clamped to [0, len], empties dropped. Undefined when nothing is left. */
export function normalizeRanges(ranges, len = Infinity) {
  if (!ranges?.length) return undefined;
  const rs = ranges
    .map(([s, e]) => [Math.max(0, Math.min(s, len)), Math.max(0, Math.min(e, len))])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const r of rs) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out.length ? out : undefined;
}

/** Apply `fn` to every style's ranges; drops empty styles. Undefined when nothing is left. */
function mapMarks(marks, fn) {
  if (!marks) return undefined;
  let out;
  for (const k of STYLES) {
    const r = marks[k]?.length ? fn(marks[k], k) : undefined;
    if (r?.length) (out ??= {})[k] = r;
  }
  return out;
}

export function normalizeMarks(marks, len = Infinity) {
  return mapMarks(marks, (r) => normalizeRanges(r, len));
}

export const hasMarks = (marks) => !!marks && STYLES.some((k) => marks[k]?.length);

const covered = (ranges, s, e) => !!ranges?.length && e > s && ranges.some(([a, b]) => a <= s && b >= e);

/** The run of non-space characters around `caret` (what a shortcut affects with no selection). */
export function wordAt(text, caret) {
  let s = caret;
  let e = caret;
  while (s > 0 && !/\s/.test(text[s - 1])) s--;
  while (e < text.length && !/\s/.test(text[e])) e++;
  return e > s ? [s, e] : null;
}

/** The stretch a format command applies to: the selection, or the word at a bare caret. */
export function targetRange(text, start, end) {
  return start === end ? wordAt(text, start) : [start, end];
}

/** Which styles cover the whole of [s, e) — drives the toolbar's B / I / U / S states. */
export function activeStyles(marks, s, e) {
  const out = { b: false, i: false, u: false, s: false };
  if (e > s) for (const k of STYLES) out[k] = covered(marks?.[k], s, e);
  return out;
}

function removeRange(ranges, s, e) {
  const out = [];
  for (const [a, b] of ranges || []) {
    if (b <= s || a >= e) out.push([a, b]);
    else {
      if (a < s) out.push([a, s]);
      if (b > e) out.push([e, b]);
    }
  }
  return normalizeRanges(out);
}

/** Turn `style` on for [s, e) — or off, if that stretch already has it all the way through. */
export function toggleStyle(marks, style, s, e) {
  if (e <= s) return { marks: normalizeMarks(marks), on: false };
  const on = !covered(marks?.[style], s, e);
  const next = { ...(marks || {}) };
  next[style] = on ? normalizeRanges([...(marks?.[style] || []), [s, e]]) : removeRange(marks?.[style], s, e);
  return { marks: normalizeMarks(next), on };
}

/** Remove every style from [s, e). */
export function clearMarks(marks, s, e) {
  return mapMarks(marks, (r) => removeRange(r, s, e));
}

/** Marks inside [a, b), shifted to start at 0 (the half of an element split off by Enter). */
export function sliceMarks(marks, a, b = Infinity) {
  return mapMarks(marks, (r) => normalizeRanges(r.map(([s, e]) => [Math.max(s, a) - a, Math.min(e, b) - a])));
}

export function shiftMarks(marks, by) {
  return mapMarks(marks, (r) => r.map(([s, e]) => [s + by, e + by]));
}

/** Marks of text A followed by text B (two elements merging). A new object, or undefined. */
export function concatMarks(a, lenA, b) {
  const shifted = shiftMarks(b, lenA) || {};
  let out;
  for (const k of STYLES) {
    const r = normalizeRanges([...(a?.[k] || []), ...(shifted[k] || [])]);
    if (r) (out ??= {})[k] = r;
  }
  return out;
}

/**
 * Carry ranges across a text edit, found by comparing old and new text from both ends
 * (case-insensitively, so "make uppercase" is not an edit at all). Cursor-boundary
 * isolation: typing right at either edge of a styled run never extends it — only typing
 * strictly inside it does, so a style can't bleed forward into what you type next.
 * A selection that starts inside a run and is typed over keeps the run's style.
 */
export function remapRanges(oldText, newText, ranges) {
  if (!ranges?.length) return undefined;
  if (oldText === newText) return ranges;
  const a = oldText.toLowerCase();
  const b = newText.toLowerCase();
  let p = 0;
  const max = Math.min(a.length, b.length);
  while (p < max && a[p] === b[p]) p++;
  let sa = a.length;
  let sb = b.length;
  while (sa > p && sb > p && a[sa - 1] === b[sb - 1]) {
    sa--;
    sb--;
  }
  const oldEnd = sa;
  const newEnd = sb;
  const d = newEnd - oldEnd;
  if (d === 0 && oldEnd === p) return ranges; // only letter case changed
  const mapStart = (s) => (s < p ? s : s >= oldEnd ? s + d : s === p ? p : newEnd);
  const mapEnd = (e) => (e <= p ? e : e >= oldEnd ? e + d : p);
  return normalizeRanges(ranges.map(([s, e]) => [mapStart(s), mapEnd(e)]), newText.length);
}

export function remapMarks(oldText, newText, marks) {
  if (!hasMarks(marks)) return undefined;
  if (oldText === newText) return marks;
  return mapMarks(marks, (r) => remapRanges(oldText, newText, r));
}

/** Older drafts stored underline alone as `underline: [[s, e]]`; fold it into `marks.u`. */
export function migrateBlock(b) {
  if (!b || !('underline' in b)) return b;
  const { underline, ...rest } = b;
  const marks = normalizeMarks({ ...(rest.marks || {}), u: [...(rest.marks?.u || []), ...(underline || [])] });
  if (marks) rest.marks = marks;
  else delete rest.marks;
  return rest;
}

/** `block` with its marks replaced (or removed when empty). */
export function withMarks(block, marks) {
  const out = { ...block };
  if (hasMarks(marks)) out.marks = marks;
  else delete out.marks;
  return out;
}

/**
 * History normaliser: when an element's text changed but its marks weren't updated
 * explicitly (typing, the Dialogue Tuner, autocomplete, Format Doctor…), move the marks
 * with the edit. Returns `next` itself when nothing needed fixing.
 */
export function reconcileMarks(prev, next) {
  if (prev === next || !Array.isArray(prev) || !Array.isArray(next)) return next;
  let byId = null;
  let out = null;
  for (let i = 0; i < next.length; i++) {
    const nb = next[i];
    if (!nb.marks) continue;
    let pb = prev[i];
    if (!pb || pb.id !== nb.id) {
      byId ??= new Map(prev.map((b) => [b.id, b]));
      pb = byId.get(nb.id);
    }
    if (!pb || pb === nb || pb.text === nb.text || pb.marks !== nb.marks) continue;
    const marks = remapMarks(pb.text, nb.text, nb.marks);
    if (marks === nb.marks) continue;
    out ??= next.slice();
    out[i] = withMarks(nb, marks);
  }
  return out || next;
}

/** [{ text, b, i, u, s }] runs for rendering and export. */
export function segments(text, marks) {
  const m = normalizeMarks(marks, text.length);
  if (!m) return [{ text, b: false, i: false, u: false, s: false }];
  const cuts = new Set([0, text.length]);
  for (const k of STYLES) for (const [s, e] of m[k] || []) cuts.add(s).add(e);
  const pts = [...cuts].sort((x, y) => x - y);
  const out = [];
  for (let n = 0; n < pts.length - 1; n++) {
    const [s, e] = [pts[n], pts[n + 1]];
    const seg = { text: text.slice(s, e) };
    for (const k of STYLES) seg[k] = covered(m[k], s, e);
    const last = out[out.length - 1];
    if (last && STYLES.every((k) => last[k] === seg[k])) last.text += seg.text;
    else out.push(seg);
  }
  return out;
}

/** CSS for a run: weight, slant and decoration lines. */
export function segmentStyle(seg) {
  const deco = [seg.u && 'underline', seg.s && 'line-through'].filter(Boolean).join(' ');
  if (!seg.b && !seg.i && !deco) return undefined;
  return {
    ...(seg.b && { fontWeight: 700 }),
    ...(seg.i && { fontStyle: 'italic' }),
    ...(deco && { textDecorationLine: deco }),
  };
}

// ---- Markup in / out ----------------------------------------------------------

// Private-use sentinels mark styles while a line is still being classified:
// \uE010/\uE011 bold, \uE012/\uE013 italic, \uE014/\uE015 underline, \uE016/\uE017 strike.
const OPEN = { b: '\uE010', i: '\uE012', u: '\uE014', s: '\uE016' };
const CLOSE = { b: '\uE011', i: '\uE013', u: '\uE015', s: '\uE017' };
export const SENTINEL_OPEN = OPEN;
export const SENTINEL_CLOSE = CLOSE;
const SENTINELS = /[\uE010-\uE017]/g;
const HAS_SENTINEL = /[\uE010-\uE017]/;
const STYLE_OF = Object.fromEntries(STYLES.flatMap((k) => [[OPEN[k], [k, true]], [CLOSE[k], [k, false]]]));

const HTML_TAGS = [
  ['b', /<(b|strong)>([\s\S]*?)<\/\1>/gi],
  ['i', /<(i|em)>([\s\S]*?)<\/\1>/gi],
  ['u', /<(u)>([\s\S]*?)<\/\1>/gi],
  ['s', /<(s|strike|del)>([\s\S]*?)<\/\1>/gi],
];

// Emphasis opens on a non-space, closes on a non-space and stays on one line.
// Bold (**) goes before italic (*) so "**x**" isn't read as two italics.
const MD = [
  ['b', /(?<!\\)\*\*(?=[^\s*])([^\n]*?[^\s\\*])\*\*/g],
  ['i', /(?<!\\)\*(?=[^\s*])([^\n]*?[^\s\\*])\*/g],
  ['u', /(?<!\\)_(?=[^\s_])([^\n]*?[^\s\\_])_/g],
  ['s', /(?<!\\)~~(?=[^\s~])([^\n]*?[^\s\\~])~~/g],
];
// Bold-italic written as ***x*** : the inner * is treated as part of the run.
const BOLD_ITALIC = /(?<!\\)\*\*\*(?=[^\s*])([^\n]*?[^\s\\*])\*\*\*/g;

/** Turn HTML tags and Markdown/Fountain emphasis into sentinels; unescape \* \_ \~. */
export function markInline(str) {
  if (!str || !/[*_~<]/.test(str)) return str;
  let s = str;
  if (s.includes('<')) for (const [k, re] of HTML_TAGS) s = s.replace(re, (_, _t, x) => OPEN[k] + x + CLOSE[k]);
  s = s.replace(BOLD_ITALIC, (_, x) => OPEN.b + OPEN.i + x + CLOSE.i + CLOSE.b);
  for (const [k, re] of MD) s = s.replace(re, (_, x) => OPEN[k] + x + CLOSE[k]);
  return s.replace(/\\([*_~])/g, '$1');
}

export function stripMarks(s) {
  return s ? s.replace(SENTINELS, '') : s;
}

/** Plain text of a line that may carry formatting markup — what classifiers look at. */
export function stripInline(s) {
  return stripMarks(markInline(s));
}

/** Sentinel-marked text → { text, marks }. Each style is tracked on its own, so overlaps are fine. */
export function takeMarks(s) {
  if (!s || !HAS_SENTINEL.test(s)) return { text: s, marks: undefined };
  let text = '';
  const open = {};
  const ranges = {};
  for (const ch of s) {
    const st = STYLE_OF[ch];
    if (!st) {
      text += ch;
      continue;
    }
    const [k, isOpen] = st;
    if (isOpen) {
      if (open[k] == null) open[k] = text.length;
    } else if (open[k] != null) {
      (ranges[k] ??= []).push([open[k], text.length]);
      open[k] = null;
    }
  }
  for (const k of STYLES) if (open[k] != null) (ranges[k] ??= []).push([open[k], text.length]);
  return { text, marks: normalizeMarks(ranges, text.length) };
}

/** Markup text (Fountain, Markdown, HTML) → { text, marks }. */
export function parseInline(s) {
  return takeMarks(markInline(s));
}

/** Convert a parsed block's sentinels into plain text + marks. Mutates and returns it. */
export function applyInline(block) {
  if (!HAS_SENTINEL.test(block.text)) return block;
  const { text, marks } = takeMarks(block.text);
  block.text = text;
  if (marks) block.marks = marks;
  else delete block.marks;
  return block;
}

/**
 * Close every open style at the end of each line and reopen it on the next, so a tag that
 * spans lines (<b>…\n…</b>) still marks each line once lines are split apart.
 */
export function balanceLines(lines) {
  const open = new Set();
  return lines.map((l) => {
    let out = [...open].map((k) => OPEN[k]).join('') + l;
    for (const ch of l) {
      const st = STYLE_OF[ch];
      if (st) {
        if (st[1]) open.add(st[0]);
        else open.delete(st[0]);
      }
    }
    out += [...open].map((k) => CLOSE[k]).join('');
    return out;
  });
}

/**
 * Fountain text for an element. Runs are split at line breaks and trimmed to their
 * non-space characters so markers always hug words; styles are opened and closed in
 * nested order (**_x_**), and literal *, _ and ~ are escaped.
 */
export function toFountainInline(text, marks) {
  const esc = (t) => t.replace(/[*_~]/g, '\\$&');
  // Per-style pieces that never cross a line break and never start or end on a space.
  const pieces = mapMarks(normalizeMarks(marks, text.length), (ranges) => {
    const out = [];
    for (const [s, e] of ranges) {
      let a = s;
      for (let k = s; k <= e; k++) {
        if (k === e || text[k] === '\n') {
          let x = a;
          let y = k;
          while (x < y && /\s/.test(text[x])) x++;
          while (y > x && /\s/.test(text[y - 1])) y--;
          if (y > x) out.push([x, y]);
          a = k + 1;
        }
      }
    }
    return out;
  });
  if (!pieces) return esc(text);

  const segs = segments(text, pieces);
  const ORDER = ['b', 'i', 'u', 's']; // opening order; closing is the reverse
  const stack = [];
  let out = '';
  for (const seg of segs) {
    const want = ORDER.filter((k) => seg[k]);
    // Close down to the deepest style that should stay open, then open what's missing.
    let keep = 0;
    while (keep < stack.length && want.includes(stack[keep])) keep++;
    for (let n = stack.length - 1; n >= keep; n--) out += STYLE_INFO[stack[n]].md;
    stack.length = keep;
    for (const k of want) {
      if (!stack.includes(k)) {
        stack.push(k);
        out += STYLE_INFO[k].md;
      }
    }
    out += esc(seg.text);
  }
  for (let n = stack.length - 1; n >= 0; n--) out += STYLE_INFO[stack[n]].md;
  return out;
}
