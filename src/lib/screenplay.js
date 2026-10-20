// Core screenplay model: element types, keyboard flow, layout metrics, dual dialogue,
// pagination and script analysis.
//
// Layout is measured in "characters" and "lines" because Courier 12pt is exactly
// 10 characters per inch and 6 lines per inch. Every width below mirrors Editor.css.

// Order matters: it's the element dropdown's order and the Alt+1…8 bindings (see shortcuts.js).
export const ELEMENT_TYPES = ['scene', 'format_cue', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'centered'];

export const ELEMENT_META = {
  //              label shown in UI        chars/line  indent (chars)  blank lines before
  scene:         { label: 'Scene Heading', cpl: 60, indent: 0,  spaceBefore: 2 },
  action:        { label: 'Action',        cpl: 60, indent: 0,  spaceBefore: 1 },
  character:     { label: 'Character',     cpl: 38, indent: 22, spaceBefore: 1 },
  parenthetical: { label: 'Parenthetical', cpl: 25, indent: 16, spaceBefore: 0 },
  dialogue:      { label: 'Dialogue',      cpl: 35, indent: 10, spaceBefore: 0 },
  transition:    { label: 'Transition',    cpl: 60, indent: 0,  spaceBefore: 1 },
  // Language / sequence / technical directions: IN CREOLE WITH ENGLISH SUBTITLES:, BEGIN FLASHBACK…
  format_cue:    { label: 'Format Cue',    cpl: 60, indent: 0,  spaceBefore: 1 },
  // Centered text (Fountain's > THE END <): the script's closing "THE END", two lines down.
  centered:      { label: 'Centered',      cpl: 60, indent: 0,  spaceBefore: 2 },
};

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
  dialogue: 'dialogue',
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

/** Empty lines of these types become Action on Enter (step out of a speech, a transition …). */
export const ENTER_EMPTY_TO_ACTION = new Set(['character', 'dialogue', 'parenthetical', 'transition', 'format_cue', 'centered']);

/** What Enter does on `block` with the caret at the end: { convertTo } for an empty line, else { next }. */
export function enterFlow(block) {
  if (isBlank(block.text) && ENTER_EMPTY_TO_ACTION.has(block.type)) return { convertTo: 'action' };
  return { next: ENTER_NEXT[block.type] };
}

/** Typing "(" at the start of an empty Dialogue line makes it a Parenthetical "()" (caret inside). */
export const opensParenthetical = (block, key) => key === '(' && block?.type === 'dialogue' && block.text.trim() === '';

export function flowHints(type) {
  const enter = ELEMENT_META[ENTER_NEXT[type]].label;
  const tab =
    type === 'action' ? 'Character' :
    type === 'dialogue' ? 'Parenthetical' :
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

/**
 * Lays items onto 54-line pages.
 *   - A Character cue never sits alone at the bottom of a page: a whole speech
 *     (cue + parentheticals + dialogue) moves together; if a speech is longer than
 *     a page it may break, but never directly after the cue or a parenthetical.
 *   - Scene headings stay with the element that follows them.
 *   - Transitions never start a page; they stay with what precedes them.
 *   - Blank spacing lines are dropped at the top of a page.
 *
 * `measured` maps item key → line count reported by the browser; anything not yet
 * measured falls back to the wrap model.
 */
export function paginate(items, measured = {}) {
  const lines = items.map((it) => measured[it.key] ?? estimateItemLines(it));

  // 1. Atomic units: speeches.
  const raw = [];
  for (let i = 0; i < items.length;) {
    let end = i + 1;
    if (items[i].type === 'character') {
      while (end < items.length && (items[end].type === 'dialogue' || items[end].type === 'parenthetical')) end++;
    }
    raw.push([i, end]);
    i = end;
  }

  // 2. Keep transitions (and THE END) with what precedes them; keep headings with what follows.
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
    // Format cues that open something ("BEGIN FLASHBACK", "IN CREOLE…:") travel with what follows.
    if (tail.type === 'scene' || (tail.type === 'format_cue' && !isClosingCue(tail.block))) {
      carry = cur;
      continue;
    }
    units.push(cur);
  }
  if (carry) units.push(carry);

  // 3. Greedy placement.
  const place = new Array(items.length);
  let page = 0;
  let used = 0;

  const put = (k) => {
    const sp = used === 0 ? 0 : spaceBefore(items[k]);
    place[k] = { page, topLine: used + sp };
    used += sp + lines[k];
    if (used > PAGE_LINES) {
      // A single element longer than the remaining page (huge paragraph): let it run on.
      const extra = Math.floor((used - 1) / PAGE_LINES);
      page += extra;
      used -= extra * PAGE_LINES;
    }
  };
  const newPage = () => {
    page += 1;
    used = 0;
  };

  for (const [s, e] of units) {
    let total = 0;
    for (let k = s; k < e; k++) total += lines[k] + (k > s ? spaceBefore(items[k]) : 0);
    if (total <= PAGE_LINES) {
      if (used > 0 && used + spaceBefore(items[s]) + total > PAGE_LINES) newPage();
      for (let k = s; k < e; k++) put(k);
    } else {
      for (let k = s; k < e; k++) {
        const sp = used === 0 ? 0 : spaceBefore(items[k]);
        const prevType = k > s ? items[k - 1].type : null;
        const canBreak = k === s || !['character', 'parenthetical', 'scene'].includes(prevType);
        if (used > 0 && canBreak && used + sp + lines[k] > PAGE_LINES) newPage();
        put(k);
      }
    }
  }

  // 4. Margins (in lines + inter-page gaps) between consecutive items in one
  //    continuous column, so items land exactly on their page cards.
  const pageOfBlock = {};
  const pageOfKey = {};
  for (let k = 0; k < items.length; k++) {
    const p = place[k];
    if (k === 0) {
      p.marginLines = p.topLine;
      p.marginGaps = 0;
    } else {
      const q = place[k - 1];
      const dp = p.page - q.page;
      p.marginLines = dp * PAGE_HEIGHT_LINES + p.topLine - q.topLine - lines[k - 1];
      p.marginGaps = dp;
    }
    p.lines = lines[k];
    p.pos = p.page * PAGE_LINES + p.topLine;
    pageOfKey[items[k].key] = p.page + 1;
    for (const b of items[k].blocks) pageOfBlock[b.id] = p.page + 1;
  }

  const last = place[place.length - 1];
  return {
    place,
    pageCount: Math.max(1, page + 1),
    pageOfBlock,
    pageOfKey,
    endPos: last ? last.pos + last.lines : 0,
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
