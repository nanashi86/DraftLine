// Format Doctor: finds elements that are probably tagged as the wrong type, and fixes them.
// Pure functions over the block array, so every rule is unit-tested.

import {
  END_RE, hasTimeOfDaySuffix, headingParts, isActBreak, timeOfDayPeriod, isFormatCue, isOnScreenText, isSecondarySlugline, isSlugline, isUnprefixedSlugline,
} from './sluglines.js';
import { looksLikeCue } from './textScriptParser.js';
import { concatMarks, remapMarks, sliceMarks, stripInline } from './formatting.js';
import { isLeadInAction, newId } from './screenplay.js';

const SPEECH = new Set(['character', 'dialogue', 'parenthetical']);

// `fix` describes the one-click fix (tooltips, the change line); `verb` is its short button label
// (Format Doctor rows, the status-bar list). Both null: nothing to fix automatically — Show it, or Ignore it.
export const ISSUE_KINDS = {
  slugline: { label: 'Unclassified slugline', fix: 'Convert to Scene Heading', verb: 'Convert' },
  secondary: { label: 'Secondary scene heading', fix: 'Convert to Scene Heading', verb: 'Convert' },
  formatcue: { label: 'Format cue tagged as Action', fix: 'Make Format Cue', verb: 'Convert' },
  cue: { label: 'Character cue tagged as Action', fix: 'Make Character', verb: 'Convert' },
  orphan: { label: 'Dialogue without a character', fix: 'Make Action', verb: 'Fix' },
  act: { label: 'Act marker in the script', fix: 'Remove', verb: 'Remove' },
  empty: { label: 'Empty element', fix: 'Remove', verb: 'Remove' },
  falsedialogue: { label: 'False dialogue', fix: 'Make Action', verb: 'Fix' },
  unspaced: { label: 'Unspaced Super/Cue', fix: 'Split out the cue', verb: 'Split' },
  ending: { label: 'Misaligned script ending', fix: 'Center ‘THE END’', verb: 'Center' },
  orphancue: { label: 'Character cue without dialogue', fix: 'Make Action', verb: 'Fix' },
  orphanparen: { label: 'Parenthetical without dialogue after it', fix: 'Make Action', verb: 'Fix' },
  slugformat: { label: 'Scene heading format', fix: 'Format heading', verb: 'Format' },
  slugincomplete: { label: 'Scene heading missing INT./EXT. or time of day', fix: null, verb: null },
  intro: { label: 'Character introduced in lowercase', fix: 'Capitalize name', verb: 'Fix' },
  spacing: { label: 'Double blank lines', fix: 'Strip blank lines', verb: 'Strip' },
  pagebottom: { label: 'Stranded at the bottom of a page', fix: null, verb: null },
};
/**
 * A finding's first line, as it shows on the page (the Format Doctor rows and the status-bar list):
 * scene headings in capitals, the way the editor, print and exports show them — never "Ext. … (Flashback)".
 */
export function findingPreview(it) {
  const t = String(it.text || '').trim();
  if (!t) return '(empty line)';
  const line = t.split('\n')[0];
  return it.from === 'scene' ? line.toUpperCase() : line;
}

/** Kinds the Fix All button (and a row's Fix) can repair. */
export const canFix = (kind) => !!ISSUE_KINDS[kind]?.fix;

// ---- Spec-script hygiene -------------------------------------------------------------------------

// The combined prefixes keep the writer's own spelling — INT./EXT. and INT/EXT. are both standard —
// and only gain the closing period: "int/ext factory" → "INT/EXT. FACTORY".
const PREFIXES = [
  [/^int(\.?)\s*\/\s*ext\.?(?=[\s.]|$)\s*/i, (m) => `INT${m[1]}/EXT. `],
  [/^i\s*\/\s*e\.?(?=[\s.]|$)\s*/i, 'I/E. '],
  [/^ext(\.?)\s*\/\s*int\.?(?=[\s.]|$)\s*/i, (m) => `EXT${m[1]}/INT. `],
  [/^int\.?(?=[\s.]|$)\s*/i, 'INT. '],
  [/^ext\.?(?=[\s.]|$)\s*/i, 'EXT. '],
  [/^est\.?(?=[\s.]|$)\s*/i, 'EST. '],
];
/** Headings that are sequences rather than places: no INT./EXT. or time of day expected. */
const SEQUENCE_HEADING = /^(?:(?:BEGIN|END|START)\s+)?(?:MONTAGE|SERIES OF SHOTS|INTERCUT|FLASHBACK|DREAM|SPLIT SCREEN)\b/i;

/**
 * A scene heading laid out the standard way: upper case, single spaces, "INT. " / "EXT. " /
 * "INT./EXT. " prefixes with their periods, and " - " before the time of day.
 *   "int kitchen–night" → "INT. KITCHEN - NIGHT"
 */
export function formatSlugline(text) {
  let t = String(text || '').trim().replace(/[ \t]+/g, ' ');
  for (const [re, canon] of PREFIXES) {
    const m = re.exec(t);
    if (m) {
      t = (typeof canon === 'function' ? canon(m) : canon) + t.slice(m[0].length);
      break;
    }
  }
  t = t.replace(/\s*(?:--+|[–—])\s*/g, ' - ').replace(/\s+-\s*|\s*-\s+/g, ' - ').replace(/(?: - )+/g, ' - ');
  return t.toUpperCase().trim();
}

/**
 * A time of day as any dash-separated part after the location, not only the last one, read the
 * same way Plan reads it (sluglines.js timeOfDayPeriod): "INT. KITCHEN - NIGHT - BACK TO SCENE",
 * "EXT. ROOF - DAY - CONTINUOUS", "INT. CINEUS RESIDENCE - NEXT DAY", "EXT. FIELD - NIGHT (FLASHBACK)".
 */
export function hasTimeOfDayPart(text) {
  return headingParts(stripInline(text || '').trim()).slice(1).some((p) => timeOfDayPeriod(p));
}

/** Prefix and time of day both there (or a sequence heading like MONTAGE, or a secondary one like LATER)? */
export function isCompleteSlugline(text) {
  // Read as it shows: headings always display, print and export in capitals, so "Later" is LATER.
  const t = stripInline(text || '').trim().toUpperCase();
  if (isSecondarySlugline(t) || SEQUENCE_HEADING.test(t) || t.startsWith('.')) return true;
  return isSlugline(t) && (hasTimeOfDaySuffix(t) || hasTimeOfDayPart(t));
}

const DOUBLE_BLANK = /\n[ \t]*\n(?:[ \t]*\n)+/;
/** Two or more blank lines in a row inside an element, or blank lines at its start or end. */
export const hasExtraBlankLines = (text) => DOUBLE_BLANK.test(text) || /^[ \t]*\n/.test(text) || /\n[ \t]*$/.test(text);
/** Collapse runs of blank lines to one, and drop blank lines at the start and end. */
export const stripBlankLines = (text) => text.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '');

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Speaking characters whose first mention in the Action is not in capitals ("Marie runs…" for a
 * MARIE who speaks) → Map blockId → [{ name, at, len }]. Only names written like a name (a capital
 * then lower case) count, so a cue like MAN never matches "the man".
 */
export function lowercaseIntroductions(blocks, names) {
  const out = new Map();
  const actions = blocks.filter((b) => b.type === 'action' && b.text.trim());
  for (const name of names) {
    if (name.length < 3 || !/\p{L}/u.test(name)) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu');
    for (const b of actions) {
      const m = re.exec(b.text);
      if (!m) continue;
      const word = m[0];
      if (word !== word.toUpperCase() && /^\p{Lu}/u.test(word)) {
        const list = out.get(b.id) || [];
        list.push({ name, at: m.index, len: word.length });
        out.set(b.id, list);
      }
      break; // only the first mention is the introduction
    }
  }
  return out;
}

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
 * Page-seam check (needs the layout): an element that introduces what follows — lead-in Action
 * ("She reads it aloud:", "SUPER: 1991"), a Character cue, a Scene Heading — on an earlier page than
 * the element after it, so it sits alone at the foot of a page. The page breaker keeps these together,
 * so this only fires where it can't (what follows is taller than a page) or when the layout handed in
 * is out of date. `pageOfBlock` is paginate()'s map of block id → page number.
 */
export function strandedAtPageBottom(b, next, pageOfBlock) {
  if (!next || !pageOfBlock) return false;
  const here = pageOfBlock[b.id];
  const there = pageOfBlock[next.id];
  if (!here || !there || there <= here) return false;
  return b.type === 'character' || b.type === 'scene' || isLeadInAction(b, next);
}

/**
 * Audit the script. `skipId` (the element being typed in) is never reported as empty,
 * so a fresh blank line doesn't nag while you write. `ignore` holds "id|kind" findings the writer
 * ignored: they're skipped, and the element's other checks still run (one finding per element).
 * `layout` (paginate()'s result for these blocks, optional) adds the page-seam check (pagebottom);
 * without it, only the element checks run.
 * Returns [{ id, index, kind, from, to, text }]; `to: null` means "remove".
 */
export function auditScript(blocks, { skipId = null, ignore = new Set(), layout = null } = {}) {
  const issues = [];
  const flaggedCue = new Set();
  const names = new Set(blocks.filter((b) => b.type === 'character')
    .map((b) => stripInline(b.text).replace(/\(.*?\)/g, '').replace(/\^\s*$/, '').trim().toUpperCase()));

  const intros = lowercaseIntroductions(blocks, names);

  blocks.forEach((b, i) => {
    const t = b.text.trim();
    const next = blocks[i + 1];
    const prev = blocks[i - 1];
    // Record a finding unless it's ignored (then the checks after it still get their turn).
    const issue = (kind, to, extra = {}) => {
      if (ignore.has(`${b.id}|${kind}`)) return false;
      issues.push({ id: b.id, index: i, kind, from: b.type, to, text: b.text, ...extra });
      return true;
    };

    if (!t || t === '()') {
      if (blocks.length > 1 && b.id !== skipId && !b.note?.trim()) issue('empty', null);
      return;
    }
    const oneLine = !t.includes('\n');

    if (b.type === 'action' && oneLine && isActBreak(t)) {
      if (issue('act', null)) return;
    }

    // THE END left at the Action margin (or typed as a Transition): it's centered.
    if ((b.type === 'action' || b.type === 'transition') && END_RE.test(stripInline(t))) {
      if (issue('ending', 'centered')) return;
    }

    // SUPER: / SUBTITLE: … run into the Action around it, with no blank line either side.
    if (b.type === 'action' && embeddedCueLines(b.text).length) {
      if (issue('unspaced', 'format_cue')) return;
    }

    // Action that is really a scene heading: an INT./EXT. variant, or an all-caps
    // "LOCATION - NIGHT" line…
    if (b.type === 'action' && oneLine && t.length <= 80 && !isOnScreenText(t)
      && (isSlugline(t) || isUnprefixedSlugline(t))) {
      if (issue('slugline', 'scene')) return;
    }
    // …or a secondary heading: BACK TO THE CINEUS RESIDENCE, LATER, MOMENTS LATER, RESUME…
    if (b.type === 'action' && isSecondarySlugline(t)) {
      if (issue('secondary', 'scene')) return;
    }
    // Language / sequence cues typed as Action (on-screen SUPER:/TITLE: lines may stay Action).
    if (b.type === 'action' && isFormatCue(t) && !isOnScreenText(t)) {
      if (issue('formatcue', 'format_cue')) return;
    }

    // Short all-caps Action directly above dialogue: a character cue.
    if (b.type === 'action' && oneLine && next && (next.type === 'dialogue' || next.type === 'parenthetical')
      && looksLikeCue(t)) {
      if (issue('cue', 'character')) {
        flaggedCue.add(i);
        return;
      }
    }

    // Dialogue / parenthetical that doesn't follow a cue or another part of a speech.
    if ((b.type === 'dialogue' || b.type === 'parenthetical')
      && !(prev && SPEECH.has(prev.type)) && !flaggedCue.has(i - 1)) {
      if (issue('orphan', 'action')) return;
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
        if (issue('falsedialogue', 'action', whole ? { mergeCue: whole.id } : {})) return;
      }
    }

    // A cue with no dialogue under it (an action, a heading, nothing): not while it's being written.
    const typing = b.id === skipId || next?.id === skipId;
    if (b.type === 'character' && !typing && !(next && (next.type === 'dialogue' || next.type === 'parenthetical'))) {
      if (issue('orphancue', 'action')) return;
    }
    // A parenthetical inside a speech that no dialogue follows.
    if (b.type === 'parenthetical' && !typing && !(next && next.type === 'dialogue')) {
      if (issue('orphanparen', 'action')) return;
    }

    // Scene headings: the standard layout first (fixable), then what's missing (yours to add).
    if (b.type === 'scene' && b.id !== skipId && !t.startsWith('.')) {
      const plain = stripInline(t);
      // Compared in capitals: a heading always shows, prints and exports in capitals (Editor.css,
      // Fountain / FDX), so how it was typed — "Ext. … (Flashback)" — is never a finding by itself.
      // Only real layout (periods, dashes, spacing, a missing prefix period) is.
      if (formatSlugline(plain) !== plain.toUpperCase()) {
        if (issue('slugformat', 'scene', { fixed: formatSlugline(b.text) })) return;
      }
      if (!isCompleteSlugline(plain)) {
        if (issue('slugincomplete', 'scene')) return;
      }
    }

    // Alone at the foot of a page, away from what it introduces (not while it's being written).
    if (!typing && strandedAtPageBottom(b, next, layout?.pageOfBlock)) {
      if (issue('pagebottom', b.type, { page: layout.pageOfBlock[b.id] })) return;
    }

    if (intros.has(b.id) && b.id !== skipId && issue('intro', b.type, { intros: intros.get(b.id) })) return;
    if (b.id !== skipId && hasExtraBlankLines(b.text)) {
      issue('spacing', b.type);
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
    if (!canFix(it.kind)) {
      out.push(b); // nothing automatic to do (e.g. a heading missing its time of day)
      continue;
    }
    if (it.kind === 'slugformat') {
      const text = formatSlugline(b.text);
      out.push(withMarks({ ...b, text }, remapMarks(b.text, text, b.marks)));
      continue;
    }
    if (it.kind === 'spacing') {
      const text = stripBlankLines(b.text);
      out.push(withMarks({ ...b, text }, remapMarks(b.text, text, b.marks)));
      continue;
    }
    if (it.kind === 'intro') {
      let text = b.text;
      for (const { at, len } of it.intros || []) text = text.slice(0, at) + text.slice(at, at + len).toUpperCase() + text.slice(at + len);
      out.push({ ...b, text }); // same length: formatting stays where it was
      continue;
    }
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
    if (it.to === 'scene') {
      // A new heading comes out in the standard layout too ("ext/int car -- day" → "EXT./INT. CAR - DAY").
      fixed.text = formatSlugline(b.text);
      const marks = remapMarks(b.text, fixed.text, b.marks);
      if (marks) fixed.marks = marks;
      else delete fixed.marks;
    }
    if (it.to === 'character') fixed.text = b.text.trim().toUpperCase();
    out.push(fixed);
  }
  return out.length ? out : blocks;
}
