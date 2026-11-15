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
