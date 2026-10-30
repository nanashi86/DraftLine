// Feature hints: a quiet nudge toward six tools writers rarely find on their own (Import Scenes,
// Analyze Value Shifts, Populate Bio, the Format Doctor, the Dialogue spotlight, Plan). Never a
// tour, never a modal, never focus.
//
//   beacon — a small accent dot on a top-bar button (Split, Characters): "something here"
//   card   — a small card beside the tool itself, only once its panel is open: two sentences,
//            the tool's button and Got it
//
// When: by what the writer has done, not by "first launch":
//   importScenes  — 8+ scene headings or 10+ pages, and no scene cards on the Scene Board yet
//   analyzeShifts — scene cards on the board, none with a Value Shift yet (a card on the board only)
//   populateBio   — 3+ characters whose introductions in the Action would fill an empty bio field
//   formatDoctor  — 5+ Format Doctor findings showing, and the Format stepper never used
//   dialogue      — 3+ speaking characters and 20+ speeches, and no character spotlit yet
//   plan          — 90+ pages (a feature-length draft), and Plan never opened
// …and only when it's calm: a few seconds after the last keystroke, a minute after the script was
// opened or imported, never in Focus or Viewing, never while another corner card is up.
//
// "Never used" is the hint's own state: using the tool any way at all marks it done.
//
// How often: once. Each hint ends as 'dismissed' (Got it, ✕) or 'done' (the tool was used, through
// the hint or not) and never comes back in this browser, unless the writer picks Show tips again.
// At most one new hint per session, except Analyze right after Import (the natural next step).

export const HINT_IDS = ['importScenes', 'analyzeShifts', 'populateBio', 'formatDoctor', 'dialogue', 'plan'];
/** localStorage: { [hintId]: 'done' | 'dismissed' }. */
export const HINTS_KEY = 'draftline_hints';
/** sessionStorage: the hint already shown this session. */
export const HINT_SESSION_KEY = 'draftline_hint_session';

export const HINT_MIN_SCENES = 8;
export const HINT_MIN_PAGES = 10;
export const HINT_MIN_BIOS = 3;
export const HINT_MIN_FINDINGS = 5;
export const HINT_MIN_SPEAKERS = 3;
export const HINT_MIN_SPEECHES = 20;
export const HINT_PLAN_PAGES = 90;
/** Quiet time after the last keystroke before a hint may appear. */
export const HINT_IDLE_MS = 3000;
/** Time after a script is opened or imported before a hint may appear. */
export const HINT_SETTLE_MS = 60000;

/**
 * Wording, and where each hint points:
 *   target  — the tool's own button (a CSS selector); the card sits beside it and its button clicks it
 *   align   — 'end' lines the card's right edge up with the target (tools on the right), 'start' its left
 *   beacon  — the top-bar button that opens the tool's panel, or null when the tool is always on screen
 *   caret   — after the tool runs from the card, put the cursor back in the script (tools that
 *             change the script in place; not ones that open a list, a workspace or a spotlight)
 *   usedBy  — a click anywhere in this element counts as using the tool (for tools whose use isn't an
 *             app state of its own, like opening the Format stepper's list)
 */
export const HINTS = {
  importScenes: {
    title: 'Turn your scenes into cards',
    text: 'Import Scenes puts every scene on the Scene Board, sorted into acts by page. Run it again any time: your titles, synopses and tags stay, and new scenes are added.',
    action: 'Import Scenes',
    target: '.board-import',
    align: 'end',
    beacon: 'split', // the Split button: the board opens beside the script
    caret: true,
  },
  analyzeShifts: {
    title: 'What turns in each scene?',
    text: 'Analyze Value Shifts reads each scene and suggests whether it turns positive or negative. It’s a second opinion: you choose what to apply.',
    action: 'Analyze Value Shifts',
    target: '.board-analyze',
    align: 'end',
    beacon: null, // shown on the board only
  },
  populateBio: {
    title: 'Fill in bios from your script',
    text: 'Populate Bio reads how you introduce each character, like MARIE (30s)--warm…, and fills in age, gender and description. It only fills empty fields, so it’s safe to run again.',
    action: 'Populate Bio',
    target: '.pb-populate',
    align: 'end',
    beacon: 'characters', // the Characters button
    caret: true,
  },
  formatDoctor: {
    title: 'Clean up the formatting',
    text: 'The Format Doctor checks your pages for what a reader would notice, like a heading with no time of day or a parenthetical with no line after it. Open the list to step through them: most fix in one click.',
    action: 'Show findings',
    target: '.stepper[aria-label="Format Doctor findings"] .stepper-main',
    align: 'start',
    beacon: null, // the stepper is already in the status bar
    usedBy: '.stepper[aria-label="Format Doctor findings"]',
  },
  dialogue: {
    title: 'Hear one character at a time',
    text: 'Pick a name to spotlight every line that character speaks, in script order, and step through them from the status bar. A quick way to check a voice stays consistent.',
    action: 'Spotlight', // + the top speaker's name
    target: '.pb-characters .cast-chip',
    align: 'start',
    beacon: 'characters', // the Characters button, or the Dialogue tab when Characters is open on Bios
  },
  plan: {
    title: 'Ready to plan the shoot?',
    text: 'Plan turns your script into a scene breakdown, a stripboard and reports, worked out from what you’ve written: no retyping. The script stays exactly as it is, and Write is one click back.',
    action: 'Open Plan',
    target: '.ws-btn[data-workspace="plan"]',
    align: 'start',
    beacon: null, // the Plan button is always in the top bar
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
 *          Shift), bioGains (characters Populate Bio would add to), findings (Format Doctor findings
 *          showing), speakers (speaking characters), speeches (their speeches, all together) }
 */
export function hintWanted(id, ctx = {}) {
  const { scenes = 0, pages = 0, sceneCards = 0, shiftedCards = 0, bioGains = 0, findings = 0, speakers = 0, speeches = 0 } = ctx;
  if (id === 'importScenes') return (scenes >= HINT_MIN_SCENES || pages >= HINT_MIN_PAGES) && sceneCards === 0;
  if (id === 'analyzeShifts') return sceneCards > 0 && shiftedCards === 0;
  if (id === 'populateBio') return bioGains >= HINT_MIN_BIOS;
  if (id === 'formatDoctor') return findings >= HINT_MIN_FINDINGS;
  if (id === 'dialogue') return speakers >= HINT_MIN_SPEAKERS && speeches >= HINT_MIN_SPEECHES;
  if (id === 'plan') return pages >= HINT_PLAN_PAGES;
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

/** Every popup a card could collide with: menus, dropdowns, hover cards, autocomplete, corner toasts. */
export const HINT_OVERLAYS = '.menu-pop, .vs-pop, .dna-tip-pop, .dl-select-list, .ac, .cue-card, .bk-toast, .milestone-toast, .toast, .find-bar';

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Can the card show beside `target` at `box` right now? Only if the tool is really on screen (not
 * covered by a drawer, a modal or anything else: the topmost thing at its centre is the tool) and
 * no menu, dropdown or toast overlaps the card. Otherwise it waits, hidden, and comes back.
 */
export function hintRoomFor(target, box, doc = document) {
  if (!target || target.offsetParent === null) return false;
  const t = target.getBoundingClientRect();
  const top = doc.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
  if (!top || !(top === target || target.contains(top))) return false;
  for (const el of doc.querySelectorAll(HINT_OVERLAYS)) {
    if (el.offsetParent !== null || doc.defaultView.getComputedStyle(el).position === 'fixed') {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && overlaps(r, box)) return false;
    }
  }
  return !doc.querySelector('dialog[open]');
}
