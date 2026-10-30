// Feature hints: a quiet nudge toward three tools writers rarely find on their own (Import Scenes,
// Analyze Value Shifts, Populate Bio). Never a tour, never a modal, never focus.
//
//   beacon — a small accent dot on a top-bar button (Split, Characters): "something here"
//   card   — a small card beside the tool itself, only once its panel is open: two sentences,
//            the tool's button and Got it
//
// When: by what the writer has done, not by "first launch":
//   importScenes  — 8+ scene headings or 10+ pages, and no scene cards on the Scene Board yet
//   analyzeShifts — scene cards on the board, none with a Value Shift yet (a card on the board only)
//   populateBio   — 3+ characters whose introductions in the Action would fill an empty bio field
// …and only when it's calm: a few seconds after the last keystroke, a minute after the script was
// opened or imported, never in Focus or Viewing, never while another corner card is up.
//
// How often: once. Each hint ends as 'dismissed' (Got it, ✕) or 'done' (the tool was used, through
// the hint or not) and never comes back in this browser, unless the writer picks Show tips again.
// At most one new hint per session, except Analyze right after Import (the natural next step).

export const HINT_IDS = ['importScenes', 'analyzeShifts', 'populateBio'];
/** localStorage: { [hintId]: 'done' | 'dismissed' }. */
export const HINTS_KEY = 'draftline_hints';
/** sessionStorage: the hint already shown this session. */
export const HINT_SESSION_KEY = 'draftline_hint_session';

export const HINT_MIN_SCENES = 8;
export const HINT_MIN_PAGES = 10;
export const HINT_MIN_BIOS = 3;
/** Quiet time after the last keystroke before a hint may appear. */
export const HINT_IDLE_MS = 3000;
/** Time after a script is opened or imported before a hint may appear. */
export const HINT_SETTLE_MS = 60000;

/** Wording, and where each hint points (a CSS selector for the tool's own button). */
export const HINTS = {
  importScenes: {
    title: 'Turn your scenes into cards',
    text: 'Import Scenes puts every scene on the Scene Board, sorted into acts by page. Run it again any time: your titles, synopses and tags stay, and new scenes are added.',
    action: 'Import Scenes',
    target: '.board-import',
    beacon: 'split', // the Split button: the board opens beside the script
  },
  analyzeShifts: {
    title: 'What turns in each scene?',
    text: 'Analyze Value Shifts reads each scene and suggests whether it turns positive or negative. It’s a second opinion: you choose what to apply.',
    action: 'Analyze Value Shifts',
    target: '.board-analyze',
    beacon: null, // shown on the board only
  },
  populateBio: {
    title: 'Fill in bios from your script',
    text: 'Populate Bio reads how you introduce each character, like MARIE (30s)--warm…, and fills in age, gender and description. It only fills empty fields, so it’s safe to run again.',
    action: 'Populate Bio',
    target: '.pb-populate',
    beacon: 'characters', // the Characters button
  },
};

/** Saved hint states; unreadable or blocked storage reads as none shown. */
export function readHints(storage) {
  try {
    const v = JSON.parse(storage?.getItem(HINTS_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** Record that a hint is finished ('done' or 'dismissed'); returns the new map. */
export function markHint(storage, id, state, current = readHints(storage)) {
  if (!HINT_IDS.includes(id) || current[id] === 'done') return current; // done is final
  const next = { ...current, [id]: state };
  try {
    storage?.setItem(HINTS_KEY, JSON.stringify(next));
  } catch { /* private window: this session still remembers */ }
  return next;
}

/** Show tips again: forget every hint's state. */
export function resetHints(storage, session) {
  try {
    storage?.removeItem(HINTS_KEY);
    session?.removeItem(HINT_SESSION_KEY);
  } catch { /* nothing to clear */ }
  return {};
}

/**
 * Has the writer reached the point where a hint helps?
 *   ctx: { scenes, pages, sceneCards (cards linked to a scene), shiftedCards (cards with a Value
 *          Shift), bioGains (characters Populate Bio would add to) }
 */
export function hintWanted(id, ctx = {}) {
  const { scenes = 0, pages = 0, sceneCards = 0, shiftedCards = 0, bioGains = 0 } = ctx;
  if (id === 'importScenes') return (scenes >= HINT_MIN_SCENES || pages >= HINT_MIN_PAGES) && sceneCards === 0;
  if (id === 'analyzeShifts') return sceneCards > 0 && shiftedCards === 0;
  if (id === 'populateBio') return bioGains >= HINT_MIN_BIOS;
  return false;
}

/** Is now a calm moment? now, lastKeyAt, openedAt in ms; busy: Focus, Viewing, a corner card, Plan. */
export function hintCalm({ now = 0, lastKeyAt = 0, openedAt = 0, busy = false } = {}) {
  return !busy && now - lastKeyAt >= HINT_IDLE_MS && now - openedAt >= HINT_SETTLE_MS;
}

/**
 * The hint to show now, or null. states — readHints(); sessionHint — the one shown this session
 * (only it, or Analyze straight after Import, may show); ctx — hintWanted's.
 */
export function pickHint(states, sessionHint, ctx) {
  for (const id of HINT_IDS) {
    if (states[id]) continue;
    const allowed = !sessionHint || sessionHint === id || (id === 'analyzeShifts' && sessionHint === 'importScenes');
    if (allowed && hintWanted(id, ctx)) return id;
  }
  return null;
}
