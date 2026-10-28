// Core screenplay model: element types, keyboard flow, layout metrics, dual dialogue,
// pagination and script analysis.
//
// Layout is measured in "characters" and "lines" because Courier 12pt is exactly
// 10 characters per inch and 6 lines per inch. Every width below mirrors Editor.css.

// Order matters: it's the element dropdown's order and the Alt+1…8 bindings (see shortcuts.js).
export const ELEMENT_TYPES = ['scene', 'format_cue', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'centered'];

export const ELEMENT_META = {
  //              label shown in UI        chars/line  indent (chars)  blank lines before  spell-checked
  scene:         { label: 'Scene Heading', cpl: 60, indent: 0,  spaceBefore: 2, spellcheck: false },
  action:        { label: 'Action',        cpl: 60, indent: 0,  spaceBefore: 1, spellcheck: true },
  character:     { label: 'Character',     cpl: 38, indent: 22, spaceBefore: 1, spellcheck: false },
  parenthetical: { label: 'Parenthetical', cpl: 25, indent: 16, spaceBefore: 0, spellcheck: false },
  dialogue:      { label: 'Dialogue',      cpl: 35, indent: 10, spaceBefore: 0, spellcheck: true },
  transition:    { label: 'Transition',    cpl: 60, indent: 0,  spaceBefore: 1, spellcheck: false },
  // Language / sequence / technical directions: IN CREOLE WITH ENGLISH SUBTITLES:, BEGIN FLASHBACK…
  format_cue:    { label: 'Format Cue',    cpl: 60, indent: 0,  spaceBefore: 1, spellcheck: false },
  // Centered text (Fountain's > THE END <): the script's closing "THE END", two lines down.
  centered:      { label: 'Centered',      cpl: 60, indent: 0,  spaceBefore: 2, spellcheck: true },
};
// Spell-checking: prose (Action, Dialogue, Centered) is checked and autocorrected; names, sluglines,
// transitions, parentheticals and format cues are not, so character names and scene tags don't
// collect red underlines. Editor.jsx reads `spellcheck` per element.

/** Column metrics inside a dual-dialogue pair (each column is 3in wide). */
export const DUAL_CPL = { character: 27, parenthetical: 20, dialogue: 27 };

/** Page geometry: 11in page, 1in top/bottom margins, 6 lines per inch. */
export const PAGE_HEIGHT_LINES = 66;
export const PAGE_TOP_LINES = 6;
export const PAGE_LINES = 54;

/** Page number label for the 0-based page `p`: page 1 is unnumbered, then "2.", "3." … */
export const pageLabel = (p) => (p > 0 ? `${p + 1}.` : '');

/**
 * Element created when pressing Enter at the end of a block. Dialogue continues as Dialogue
 * (a second paragraph of the same speech); Enter on that new, empty line steps out to Action
 * — so "Enter, Enter" ends a speech. Any empty Character / Dialogue / Parenthetical /
 * Transition / Format Cue / Centered line turns into Action on Enter.
 */
export const ENTER_NEXT = {
  scene: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action', // a speech ends on Enter, as in Final Draft; Tab adds a parenthetical
  transition: 'action',
  format_cue: 'action',
  centered: 'action',
};

/** Tab on an empty block (or one with nothing to branch from) converts its type. */
export const TAB_NEXT = {
  action: 'character',
  character: 'transition',
  transition: 'scene',
  scene: 'action',
  dialogue: 'parenthetical',
  parenthetical: 'dialogue',
  format_cue: 'action',
  centered: 'action',
};

export const SHIFT_TAB_NEXT = {
  action: 'scene',
  scene: 'transition',
  transition: 'character',
  character: 'action',
  dialogue: 'parenthetical',
  parenthetical: 'dialogue',
  format_cue: 'action',
  centered: 'action',
};

/** Format cues that close a sequence ("END MONTAGE") stay with what precedes them. */
export const isClosingCue = (b) => b?.type === 'format_cue' && /^\s*END\b/i.test(b.text);

/** Elements that stay on the page of whatever precedes them. */
const keepsWithPrevious = (item) => item.type === 'transition' || item.type === 'centered' || isClosingCue(item.block);

// Lead-in keywords: language cues ("IN CREOLE WITH ENGLISH SUBTITLES"), PRE-LAP, SUPER, INSERT,
// TITLE, CHYRON. A keyword counts in capitals ("INSERT - THE LETTER") or, in any case, when a colon
// follows it ("Super: Port-au-Prince"), so ordinary Action that happens to start with "Insert the key…"
// or "Superstition…" isn't one.
const LEAD_IN_WORD = String.raw`(?:IN [A-Z/ ]+ (?:WITH|SUBTITLED?)|PRE-LAP|SUPER|INSERT|TITLE|CHYRON)`;
const LEAD_IN_CAPS = new RegExp(`^${LEAD_IN_WORD}(?![A-Za-z])`);
const LEAD_IN_COLON = new RegExp(`^${LEAD_IN_WORD}\\s*:`, 'i');
/** Shorter than this, an Action line ending in ":" introduces what follows ("She reads it aloud:"). */
export const LEAD_IN_COLON_MAX = 50;

/**
 * Action that introduces the element after it, so it must never end a page on its own:
 *   a) one short line ending in a colon ("On the screen:", under LEAD_IN_COLON_MAX characters);
 *   b) a one-paragraph lead-in: IN <LANGUAGE> WITH … / SUBTITLED, PRE-LAP, SUPER, INSERT, TITLE, CHYRON;
 *   c) a single line in capitals right before a Character cue or a Scene Heading ("SILENCE.").
 * `next` is the block that follows; (c) needs it, (a) and (b) don't.
 */
export function isLeadInAction(block, next = null) {
  if (block?.type !== 'action') return false;
  const t = String(block.text || '').trim();
  if (!t || t.includes('\n')) return false;
  if (t.endsWith(':') && t.length < LEAD_IN_COLON_MAX) return true;
  if (LEAD_IN_CAPS.test(t) || LEAD_IN_COLON.test(t)) return true;
  return (next?.type === 'character' || next?.type === 'scene')
    && t.length <= ELEMENT_META.action.cpl && /\p{L}/u.test(t) && t === t.toUpperCase();
}

/** Empty lines of these types become Action on Enter (step out of a speech, a transition …). */
export const ENTER_EMPTY_TO_ACTION = new Set(['character', 'dialogue', 'parenthetical', 'transition', 'format_cue', 'centered']);

/** What Enter does on `block` with the caret at the end: { convertTo } for an empty line, else { next }. */
export function enterFlow(block) {
  if (isBlank(block.text) && ENTER_EMPTY_TO_ACTION.has(block.type)) return { convertTo: 'action' };
  return { next: ENTER_NEXT[block.type] };
}

/**
 * The element Enter makes after `block` when `after` (the text past the caret) moves down with it:
 * ENTER_NEXT, except that splitting a speech mid-line keeps both halves Dialogue.
 */
export const enterNextType = (block, after = '') => (block.type === 'dialogue' && after.trim() ? 'dialogue' : ENTER_NEXT[block.type]);

/** Typing "(" at the start of an empty Dialogue line makes it a Parenthetical "()" (caret inside). */
export const opensParenthetical = (block, key) => key === '(' && block?.type === 'dialogue' && block.text.trim() === '';

export function flowHints(type) {
  const enter = ELEMENT_META[ENTER_NEXT[type]].label;
  const tab =
    type === 'action' ? 'Character' :
    type === 'dialogue' ? 'Parenthetical' :
    type === 'character' ? 'Extension' :
    type === 'scene' ? 'Time of day' :
    ELEMENT_META[TAB_NEXT[type]].label;
  return { enter, tab };
}

let idCounter = 0;
const idSeed = Math.random().toString(36).slice(2, 7);
export function newId() {
  idCounter += 1;
  return `b${idSeed}${idCounter.toString(36)}`;
}

export function makeBlock(type, text = '', extra = null) {
  return extra ? { id: newId(), type, text, ...extra } : { id: newId(), type, text };
}

export function isBlank(text) {
  return text.trim() === '' || text.trim() === '()';
}

const isSpeechPart = (b) => b && (b.type === 'dialogue' || b.type === 'parenthetical');

/** Strip extensions like (V.O.), (CONT'D), the dual-dialogue caret and the Fountain @ prefix. */
export function characterName(text) {
  return text
    .replace(/^@/, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\^\s*$/, '')
    .trim()
    .toUpperCase();
}

export function characterExtension(text) {
  const m = text.match(/\((.*?)\)/);
  return m ? `(${m[1].toUpperCase()})` : '';
}

// ---------------------------------------------------------------------------
// Word-wrap model (used for arrow-key navigation and as a fallback line count
// before the browser has measured an element).
// ---------------------------------------------------------------------------

function findBreak(line, s, cpl) {
  const limit = s + cpl;
  for (let k = limit; k > s; k--) {
    if (line[k] === ' ') return [k, k + 1];
    const prev = line[k - 1];
    if ((prev === '-' || prev === '—') && k - 1 > s && /\w/.test(line[k] || '')) return [k, k];
  }
  return null;
}

/** Returns [start, end] offsets into `text` for each visual line. */
export function wrapOffsets(text, cpl) {
  const lines = [];
  let base = 0;
  for (const hard of text.split('\n')) {
    if (hard.length === 0) lines.push([base, base]);
    let s = 0;
    while (s < hard.length) {
      if (hard.length - s <= cpl) {
        lines.push([base + s, base + hard.length]);
        break;
      }
      const br = findBreak(hard, s, cpl);
      if (!br) {
        lines.push([base + s, base + s + cpl]);
        s += cpl;
      } else {
        lines.push([base + s, base + br[0]]);
        s = br[1];
      }
    }
    base += hard.length + 1;
  }
  return lines;
}

export function lineIndexOf(lines, pos) {
  for (let i = lines.length - 1; i >= 0; i--) if (pos >= lines[i][0]) return i;
  return 0;
}

export function wordCount(text) {
  let n = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const space = c === 32 || c === 10 || c === 9 || c === 13 || c === 160;
    if (!space && !inWord) n++;
    inWord = !space;
  }
  return n;
}

// Blocks are immutable, so derived per-block values can be cached by identity.
const wordCache = new WeakMap();
function blockWords(b) {
  let n = wordCache.get(b);
  if (n === undefined) {
    n = wordCount(b.text);
    wordCache.set(b, n);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Dual dialogue.
// The second speaker's Character block carries `dual: true` (mirrors Fountain's
// `NAME ^`). A pair is only valid when that cue directly follows another speech.
// ---------------------------------------------------------------------------

export function speechEnd(blocks, cueIdx) {
  let j = cueIdx + 1;
  while (j < blocks.length && isSpeechPart(blocks[j])) j++;
  return j;
}

function speechStart(blocks, idx) {
  let c = idx;
  while (c >= 0 && isSpeechPart(blocks[c])) c--;
  return c >= 0 && blocks[c].type === 'character' ? c : -1;
}

/**
 * Groups blocks into render/layout "items": single blocks, or a dual-dialogue pair
 * ({ kind: 'dual', left: [...], right: [...] }).
 */
export function buildItems(blocks) {
  const items = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === 'character') {
      const j = speechEnd(blocks, i);
      const nb = blocks[j];
      if (nb && nb.type === 'character' && nb.dual) {
        const k = speechEnd(blocks, j);
        items.push({
          kind: 'dual',
          key: b.id,
          type: 'dual',
          left: blocks.slice(i, j),
          right: blocks.slice(j, k),
          blocks: blocks.slice(i, k),
        });
        i = k;
        continue;
      }
    }
    items.push({ kind: 'block', key: b.id, type: b.type, block: b, blocks: [b] });
    i++;
  }
  return items;
}

/**
 * Toggle dual dialogue for the speech containing blocks[idx].
 * Returns { blocks } on success or { error } explaining why it can't.
 */
export function toggleDualAt(blocks, idx) {
  const c = speechStart(blocks, idx);
  if (c < 0) return { error: 'Put the cursor in a character’s speech to make it dual dialogue.' };
  const end = speechEnd(blocks, c);
  const set = (i, dual) => blocks.map((b, k) => {
    if (k !== i) return b;
    const { dual: _old, ...rest } = b; // eslint-disable-line no-unused-vars
    return dual ? { ...rest, dual: true } : rest;
  });

  // Already part of a pair → un-pair.
  const prevCue = c > 0 ? speechStart(blocks, c - 1) : -1;
  const pairedWithPrev = blocks[c].dual && prevCue >= 0 && speechEnd(blocks, prevCue) === c;
  if (pairedWithPrev) return { blocks: set(c, false), paired: false };
  const next = blocks[end];
  if (next?.type === 'character' && next.dual) return { blocks: set(end, false), paired: false };

  // Pair with the speech right before (this one becomes the right column)…
  if (prevCue >= 0 && speechEnd(blocks, prevCue) === c && !blocks[prevCue].dual) {
    return { blocks: set(c, true), paired: true };
  }
  // …or with the speech right after.
  if (next?.type === 'character') {
    const after = blocks[speechEnd(blocks, end)];
    if (!(after?.type === 'character' && after.dual)) return { blocks: set(end, true), paired: true };
  }
  return { error: 'Dual dialogue needs two speeches back to back.' };
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function blockLines(b, cpl) {
  return wrapOffsets(b.text || ' ', cpl).length;
}

export function estimateItemLines(item) {
  if (item.kind === 'dual') {
    const col = (bs) => bs.reduce((n, b) => n + blockLines(b, DUAL_CPL[b.type] || 27), 0);
    return Math.max(col(item.left), col(item.right));
  }
  return blockLines(item.block, ELEMENT_META[item.type].cpl);
}

function spaceBefore(item) {
  return item.kind === 'dual' ? 1 : ELEMENT_META[item.type].spaceBefore;
}

/** The Character line that resumes a speech on the next page: "FITOH (CONT'D)", keeping (V.O.) etc. */
export function contdCue(cueText) {
  const base = String(cueText || '').replace(/^@/, '').replace(/\^\s*$/, '').trim().toUpperCase();
  return /\(CONT['’]D\)/.test(base) ? base : `${base} (CONT'D)`;
}

/** Page-seam minimums: lines of dialogue that must stay on each side of a split speech. */
export const SPLIT_MIN_LINES = 2;
/** Lines of following action / dialogue a scene heading needs on its page. */
const HEADING_MIN_FOLLOW = 2;

/**
 * Lays items onto 54-line pages, with the industry's page-seam rules:
 *   - Speeches (cue + parentheticals + dialogue) move to the next page whole — unless at least
 *     2 lines of dialogue fit here and at least 2 remain. Then the speech splits at a dialogue
 *     line: "(MORE)" under the last line on this page, "NAME (CONT'D)" above the rest on the
 *     next. A split never falls inside or directly after a parenthetical, and dual dialogue
 *     never splits. (MORE) and (CONT'D) are layout only: nothing is added to the script.
 *   - A scene heading is never the last thing on a page: it moves with at least 2 lines of
 *     what follows it.
 *   - Lead-in Action (isLeadInAction: "She reads it aloud:", "SUPER: 1991") is never the last thing
 *     on a page either: it moves on with the element it introduces.
 *   - Transitions (and THE END) never start a page; they stay with what precedes them.
 *   - Blank spacing lines are dropped at the top of a page.
 *
 * `measured` maps item key → line count reported by the browser; anything not yet
 * measured falls back to the wrap model.
 *
 * Returns { place, pageCount, pageOfBlock, pageOfKey, endPos }. place[k] is where item k starts
 * (page, topLine, pos), its line count, and the margin above it in the editor's continuous
 * column. An item that sits at a seam also has `pieces`: [{ page, topLine, from, to, more, cont,
 * marginLines, marginGaps }] — the lines [from, to) of the element on that page, with
 * `more` (a (MORE) line follows) and `cont` (a "NAME (CONT'D)" line comes first).
 */
export function paginate(items, measured = {}) {
  const lines = items.map((it) => measured[it.key] ?? estimateItemLines(it));
  const type = (k) => items[k].type;
  const splittable = (k) => items[k].kind === 'block' && type(k) === 'dialogue';

  // 1. Atomic units: speeches.
  const raw = [];
  for (let i = 0; i < items.length;) {
    let end = i + 1;
    if (type(i) === 'character') {
      while (end < items.length && (type(end) === 'dialogue' || type(end) === 'parenthetical')) end++;
    }
    raw.push([i, end]);
    i = end;
  }

  // 2. Keep transitions (and THE END) with what precedes them; keep headings (and opening
  //    format cues) with what follows — for a heading, at least 2 lines of it.
  const followsHeading = (u) => {
    let h = -1;
    for (let k = u[0]; k < u[1]; k++) if (type(k) === 'scene') h = k;
    if (h < 0) return Infinity;
    let n = 0;
    for (let k = h + 1; k < u[1]; k++) n += lines[k];
    return n;
  };
  const units = [];
  let carry = null;
  for (const u of raw) {
    if (keepsWithPrevious(items[u[0]]) && units.length && !carry) {
      units[units.length - 1][1] = u[1];
      continue;
    }
    const cur = carry ? [carry[0], u[1]] : [...u];
    carry = null;
    const tail = items[cur[1] - 1];
    // Format cues that open something ("BEGIN FLASHBACK", "IN CREOLE…:") travel with what follows,
    // and so does lead-in Action ("She reads it aloud:", "SUPER: 1991"): never the last line of a page.
    const leadIn = tail.kind === 'block' && cur[1] < items.length && isLeadInAction(tail.block, items[cur[1]].blocks[0]);
    if (tail.type === 'scene' || (tail.type === 'format_cue' && !isClosingCue(tail.block)) || leadIn || followsHeading(cur) < HEADING_MIN_FOLLOW) {
      carry = cur;
      continue;
    }
    units.push(cur);
  }
  if (carry) units.push(carry);

  // 3. Placement.
  const pieces = items.map(() => []);
  let page = 0;
  let used = 0;
  let pendingCont = null; // "NAME (CONT'D)" waiting at the top of a fresh page

  const piece = (k, from, to, sp) => {
    const top = used + sp;
    const pc = { page, topLine: top, from, to, more: false, cont: null };
    if (pendingCont) {
      pc.cont = pendingCont;
      pendingCont = null;
    }
    pieces[k].push(pc);
    used = top + (to - from);
    if (used > PAGE_LINES) {
      // A single element longer than the remaining page (huge paragraph): let it run on.
      const extra = Math.floor((used - 1) / PAGE_LINES);
      page += extra;
      used -= extra * PAGE_LINES;
    }
    return pc;
  };
  const newPage = () => {
    page += 1;
    used = 0;
  };
  // Blank lines before item k when it starts (not continues) here.
  const gapBefore = (k, off) => (used === 0 || off > 0 ? 0 : spaceBefore(items[k]));

  /** The cue of the speech item k belongs to, or -1. */
  const cueOf = (k) => {
    let c = k;
    while (c >= 0 && (type(c) === 'dialogue' || type(c) === 'parenthetical')) c--;
    return c >= 0 && type(c) === 'character' ? c : -1;
  };

  /**
   * The latest legal split of [ (k0, off0) … e ) on the current page: { k, at } where `at` lines
   * of item k stay here. null if none: then the rest moves on whole.
   */
  const findSplit = (k0, off0, e) => {
    // Dialogue lines left in the speech from item k (offset off) onward.
    const dlgAfter = (k, off) => {
      let n = 0;
      for (let j = k; j < e && (j === k || type(j) === 'dialogue' || type(j) === 'parenthetical'); j++) {
        if (type(j) === 'dialogue') n += lines[j] - (j === k ? off : 0);
      }
      return n;
    };
    let y = used;
    let dlgHere = 0; // dialogue lines of the current speech already on this page
    let best = null;
    for (let k = k0; k < e; k++) {
      const off = k === k0 ? off0 : 0;
      const sp = y === 0 || off > 0 ? 0 : spaceBefore(items[k]);
      const n = lines[k] - off;
      if (type(k) === 'character') dlgHere = 0;
      if (splittable(k) && cueOf(k) >= 0) {
        for (let m = 1; m <= n; m++) {
          if (y + sp + m + 1 > PAGE_LINES) break; // + the (MORE) line
          const atEnd = m === n;
          // At an element boundary the next part of the speech must exist and not be another cue.
          if (atEnd && !(k + 1 < e && (type(k + 1) === 'dialogue' || type(k + 1) === 'parenthetical'))) continue;
          if (dlgHere + m < SPLIT_MIN_LINES) continue;
          if (dlgAfter(k, off + m) < SPLIT_MIN_LINES) continue;
          best = { k, at: off + m };
        }
      }
      y += sp + n;
      if (type(k) === 'dialogue') dlgHere += n;
      if (y >= PAGE_LINES) break;
    }
    return best;
  };

  let fresh = true; // nothing on this page yet but, at most, a (CONT'D) line
  let last = null; // the last piece placed
  const put = (k, from, to) => {
    last = piece(k, from, to, fresh && from === 0 ? 0 : gapBefore(k, from));
    fresh = false;
    return last;
  };
  // Is item k (from offset off) the continuation of a speech whose cue is already placed?
  const midSpeech = (k, off) => off > 0 || ((type(k) === 'dialogue' || type(k) === 'parenthetical') && cueOf(k) >= 0 && pieces[cueOf(k)].length > 0);
  const turnPage = (cueK) => {
    newPage();
    fresh = true;
    if (cueK >= 0) {
      pendingCont = contdCue(items[cueK].block.text);
      used = 1; // NAME (CONT'D)
    }
  };

  for (const [s, e] of units) {
    let k = s;
    let off = 0;
    while (k < e) {
      // Lines the rest of the unit needs here.
      let total = 0;
      for (let j = k; j < e; j++) total += (j === k ? gapBefore(j, off) : spaceBefore(items[j])) + lines[j] - (j === k ? off : 0);
      if (used + total <= PAGE_LINES) {
        for (; k < e; k++, off = 0) put(k, off, lines[k]);
        break;
      }
      const split = findSplit(k, off, e);
      if (split) {
        for (; k < split.k; k++, off = 0) put(k, off, lines[k]);
        put(split.k, off, split.at).more = true;
        used += 1; // (MORE)
        turnPage(cueOf(split.k));
        if (split.at >= lines[split.k]) {
          k = split.k + 1;
          off = 0;
        } else {
          k = split.k;
          off = split.at;
        }
        continue;
      }
      // An element taller than a whole page (a long Action paragraph, a pasted block) can never
      // fit: it breaks at the page edge, line by line, with at least 2 lines on each side —
      // otherwise it would run off the bottom of the paper in print and PDF.
      const rest = lines[k] - off;
      if (rest > PAGE_LINES && type(k) !== 'dialogue' && type(k) !== 'parenthetical') {
        const room = PAGE_LINES - used - (fresh && off === 0 ? 0 : gapBefore(k, off));
        if (room >= SPLIT_MIN_LINES) {
          put(k, off, off + room);
          turnPage(-1);
          off += room;
          continue;
        }
      }
      if (!fresh) {
        // The unit leads up to an element taller than a page (a heading, then a huge paragraph):
        // fill this page — heading included — if at least 2 of its lines fit, rather than leaving
        // the page nearly empty. The big element then breaks at the page edge (above).
        let h = k;
        let need = 0;
        while (h < e && !(lines[h] - (h === k ? off : 0) > PAGE_LINES && type(h) !== 'dialogue' && type(h) !== 'parenthetical')) {
          need += (h === k ? gapBefore(h, off) : spaceBefore(items[h])) + lines[h] - (h === k ? off : 0);
          h++;
        }
        if (h < e && h > k && used + need + spaceBefore(items[h]) + SPLIT_MIN_LINES <= PAGE_LINES) {
          for (; k < h; k++, off = 0) put(k, off, lines[k]);
          continue;
        }
        // Doesn't fit and can't split here: the rest starts a fresh page (still a speech? cue it).
        const mid = midSpeech(k, off);
        if (mid && last && used < PAGE_LINES) {
          last.more = true;
          used += 1;
        }
        turnPage(mid ? cueOf(k) : -1);
        continue;
      }
      // Longer than a whole page with no legal split: place one element (a huge paragraph runs
      // on) and carry on with the next.
      put(k, off, lines[k]);
      k += 1;
      off = 0;
    }
  }

  // 4. Margins (in lines + inter-page gaps) between consecutive pieces in one continuous
  //    column, so everything lands exactly on its page card. A piece's (CONT'D) line sits
  //    just above it; its (MORE) line just below.
  const place = new Array(items.length);
  const pageOfBlock = {};
  const pageOfKey = {};
  let prev = null; // { page, end } of the last piece, (MORE) included
  for (let k = 0; k < items.length; k++) {
    const ps = pieces[k];
    for (const pc of ps) {
      const start = pc.topLine - (pc.cont ? 1 : 0);
      if (!prev) {
        pc.marginLines = start;
        pc.marginGaps = 0;
      } else {
        const dp = pc.page - prev.page;
        pc.marginLines = dp * PAGE_HEIGHT_LINES + start - prev.end;
        pc.marginGaps = dp;
      }
      prev = { page: pc.page, end: pc.topLine + (pc.to - pc.from) + (pc.more ? 1 : 0) };
    }
    const first = ps[0];
    const seam = ps.length > 1 || first.more || !!first.cont;
    place[k] = {
      page: first.page,
      topLine: first.topLine,
      lines: lines[k],
      pos: first.page * PAGE_LINES + first.topLine,
      marginLines: first.marginLines,
      marginGaps: first.marginGaps,
      ...(seam ? { pieces: ps } : {}),
    };
    pageOfKey[items[k].key] = first.page + 1;
    for (const b of items[k].blocks) pageOfBlock[b.id] = first.page + 1;
  }

  const lastPieces = pieces[pieces.length - 1];
  const tail = lastPieces?.[lastPieces.length - 1];
  return {
    place,
    pageCount: Math.max(1, page + 1),
    pageOfBlock,
    pageOfKey,
    endPos: tail ? tail.page * PAGE_LINES + tail.topLine + (tail.to - tail.from) : 0,
  };
}

/** "1 3/8" style scene lengths, rounded up to the nearest eighth (min 1/8). */
/** Screenplay lines → eighths of a page (at least 1), the way scene lengths are counted. */
export const linesToEighths = (lines) => Math.max(1, Math.ceil((lines / PAGE_LINES) * 8 - 0.01));

export function formatEighths(lines) {
  const eighths = linesToEighths(lines);
  const whole = Math.floor(eighths / 8);
  const rem = eighths % 8;
  if (!whole) return `${rem}/8`;
  return rem ? `${whole} ${rem}/8` : `${whole}`;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Single pass producing scene numbers, the scene each block belongs to, and a
 * per-character index of every speech with scene context.
 */
export function analyzeScript(blocks) {
  const sceneNumbers = {};
  const sceneOfBlock = {};
  const characters = new Map();
  let scene = 0;
  let sceneId = null;
  let heading = '';
  let lastSpeech = null;
  let words = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    words += blockWords(b);
    if (b.type === 'scene') {
      scene += 1;
      sceneId = b.id;
      heading = b.text.trim().toUpperCase();
      sceneNumbers[b.id] = scene;
      lastSpeech = null;
    }
    sceneOfBlock[b.id] = sceneId;
    if (b.type !== 'character') continue;
    const name = characterName(b.text);
    if (!name) continue;

    const end = speechEnd(blocks, i);
    const parts = blocks.slice(i + 1, end);
    if (parts.length === 0) continue; // a cue still being typed isn't a character yet
    const following = blocks[end];
    const prevCue = i > 0 ? speechStart(blocks, i - 1) : -1;
    const dual = (b.dual && prevCue >= 0 && speechEnd(blocks, prevCue) === i)
      || (following?.type === 'character' && !!following.dual);

    let c = characters.get(name);
    if (!c) {
      c = { name, entries: [], lines: 0, words: 0, scenes: new Set() };
      characters.set(name, c);
    }
    const dialogueParts = parts.filter((p) => p.type === 'dialogue');
    c.lines += dialogueParts.length;
    c.words += dialogueParts.reduce((n, p) => n + blockWords(p), 0);
    c.scenes.add(scene);
    c.entries.push({
      cue: b,
      extension: characterExtension(b.text),
      scene,
      heading,
      parts,
      dual,
      context: lastSpeech && lastSpeech.name !== name ? lastSpeech : null,
    });

    const lastDialogue = dialogueParts[dialogueParts.length - 1];
    if (lastDialogue) lastSpeech = { name, text: lastDialogue.text };
  }

  const characterList = [...characters.values()].sort(
    (a, b) => b.lines - a.lines || a.name.localeCompare(b.name),
  );

  return { sceneNumbers, sceneOfBlock, sceneCount: scene, characters, characterList, words };
}
