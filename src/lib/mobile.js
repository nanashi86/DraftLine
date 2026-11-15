// Phones and touch screens: the few things DraftLine does differently there. Each rule is scoped to
// a phone-width window or a touch screen with no hover, so a desktop with a mouse matches none of it.
// The CSS side is the "Phones and touch screens" block at the end of App.css.

/** A phone-width window: the "phones" step of App.css (max-width: 559.98px). Split is off here. */
export const PHONE_QUERY = '(max-width: 559.98px)';
/** Where the Scenes list and the dock are each the whole width of the window (App.css, 720px step). */
export const FULL_WIDTH_PANELS_QUERY = '(max-width: 720px)';
/** A touch screen with no hover (phones, tablets): keyboard-shortcut hints and the shortcut list step aside. */
export const TOUCH_QUERY = '(hover: none)';

/** Does `query` match this window right now? No window (tests, the server) reads as no. */
export function mediaMatches(query, win = globalThis) {
  try {
    return !!win.matchMedia?.(query).matches;
  } catch {
    return false;
  }
}

/** The Write views to offer: Page · Split · Board, or Page · Board on a phone (Split doesn't fit two panes). */
export function writeViewsFor(views, phone) {
  return phone ? views.filter((v) => v.id !== 'split') : views;
}

/** The view to show: Split becomes Page on a phone; every other view stays as it is. */
export const viewOnPhone = (view, phone) => (phone && view === 'split' ? 'page' : view);

/**
 * Is a menu hint a keyboard shortcut (Alt+S, Ctrl+/, Ctrl+Alt+N, ⌘O, F1, "Esc exits")? Those are hidden
 * on touch screens. Counts, file types and words (12, .fdx, Showing, The Last Ferry) are not.
 */
export function isShortcutHint(hint) {
  const h = String(hint ?? '').trim();
  if (!h) return false;
  return /^(?:(?:Ctrl|Alt|Shift|Cmd|Option|[⌘⌥⇧⌃])\s*\+?\s*)+\S{1,6}$/.test(h)
    || /^F\d{1,2}$/.test(h)
    || /^Esc\b/.test(h);
}

/**
 * Where every panel is the window's full width (phones), only one may be open: the Scenes list or a
 * dock panel (Story Bible, Characters, Snapshots, Margin Notes — the dock already holds one at a time).
 * Given what was open (`prev`) and what's now asked for (`next`), both { dock, navOpen }, returns what
 * should be open: the one just opened wins and the other closes. Closing only hides a panel, so its
 * place (tab, scroll, the script beneath) and everything in it stays.
 */
export function exclusivePanels(prev, next) {
  if (!next.dock || !next.navOpen) return next;
  const navJustOpened = next.navOpen && !prev.navOpen;
  const dockJustOpened = next.dock !== prev.dock;
  if (navJustOpened && !dockJustOpened) return { dock: null, navOpen: true };
  return { dock: next.dock, navOpen: false }; // a dock panel opened (or both were already open): it stays
}

// ---- The element bar (phones): Scene · Action · Character · Dialogue · ( ) · Transition ----------
// A slim row just above the on-screen keyboard while you write, standing in for Tab and Alt+1…8.
// components/ElementBar.jsx draws it; switching goes through the editor's own setType, like Alt+1…8.

/** The bar's buttons, in writing order. `short` is used on the narrowest phones (under 375px). */
export const ELEMENT_BAR = [
  { type: 'scene', label: 'Scene', short: 'Scene', title: 'Scene Heading' },
  { type: 'action', label: 'Action', short: 'Action', title: 'Action' },
  { type: 'character', label: 'Character', short: 'Char', title: 'Character' },
  { type: 'dialogue', label: 'Dialogue', short: 'Dial', title: 'Dialogue' },
  { type: 'parenthetical', label: '( )', short: '( )', title: 'Parenthetical' },
  { type: 'transition', label: 'Transition', short: 'Trans', title: 'Transition' },
];

/** Show the bar? Phone-width touch screen, the cursor in the script, the page showing, not Viewing. */
export function showElementBar({ phone, touch, writing, editor = true, locked = false }) {
  return !!(phone && touch && writing && editor && !locked);
}

/**
 * Where the bar sits (its top, in layout-viewport px): on the keyboard's top edge — the bottom of the
 * visual viewport — or, with no keyboard up, just above the status bar. `vv` is window.visualViewport
 * ({ offsetTop, height }); `innerHeight` the layout viewport's height; `statusH` the status bar's.
 */
export function elementBarTop({ vv, innerHeight, statusH = 0, barH }) {
  const visibleBottom = vv ? vv.offsetTop + vv.height : innerHeight;
  return Math.round(Math.min(visibleBottom, innerHeight - statusH) - barH);
}

/** Is the on-screen keyboard (probably) up? The visible area is well short of the window. */
export const keyboardUp = ({ vv, innerHeight }) => !!vv && innerHeight - (vv.offsetTop + vv.height) > 120;

/**
 * How far to scroll the script so the line being written stays clear of the bar: `bottom` is the
 * lowest point that must show (the cursor's line, or the suggestion list under it), `limit` the bar's
 * top less a little air. Positive: scroll down by that much; 0: it already shows.
 */
export const scrollToClear = (bottom, limit) => (bottom > limit ? Math.ceil(bottom - limit) : 0);
