// Story DNA: the Story Bible's blueprint — genre, theme and central dramatic question, the
// plot devices the script uses, and the eight narrative questions, each tied to its Story
// Glossary term. Stored on the project record as `storyDna` (see projectStorage.js).

/** Genre pills (multi-select). "Other" shows a free-text field beside it. */
export const GENRES = [
  'Drama', 'Thriller', 'Crime', 'Horror', 'Comedy', 'Action', 'Adventure', 'Romance', 'Fantasy',
  'Science Fiction', 'Western', 'Noir', 'Other',
];

const GENRE_ALIASES = {
  noir: 'Noir', noire: 'Noir', 'film noir': 'Noir', 'film-noir': 'Noir', 'sci-fi': 'Science Fiction', scifi: 'Science Fiction', 'sci fi': 'Science Fiction', sf: 'Science Fiction',
};
/** Names stored by earlier versions → today's ("Noire" was a misspelling of Noir). */
const LEGACY_GENRES = { Noire: 'Noir' };

/** Pill order, old spellings fixed, unknown names dropped, no repeats. */
export function sortGenres(list) {
  const set = new Set(list.map((g) => LEGACY_GENRES[g] || g));
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

/**
 * The six types grouped under Robert McKee's three levels of conflict, for the Conflict picker's
 * <optgroup>s and the Glossary. Display only: the stored value is still the type's own label
 * (CONFLICT_TYPES), so saved scripts and the loose matching in matchConflictType are unchanged.
 */
export const CONFLICT_LEVELS = [
  { id: 'inner', level: 'Inner', group: 'Inner Conflict', types: ['Individual vs. Self'] },
  { id: 'personal', level: 'Personal', group: 'Personal Conflict', types: ['Individual vs. Individual'] },
  {
    id: 'world',
    level: 'Wider World',
    group: 'Wider World Conflict',
    types: ['Individual vs. Society', 'Individual vs. Nature', 'Individual vs. Technology', 'Individual vs. Supernatural'],
  },
];

/**
 * Plot Devices the writer can add to the blueprint, each with Yes / No and notes. `dict` is the
 * Glossary entry its (i) shows. Stored as `devices: [{ id, on, notes }]`: Foreshadowing and
 * Flashback first (always there — see DEFAULT_DEVICES), then the others in the order added.
 */
export const PLOT_DEVICES = [
  { id: 'foreshadowing', label: 'Foreshadowing', dict: 'foreshadowing' },
  { id: 'flashback', label: 'Flashback', dict: 'flashback' },
  { id: 'tickingClock', label: 'Ticking Clock', dict: 'tickingClock' },
  { id: 'macguffin', label: 'MacGuffin', dict: 'macguffin' },
  { id: 'quest', label: 'Quest', dict: 'quest' },
  { id: 'cliffhanger', label: 'Cliffhanger', dict: 'cliffhanger' },
  { id: 'redHerring', label: 'Red herring', dict: 'redHerring' },
  { id: 'loveTriangle', label: 'Love triangle', dict: 'loveTriangle' },
];
/** The old free "Special Plot Technique" toggle: kept (with its notes) if a project used it. */
const LEGACY_TECHNIQUE = { id: 'technique', label: 'Special Plot Technique', dict: null };
/**
 * Deus ex machina left the picklist (it's a flaw to avoid, not a device to plan; Ticking Clock took
 * its place). A script that already added it keeps the row, its Yes / No and its notes, and can
 * still remove it; it just can't be added again.
 */
const LEGACY_DEUS = { id: 'deusExMachina', label: 'Deus ex machina', dict: 'deusExMachina' };
const ALL_DEVICES = [...PLOT_DEVICES, LEGACY_TECHNIQUE, LEGACY_DEUS];

/**
 * Every script starts with these two rows, set to No (collapsed — no notes box until Yes).
 * They're always present: a script that loads without them (new, older, or saved before this)
 * gets them back, set to No; they can be switched to No but not removed.
 */
export const DEFAULT_DEVICES = ['foreshadowing', 'flashback'];
export const isDefaultDevice = (id) => DEFAULT_DEVICES.includes(id);
const defaultDeviceRows = () => DEFAULT_DEVICES.map((id) => ({ id, on: false, notes: '' }));

/** The default rows first (keeping what's stored for them), then everything else in order. */
function withDefaultDevices(list) {
  const byId = new Map(list.map((x) => [x.id, x]));
  return [
    ...DEFAULT_DEVICES.map((id) => byId.get(id) || { id, on: false, notes: '' }),
    ...list.filter((x) => !isDefaultDevice(x.id)),
  ];
}

export const deviceInfo = (id) => ALL_DEVICES.find((d) => d.id === id) || null;

/** Devices not added yet, for the picklist (in glossary order). */
export const availableDevices = (dna) => PLOT_DEVICES.filter((d) => !dna.devices.some((x) => x.id === d.id));

export function addDevice(dna, id) {
  // Only the picklist's devices can be added; retired ones (Special Plot Technique, Deus ex machina) are only kept.
  if (!PLOT_DEVICES.some((d) => d.id === id) || dna.devices.some((x) => x.id === id)) return dna;
  return { ...dna, devices: [...dna.devices, { id, on: true, notes: '' }] };
}
export function setDevice(dna, id, patch) {
  return { ...dna, devices: dna.devices.map((x) => (x.id === id ? { ...x, ...patch, id } : x)) };
}
export function removeDevice(dna, id) {
  if (isDefaultDevice(id)) return setDevice(dna, id, { on: false }); // the defaults stay, set to No
  return { ...dna, devices: dna.devices.filter((x) => x.id !== id) };
}

/**
 * The Plot Devices section top to bottom: one row per device (defaults first, then added ones in
 * the order added), and the "+ Add device…" picklist last — always below the rows — while any
 * device is left to add.
 */
export function plotDeviceLayout(dna) {
  const rows = dna.devices.map((dev) => ({
    kind: 'device', ...dev, info: deviceInfo(dev.id), removable: !isDefaultDevice(dev.id), expanded: !!(dev.on || dev.notes),
  }));
  const options = availableDevices(dna);
  return options.length ? [...rows, { kind: 'add', options }] : rows;
}

export const DNA_QUESTIONS = [
  { key: 'protagonist', label: 'Protagonist', question: 'Who is it about?', dict: 'protagonist' },
  { key: 'incitingIncident', label: 'Inciting Incident', question: 'What happens that starts the story?', dict: 'incitingIncident' },
  { key: 'goal', label: 'Goal / Desire', question: 'What do they want?', dict: 'goal' },
  { key: 'flaw', label: 'Flaw', question: 'What must they overcome to get it?', dict: 'flaw' },
  { key: 'conflict', label: 'Conflict / Obstacle', question: 'Why can’t they get it?', dict: 'conflict', conflictType: true },
  { key: 'risingAction', label: 'Complications', question: 'What did they do about it?', dict: 'risingAction' },
  // The last two kept their storage keys, so every saved answer stays under the same question:
  // "Why doesn't that work?" (stored as `climax`) is All Is Lost / Crisis, and "How does it end?" (stored
  // as `fallingAction`) is Climax / Resolution. Only the labels and glossary links changed.
  { key: 'climax', label: 'All Is Lost / Crisis', question: 'Why doesn’t that work?', dict: 'crisis' },
  { key: 'fallingAction', label: 'Climax / Resolution', question: 'How does it end?', dict: 'climax' },
];

export function emptyStoryDna() {
  return {
    genres: [],
    genreOther: '',
    theme: '',
    devices: defaultDeviceRows(),
    conflictType: '',
    answers: Object.fromEntries(DNA_QUESTIONS.map((q) => [q.key, ''])),
  };
}

const str = (v) => (typeof v === 'string' ? v : '');

/** A stored toggle (boolean, string, or { on, notes }) → { on, notes }, or null if unused. */
function legacyToggle(v) {
  if (typeof v === 'boolean') return v ? { on: true, notes: '' } : null;
  if (typeof v === 'string') return v.trim() ? { on: true, notes: v } : null;
  if (v && typeof v === 'object' && (v.on || str(v.notes).trim())) return { on: !!v.on, notes: str(v.notes) };
  return null;
}

/**
 * Anything stored (nothing, an older or partial shape) → a complete Story DNA object.
 * Accepts a single text `genre` (→ the pills), the misspelt "Noire", answers stored at the
 * top level, conflict types written loosely ("vs self", "Man vs. Nature"), and the old fixed
 * toggles — Foreshadowing, Flashback and Special Plot Technique, stored as booleans, strings
 * or { on, notes } — which become Plot Devices when they were used (on, or with notes).
 * Foreshadowing and Flashback are always in the result (set to No unless stored otherwise).
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
  const stored = [];
  if (Array.isArray(raw.devices)) {
    const seen = new Set();
    for (const x of raw.devices) {
      if (!x || !deviceInfo(x.id) || seen.has(x.id)) continue;
      seen.add(x.id);
      stored.push({ id: x.id, on: !!x.on, notes: str(x.notes) });
    }
  } else {
    for (const id of ['foreshadowing', 'flashback', 'technique']) {
      const t = legacyToggle(raw[id]);
      if (t) stored.push({ id, ...t });
    }
  }
  d.devices = withDefaultDevices(stored);
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

