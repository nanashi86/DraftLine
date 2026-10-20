// Rename a character across a project: cues, dialogue, action, Beat Board and Bible.
//
// Matching is whole-name and case-aware, so renaming FITO → MARC changes
//   FITO (V.O.)            → MARC (V.O.)            (cue; extensions, caret and spacing kept)
//   "Fito, come here!"     → "Marc, come here!"     (Title Case → Title Case)
//   FITO (10) darts past.  → MARC (10) darts past.  (ALL CAPS → ALL CAPS)
//   Fito's bike            → Marc's bike            (possessives follow the name)
// and never touches FITOS, AFITO, Fitness or JEAN in JEAN-CLAUDE: a match must not touch a
// letter, digit, underscore or hyphenated word on either side. Only the name as typed, its
// ALL CAPS form and its Title Case form match — so renaming ROSE leaves "a rose" alone.
//
// Pure functions: the project goes in, a new project (unchanged objects reused) comes out,
// plus counts for the review dialog and the list of what changed (for a precise undo).

import { remapMarks } from './formatting.js';
import { characterName } from './screenplay.js';

export const RENAME_CATEGORIES = [
  { id: 'cues', label: 'Character cues', hint: 'Speaking cues — (V.O.), (O.S.), (CONT’D) … are kept' },
  { id: 'dialogue', label: 'Spoken dialogue mentions', hint: 'The name inside dialogue and parentheticals' },
  { id: 'action', label: 'Action & description mentions', hint: 'ALL CAPS and Title Case in action, scene headings and other direction' },
  { id: 'notes', label: 'Beat Board & Story Bible', hint: 'Beat cards, character bios, Story Notes and Story DNA' },
];
export const ALL_CATEGORIES = Object.freeze({ cues: true, dialogue: true, action: true, notes: true });

const SPEECH = new Set(['dialogue', 'parenthetical']);
const DESCRIPTION = new Set(['action', 'scene', 'transition', 'format_cue', 'centered']);

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** "jovenel moïse" → "Jovenel Moïse"; "o'brien" → "O'Brien"; "jean-claude" → "Jean-Claude". */
export function titleCase(name) {
  return clean(name).toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

/**
 * The spellings that match and what each becomes: the name as typed, ALL CAPS and Title
 * Case (each mapped to the same form of the new name). Longest first, so "Mc" never
 * pre-empts "McClane".
 */
export function nameVariants(oldName, newName) {
  const o = clean(oldName);
  const n = clean(newName);
  const pairs = new Map();
  if (!o) return [];
  pairs.set(o.toUpperCase(), n.toUpperCase());
  pairs.set(titleCase(o), titleCase(n));
  if (!pairs.has(o)) pairs.set(o, n); // e.g. "McClane" as written in the bio
  return [...pairs].map(([from, to]) => ({ from, to })).sort((a, b) => b.from.length - a.from.length);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-name matcher for the variants. Spaces inside a name match any run of spaces. */
export function nameMatcher(variants) {
  if (!variants.length) return null;
  const alts = variants.map((v) => escape(v.from).replace(/ /g, '\\s+')).join('|');
  // Not glued to a letter/digit/underscore, nor a hyphenated part of a longer name.
  return new RegExp(`(?<![\\p{L}\\p{N}_]|[\\p{L}\\p{N}]-)(?:${alts})(?![\\p{L}\\p{N}_]|-[\\p{L}\\p{N}])`, 'gu');
}

/** Replace every whole-name match in `text`. Returns { text, count, marks } (marks shifted). */
export function replaceName(text, variants, marks) {
  const re = nameMatcher(variants);
  if (!re || !text) return { text, count: 0, marks };
  const to = new Map(variants.map((v) => [v.from, v.to]));
  const replacement = (s) => {
    const key = s.replace(/\s+/g, ' ');
    return to.get(key) ?? variants.find((v) => v.from.toUpperCase() === key.toUpperCase())?.to ?? s;
  };
  // Only matches that actually change count (renaming FITO → Fito leaves "FITO" alone).
  const hits = [...text.matchAll(re)].filter((h) => replacement(h[0]) !== h[0]);
  if (!hits.length) return { text, count: 0, marks };
  let out = text;
  let m = marks;
  // Right to left, one edit at a time, so each formatting shift is exact.
  for (let k = hits.length - 1; k >= 0; k--) {
    const hit = hits[k];
    const repl = replacement(hit[0]);
    const next = out.slice(0, hit.index) + repl + out.slice(hit.index + hit[0].length);
    if (m) m = remapMarks(out, next, m);
    out = next;
  }
  return { text: out, count: hits.length, marks: m };
}

/** Does this cue belong to `oldName`? ("FITO (V.O.)", "@Fito", "fito ^" all do.) */
export const isCueFor = (text, oldName) => characterName(text) === clean(oldName).toUpperCase() && !!clean(oldName);

/** "FITO (V.O.) ^" → "MARC (V.O.) ^": swap the name, keep @, extensions, caret and spacing. */
export function renameCue(text, newName) {
  const m = /^(\s*@?)(.*?)(\s*(?:\(.*)?(?:\^\s*)?)$/.exec(text);
  if (!m) return text;
  const [, lead, , tail] = m;
  return `${lead}${clean(newName).toUpperCase()}${tail.startsWith('(') ? ` ${tail}` : tail}`;
}

/** list.map(fn), but the very same array when nothing changed. */
function mapKeep(list, fn) {
  if (!Array.isArray(list)) return list;
  let hit = false;
  const out = list.map((x) => {
    const y = fn(x);
    if (y !== x) hit = true;
    return y;
  });
  return hit ? out : list;
}

const withText = (obj, field, res) => {
  if (!res.count) return obj;
  const next = { ...obj, [field]: res.text };
  if (field === 'text') {
    // Always a fresh marks object: the history normaliser then knows they're already moved.
    if (res.marks) next.marks = res.marks === obj.marks ? { ...res.marks } : res.marks;
    else delete next.marks;
  }
  return next;
};

/** Rename inside every string field of a plain object (beat, bio, DNA answers …). */
function renameFields(obj, fields, variants) {
  let out = obj;
  let count = 0;
  for (const f of fields) {
    if (typeof out[f] !== 'string') continue;
    const r = replaceName(out[f], variants);
    if (r.count) {
      out = { ...out, [f]: r.text };
      count += r.count;
    }
  }
  return { obj: out, count };
}

const BEAT_FIELDS = ['title', 'synopsis'];
const BIO_FIELDS = ['name', 'role', 'age', 'traits', 'backstory'];

function renameDna(dna, variants) {
  if (!dna || typeof dna !== 'object') return { dna, count: 0 };
  let count = 0;
  let out = dna;
  const top = renameFields(out, ['theme', 'genreOther'], variants);
  out = top.obj;
  count += top.count;
  if (out.answers && typeof out.answers === 'object') {
    const a = renameFields(out.answers, Object.keys(out.answers), variants);
    if (a.count) out = { ...out, answers: a.obj };
    count += a.count;
  }
  for (const [k, v] of Object.entries(out)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.notes === 'string' && k !== 'answers') {
      const r = renameFields(v, ['notes'], variants);
      if (r.count) out = { ...out, [k]: r.obj };
      count += r.count;
    }
  }
  return { dna: out, count };
}

/**
 * Rename `oldName` → `newName` across a project { blocks, beats, characters, storyNotes,
 * storyDna } for the categories switched on. Returns
 *   { project, counts: { cues, dialogue, action, notes }, total, changed }
 * where `project` reuses every unchanged object, and `changed` lists { blocks, beats,
 * characters, sections, storyDna } as [before, after] pairs.
 */
export function renameCharacter(project, oldName, newName, categories = ALL_CATEGORIES) {
  const counts = { cues: 0, dialogue: 0, action: 0, notes: 0 };
  const changed = { blocks: [], beats: [], characters: [], sections: [], storyDna: null };
  const o = clean(oldName);
  const n = clean(newName);
  const same = !o || !n || o === n;
  const variants = same ? [] : nameVariants(o, n);
  const on = { ...ALL_CATEGORIES, ...categories };
  const track = (list, before, after) => {
    if (after !== before) list.push([before, after]);
    return after;
  };

  const blocks = mapKeep(project.blocks || [], (b) => {
    if (same) return b;
    let next = b;
    let cat = null;
    if (b.type === 'character') {
      cat = 'cues';
      if (isCueFor(b.text, o)) {
        const text = renameCue(b.text, n);
        if (text !== b.text) counts.cues += 1;
        if (on.cues && text !== b.text) {
          next = { ...b, text };
          const marks = remapMarks(b.text, text, b.marks);
          if (marks) next.marks = marks === b.marks ? { ...marks } : marks;
          else delete next.marks;
        }
      } else {
        // Another character's cue that mentions the name: "FITO'S MOTHER" — description-like.
        cat = 'action';
      }
    } else if (SPEECH.has(b.type)) cat = 'dialogue';
    else if (DESCRIPTION.has(b.type)) cat = 'action';

    if (cat && (cat !== 'cues')) {
      const r = replaceName(b.text, variants, b.marks);
      counts[cat] += r.count;
      if (on[cat]) next = withText(next, 'text', r);
    }
    // A margin note travels with its element's category.
    if (cat && typeof b.note === 'string') {
      const r = replaceName(b.note, variants);
      const noteCat = cat === 'cues' ? 'dialogue' : cat;
      counts[noteCat] += r.count;
      if (on[noteCat] && r.count) next = { ...next, note: r.text };
    }
    return track(changed.blocks, b, next);
  });

  const beats = mapKeep(project.beats || [], (bt) => {
    if (same) return bt;
    const r = renameFields(bt, BEAT_FIELDS, variants);
    counts.notes += r.count;
    return on.notes ? track(changed.beats, bt, r.obj) : bt;
  });

  const characters = mapKeep(project.characters || [], (c) => {
    if (same) return c;
    const r = renameFields(c, BIO_FIELDS, variants);
    // A bio named exactly like the cue ("FITO") follows it even if typed in another case.
    let obj = r.obj;
    let count = r.count;
    if (obj.name === c.name && clean(c.name).toUpperCase() === o.toUpperCase() && clean(c.name) !== n) {
      obj = { ...obj, name: clean(c.name) === clean(c.name).toUpperCase() ? n.toUpperCase() : n };
      count += 1;
    }
    counts.notes += count;
    return on.notes ? track(changed.characters, c, obj) : c;
  });

  let storyNotes = project.storyNotes;
  if (!same && storyNotes?.sections) {
    let any = false;
    const sections = storyNotes.sections.map((s) => {
      const r = renameFields(s, ['title', 'body'], variants);
      counts.notes += r.count;
      if (!on.notes || !r.count) return s;
      any = true;
      return track(changed.sections, s, r.obj);
    });
    if (any) storyNotes = { ...storyNotes, sections };
  }

  let storyDna = project.storyDna;
  if (!same) {
    const r = renameDna(storyDna, variants);
    counts.notes += r.count;
    if (on.notes && r.count) {
      changed.storyDna = [storyDna, r.dna];
      storyDna = r.dna;
    }
  }

  const total = Object.entries(counts).reduce((t, [k, v]) => t + (on[k] ? v : 0), 0);
  return {
    project: { ...project, blocks, beats, characters, storyNotes, storyDna },
    counts,
    total,
    changed,
  };
}

/** Trim a long before/after pair to a window around the first change ("…drops beside her"). */
export function excerpt(before, after, lead = 24, width = 64) {
  const a = String(before).replace(/\s+/g, ' ');
  const b = String(after).replace(/\s+/g, ' ');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const start = Math.max(0, i - lead);
  const cut = (s) => {
    const from = start && s.indexOf(' ', start) !== -1 && s.indexOf(' ', start) < i ? s.indexOf(' ', start) + 1 : start;
    const piece = s.slice(from, from + width);
    return (from > 0 ? '…' : '') + piece + (from + width < s.length ? '…' : '');
  };
  return { before: cut(a), after: cut(b) };
}

/** A few "before → after" lines per category for the review dialog. */
export function renamePreview(project, oldName, newName, limit = 3) {
  const out = { cues: [], dialogue: [], action: [], notes: [] };
  const { changed } = renameCharacter(project, oldName, newName);
  for (const [before, after] of changed.blocks) {
    const cat = before.type === 'character' && isCueFor(before.text, oldName) ? 'cues'
      : SPEECH.has(before.type) ? 'dialogue' : 'action';
    if (out[cat].length < limit && before.text !== after.text) out[cat].push(excerpt(before.text, after.text));
  }
  for (const [before, after] of [...changed.beats, ...changed.characters]) {
    if (out.notes.length >= limit) break;
    const f = ['name', 'title', 'synopsis', 'traits', 'backstory'].find((k) => before[k] !== after[k]);
    if (f) out.notes.push(excerpt(before[f], after[f]));
  }
  return out;
}

/**
 * Undo / redo for the parts outside the script history: put back each beat, bio, note
 * section or Story DNA the rename changed — only where it's still exactly as the rename
 * left it, so edits made since are never thrown away.
 */
export function revertRename(state, changed, direction = 'undo') {
  const [fromIdx, toIdx] = direction === 'undo' ? [1, 0] : [0, 1];
  const swap = (list, pairs) => {
    if (!pairs.length) return list;
    const map = new Map(pairs.map((p) => [p[fromIdx], p[toIdx]]));
    let hit = false;
    const next = list.map((x) => {
      if (map.has(x)) {
        hit = true;
        return map.get(x);
      }
      return x;
    });
    return hit ? next : list;
  };
  const beats = swap(state.beats, changed.beats);
  const characters = swap(state.characters, changed.characters);
  let { storyNotes } = state;
  if (changed.sections.length && storyNotes?.sections) {
    const sections = swap(storyNotes.sections, changed.sections);
    if (sections !== storyNotes.sections) storyNotes = { ...storyNotes, sections };
  }
  let { storyDna } = state;
  if (changed.storyDna && storyDna === changed.storyDna[fromIdx]) storyDna = changed.storyDna[toIdx];
  return { beats, characters, storyNotes, storyDna };
}
