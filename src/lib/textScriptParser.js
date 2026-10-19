// Plain-text screenplay ingestion: turns text exported or pasted from Google Docs,
// Word, PDFs or other apps into DraftLine elements.
//
// Real-world text arrives in three shapes, and the parser adapts to each:
//   • blank-line separated  — elements separated by empty lines (typed scripts, .txt exports)
//   • compact               — one paragraph per line, few or no blank lines (Docs/Word paste)
//   • indented              — hard-wrapped with indentation preserved (copied from a PDF)
//
// Output: { blocks: [{ type, text, dual?, note?, marks? }], meta, stats, layout, cleaned }.
//
// Inline formatting from Markdown/Fountain (**bold**, *italic*, _underline_, ~~strike~~) or
// HTML (<b>, <i>, <u>, <s> …) is kept: it's turned into private-use sentinels up front,
// every classifier looks at the line without them, and finish() converts them into the
// element's marks.

import { parseFountain } from './fountain.js';
import { looksLikeDate, looksLikeDraftVersion } from './titleFonts.js';
import {
  END_RE, isActBreak, isCueShaped, isFormatCue, isOnScreenText, isSceneHeadingLine, isSlugline, startsLikeProse,
} from './sluglines.js';
import { addNotes, extractNotes } from './notes.js';
import { applyInline, balanceLines, markInline, stripMarks as S } from './formatting.js';

const TRANSITION_EXACT = /^(?:FADE (?:IN|OUT)|FADE TO BLACK|CUT TO BLACK|SMASH TO BLACK|BLACKOUT)[.:]?$/;

const hasLetters = (s) => /\p{L}/u.test(s);
const isUpper = (s) => hasLetters(s) && s === s.toUpperCase();

/** Leading indentation in columns (a tab counts as 4). */
function indentOf(line) {
  let n = 0;
  for (const ch of line) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 4;
    else break;
  }
  return n;
}

/**
 * Scene headings: any INT./EXT. variant (INT/EXT, EXT/INT., I/E …), a secondary heading
 * (BACK TO …, LATER, MOMENTS LATER, RESUME, CONTINUOUS, SAME) or an all-caps
 * "FLASHBACK - CROIX-DES-BOSSALES - NIGHT". See sluglines.js.
 */
export function isSceneHeading(t) {
  return isSceneHeadingLine(t);
}


function cleanSceneHeading(t) {
  return t
    .replace(/^\./, '')
    .replace(/^\d+[A-Z]?[.)]?\s+/, '') // leading scene number
    .replace(/\s+\d+[A-Z]?\.?$/, '') // trailing scene number
    .replace(/\s*#[^#]*#\s*$/, '') // Fountain #12#
    .trim()
    .toUpperCase();
}

export function isTransition(t) {
  if (t.startsWith('>') && !t.endsWith('<')) return true;
  if (!isUpper(t)) return false;
  return /\bTO:$/.test(t) || TRANSITION_EXACT.test(t);
}

/**
 * A standalone ALL CAPS name, optionally with extensions like (V.O.) or (cont'd). Not a
 * character introduction: "FITO (10)--copper skin, bare feet" (an age, dashes, prose) is
 * Action. Pass the following line to also reject a name whose next line reads as more
 * description ("FITO (10)" / "copper skin, bare feet, darts…").
 */
export function looksLikeCue(t, next) {
  if (t.startsWith('@')) return true;
  if (!isCueShaped(t) || (next !== undefined && startsLikeProse(next))) return false;
  if (isOnScreenText(t) || isFormatCue(t)) return false; // SUPER: …, END MONTAGE are not speakers
  return !isSlugline(t) && !isSceneHeading(t) && !isTransition(t);
}

const isParenStart = (t) => t.startsWith('(');

/** Page furniture from PDFs and older formats that isn't part of the story. */
function isPageArtifact(t) {
  return /^\d{1,3}\.?$/.test(t) // page numbers
    || /^\(?\s*MORE\s*\)?$/i.test(t)
    || /^\(?\s*CONTINUED\s*\)?:?$/i.test(t)
    || /^CONT(?:INUED|'D)\.?:?$/i.test(t);
}

function detectLayout(lines) {
  const nonEmpty = lines.filter((l) => l.trim());
  if (!nonEmpty.length) return { kind: 'blank-line', base: 0 };
  const blanks = lines.length - nonEmpty.length;
  const indents = nonEmpty.map(indentOf).sort((a, b) => a - b);
  const base = indents[Math.floor(indents.length * 0.1)];
  const deep = nonEmpty.filter((l) => indentOf(l) - base >= 6).length;
  if (deep / nonEmpty.length >= 0.2) return { kind: 'indented', base };
  if (blanks / nonEmpty.length < 0.2) return { kind: 'compact', base };
  return { kind: 'blank-line', base };
}

/**
 * Title page detection for text that isn't Fountain: everything before the first
 * scene heading / FADE IN, when it contains a "Written by" style credit.
 */
function extractTitlePage(lines) {
  const stop = lines.findIndex((l) => {
    const t = l.trim();
    return isSceneHeading(t) || /^FADE IN/i.test(t);
  });
  if (stop <= 0) return null;
  const head = lines.slice(0, stop).map((l) => l.trim());
  const byIdx = head.findIndex((t) => /^(?:written|screenplay|teleplay|story)?\s*by\b/i.test(t));
  if (byIdx < 0) return null;

  const before = head.slice(0, byIdx).filter(Boolean);
  const title = before.length ? before[before.length - 1].replace(/^["“]|["”]$/g, '') : '';
  const creditMatch = head[byIdx].match(/^(?:[\w-]+\s+){0,3}?by\b\s*:?/i);
  const credit = creditMatch ? creditMatch[0].replace(/:$/, '').trim() : 'Written by';
  const sameLine = head[byIdx].slice(creditMatch ? creditMatch[0].length : 0).trim();
  let rest = head.slice(byIdx + 1);
  let author = sameLine;
  if (!author) {
    const k = rest.findIndex(Boolean);
    if (k >= 0) {
      author = rest[k];
      rest = rest.slice(k + 1);
    }
  }
  const remaining = rest.filter(Boolean);
  const based = remaining.find((t) => /^based on\b/i.test(t));
  const version = remaining.find((t) => t !== based && looksLikeDraftVersion(t));
  const date = remaining.find((t) => t !== based && t !== version && looksLikeDate(t));
  const contact = remaining.filter((t) => t !== based && t !== version && t !== date).join('\n');
  return {
    meta: {
      title,
      credit,
      author,
      basedOn: based ? based.replace(/^based on\s+/i, '') : '',
      draftVersion: version || '',
      draftDate: date || '',
      contact,
    },
    stop,
  };
}

/**
 * @param {string} source  raw text
 * @param {{ autoDetect?: boolean, unwrap?: boolean }} options
 *   autoDetect — classify elements (default true); off imports every paragraph as Action.
 *   unwrap     — join hard-wrapped lines inside a paragraph with spaces instead of keeping line
 *                breaks. 'auto' (default) joins them only for PDF-style indented text.
 */
export function parseTextScript(source, { autoDetect = true, unwrap = 'auto' } = {}) {
  let text = (source || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\f/g, '\n');

  // Real Fountain files (title page keys or forced elements) go through the Fountain parser.
  if (autoDetect && /^\s*Title\s*:/i.test(text)) {
    const f = parseFountain(text);
    return finish(f.blocks, f.meta, 'fountain', 0, false);
  }

  // [[Notes]] come out first so they can't affect classification; each line keeps its notes
  // (noteAt is parallel to lines), and a note on a line of its own joins the line above.
  let lines = [];
  let noteAt = [];
  {
    let carry = [];
    for (const rawLine of balanceLines(markInline(text).split('\n'))) {
      const { text: l, notes: marked } = extractNotes(rawLine);
      const notes = marked.map(S);
      if (notes.length && !S(l).trim()) {
        if (lines.length) noteAt[noteAt.length - 1].push(...notes);
        else carry.push(...notes);
        continue;
      }
      lines.push(l.replace(/\s+$/, ''));
      noteAt.push([...carry, ...notes]);
      carry = [];
    }
    if (carry.length && noteAt.length) noteAt[0].push(...carry);
  }
  let meta = {};
  let cleaned = 0;
  let actBreaks = 0;

  if (autoDetect) {
    const tp = extractTitlePage(lines.map(S));
    if (tp) {
      meta = tp.meta;
      lines = lines.slice(tp.stop);
      noteAt = noteAt.slice(tp.stop);
    }
    const kept = [];
    const keptNotes = [];
    lines.forEach((l, k) => {
      const t = S(l).trim();
      const drop = t && (isPageArtifact(t) || isActBreak(t));
      if (drop) {
        if (isActBreak(t)) actBreaks += 1; else cleaned += 1;
        if (keptNotes.length) keptNotes[keptNotes.length - 1].push(...noteAt[k]);
      } else {
        kept.push(l);
        keptNotes.push(noteAt[k]);
      }
    });
    lines = kept;
    noteAt = keptNotes;
  }

  const layout = detectLayout(lines.map(S));
  const unwrapOn = unwrap === 'auto' ? layout.kind === 'indented' : !!unwrap;
  const joiner = unwrapOn ? ' ' : '\n';
  const blocks = [];
  const last = () => blocks[blocks.length - 1];
  const push = (type, t, extra) => blocks.push(extra ? { type, text: t, ...extra } : { type, text: t });

  if (!autoDetect) {
    // Plain mode: paragraphs (or single lines in compact text) become Action.
    let para = [];
    let paraNotes = [];
    const flush = () => {
      if (para.length) {
        push('action', para.join(joiner));
        addNotes(last(), paraNotes);
      }
      para = [];
      paraNotes = [];
    };
    lines.forEach((l, k) => {
      if (!S(l).trim()) flush();
      else {
        para.push(l.trim());
        paraNotes.push(...noteAt[k]);
        if (layout.kind === 'compact') flush();
      }
    });
    flush();
    return finish(blocks, {}, layout.kind, 0, unwrapOn);
  }

  const rel = (l) => indentOf(l) - layout.base;
  let inSpeech = false;
  let speechHasDialogue = false; // compact layout: one dialogue paragraph per speech segment
  let prevBlank = true;
  let pendingNotes = []; // notes from the line just processed, attached to the block it fed

  for (let i = 0; i < lines.length; i++) {
    if (pendingNotes.length && last()) addNotes(last(), pendingNotes.splice(0));
    pendingNotes.push(...noteAt[i]);
    const raw = S(lines[i]);
    const tm = lines[i].trim(); // with formatting sentinels — what gets stored
    const t = raw.trim(); // without — what gets classified
    if (!t) {
      inSpeech = false;
      prevBlank = true;
      continue;
    }
    const next = S(lines[i + 1] ?? '');
    const nextT = next.trim();
    const afterCue = inSpeech && !speechHasDialogue; // the line right under a character cue

    // Forced Fountain-style markers
    if (t.startsWith('!')) {
      push('action', tm.slice(tm.indexOf('!') + 1).trim());
      inSpeech = false;
      prevBlank = false;
      continue;
    }

    // Right under a cue, only a real INT./EXT. heading interrupts: "LATER!" there is dialogue.
    if (isSlugline(t) || (!afterCue && isSceneHeading(t))) {
      push('scene', cleanSceneHeading(tm));
      inSpeech = false;
      prevBlank = false;
      continue;
    }

    // Format cues: IN CREOLE WITH ENGLISH SUBTITLES:, BEGIN FLASHBACK, END MONTAGE, SUPER:, TITLE: …
    if (!afterCue && isFormatCue(t)) {
      push('format_cue', tm); // shown and exported in caps; the typed case is kept
      inSpeech = false;
      prevBlank = false;
      continue;
    }

    // THE END (or "FADE OUT. THE END" on one line): centered, below the last transition.
    const end = !inSpeech && END_RE.exec(t);
    if (end) {
      if (end[1]) push('transition', end[1].toUpperCase().replace(/\.?$/, '.'));
      push('centered', end[1] ? end[2].toUpperCase() : tm.toUpperCase());
      inSpeech = false;
      prevBlank = false;
      continue;
    }

    // FADE IN:, FADE OUT., CUT TO:, SMASH CUT TO: … are always transitions.
    if (isTransition(t)) {
      push('transition', tm.replace(/^>\s*/, '').toUpperCase());
      inSpeech = false;
      prevBlank = false;
      continue;
    }

    // A new cue (also ends any current speech when there's no blank line between them).
    const cueIndentOk = layout.kind !== 'indented' || rel(raw) >= 10;
    if (nextT && cueIndentOk && looksLikeCue(t, nextT) && !(inSpeech && !speechHasDialogue)) {
      const dual = /\^\s*$/.test(t);
      push('character', tm.replace(/^@/, '').replace(/\s*\^\s*$/, '').toUpperCase(), dual ? { dual: true } : null);
      inSpeech = true;
      speechHasDialogue = false;
      prevBlank = false;
      continue;
    }

    if (inSpeech) {
      if (layout.kind === 'indented' && rel(raw) < 6) {
        inSpeech = false; // back at the action margin
      } else if (isParenStart(t)) {
        // Parentheticals can wrap across lines in PDF copies: read until the closing ")".
        let paren = tm;
        while (!S(paren).endsWith(')') && i + 1 < lines.length && S(lines[i + 1]).trim()
          && !looksLikeCue(S(lines[i + 1]).trim())) {
          i += 1;
          paren += ` ${lines[i].trim()}`;
          pendingNotes.push(...noteAt[i]);
        }
        push('parenthetical', paren);
        speechHasDialogue = false;
        prevBlank = false;
        continue;
      } else if (!speechHasDialogue) {
        push('dialogue', tm);
        speechHasDialogue = true;
        prevBlank = false;
        continue;
      } else if (layout.kind === 'compact') {
        inSpeech = false; // one paragraph per line: a second plain line is action
      } else {
        last().text += joiner + tm; // wrapped dialogue continues until a blank line
        prevBlank = false;
        continue;
      }
    }

    // Action: lines of one paragraph stay together (compact text: one line = one paragraph).
    const lb = last();
    if (lb?.type === 'action' && !prevBlank && layout.kind !== 'compact') lb.text += joiner + tm;
    else push('action', tm);
    prevBlank = false;
  }

  if (pendingNotes.length && last()) addNotes(last(), pendingNotes);
  const result = finish(mergePageBreakContinuations(blocks), meta, layout.kind, cleaned, unwrapOn);
  result.actBreaks = actBreaks;
  return result;
}

/**
 * In PDF copies a speech split by a page break reappears as "NAME (CONT'D)" right after
 * that character's own dialogue. Fold those back into one speech.
 */
function mergePageBreakContinuations(blocks) {
  const out = [];
  let lastCue = null;
  let joinNext = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (joinNext && b.type === 'dialogue' && out[out.length - 1]?.type === 'dialogue') {
      out[out.length - 1] = addNotes({ ...out[out.length - 1], text: `${out[out.length - 1].text} ${b.text}` }, b.note);
      joinNext = false;
      continue;
    }
    joinNext = false;
    if (b.type === 'character') {
      const name = b.text.replace(/\(.*?\)/g, '').trim();
      const prev = out[out.length - 1];
      const isCont = /\(\s*CONT(?:'|’)?D\s*\)|\(\s*CONTINUED\s*\)/i.test(b.text);
      if (isCont && lastCue === name && (prev?.type === 'dialogue' || prev?.type === 'parenthetical')) {
        joinNext = true; // drop the repeated cue; its lines join the previous speech
        if (b.note) out[out.length - 1] = addNotes({ ...prev }, b.note);
        continue;
      }
      lastCue = name;
    } else if (b.type !== 'dialogue' && b.type !== 'parenthetical') {
      lastCue = null;
    }
    out.push(b);
  }
  return out;
}

function finish(blocks, meta, layout, cleaned, unwrapped = false) {
  const clean = blocks.map(applyInline).filter((b) => b.text.trim());
  const stats = { scene: 0, action: 0, character: 0, dialogue: 0, parenthetical: 0, transition: 0, format_cue: 0, centered: 0 };
  const names = new Set();
  let notes = 0;
  for (const b of clean) {
    stats[b.type] += 1;
    if (b.note) notes += 1;
    if (b.type === 'character') names.add(b.text.replace(/\(.*?\)/g, '').trim());
  }
  return { blocks: clean, meta, stats: { ...stats, characters: names.size, notes }, layout, cleaned, unwrapped };
}
