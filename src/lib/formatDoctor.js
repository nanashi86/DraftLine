// Format Doctor: finds elements that are probably tagged as the wrong type, and fixes them.
// Pure functions over the block array, so every rule is unit-tested.

import {
  END_RE, isActBreak, isFormatCue, isOnScreenText, isSecondarySlugline, isSlugline, isUnprefixedSlugline,
} from './sluglines.js';
import { looksLikeCue } from './textScriptParser.js';
import { concatMarks, sliceMarks, stripInline } from './formatting.js';
import { newId } from './screenplay.js';

const SPEECH = new Set(['character', 'dialogue', 'parenthetical']);

// `fix` is the label on the row's one-click fix button.
export const ISSUE_KINDS = {
  slugline: { label: 'Unclassified slugline', fix: 'Convert to Scene Heading' },
  secondary: { label: 'Secondary scene heading', fix: 'Convert to Scene Heading' },
  formatcue: { label: 'Format cue tagged as Action', fix: 'Make Format Cue' },
  cue: { label: 'Character cue tagged as Action', fix: 'Make Character' },
  orphan: { label: 'Dialogue without a character', fix: 'Make Action' },
  act: { label: 'Act marker in the script', fix: 'Remove' },
  empty: { label: 'Empty element', fix: 'Remove' },
  falsedialogue: { label: 'False dialogue', fix: 'Make Action' },
  unspaced: { label: 'Unspaced Super/Cue', fix: 'Split out the cue' },
  ending: { label: 'Misaligned script ending', fix: 'Center ‘THE END’' },
};

const NARRATIVE_DASH = /^(?:--|—|–)/;

/**
 * A character introduction merged into a speech: an all-caps name, an optional age, then a
 * dash straight into description — "FITO (10)--copper skin with curly hair…". Case-sensitive
 * on the name, so "Wait--what?" or "No--" never match.
 */
export const CHARACTER_INTRO_RE = /^([A-Z][A-Z0-9 .'’-]*?)\s*(\(\d+[^)]*\))?\s*(?:--|—|–)\s*\S/u;

/** A "cue" holding an age or a dash — "FITO (10)", "FITO (10)--" — is the start of an introduction. */
const INTRO_CUE = /\(\s*\d[^)]*\)|--|—|–/;

/** Is `text` a character introduction? With no age, the name must be one of the script's characters. */
export function isCharacterIntro(text, knownNames = new Set()) {
  const m = CHARACTER_INTRO_RE.exec(stripInline(text || '').trim());
  if (!m) return false;
  return !!m[2] || knownNames.has(m[1].trim());
}

/** The speech around block `i`: [cueIndex, endIndex) — cue first, then its dialogue/parentheticals. */
function speechAround(blocks, i) {
  let s = i;
  while (s > 0 && (blocks[s].type === 'dialogue' || blocks[s].type === 'parenthetical')) s--;
  if (blocks[s].type !== 'character') return null;
  let e = s + 1;
  while (e < blocks.length && (blocks[e].type === 'dialogue' || blocks[e].type === 'parenthetical')) e++;
  return [s, e];
}

/** Lines of an Action block that are a SUPER: / TITLE: / … SUBTITLES: cue sharing the block with other lines. */
function embeddedCueLines(text) {
  const lines = text.split('\n');
  if (lines.filter((l) => l.trim()).length < 2) return [];
  return lines.map((l, k) => (isFormatCue(l) ? k : -1)).filter((k) => k >= 0);
}

/**
 * Audit the script. `skipId` (the element being typed in) is never reported as empty,
 * so a fresh blank line doesn't nag while you write.
 * Returns [{ id, index, kind, from, to, text }]; `to: null` means "remove".
 */
export function auditScript(blocks, { skipId = null } = {}) {
  const issues = [];
  const flaggedCue = new Set();
  const names = new Set(blocks.filter((b) => b.type === 'character')
    .map((b) => stripInline(b.text).replace(/\(.*?\)/g, '').replace(/\^\s*$/, '').trim().toUpperCase()));

  blocks.forEach((b, i) => {
    const t = b.text.trim();
    const next = blocks[i + 1];
    const prev = blocks[i - 1];
    const issue = (kind, to) => issues.push({ id: b.id, index: i, kind, from: b.type, to, text: b.text });

    if (!t || t === '()') {
      if (blocks.length > 1 && b.id !== skipId && !b.note?.trim()) issue('empty', null);
      return;
    }
    const oneLine = !t.includes('\n');

    if (b.type === 'action' && oneLine && isActBreak(t)) {
      issue('act', null);
      return;
    }

    // THE END left at the Action margin (or typed as a Transition): it's centered.
    if ((b.type === 'action' || b.type === 'transition') && END_RE.test(stripInline(t))) {
      issue('ending', 'centered');
      return;
    }

    // SUPER: / SUBTITLE: … run into the Action around it, with no blank line either side.
    if (b.type === 'action' && embeddedCueLines(b.text).length) {
      issue('unspaced', 'format_cue');
      return;
    }

    // Action that is really a scene heading: an INT./EXT. variant, or an all-caps
    // "LOCATION - NIGHT" line…
    if (b.type === 'action' && oneLine && t.length <= 80 && !isOnScreenText(t)
      && (isSlugline(t) || isUnprefixedSlugline(t))) {
      issue('slugline', 'scene');
      return;
    }
    // …or a secondary heading: BACK TO THE CINEUS RESIDENCE, LATER, MOMENTS LATER, RESUME…
    if (b.type === 'action' && isSecondarySlugline(t)) {
      issue('secondary', 'scene');
      return;
    }
    // Language / sequence cues typed as Action (on-screen SUPER:/TITLE: lines may stay Action).
    if (b.type === 'action' && isFormatCue(t) && !isOnScreenText(t)) {
      issue('formatcue', 'format_cue');
      return;
    }

    // Short all-caps Action directly above dialogue: a character cue.
    if (b.type === 'action' && oneLine && next && (next.type === 'dialogue' || next.type === 'parenthetical')
      && looksLikeCue(t)) {
      issue('cue', 'character');
      flaggedCue.add(i);
      return;
    }

    // Dialogue / parenthetical that doesn't follow a cue or another part of a speech.
    if ((b.type === 'dialogue' || b.type === 'parenthetical')
      && !(prev && SPEECH.has(prev.type)) && !flaggedCue.has(i - 1)) {
      issue('orphan', 'action');
      return;
    }

    // False dialogue — structure only, never length or a leading dash (monologues and
    // interrupted "--and then…" lines are real dialogue). Two cases:
    //  • the line itself is a character introduction: "FITO (10)--copper skin…";
    //  • its "cue" isn't a valid cue at all ("FITO (10)" — an age), so the speech is an intro
    //    split in two; a lone cue + line folds back into one Action paragraph.
    if (b.type === 'dialogue') {
      const sp = speechAround(blocks, i);
      const cue = sp && blocks[sp[0]];
      const badCue = cue && INTRO_CUE.test(stripInline(cue.text));
      if (badCue || isCharacterIntro(t, names)) {
        const whole = badCue && sp[1] - sp[0] === 2 ? cue : null;
        issues.push({ id: b.id, index: i, kind: 'falsedialogue', from: 'dialogue', to: 'action', text: b.text, ...(whole ? { mergeCue: whole.id } : {}) });
      }
    }
  });

  return issues;
}

const withMarks = (b, marks) => {
  const out = { ...b };
  if (marks && Object.keys(marks).length) out.marks = marks;
  else delete out.marks;
  return out;
};

/** An Action block with SUPER: … lines inside → Action / Format Cue / Action blocks. */
function splitOutCues(b) {
  const cueLines = new Set(embeddedCueLines(b.text));
  const parts = [];
  let pos = 0;
  b.text.split('\n').forEach((line, k) => {
    const type = cueLines.has(k) ? 'format_cue' : 'action';
    const start = pos;
    pos += line.length + 1;
    const last = parts[parts.length - 1];
    if (last && last.type === 'action' && type === 'action') last.end = start + line.length;
    else parts.push({ type, start, end: start + line.length });
  });
  return parts
    .map((p, n) => {
      const raw = b.text.slice(p.start, p.end);
      const lead = raw.length - raw.trimStart().length;
      const text = raw.trim();
      const part = withMarks({ id: n === 0 ? b.id : newId(), type: p.type, text }, sliceMarks(b.marks, p.start + lead, p.start + lead + text.length));
      if (n === 0 && b.note != null) part.note = b.note;
      return part;
    })
    .filter((p) => p.text);
}

/** "THE END" → Centered; "FADE OUT. THE END" → a FADE OUT. transition and a centered THE END. */
function centerEnding(b) {
  const m = END_RE.exec(stripInline(b.text).trim());
  const rest = { ...b };
  delete rest.dual;
  if (!m?.[1]) return [{ ...rest, type: 'centered', text: b.text.trim().toUpperCase() }];
  delete rest.marks;
  return [
    { ...rest, type: 'transition', text: m[1].toUpperCase().replace(/\.?$/, '.') },
    { id: newId(), type: 'centered', text: m[2].toUpperCase() },
  ];
}

/** Cue + dialogue → one Action paragraph ("FITO (10)" + "--copper skin…" → "FITO (10)--copper skin…"). */
function mergeSpeech(cue, d) {
  const sep = NARRATIVE_DASH.test(d.text.trim()) ? '' : '\n';
  const head = cue.text.trim() + sep;
  const body = d.text.trimStart();
  const shift = d.text.length - body.length;
  const marks = concatMarks(sliceMarks(cue.marks, cue.text.length - cue.text.trimStart().length), head.length, sliceMarks(d.marks, shift));
  const note = [cue.note, d.note].filter((n) => n?.trim()).join('\n');
  const out = withMarks({ id: cue.id, type: 'action', text: head + body }, marks);
  if (note) out.note = note;
  return out;
}

/** Apply fixes (one, some or all issues). Returns a new block array. */
export function applyFixes(blocks, issues) {
  const byId = new Map(issues.map((it) => [it.id, it]));
  const mergedCues = new Map(issues.filter((it) => it.mergeCue).map((it) => [it.mergeCue, it.id]));
  const out = [];
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k];
    // A cue folding into the false dialogue below it: emit the merged Action here, skip both.
    if (mergedCues.has(b.id) && blocks[k + 1]?.id === mergedCues.get(b.id)) {
      out.push(mergeSpeech(b, blocks[k + 1]));
      k += 1;
      continue;
    }
    const it = byId.get(b.id);
    if (!it) {
      out.push(b);
      continue;
    }
    if (it.to === null) continue; // remove
    if (it.kind === 'unspaced') {
      out.push(...splitOutCues(b));
      continue;
    }
    if (it.kind === 'ending') {
      out.push(...centerEnding(b));
      continue;
    }
    const fixed = { ...b, type: it.to };
    if (it.to !== 'character') delete fixed.dual;
    if (it.to === 'scene') fixed.text = b.text.trim().toUpperCase();
    if (it.to === 'character') fixed.text = b.text.trim().toUpperCase();
    out.push(fixed);
  }
  return out.length ? out : blocks;
}
