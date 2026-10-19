// Fountain (https://fountain.io) import/export.

import { draftLines, splitDraftInfo } from './titleFonts.js';
import { END_RE, isCueShaped, isFormatCue, isSlugline, startsLikeProse } from './sluglines.js';
import { addNotes, fountainNote } from './notes.js';
import { parseInline, stripInline, toFountainInline } from './formatting.js';

/** The element's text with **bold**, *italic*, _underline_ and ~~strike~~ (literal * _ ~ escaped). */
const ft = (b) => toFountainInline(b.text, b.marks);

const SCENE_RE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const FORCE_CHARS = /^[!@#~=>.[]/;

function isAllCaps(s) {
  return /[A-Z]/.test(s) && s === s.toUpperCase();
}

function escapeAction(text) {
  const lines = text.replace(/\s+$/, '').split('\n');
  const first = lines[0].trim();
  const needsForce =
    SCENE_RE.test(first) ||
    FORCE_CHARS.test(first) ||
    (isAllCaps(first) && /TO:$/.test(first)) ||
    (isAllCaps(first) && lines.length > 1); // would otherwise read as a Character cue
  if (needsForce) lines[0] = `!${lines[0]}`;
  return lines.join('\n');
}

function wrapParens(text) {
  let t = text.trim();
  if (!t.startsWith('(')) t = `(${t}`;
  if (!t.endsWith(')')) t = `${t})`;
  return t;
}

export function basedOnLine(v) {
  const t = (v || '').trim();
  if (!t) return '';
  return /^based on\b/i.test(t) ? t : `Based on ${t}`;
}

function titleField(key, value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (!v.includes('\n')) return `${key}: ${v}`;
  return `${key}:\n${v.split('\n').map((l) => `    ${l.trim()}`).join('\n')}`;
}

export function toFountain({ meta = {}, blocks }) {
  const paras = [];

  const titlePage = [
    titleField('Title', meta.title),
    meta.author?.trim() ? titleField('Credit', meta.credit ?? 'Written by') : null,
    titleField('Author', meta.author),
    titleField('Source', basedOnLine(meta.basedOn)),
    // Standard Fountain key; the version (if any) is the first line, the date the second.
    titleField('Draft date', draftLines(meta).join('\n')),
    titleField('Contact', meta.contact),
  ].filter(Boolean);
  if (titlePage.length) paras.push(titlePage.join('\n'));

  const bs = blocks.filter((b) => (b.text.trim() !== '' && b.text.trim() !== '()') || b.note?.trim());
  let i = 0;
  // Dual dialogue is only valid when a ^ cue directly follows a (non-^) speech.
  let lastSpeech = null; // 'left' | 'right' | null
  while (i < bs.length) {
    const b = bs[i];
    if (b.text.trim() === '' || b.text.trim() === '()') {
      // An element that only carries a note becomes a standalone [[note]].
      paras.push(fountainNote(b).trim());
      lastSpeech = null;
      i++;
      continue;
    }
    switch (b.type) {
      case 'scene': {
        // Export uses the strict Fountain prefixes; anything else is forced with "."
        const t = ft(b).trim().toUpperCase();
        paras.push((SCENE_RE.test(t) ? t : `.${t}`) + fountainNote(b));
        lastSpeech = null;
        i++;
        break;
      }
      case 'transition': {
        const t = ft(b).trim().toUpperCase();
        paras.push((/TO:$/.test(t) ? t : `> ${t}`) + fountainNote(b));
        lastSpeech = null;
        i++;
        break;
      }
      case 'character': {
        let cue = ft(b).trim().toUpperCase().replace(/\s*\^$/, '');
        const bare = cue.replace(/\(.*?\)/g, '').trim();
        if (!/[A-Z]/.test(bare)) cue = `@${cue}`;
        const isRight = !!b.dual && lastSpeech === 'left';
        const lines = [(isRight ? `${cue} ^` : cue) + fountainNote(b)];
        i++;
        while (i < bs.length && (bs[i].type === 'dialogue' || bs[i].type === 'parenthetical') && bs[i].text.trim()) {
          const p = bs[i];
          if (p.type === 'parenthetical') lines.push(wrapParens(ft(p)) + fountainNote(p));
          else lines.push(ft(p).replace(/\s+$/, '').split('\n').map((l) => (l.trim() === '' ? '  ' : l)).join('\n') + fountainNote(p));
          i++;
        }
        if (lines.length > 1) {
          paras.push(lines.join('\n'));
          lastSpeech = isRight ? 'right' : 'left';
        } else {
          // A cue with no dialogue isn't a valid Fountain character; keep it as action.
          paras.push(escapeAction(cue) + fountainNote(b));
          lastSpeech = null;
        }
        break;
      }
      case 'centered':
        paras.push(ft(b).replace(/\s+$/, '').split('\n').map((l) => `> ${l.trim()} <`).join('\n') + fountainNote(b));
        lastSpeech = null;
        i++;
        break;
      case 'format_cue':
        // Fountain has no format-cue element: an all-caps Action line, which DraftLine (and the
        // text importer) reads back as a Format Cue when it matches IN … WITH ENGLISH SUBTITLES,
        // BEGIN …, END …, SUPER: … The .fdx export keeps every format cue exactly.
        paras.push(escapeAction(ft(b).trim().toUpperCase()) + fountainNote(b));
        lastSpeech = null;
        i++;
        break;
      default:
        paras.push(escapeAction(ft(b)) + fountainNote(b));
        lastSpeech = null;
        i++;
    }
  }
  return `${paras.join('\n\n')}\n`;
}

/**
 * A character cue: a short all-caps name standing alone, with only extensions like (V.O.).
 * "FITO (10)--copper skin, bare feet" — or a name whose next line reads as more
 * description — introduces a character in Action instead.
 */
function isCharacterCue(line, next) {
  if (line.startsWith('@')) return true;
  const bare = stripInline(line).replace(/\(.*?\)/g, '').replace(/\^\s*$/, '').trim();
  return isCueShaped(line) && !startsLikeProse(next) && isAllCaps(bare) && !isSlugline(bare) && !isFormatCue(bare);
}

/** A whole line that's a format cue on its own: SUPER: …, TITLE: …, IN CREOLE WITH ENGLISH SUBTITLES: */
const isCueLine = (line) => isFormatCue(line.trim()) && isAllCaps(stripInline(line));

// Private-use markers stand in for [[notes]] while lines are classified, so a note can
// never change how its line is read, and each note stays with the element it was on.
const MARK_RE = /\uE000(\d+)\uE001/g;

/** Parses Fountain text into { meta, blocks: [{type, text, dual?, note?}] }. */
export function parseFountain(source) {
  let text = source.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  text = text.replace(/\/\*[\s\S]*?\*\//g, ''); // boneyard
  const store = [];
  text = text.replace(/\[\[([\s\S]*?)\]\]/g, (_, n) => `\uE000${store.push(n) - 1}\uE001`);
  const take = (line) => {
    const notes = [];
    const t = line.replace(MARK_RE, (_, k) => {
      const n = store[Number(k)].split('\n').map((l) => (l === '  ' ? '' : l.trim())).join('\n').trim();
      if (n) notes.push(n);
      return '';
    });
    return { t: notes.length ? t.replace(/[ \t]+$/, '') : t, notes };
  };
  const lines = text.split('\n');

  const tp = {};
  let i = 0;
  // A title page starts with a known key — not just any "WORDS:" line, or a script that
  // opens with FADE IN: or CUT TO: would lose that line to the title page.
  if (/^\s*(?:title|credit|author|authors|source|draft date|draft|revision|contact|copyright|notes|date|episode|series)\s*:/i
    .test(take(lines[0] || '').t)) {
    let key = null;
    while (i < lines.length && lines[i].trim() !== '') {
      const line = take(lines[i]).t;
      const m = line.match(/^([A-Za-z][A-Za-z ]*):\s*(.*)$/);
      if (m) {
        key = m[1].trim().toLowerCase();
        tp[key] = m[2].trim();
      } else if (key) {
        tp[key] = tp[key] ? `${tp[key]}\n${line.trim()}` : line.trim();
      }
      i++;
    }
  }

  const paras = [];
  let cur = [];
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '' && l !== '  ') {
      if (cur.length) paras.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) paras.push(cur);

  const blocks = [];
  let pending = []; // notes seen before any element exists
  const push = (type, raw, extra, notes = []) => {
    const { text: t, marks } = parseInline(raw);
    const b = extra ? { type, text: t, ...extra } : { type, text: t };
    if (marks) b.marks = marks;
    addNotes(b, [...pending, ...notes]);
    pending = [];
    blocks.push(b);
    return b;
  };
  const attachToLast = (notes) => {
    if (!notes.length) return;
    if (blocks.length) addNotes(blocks[blocks.length - 1], notes);
    else pending.push(...notes);
  };

  for (const rawPara of paras) {
    // Separate notes from text; a line that held only a note folds into its neighbour.
    const lines = [];
    let carry = [];
    for (const raw of rawPara) {
      const { t, notes } = take(raw);
      if (!t.trim() && notes.length && raw !== '  ') {
        if (lines.length) lines[lines.length - 1].notes.push(...notes);
        else carry.push(...notes);
        continue;
      }
      lines.push({ t, notes: [...carry, ...notes] });
      carry = [];
    }
    if (!lines.length) {
      attachToLast(carry); // a standalone [[note]] paragraph belongs to the element above
      continue;
    }
    const p = lines.map((l) => l.t);
    const allNotes = lines.flatMap((l) => l.notes);
    const first = p[0].trim();
    if (/^#/.test(first) || /^=(?!==)/.test(first) || /^===+$/.test(first)) {
      attachToLast(allNotes);
      continue;
    }

    if ((first.startsWith('.') && !first.startsWith('..')) || isSlugline(first)) {
      push('scene', first.replace(/^\./, '').replace(/\s*#[^#]*#\s*$/, '').trim(), null, lines[0].notes);
      if (p.length > 1) push('action', p.slice(1).join('\n'), null, lines.slice(1).flatMap((l) => l.notes));
      continue;
    }
    if (first.startsWith('>') && first.endsWith('<')) {
      push('centered', p.map((l) => l.trim().replace(/^>\s*|\s*<$/g, '')).join('\n'), null, allNotes);
      continue;
    }
    if (first.startsWith('>') && p.length === 1) {
      push('transition', first.slice(1).trim(), null, allNotes);
      continue;
    }
    // …TO: lines, plus the standard fades (strict Fountain would read FADE IN: as Action).
    if (p.length === 1 && isAllCaps(first) && (/TO:$/.test(first) || /^FADE (?:IN|OUT)[:.]?$|^(?:FADE|CUT) TO BLACK\.?$/.test(first))) {
      push('transition', first, null, allNotes);
      continue;
    }
    if (first.startsWith('!')) {
      push('action', p.join('\n').replace(/^\s*!/, ''), null, allNotes);
      continue;
    }
    if (p.length > 1 && isCharacterCue(first, p[1])) {
      const dual = /\^\s*$/.test(first);
      push('character', first.replace(/^@/, '').replace(/\s*\^\s*$/, ''), dual ? { dual: true } : null, lines[0].notes);
      let dialogue = null;
      let dNotes = [];
      for (const { t: raw, notes } of lines.slice(1)) {
        const l = raw.trim();
        if (/^\(.*\)$/.test(l)) {
          if (dialogue !== null) push('dialogue', dialogue, null, dNotes);
          dialogue = null;
          dNotes = [];
          push('parenthetical', l, null, notes);
        } else {
          const line = raw === '  ' ? '' : l;
          dialogue = dialogue === null ? line : `${dialogue}\n${line}`;
          dNotes.push(...notes);
        }
      }
      if (dialogue !== null) push('dialogue', dialogue, null, dNotes);
      continue;
    }
    // Action. SUPER: / TITLE: / … SUBTITLES: lines, and a closing THE END, come out as their
    // own elements even when the writer left no blank line around them.
    let run = [];
    const flush = () => {
      if (run.length) push('action', run.map((l) => l.t).join('\n'), null, run.flatMap((l) => l.notes));
      run = [];
    };
    for (const line of lines) {
      const end = END_RE.exec(stripInline(line.t).trim());
      if (isCueLine(line.t)) {
        flush();
        push('format_cue', line.t.trim(), null, line.notes);
      } else if (end && (isAllCaps(stripInline(line.t)) || lines.length === 1)) {
        flush();
        if (end[1]) push('transition', end[1].toUpperCase().replace(/\.?$/, '.'));
        push('centered', end[1] ? end[2].toUpperCase() : line.t.trim(), null, line.notes);
      } else if (line === lines[0] && lines.length > 1 && /^FADE OUT\.?$/.test(stripInline(line.t).trim())
        && END_RE.test(stripInline(lines[1].t).trim())) {
        push('transition', line.t.trim().toUpperCase(), null, line.notes);
      } else run.push(line);
    }
    flush();
  }
  attachToLast(pending.splice(0));

  const meta = {
    title: (tp.title || '').replace(/\n/g, ' ').replace(/[*_]/g, ''),
    credit: tp.credit || 'Written by',
    author: tp.author || tp.authors || '',
    basedOn: (tp.source || '').replace(/^based on\s+/i, ''),
    ...splitDraftInfo([tp.draft, tp.revision, tp['draft date']].filter(Boolean).join('\n')),
    contact: [tp.contact, tp.copyright].filter(Boolean).join('\n'),
  };
  return { meta, blocks };
}
