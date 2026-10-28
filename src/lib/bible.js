// Project Bible: character bios and story notes, stored on the project record beside the
// script (see projectStorage.js). Pure functions, so every operation is unit-tested.
//
//   characters: [{ id, name, primaryRole, secondaryRole, relationship, age, gender, description, traits, backstory }]
//   storyNotes: { sections: [{ id, title, body }] }   — body is Markdown

import { normalizeStoryDna } from './storyDna.js';

/** Characters → Bios → Gender: blank (not set) or one of these. */
export const GENDERS = ['Male', 'Female', 'Non-Binary', 'Other'];
/** A stored gender, or '' when it's missing or not one of GENDERS. */
export const validGender = (g) => (GENDERS.includes(g) ? g : '');

export const CHARACTER_FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'MARIE CINEUS' },
  // (Primary Role and Secondary Function — two picklists — come right after Name.)
  { key: 'relationship', label: 'Relationship', placeholder: 'e.g., Brother-in-law to Fito, manages textile warehouse' },
  // Age / Timeline shares its row with the Gender picker (GENDERS), like the two role pickers above.
  { key: 'age', label: 'Age / Timeline', placeholder: '10 in 1986, 45 in 2021' },
  {
    key: 'description',
    label: 'Physical Description',
    placeholder: 'e.g., Tall, lean, weathered hands, always wearing a faded denim jacket...',
    multiline: true,
  },
  { key: 'traits', label: 'Traits', placeholder: 'Stubborn, funny under pressure, never cries in public', multiline: true },
  { key: 'backstory', label: 'Backstory / Motivation', placeholder: 'What happened before page 1 — and what she wants now', multiline: true },
];

/**
 * Story Notes sections a new project starts with, in order. Theme isn't one of them: it
 * lives in Story DNA ("Theme — revealed by the Climax"), so there's one place for it.
 */
export const DEFAULT_SECTIONS = ['Logline', 'Tone', 'Pitch', 'Timeline', 'Scratchpad'];
/** The standard cards that come before the Synopsis and Treatment, in their reading order. */
export const NOTES_ORDER = ['Logline', 'Tone', 'Pitch', 'Timeline'];

/** Note titles that meant the story's theme in earlier versions (case-insensitive). */
const THEME_TITLES = new Set(['themes', 'themes & motifs', 'theme']);
const isThemeTitle = (title) => THEME_TITLES.has(String(title || '').trim().toLowerCase());

/** Earlier preset names → today's (case-insensitive). */
export const LEGACY_SECTION_NAMES = {
  'themes & motifs': 'Themes',
  'timeline & lore': 'Timeline',
  'general scratchpad': 'Scratchpad',
};

/**
 * Story Notes format version. Version 3 = the five presets above (version 2 also had
 * Themes). Older notes are migrated once (renamed, completed and reordered; Themes moves to
 * Story DNA — see migrateStoryBible); after that your own deletions, renames and order are
 * left alone.
 */
export const STORY_NOTES_VERSION = 4; // 4: Pitch before Timeline (reorderStandardNotes)
const THEMES_MOVED_VERSION = 3; // before 3, a Themes card could move into Story DNA (migrateStoryBible)

/** Today's preset name for a title (old names included), or null if it isn't a preset. */
const presetName = (title) => {
  const k = String(title || '').trim().toLowerCase();
  const name = LEGACY_SECTION_NAMES[k] || DEFAULT_SECTIONS.find((d) => d.toLowerCase() === k) || null;
  return DEFAULT_SECTIONS.includes(name) ? name : null;
};

let counter = 0;
const seed = Math.random().toString(36).slice(2, 6);
const uid = (p) => {
  counter += 1;
  return `${p}${seed}${counter.toString(36)}`;
};

// ---- Drawer tabs -------------------------------------------------------------------------

/** The Bible's tabs, in order. Story DNA opens first unless you pick another tab this session. */
// Two drawers share the right dock. Labels stay short so the tabs never wrap.
//   Story Bible — DNA (Blueprint + Glossary) · Notes (Logline, Pitch, Scratchpad …)
//   Characters  — Bios (profiles, rename) · Dialogue (every line, one voice at a time)
// The ids are only UI state; the project still stores storyDna, storyNotes and characters.
/** The DNA tab's two views, left to right. */
export const DNA_VIEWS = [
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'dictionary', label: 'Glossary' },
];

export const BIBLE_TABS = [
  { id: 'dna', label: 'DNA', title: 'Blueprint & Glossary' },
  { id: 'notes', label: 'Notes', title: 'Logline, tone, timeline, pitch, scratchpad (theme is in DNA)' },
];
export const DEFAULT_BIBLE_TAB = 'dna';

export const CHARACTER_TABS = [
  { id: 'bios', label: 'Bios', title: 'Character profiles, traits and backstory · rename across the script' },
  { id: 'dialogue', label: 'Dialogue', title: 'Every line a character speaks, top to bottom' },
];
export const DEFAULT_CHARACTER_TAB = 'bios';

/** Badge beside a tab label: Story DNA progress, bio count, speaking characters; Notes has none. */
export function bibleTabBadge(id, { characters = [], dnaAnswered = 0, dnaTotal = 8, speakers = [] } = {}) {
  if (id === 'dna') return `${dnaAnswered}/${dnaTotal}`;
  if (id === 'bios') return String(characters.length);
  if (id === 'dialogue') return String(speakers.length);
  return null;
}

// Genres live with the rest of Story DNA; re-exported here for convenience.
export { GENRES, genresFromText, toggleGenre } from './storyDna.js';

// ---- Characters -------------------------------------------------------------------------

// A bio's place in the story: a Primary Role (where they rank) and a Secondary Function (what
// they do for the protagonist), each with its Glossary entry (`dict`), plus free-text
// Relationship. Stored as ids: { primaryRole: 'deuteragonist', secondaryRole: 'foil', relationship }.
export const PRIMARY_ROLES = [
  { id: 'protagonist', label: 'Protagonist', dict: 'protagonist' },
  { id: 'antagonist', label: 'Antagonist', dict: 'antagonist' },
  { id: 'deuteragonist', label: 'Deuteragonist', dict: 'deuteragonist' },
  { id: 'tritagonist', label: 'Tritagonist', dict: 'tritagonist' },
  { id: 'supporting', label: 'Supporting', dict: 'supportingCharacter' },
  { id: 'minor', label: 'Minor / Cameo', dict: 'minorCharacter' },
];
export const SECONDARY_ROLES = [
  { id: 'none', label: 'None', dict: null },
  { id: 'foil', label: 'Foil', dict: 'foil' },
  { id: 'catalyst', label: 'Catalyst', dict: 'catalyst' },
  { id: 'mentor', label: 'Mentor / Guide', dict: 'mentor' },
  { id: 'confidant', label: 'Confidant(e)', dict: 'confidant' },
  { id: 'loveInterest', label: 'Love Interest', dict: 'loveInterest' },
  { id: 'skeptic', label: 'Skeptic / Voice of Reason', dict: 'skeptic' },
  { id: 'henchman', label: 'Henchman / Enforcer', dict: 'henchman' },
  { id: 'thresholdGuardian', label: 'Threshold Guardian', dict: 'thresholdGuardian' },
  { id: 'shadow', label: 'Shadow / Mirror', dict: 'shadow' },
];
export const primaryRole = (id) => PRIMARY_ROLES.find((r) => r.id === id) || null;
export const secondaryRole = (id) => SECONDARY_ROLES.find((r) => r.id === id && r.id !== 'none') || null;

/** "Deuteragonist (Foil)", "Protagonist", "(Mentor / Guide)" or "". */
export function roleSummary(c) {
  const p = primaryRole(c?.primaryRole);
  const s = secondaryRole(c?.secondaryRole);
  if (p && s) return `${p.label} (${s.label})`;
  return p ? p.label : s ? `(${s.label})` : '';
}

// Words in an older free-text "Role / Relationship" that name a role.
const PRIMARY_WORDS = [
  ['protagonist', /\b(?:protagonist|lead|main character|hero(?:ine)?)\b/i],
  ['antagonist', /\b(?:antagonist|villain)\b/i],
  ['deuteragonist', /\bdeuteragonist\b/i],
  ['tritagonist', /\btritagonist\b/i],
  ['supporting', /\bsupporting(?: character| role)?\b/i],
  // "Minor Character / Cameo" (the old label) as a whole, so no stray "Cameo" is left as a relationship.
  ['minor', /\b(?:minor(?: character| role)?(?:\s*\/\s*cameo)?|cameo|bit part)\b/i],
];
const SECONDARY_WORDS = [
  ['foil', /\bfoil\b/i],
  ['catalyst', /\b(?:catalyst|instigator)\b/i],
  ['mentor', /\b(?:mentor|guide)\b/i],
  ['confidant', /\bconfidante?\b/i],
  ['loveInterest', /\blove interest\b/i],
  ['skeptic', /\b(?:skeptic|voice of reason)\b/i],
  ['henchman', /\b(?:henchman|henchmen|enforcer)\b/i],
  ['thresholdGuardian', /\bthreshold guardian\b/i],
  ['shadow', /\bshadow\b/i],
];

/**
 * An older free-text role ("Protagonist · Theo’s older sister") → { primaryRole, secondaryRole,
 * relationship }: role words found become the picks, the rest is kept as the relationship.
 */
export function splitLegacyRole(text) {
  let rest = String(text || '');
  let primary = '';
  let secondary = 'none';
  for (const [id, re] of PRIMARY_WORDS) {
    if (re.test(rest)) {
      primary = id;
      rest = rest.replace(re, ' ');
      break;
    }
  }
  for (const [id, re] of SECONDARY_WORDS) {
    if (re.test(rest)) {
      secondary = id;
      rest = rest.replace(re, ' ');
      break;
    }
  }
  const relationship = rest
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·,;:/|–—-]+|[\s·,;:/|–—-]+$/g, '')
    .replace(/\s+([·,;])/g, '$1')
    .trim();
  return { primaryRole: primary, secondaryRole: secondary, relationship };
}

/** A stored bio in today's shape: picks validated, a legacy `role` split into picks + relationship. */
export function normalizeCharacter(c) {
  const { role, ...rest } = c;
  const out = {
    ...rest,
    primaryRole: primaryRole(rest.primaryRole) ? rest.primaryRole : '',
    secondaryRole: secondaryRole(rest.secondaryRole) ? rest.secondaryRole : 'none',
    relationship: typeof rest.relationship === 'string' ? rest.relationship : '',
    age: typeof rest.age === 'string' ? rest.age : '',
    gender: validGender(rest.gender),
    description: typeof rest.description === 'string' ? rest.description : '', // Physical Description
    traits: typeof rest.traits === 'string' ? rest.traits : '',
    backstory: typeof rest.backstory === 'string' ? rest.backstory : '',
  };
  if (typeof role === 'string' && role.trim()) {
    const legacy = splitLegacyRole(role);
    if (!out.primaryRole) out.primaryRole = legacy.primaryRole;
    if (out.secondaryRole === 'none') out.secondaryRole = legacy.secondaryRole;
    if (!out.relationship.trim()) out.relationship = legacy.relationship;
  }
  return out;
}

export const normalizeCharacters = (list) => (Array.isArray(list) ? list.map(normalizeCharacter) : []);

export function newCharacter(fields = {}) {
  return normalizeCharacter({
    id: uid('ch'), name: '', primaryRole: '', secondaryRole: 'none', relationship: '', age: '', gender: '', description: '', traits: '', backstory: '',
    ...fields,
  });
}

export function validCharacters(list) {
  return Array.isArray(list) && list.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string');
}

/** Add a character (at the end, or at `index`). */
export function addCharacter(list, fields = {}, index = list.length) {
  const c = newCharacter(fields);
  const next = list.slice();
  next.splice(Math.max(0, Math.min(index, next.length)), 0, c);
  return { list: next, character: c };
}

export function updateCharacter(list, id, patch) {
  let changed = false;
  const next = list.map((c) => {
    if (c.id !== id) return c;
    changed = true;
    return { ...c, ...patch, id };
  });
  return changed ? next : list;
}

export function removeCharacter(list, id) {
  const next = list.filter((c) => c.id !== id);
  return next.length === list.length ? list : next;
}

/** Move a character up (-1) or down (+1) in the list. */
export function moveCharacter(list, id, dir) {
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** A–Z by name (unnamed characters last), stable for ties. */
export function sortCharacters(list) {
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const x = a.c.name.trim();
      const y = b.c.name.trim();
      if (!x !== !y) return x ? -1 : 1;
      return x.localeCompare(y, undefined, { sensitivity: 'base' }) || a.i - b.i;
    })
    .map(({ c }) => c);
}

/** Filter by name (case- and accent-insensitive substring). */
export function filterCharacters(list, query) {
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = fold((query || '').trim());
  return q ? list.filter((c) => fold(c.name).includes(q)) : list;
}

/** Script speakers (CHARACTER cues) that have no bio yet, by cue name. */
export function missingFromScript(list, speakers) {
  const have = new Set(list.map((c) => c.name.trim().toUpperCase()));
  return speakers.filter((n) => n && !have.has(n.trim().toUpperCase()));
}

// ---- Story notes ------------------------------------------------------------------------
//
// { version, sections: [{ id, title, body }], synopsis: { act1, act2, act2b, act3 }, treatment: { …same… } }
// The Synopsis is a structured act card shown right after Timeline (SYNOPSIS_AFTER); the Treatment —
// the same acts, at full length — comes right after the Synopsis.
//
// Both follow the Scene Board's 3 / 4-act switch (ACT_STRUCTURES). Four slots are stored, so a
// switch never moves or loses text:
//   3 acts: Act I (act1) · Act II (act2) · Act III (act3)
//   4 acts: Act 1 (act1) · Act 2A (act2) · Act 2B (act2b) · Act 3 (act3)
// Act II's text is Act 2A's in the 4-act view; Act 2B written there stays on show in the 3-act
// view too (under Act II), so nothing is ever hidden.

/** The act structures the Synopsis, Treatment and Scene Board offer. */
export const ACT_STRUCTURES = [3, 4];
export const DEFAULT_ACT_STRUCTURE = 4;
export const ACT_KEYS = ['act1', 'act2', 'act2b', 'act3'];

// Labels per structure — the 4-act names are the Scene Board's (beats.js ACTS).
const ACT_LABELS = {
  3: {
    act1: ['Act I: Setup', 'Act I (Setup)'],
    act2: ['Act II: Confrontation', 'Act II (Confrontation)'],
    act2b: ['Act II (cont.): Fall & Crisis', 'Act II, cont. (Fall & Crisis)'],
    act3: ['Act III: Resolution', 'Act III (Resolution)'],
  },
  4: {
    act1: ['Act 1: Setup', 'Act 1 (Setup)'],
    act2: ['Act 2A: Escalation to Midpoint', 'Act 2A (Escalation to Midpoint)'],
    act2b: ['Act 2B: Fall & Crisis', 'Act 2B (Fall & Crisis)'],
    act3: ['Act 3: Climax & Resolution', 'Act 3 (Climax & Resolution)'],
  },
};
const PLACEHOLDERS = {
  synopsis: {
    3: {
      act1: 'Act I setup, world-building, inciting incident...',
      act2: 'Act II escalating stakes, midpoint reversal, all-hope-is-lost moment...',
      act2b: 'The fall after the midpoint, the crisis...',
      act3: 'Act III climax, ultimate confrontation, and resolution...',
    },
    4: {
      act1: 'Act 1 setup, world-building, inciting incident...',
      act2: 'Act 2A rising stakes, up to the midpoint reversal...',
      act2b: 'Act 2B the fall after the midpoint, the crisis, the all-hope-is-lost moment...',
      act3: 'Act 3 climax, ultimate confrontation, and resolution...',
    },
  },
  treatment: {
    3: {
      act1: 'Act I in full: the world, the characters, the inciting incident — sequence by sequence...',
      act2: 'Act II in full: escalating stakes, subplots, the midpoint reversal, the all-hope-is-lost moment...',
      act2b: 'The fall after the midpoint, in full...',
      act3: 'Act III in full: the climax, the final confrontation, and the resolution...',
    },
    4: {
      act1: 'Act 1 in full: the world, the characters, the inciting incident — sequence by sequence...',
      act2: 'Act 2A in full: rising stakes and subplots, up to the midpoint reversal...',
      act2b: 'Act 2B in full: the fall after the midpoint, the crisis, the all-hope-is-lost moment...',
      act3: 'Act 3 in full: the climax, the final confrontation, and the resolution...',
    },
  },
};

const actStructure = (mode) => (ACT_STRUCTURES.includes(Number(mode)) ? Number(mode) : 3);

/**
 * The act boxes a card shows: card 'synopsis' | 'treatment', structure 3 | 4, and the card's
 * value — in the 3-act view Act 2B appears (under Act II) only when it has text.
 * → [{ key, label, short, placeholder }]
 */
export function actsFor(card, mode, value) {
  const m = actStructure(mode);
  const keys = m === 4 ? ACT_KEYS : ACT_KEYS.filter((k) => k !== 'act2b' || (value?.act2b || '').trim());
  return keys.map((key) => ({ key, label: ACT_LABELS[m][key][0], short: ACT_LABELS[m][key][1], placeholder: PLACEHOLDERS[card][m][key] }));
}

/** The Synopsis card's three acts (the 3-act view, nothing in 2B). */
export const SYNOPSIS_ACTS = actsFor('synopsis', 3, null);
export const SYNOPSIS_AFTER = 'Timeline';

export const emptySynopsis = () => ({ act1: '', act2: '', act2b: '', act3: '' });

/** The Treatment card: the full narrative treatment, below the Synopsis, in the Synopsis's acts. */
export const TREATMENT = {
  label: 'Treatment',
  placeholder: 'Write or paste your full narrative treatment here (sequence-by-sequence prose, scene breakdowns, subplots)...',
};

/** The Treatment's acts in the 3-act view (full-length prompts). */
export const TREATMENT_ACTS = actsFor('treatment', 3, null);

/** "ACT I: SETUP", "ACT 2A: ESCALATION TO MIDPOINT" — how an act is headed in Copy as Markdown's Treatment. */
export const treatmentActHeading = (a) => a.label.toUpperCase();

/**
 * Anything stored → { act1, act2, act2b, act3 }. A plain string (a one-box treatment from before
 * the acts) becomes Act I, word for word.
 */
export const normalizeTreatment = (v) => normalizeSynopsis(v);

export const treatmentHasText = (t) => synopsisHasText(t);

/** Set one Treatment act (the others are untouched). */
export function setTreatmentAct(notes, key, text) {
  if (!ACT_KEYS.includes(key)) return notes;
  return { ...notes, treatment: { ...normalizeTreatment(notes.treatment), [key]: String(text ?? '') } };
}

/** Anything stored → { act1, act2, act2b, act3 }. A plain string (an older one-box synopsis) becomes Act I. */
export function normalizeSynopsis(v) {
  if (typeof v === 'string') return { ...emptySynopsis(), act1: v };
  if (!v || typeof v !== 'object') return emptySynopsis();
  const out = emptySynopsis();
  for (const key of ACT_KEYS) out[key] = typeof v[key] === 'string' ? v[key] : '';
  return out;
}

export const synopsisHasText = (s) => ACT_KEYS.some((key) => (s?.[key] || '').trim());

/** Set one act's text (the others are untouched). */
export function setSynopsisAct(notes, key, text) {
  if (!ACT_KEYS.includes(key)) return notes;
  return { ...notes, synopsis: { ...normalizeSynopsis(notes.synopsis), [key]: text } };
}

// ---- Switching 3 ⇄ 4 acts: the Act II text is split / joined (Synopsis and Treatment alike) ----
//
// 4 → 3: Act 2A and Act 2B are joined into Act II with a plain blank line — nothing is added to the
//        prose. Where 2B began is kept out of sight in the notes (`actSplits`): its offset, plus a
//        few words either side, so the boundary can still be found after edits elsewhere.
// 3 → 4: Act II becomes Act 2A + Act 2B, split at the first of these that applies:
//          1. where it was joined (the remembered boundary, if those words are still there);
//          2. a marker the writer typed — a "### Act 2B" or "## Midpoint" heading, a "---" rule or
//             "[ACT 2B]" (dropped from the text);
//          3. before the first paragraph that names the first Act 2B card's scene location (or
//             title) on the Scene Board, e.g. "MORNE CALVAIRE", or has a midpoint keyword
//             (MIDPOINT_KEYWORDS) — whichever paragraph comes first;
//          4. the paragraph break nearest the middle.
//        Paragraphs are separated by blank lines; text written with single line breaks only is
//        taken line by line.
//        Splits fall between paragraphs — nothing is added to the text. Act 2B is never left empty
//        while Act II has words. (Nothing moves if 2B already has text.)

/** A split marker the writer can type into Act II. */
export const ACT2B_MARKER = /(?:###?\s*(?:ACT\s*2B|MIDPOINT)|---|\[ACT\s*2B\])/i;
const SPLIT_CONTEXT = 32; // characters remembered either side of the boundary
export const SPLIT_CARDS = ['synopsis', 'treatment'];

/** Split text at the boundary nearest its middle: a blank line, else a line break, a sentence end, a space. */
function splitNearMiddle(text) {
  const t = text.trim();
  const mid = t.length / 2;
  for (const re of [/\n[ \t]*\n/g, /\n/g, /(?<=[.!?]["'”’)\]]*)\s+/g, /\s+/g]) {
    let best = null;
    for (const m of t.matchAll(re)) {
      const centre = m.index + m[0].length / 2;
      if (!best || Math.abs(centre - mid) < Math.abs(best.index + best[0].length / 2 - mid)) best = m;
    }
    if (best) return [t.slice(0, best.index).trim(), t.slice(best.index + best[0].length).trim()];
  }
  return [t, '']; // one word: nowhere to split
}

/** Words that mark the story's midpoint, used when no marker or Scene Board anchor splits Act II. */
export const MIDPOINT_KEYWORDS = /(?:carlo|hit and run|bmw|nephew of cassandre)/i;

const TIME_OF_DAY = /\s+[-–—]\s+(?:DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNRISE|SUNSET|LATER|CONTINUOUS|MOMENTS LATER|SAME|SAME TIME|NOON|MIDNIGHT)\b.*$/i;
const SLUG_PREFIX = /^(?:INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.|EXT\.|EST\.)\s*/i;

/** "EXT. MORNE CALVAIRE - NIGHT" → "MORNE CALVAIRE" ('' when it isn't a scene heading). */
export function slugLocation(heading) {
  const h = String(heading || '').trim();
  if (!SLUG_PREFIX.test(h)) return '';
  return h.replace(SLUG_PREFIX, '').replace(TIME_OF_DAY, '').trim();
}

/**
 * What to look for in Act II to find where Act 2B starts: from the Scene Board's first Act 2B card,
 * its linked scene's location, else its own heading's location, else its title.
 */
export function act2bAnchors({ beats = [], blocks = [] } = {}) {
  const card = (beats || []).find((b) => b && b.act === 2);
  if (!card) return [];
  const out = [];
  const scene = card.sceneId && (blocks || []).find((b) => b.id === card.sceneId);
  if (scene) out.push(slugLocation(scene.text));
  const title = String(card.title || '').trim();
  out.push(slugLocation(title) || title);
  return [...new Set(out.filter((a) => a.length >= 3))];
}

/** Paragraphs of `t` with where each starts: [{ start, text }] — blank-line separated, else one per line. */
function paragraphs(t) {
  const out = [];
  const re = /\n[ \t]*\n/.test(t) ? /\n[ \t]*\n+/g : /\n+/g;
  let start = 0;
  for (const m of t.matchAll(re)) {
    out.push({ start, text: t.slice(start, m.index) });
    start = m.index + m[0].length;
  }
  out.push({ start, text: t.slice(start) });
  return out;
}
const wordRe = (phrase) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?:$|[^\\p{L}\\p{N}])`, 'iu');

/** Split before the first paragraph after the first that matches `test`, or null. */
function splitBeforeParagraph(t, test) {
  const p = paragraphs(t).slice(1).find((x) => test(x.text));
  return p ? [t.slice(0, p.start).trim(), t.slice(p.start).trim()] : null;
}

/**
 * Before the first paragraph (after the first) naming a Scene Board anchor or holding a midpoint
 * keyword → [2A, 2B]; null when none does.
 */
export function splitAtStoryTurn(text, { anchors = [], keywords = MIDPOINT_KEYWORDS } = {}) {
  const t = String(text || '').trim();
  const res = anchors.map(wordRe);
  return splitBeforeParagraph(t, (p) => res.some((re) => re.test(p)) || Boolean(keywords?.test(p)));
}

/**
 * Act II → [Act 2A, Act 2B]: at a typed marker, else before the first paragraph naming a Scene
 * Board anchor (`anchors`, see act2bAnchors) or holding a midpoint keyword, else near the middle.
 */
export function splitAct2(text, { anchors = [], keywords = MIDPOINT_KEYWORDS } = {}) {
  const t = String(text || '').trim();
  if (!t) return ['', ''];
  const m = ACT2B_MARKER.exec(t);
  if (m) {
    // A heading marker takes its whole line ("### Act 2B: Fall & Crisis"); "---" and "[ACT 2B]" only themselves.
    let end = m.index + m[0].length;
    if (m[0].startsWith('#')) {
      const nl = t.indexOf('\n', end);
      end = nl < 0 ? t.length : nl;
    }
    const before = t.slice(0, m.index).trim();
    const after = t.slice(end).trim();
    if (after) return [before, after];
    return before ? splitAct2(before, { anchors, keywords }) : ['', '']; // marker at the very end
  }
  const hit = splitAtStoryTurn(t, { anchors, keywords });
  return hit || splitNearMiddle(t);
}

/** [Act 2A, Act 2B] → Act II: the two trimmed halves with a blank line between (empty halves add nothing). */
export function joinAct2(a, b) {
  return [String(a || '').trim(), String(b || '').trim()].filter(Boolean).join('\n\n');
}

/** Where 2B begins in joinAct2(a, b): { at, head, tail } — or null when 2B is empty. */
export function act2Split(a, b) {
  const A = String(a || '').trim();
  const B = String(b || '').trim();
  if (!B) return null;
  return { at: A ? A.length + 2 : 0, head: A.slice(-SPLIT_CONTEXT), tail: B.slice(0, SPLIT_CONTEXT) };
}

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Act II split at a remembered boundary → [2A, 2B], or null when those words aren't there any more. */
export function restoreSplit(text, split) {
  const t = String(text || '').trim();
  if (!split || typeof split.tail !== 'string' || !split.tail || !t) return null;
  const head = String(split.head || '');
  const fits = (at) => at >= 0 && at <= t.length && t.slice(0, at).trimEnd().endsWith(head) && t.slice(at).trimStart().startsWith(split.tail);
  const cut = (at) => [t.slice(0, at).trim(), t.slice(at).trim()];
  if (Number.isInteger(split.at) && fits(split.at)) return cut(split.at);
  // Text was added or removed before the boundary: look for the same words, once.
  const re = new RegExp(`${head ? `${escapeRe(head)}\\s*` : '^'}(?=${escapeRe(split.tail)})`, 'g');
  const hits = [...t.matchAll(re)];
  return hits.length === 1 ? cut(hits[0].index + hits[0][0].length) : null;
}

/** One card's acts { act1, act2, act2b, act3 } converted from `from` acts to `to` acts (`hints`: splitAct2's). */
export function convertActs(acts, from, to, split = null, hints = {}) {
  const v = normalizeSynopsis(acts);
  if (Number(from) === Number(to)) return v;
  if (Number(to) === 4) {
    if (v.act2b.trim() || !v.act2.trim()) return v;
    const [a, b] = restoreSplit(v.act2, split) || splitAct2(v.act2, hints);
    return { ...v, act2: a, act2b: b };
  }
  if (!v.act2b.trim()) return v;
  return { ...v, act2: joinAct2(v.act2, v.act2b), act2b: '' };
}

/**
 * "Auto-Align Acts" (4 acts): re-split each card's Act 2A + 2B as one Act II, using the Scene
 * Board and midpoint keywords (see splitAct2) — text only moves between 2A and 2B, nothing is
 * added or lost. Returns { notes, changed: ['synopsis', …] } (the same notes object if nothing moved).
 */
export function realignActs(notes, story = {}) {
  const n = normalizeStoryNotes(notes);
  const hints = { anchors: act2bAnchors(story) };
  const changed = [];
  const next = {};
  for (const card of SPLIT_CARDS) {
    const v = n[card];
    const whole = joinAct2(v.act2, v.act2b);
    if (!whole) continue;
    const [a, b] = splitAct2(whole, hints);
    if (a !== v.act2.trim() || b !== v.act2b.trim()) {
      next[card] = { ...v, act2: a, act2b: b };
      changed.push(card);
    }
  }
  if (!changed.length) return { notes, changed };
  const out = { ...n, ...next };
  const splits = { ...n.actSplits };
  for (const c of changed) delete splits[c]; // a remembered join no longer applies
  if (Object.keys(splits).length) out.actSplits = splits;
  else delete out.actSplits;
  return { notes: out, changed };
}

/** A valid remembered boundary, or null. */
const validSplit = (x) => (x && typeof x === 'object' && Number.isInteger(x.at) && x.at >= 0 && typeof x.head === 'string' && typeof x.tail === 'string' && x.tail
  ? { at: x.at, head: x.head, tail: x.tail } : null);
export function normalizeActSplits(x) {
  const out = {};
  for (const card of SPLIT_CARDS) {
    const v = validSplit(x?.[card]);
    if (v) out[card] = v;
  }
  return out;
}

/**
 * The notes after switching the act structure: Synopsis and Treatment both converted, with
 * `actSplits` remembering (4 → 3) or using up (3 → 4) where each Act 2B began. `story`
 * ({ beats, blocks }) lets 3 → 4 find Act 2B from the Scene Board.
 */
export function convertNotesActs(notes, from, to, story = {}) {
  if (Number(from) === Number(to)) return notes;
  const hints = { anchors: act2bAnchors(story) }; // story: { beats, blocks } — the Scene Board and script
  const n = normalizeStoryNotes(notes);
  const splits = { ...n.actSplits };
  const next = {};
  for (const card of SPLIT_CARDS) {
    const before = n[card];
    if (Number(to) === 3) {
      const at = act2Split(before.act2, before.act2b);
      if (at) splits[card] = at;
      next[card] = convertActs(before, from, to);
    } else {
      next[card] = convertActs(before, from, to, splits[card], hints);
      if (next[card].act2b !== before.act2b || !before.act2.trim()) delete splits[card];
    }
  }
  const same = (a, b) => ACT_KEYS.every((k) => a[k] === b[k]);
  const sameSplits = JSON.stringify(splits) === JSON.stringify(n.actSplits || {});
  if (SPLIT_CARDS.every((c) => same(next[c], n[c])) && sameSplits) return notes; // nothing to move: not an edit
  const out = { ...n, ...next };
  if (Object.keys(splits).length) out.actSplits = splits;
  else delete out.actSplits;
  return out;
}

/** Where the Synopsis card goes among the sections: right after Pitch, else at the end. */
export function synopsisIndex(sections) {
  // After Timeline; if that card was deleted, after the last of Logline / Tone / Pitch still there.
  for (const name of [...NOTES_ORDER].reverse()) {
    const i = sections.findIndex((s) => s.title.trim().toLowerCase() === name.toLowerCase());
    if (i >= 0) return i + 1;
  }
  return sections.length;
}

/**
 * Version 3 → 4: Logline, Tone, Pitch and Timeline put in that order, each in one of the places
 * those cards already held — your own cards (and the Scratchpad) don't move.
 */
export function reorderStandardNotes(sections) {
  const rank = (s) => NOTES_ORDER.findIndex((n) => n.toLowerCase() === s.title.trim().toLowerCase());
  const slots = sections.map((s, i) => (rank(s) >= 0 ? i : -1)).filter((i) => i >= 0);
  const sorted = slots.map((i) => sections[i]).sort((a, b) => rank(a) - rank(b));
  const out = [...sections];
  slots.forEach((slot, k) => { out[slot] = sorted[k]; });
  return out;
}

/**
 * The Notes tab as Markdown, in on-screen order — the Synopsis (Act I / II / III) in its place
 * after Pitch, then the Treatment. Empty sections and acts are left out.
 */
export function storyNotesMarkdown(notes, title = '', mode = 3) {
  const n = normalizeStoryNotes(notes);
  const out = [];
  if (title.trim()) out.push(`# ${title.trim()} — Story Notes`, '');
  const syn = () => {
    if (synopsisHasText(n.synopsis)) {
      out.push('## Synopsis', '');
      for (const a of actsFor('synopsis', mode, n.synopsis)) {
        const t = n.synopsis[a.key].trim();
        if (t) out.push(`### ${a.label}`, '', t, '');
      }
    }
    if (treatmentHasText(n.treatment)) {
      out.push(`## ${TREATMENT.label}`, '');
      for (const a of actsFor('treatment', mode, n.treatment)) {
        const t = n.treatment[a.key].trim();
        if (t) out.push(`### ${treatmentActHeading(a)}`, '', t, '');
      }
    }
  };
  const at = synopsisIndex(n.sections);
  n.sections.forEach((s, i) => {
    if (i === at) syn();
    if (!s.body.trim()) return;
    out.push(`## ${s.title.trim() || 'Untitled section'}`, '', s.body.trim(), '');
  });
  if (at >= n.sections.length) syn();
  return `${out.join('\n').trim()}\n`;
}

export function defaultStoryNotes() {
  return {
    version: STORY_NOTES_VERSION,
    sections: DEFAULT_SECTIONS.map((title) => ({ id: uid('sn'), title, body: '' })),
    synopsis: emptySynopsis(),
    treatment: emptySynopsis(),
  };
}

/**
 * Bring notes from an older version to today's presets without losing a word:
 *   • "Themes & Motifs" → Themes, "Timeline & Lore" → Timeline, "General Scratchpad" →
 *     Scratchpad (same section, same id, same text)
 *   • any preset that's missing is added, empty
 *   • presets go first in order — Logline, Themes, Tone, Timeline, Pitch, Scratchpad —
 *     followed by your own sections in the order you had them
 *   • if two sections end up with the same preset name, their text is combined
 */
export function migrateStoryNotes(sections) {
  const presets = new Map();
  const custom = [];
  let themes = null; // old "Themes" / "Themes & Motifs" text, combined — kept unless it moves to Story DNA
  const combine = (have, s) => {
    if (s.body.trim()) have.body = have.body.trim() ? `${have.body.replace(/\s+$/, '')}\n\n${s.body}` : s.body;
  };
  for (const s of sections) {
    if (isThemeTitle(s.title)) {
      if (!themes) themes = { ...s, title: 'Themes' };
      else combine(themes, s);
      continue;
    }
    const name = presetName(s.title);
    if (!name) {
      custom.push(s);
      continue;
    }
    const have = presets.get(name);
    if (!have) presets.set(name, { ...s, title: name });
    else combine(have, s);
  }
  const ordered = DEFAULT_SECTIONS.map((name) => presets.get(name) || { id: uid('sn'), title: name, body: '' });
  // An empty Themes card just goes; one with text stays (as your own section) until it can move.
  const kept = themes?.body.trim() ? [themes] : [];
  return { version: STORY_NOTES_VERSION, sections: [...ordered, ...kept, ...custom], synopsis: emptySynopsis(), treatment: emptySynopsis() };
}

/** "- Exile\n- Return home" → "Exile; Return home" (Story DNA's Theme is a one-line field). */
export function themeLine(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '').replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .join('; ');
}

export const CENTRAL_QUESTION_PREFIX = 'Central dramatic question: ';

/**
 * Story DNA no longer has a Central Dramatic Question field. A project that filled one in keeps
 * its words: they're added to the Scratchpad note (once — loading again doesn't repeat them).
 */
function keepCentralQuestion(storyNotes, rawDna) {
  const q = typeof rawDna?.centralQuestion === 'string' ? rawDna.centralQuestion.trim() : '';
  if (!q) return storyNotes;
  const line = `${CENTRAL_QUESTION_PREFIX}${q}`;
  if (storyNotes.sections.some((s) => s.body.includes(line))) return storyNotes;
  const sections = [...storyNotes.sections];
  let i = sections.findIndex((s) => s.title === 'Scratchpad');
  if (i < 0) {
    sections.push({ id: uid('sn'), title: 'Scratchpad', body: '' });
    i = sections.length - 1;
  }
  const body = sections[i].body.replace(/\s+$/, '');
  sections[i] = { ...sections[i], body: body ? `${body}\n\n${line}` : line };
  return { ...storyNotes, sections };
}

/**
 * Load-time migration for the Story Bible as a whole (stored notes + stored Story DNA):
 * notes saved before version 3 had a Themes card. Its text moves into Story DNA's Theme
 * when that's blank; if Theme already says the same thing, the card simply goes; if Theme
 * says something else, the card stays as one of your own notes — nothing is overwritten.
 * Returns { storyNotes, storyDna, movedTheme }.
 */
export function migrateStoryBible(rawNotes, rawDna) {
  let storyDna = normalizeStoryDna(rawDna);
  let storyNotes = keepCentralQuestion(normalizeStoryNotes(rawNotes), rawDna);
  const old = rawNotes && typeof rawNotes === 'object' && (rawNotes.version || 1) < THEMES_MOVED_VERSION;
  const card = old ? storyNotes.sections.find((s) => s.title === 'Themes') : null;
  if (!card) return { storyNotes, storyDna, movedTheme: false };
  const line = themeLine(card.body);
  const current = storyDna.theme.trim();
  if (current && current !== line) return { storyNotes, storyDna, movedTheme: false };
  if (!current) storyDna = { ...storyDna, theme: line };
  storyNotes = { ...storyNotes, sections: storyNotes.sections.filter((s) => s !== card) };
  return { storyNotes, storyDna, movedTheme: !current };
}

/**
 * Anything stored (object, legacy markdown string, nothing) → { version, sections }.
 * Notes from before version 2 are migrated once (see migrateStoryNotes); current notes are
 * kept exactly as they are.
 */
export function normalizeStoryNotes(notes) {
  if (typeof notes === 'string') {
    const d = defaultStoryNotes();
    d.sections[d.sections.length - 1].body = notes;
    return d;
  }
  if (notes && Array.isArray(notes.sections) && notes.sections.every((s) => s && typeof s.id === 'string')) {
    const sections = notes.sections.map((s) => ({ id: s.id, title: String(s.title ?? ''), body: String(s.body ?? '') }));
    const synopsis = normalizeSynopsis(notes.synopsis);
    const treatment = normalizeTreatment(notes.treatment);
    const splits = normalizeActSplits(notes.actSplits); // where a joined Act II splits again (convertNotesActs)
    const extra = Object.keys(splits).length ? { actSplits: splits } : {};
    const v = notes.version || 1;
    if (v < THEMES_MOVED_VERSION) return { ...migrateStoryNotes(sections), synopsis, treatment, ...extra };
    if (v < STORY_NOTES_VERSION) return { version: STORY_NOTES_VERSION, sections: reorderStandardNotes(sections), synopsis, treatment, ...extra };
    return { version: notes.version, sections, synopsis, treatment, ...extra };
  }
  return defaultStoryNotes();
}

export function updateSection(notes, id, patch) {
  return { ...notes, sections: notes.sections.map((s) => (s.id === id ? { ...s, ...patch, id } : s)) };
}

export function addSection(notes, title = 'New section') {
  const section = { id: uid('sn'), title, body: '' };
  return { notes: { ...notes, sections: [...notes.sections, section] }, section };
}

export function removeSection(notes, id) {
  return { ...notes, sections: notes.sections.filter((s) => s.id !== id) };
}

/**
 * Split pasted text into sections at Markdown headings (# / ## / ###) or underlined
 * headings. Text before the first heading has title null.
 */
export function splitByHeadings(text) {
  const lines = (text || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let cur = { title: null, lines: [] };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const md = l.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/);
    const underlined = !md && l.trim() && /^\s*(=+|-{3,})\s*$/.test(lines[i + 1] || '') ? l.trim() : null;
    if (md || underlined) {
      if (cur.title !== null || cur.lines.some((x) => x.trim())) out.push(cur);
      const level = md ? md[1].length : /=/.test(lines[i + 1]) ? 1 : 2;
      cur = { title: (md ? md[2] : underlined).trim(), level, lines: [] };
      if (underlined) i += 1;
    } else cur.lines.push(l);
  }
  if (cur.title !== null || cur.lines.some((x) => x.trim())) out.push(cur);
  return out.map((s) => ({ title: s.title, level: s.level ?? 0, body: s.lines.join('\n').trim() }));
}

/** importNotes targets for the Treatment's acts (the "Into" list offers them beside the sections). */
export const treatmentTargets = (mode = 3, value = null) => actsFor('treatment', mode, value)
  .map((a) => ({ id: `treatment:${a.key}`, key: a.key, label: `${TREATMENT.label} — ${a.short}` }));
export const TREATMENT_TARGETS = treatmentTargets(3);
const treatmentTargetKey = (id) => {
  const m = /^treatment:(act1|act2|act2b|act3)$/.exec(id || '');
  return m ? m[1] : null;
};

/** Which fixed card a pasted heading names: 'treatment', 'synopsis', an act key, or null. */
function fixedCardFor(title) {
  const t = title.trim().toLowerCase().replace(/[:.]+$/, '').replace(/\s+/g, ' ');
  if (t === TREATMENT.label.toLowerCase()) return 'treatment';
  if (t === 'synopsis') return 'synopsis';
  // "Act I", "ACT II: CONFRONTATION", "Act 1", "Act 2A", "ACT 2B: FALL & CRISIS", "Act III (Resolution)"…
  // — the act, then nothing or a ":" / "(" / dash and a name (so "Act 1 notes" stays a section).
  const m = /^act\s+(iii|ii|i|[123])([ab])?(?:\s*(?:[:(–—-].*|\(cont\.\).*))?$/.exec(t);
  if (!m) return null;
  const n = { i: 1, ii: 2, iii: 3 }[m[1]] || Number(m[1]);
  if (n === 1) return m[2] ? null : 'act1';
  if (n === 3) return m[2] ? null : 'act3';
  return m[2] === 'b' || /\(cont\.\)/.test(t) ? 'act2b' : 'act2';
}

/**
 * "Import from Notes": paste external text into the Bible.
 *   mode 'append'   — add to the end of section `targetId`
 *   mode 'replace'  — replace that section's text
 *   mode 'sections' — split at headings: a heading that matches an existing section's
 *                      title appends there, others become new sections; text before the
 *                      first heading goes to `targetId`.
 *                      "## Synopsis" and "## Treatment" fill those cards: their act headings
 *                      ("### ACT I: SETUP", "### Act II: Confrontation", "### Act 3"…) pick the
 *                      act, and any other headings under them stay in the current act's text.
 *                      Act headings on their own (no card heading above) go to the Synopsis.
 *   targetId "treatment:act1" … (TREATMENT_TARGETS) — that Treatment act
 */
export function importNotes(notes, text, { targetId, mode = 'append' } = {}) {
  const clean = (text || '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return notes;
  const join = (a, b) => (a.trim() ? `${a.replace(/\s+$/, '')}\n\n${b}` : b);
  const intoTreatment = treatmentTargetKey(targetId);
  // Fixed cards: read / write one act of the Synopsis or the Treatment.
  const getAct = (n, card, key) => (card === 'treatment' ? normalizeTreatment(n.treatment) : normalizeSynopsis(n.synopsis))[key];
  const setAct = (n, card, key, t) => (card === 'treatment' ? setTreatmentAct(n, key, t) : setSynopsisAct(n, key, t));
  const addToAct = (n, card, key, t) => (t ? setAct(n, card, key, join(getAct(n, card, key), t)) : n);

  if (intoTreatment && mode !== 'sections') {
    return setAct(notes, 'treatment', intoTreatment, mode === 'replace' ? clean : join(getAct(notes, 'treatment', intoTreatment), clean));
  }
  const target = notes.sections.find((s) => s.id === targetId) || notes.sections[notes.sections.length - 1];
  if (mode !== 'sections' || !target) {
    if (!target) return addSectionWith(notes, 'Imported notes', clean);
    return updateSection(notes, target.id, { body: mode === 'replace' ? clean : join(target.body, clean) });
  }
  let next = notes;
  let inCard = null; // { card: 'synopsis' | 'treatment', level, act } while inside "## Synopsis" / "## Treatment"
  for (const part of splitByHeadings(clean)) {
    if (part.title === null) {
      if (!part.body) continue;
      if (intoTreatment) next = addToAct(next, 'treatment', intoTreatment, part.body);
      else next = updateSection(next, target.id, { body: join(next.sections.find((s) => s.id === target.id).body, part.body) });
      continue;
    }
    const fixed = fixedCardFor(part.title);
    if (inCard && part.level > inCard.level) {
      if (fixed && fixed.startsWith('act')) {
        inCard.act = fixed;
        next = addToAct(next, inCard.card, fixed, part.body);
      } else {
        // A heading of its own inside an act (### Sequence 2…): kept, with its text, in that act.
        const chunk = `${'#'.repeat(part.level)} ${part.title}${part.body ? `\n\n${part.body}` : ''}`;
        next = addToAct(next, inCard.card, inCard.act, chunk);
      }
      continue;
    }
    inCard = null;
    // Copy as Markdown's own title line ("# Run! — Story Notes") isn't a section.
    if (/\s—\s*Story Notes$/.test(part.title) && !part.body) continue;
    if (fixed === 'treatment' || fixed === 'synopsis') {
      inCard = { card: fixed, level: part.level || 1, act: 'act1' };
      next = addToAct(next, fixed, 'act1', part.body);
      continue;
    }
    if (fixed) { // an act heading on its own: the Synopsis
      next = addToAct(next, 'synopsis', fixed, part.body);
      continue;
    }
    const want = (presetName(part.title) || part.title).toLowerCase();
    const same = next.sections.find((s) => s.title.trim().toLowerCase() === want);
    if (same) next = part.body ? updateSection(next, same.id, { body: join(same.body, part.body) }) : next;
    else next = addSectionWith(next, part.title, part.body);
  }
  return next;
}

function addSectionWith(notes, title, body) {
  const { notes: n, section } = addSection(notes, title);
  return updateSection(n, section.id, { body });
}

// ---- A small, safe Markdown reader for the notes preview ------------------------------
// Headings, paragraphs, bullet / numbered lists, block quotes and rules. Inline emphasis
// is left to formatting.js (**bold**, *italic*, _underline_, ~~strike~~). Output is data,
// rendered as React elements — never as HTML — so pasted text can't inject markup.

export function markdownBlocks(md) {
  const lines = (md || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if (!l.trim()) {
      flush();
    } else if ((m = l.match(/^\s{0,3}(#{1,4})\s+(.*)$/))) {
      flush();
      blocks.push({ type: 'h', level: m[1].length, text: m[2] });
    } else if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) {
      flush();
      blocks.push({ type: 'hr' });
    } else if ((m = l.match(/^\s*[-*+•]\s+(.*)$/))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === 'ul') last.items.push(m[1]);
      else blocks.push({ type: 'ul', items: [m[1]] });
    } else if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === 'ol') last.items.push(m[2]);
      else blocks.push({ type: 'ol', start: Number(m[1]), items: [m[2]] });
    } else if ((m = l.match(/^\s*>\s?(.*)$/))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === 'quote') last.text += ` ${m[1]}`;
      else blocks.push({ type: 'quote', text: m[1] });
    } else {
      para.push(l.trim());
    }
  }
  flush();
  return blocks;
}
