// Project Bible: character bios and story notes, stored on the project record beside the
// script (see projectStorage.js). Pure functions, so every operation is unit-tested.
//
//   characters: [{ id, name, role, age, traits, backstory }]
//   storyNotes: { sections: [{ id, title, body }] }   — body is Markdown

import { normalizeStoryDna } from './storyDna.js';

export const CHARACTER_FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'MARIE CINEUS' },
  { key: 'role', label: 'Role / Relationship', placeholder: 'Protagonist · Theo’s older sister' },
  { key: 'age', label: 'Age / Timeline ages', placeholder: '10 in 1986, 45 in 2021' },
  { key: 'traits', label: 'Traits', placeholder: 'Stubborn, funny under pressure, never cries in public', multiline: true },
  { key: 'backstory', label: 'Backstory / Motivation', placeholder: 'What happened before page 1 — and what she wants now', multiline: true },
];

/**
 * Story Notes sections a new project starts with, in order. Theme isn't one of them: it
 * lives in Story DNA ("Theme — revealed by the Climax"), so there's one place for it.
 */
export const DEFAULT_SECTIONS = ['Logline', 'Tone', 'Timeline', 'Pitch', 'Scratchpad'];

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
export const STORY_NOTES_VERSION = 3;

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
  { id: 'dna', icon: '📖', label: 'DNA', title: 'Blueprint & Glossary' },
  { id: 'notes', icon: '📝', label: 'Notes', title: 'Logline, tone, timeline, pitch, scratchpad (theme is in DNA)' },
];
export const DEFAULT_BIBLE_TAB = 'dna';

export const CHARACTER_TABS = [
  { id: 'bios', icon: '👤', label: 'Bios', title: 'Character profiles, traits and backstory · rename across the script' },
  { id: 'dialogue', icon: '💬', label: 'Dialogue', title: 'Every line a character speaks, top to bottom' },
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

export function newCharacter(fields = {}) {
  return { id: uid('ch'), name: '', role: '', age: '', traits: '', backstory: '', ...fields };
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

export function defaultStoryNotes() {
  return { version: STORY_NOTES_VERSION, sections: DEFAULT_SECTIONS.map((title) => ({ id: uid('sn'), title, body: '' })) };
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
  return { version: STORY_NOTES_VERSION, sections: [...ordered, ...kept, ...custom] };
}

/** "- Exile\n- Return home" → "Exile; Return home" (Story DNA's Theme is a one-line field). */
export function themeLine(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '').replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .join('; ');
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
  let storyNotes = normalizeStoryNotes(rawNotes);
  const old = rawNotes && typeof rawNotes === 'object' && (rawNotes.version || 1) < STORY_NOTES_VERSION;
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
    if ((notes.version || 1) < STORY_NOTES_VERSION) return migrateStoryNotes(sections);
    return { version: notes.version, sections };
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
    const md = l.match(/^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/);
    const underlined = !md && l.trim() && /^\s*(=+|-{3,})\s*$/.test(lines[i + 1] || '') ? l.trim() : null;
    if (md || underlined) {
      if (cur.title !== null || cur.lines.some((x) => x.trim())) out.push(cur);
      cur = { title: (md ? md[1] : underlined).trim(), lines: [] };
      if (underlined) i += 1;
    } else cur.lines.push(l);
  }
  if (cur.title !== null || cur.lines.some((x) => x.trim())) out.push(cur);
  return out.map((s) => ({ title: s.title, body: s.lines.join('\n').trim() }));
}

/**
 * "Import from Notes": paste external text into the Bible.
 *   mode 'append'   — add to the end of section `targetId`
 *   mode 'replace'  — replace that section's text
 *   mode 'sections' — split at headings: a heading that matches an existing section's
 *                      title appends there, others become new sections; text before the
 *                      first heading goes to `targetId`
 */
export function importNotes(notes, text, { targetId, mode = 'append' } = {}) {
  const clean = (text || '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return notes;
  const join = (a, b) => (a.trim() ? `${a.replace(/\s+$/, '')}\n\n${b}` : b);
  const target = notes.sections.find((s) => s.id === targetId) || notes.sections[notes.sections.length - 1];
  if (mode !== 'sections' || !target) {
    if (!target) return addSectionWith(notes, 'Imported notes', clean);
    return updateSection(notes, target.id, { body: mode === 'replace' ? clean : join(target.body, clean) });
  }
  let next = notes;
  for (const part of splitByHeadings(clean)) {
    if (part.title === null) {
      if (part.body) next = updateSection(next, target.id, { body: join(next.sections.find((s) => s.id === target.id).body, part.body) });
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
