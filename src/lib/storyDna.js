// Story DNA: the Project Bible's story blueprint — a few metadata fields and the eight
// narrative questions, each tied to its Structure Dictionary term. Stored on the project
// record as `storyDna` (see projectStorage.js).

/** Genre checklist (multi-select). "Other" shows a free-text field beside it. */
export const GENRES = [
  'Drama', 'Thriller', 'Crime', 'Horror', 'Comedy', 'Action', 'Adventure', 'Romance', 'Fantasy',
  'Science Fiction', 'Western', 'Noire', 'Other',
];

const GENRE_ALIASES = { noir: 'Noire', 'sci-fi': 'Science Fiction', scifi: 'Science Fiction', 'sci fi': 'Science Fiction', sf: 'Science Fiction' };

/** Checklist order, unknown names dropped, no repeats. */
export function sortGenres(list) {
  const set = new Set(list);
  return GENRES.filter((g) => set.has(g));
}

/** Tick or untick one genre. */
export function toggleGenre(dna, genre, on) {
  const set = new Set(dna.genres);
  if (on) set.add(genre);
  else set.delete(genre);
  return { ...dna, genres: sortGenres([...set]) };
}

/**
 * A free-text genre (the old single "Genre" field) → { genres, genreOther }:
 * "Political drama · thriller" → Thriller, plus Other: "Political drama".
 */
export function genresFromText(text) {
  const genres = new Set();
  const other = [];
  for (const raw of String(text || '').split(/[,/·;|]+|\s+(?:and|&)\s+/i)) {
    const t = raw.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    const hit = GENRES.find((g) => g.toLowerCase() === k && g !== 'Other') || GENRE_ALIASES[k];
    if (hit) genres.add(hit);
    else other.push(t);
  }
  if (other.length) genres.add('Other');
  return { genres: sortGenres([...genres]), genreOther: other.join(', ') };
}

export const CONFLICT_TYPES = [
  'Individual vs. Individual',
  'Individual vs. Nature',
  'Individual vs. Society',
  'Individual vs. Technology',
  'Individual vs. Supernatural',
  'Individual vs. Self',
];

/** Yes / No techniques, each with notes. `dict` links to a Structure Dictionary term. */
export const DNA_TOGGLES = [
  { key: 'technique', label: 'Special Plot Technique' },
  { key: 'foreshadowing', label: 'Foreshadowing', dict: 'foreshadowing' },
  { key: 'flashback', label: 'Flashback', dict: 'flashback' },
];

export const DNA_QUESTIONS = [
  { key: 'protagonist', label: 'Protagonist', question: 'Who is it about?', dict: 'protagonist' },
  { key: 'incitingIncident', label: 'Inciting Incident', question: 'What happens that starts the story?', dict: 'incitingIncident' },
  { key: 'goal', label: 'Goal / Desire', question: 'What do they want?', dict: 'goal' },
  { key: 'flaw', label: 'Flaw', question: 'What must they overcome to get it?', dict: 'flaw' },
  { key: 'conflict', label: 'Conflict / Debate', question: 'Why can’t they get it?', dict: 'conflict', conflictType: true },
  { key: 'risingAction', label: 'Rising Action', question: 'What did they do about it?', dict: 'risingAction' },
  { key: 'climax', label: 'Climax', question: 'Why doesn’t that work?', dict: 'climax' },
  { key: 'fallingAction', label: 'Falling Action', question: 'How does it end?', dict: 'fallingAction' },
];

export function emptyStoryDna() {
  return {
    genres: [],
    genreOther: '',
    theme: '',
    technique: { on: false, notes: '' },
    foreshadowing: { on: false, notes: '' },
    flashback: { on: false, notes: '' },
    conflictType: '',
    answers: Object.fromEntries(DNA_QUESTIONS.map((q) => [q.key, ''])),
  };
}

const str = (v) => (typeof v === 'string' ? v : '');

/**
 * Anything stored (nothing, an older or partial shape) → a complete Story DNA object.
 * Accepts a single text `genre` (→ the checklist), toggles stored as plain booleans or
 * strings, answers stored at the top level,
 * and conflict types written loosely ("vs self", "Man vs. Nature").
 */
export function normalizeStoryDna(raw) {
  const d = emptyStoryDna();
  if (!raw || typeof raw !== 'object') return d;
  if (Array.isArray(raw.genres)) {
    d.genres = sortGenres(raw.genres.filter((g) => typeof g === 'string'));
    d.genreOther = str(raw.genreOther);
  } else if (str(raw.genre).trim()) {
    Object.assign(d, genresFromText(raw.genre)); // older projects stored one text field
  }
  d.theme = str(raw.theme);
  for (const { key } of DNA_TOGGLES) {
    const v = raw[key];
    if (typeof v === 'boolean') d[key] = { on: v, notes: '' };
    else if (typeof v === 'string') d[key] = { on: !!v.trim(), notes: v };
    else if (v && typeof v === 'object') d[key] = { on: !!v.on, notes: str(v.notes) };
  }
  const answers = raw.answers && typeof raw.answers === 'object' ? raw.answers : {};
  for (const q of DNA_QUESTIONS) d.answers[q.key] = str(answers[q.key] ?? raw[q.key]);
  d.conflictType = matchConflictType(raw.conflictType);
  return d;
}

/** "vs self", "man vs. nature", "Individual vs. Society" → the canonical label (or ''). */
export function matchConflictType(v) {
  const key = (s) => str(s).toLowerCase().replace(/^.*?\bvs?\.?\s*/, '').trim();
  const k = key(v);
  if (!k) return '';
  return CONFLICT_TYPES.find((t) => key(t) === k) || '';
}

/** How many of the eight questions have an answer. */
export function storyDnaProgress(dna) {
  return DNA_QUESTIONS.filter((q) => dna.answers[q.key]?.trim()).length;
}

/** Update one answer / field / toggle immutably. */
export function setAnswer(dna, key, value) {
  return { ...dna, answers: { ...dna.answers, [key]: value } };
}
export function setField(dna, key, value) {
  return { ...dna, [key]: value };
}
export function setToggle(dna, key, patch) {
  return { ...dna, [key]: { ...dna[key], ...patch } };
}
