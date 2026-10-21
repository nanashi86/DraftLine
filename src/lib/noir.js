// Film Noir mode: Ctrl+Shift+Alt+N (⌘⇧⌥N), or "noir" typed into a drawer's search box, turns the
// page high-contrast black and white with Venetian-blind shadows and soft rain. The same keys,
// Esc, or the status bar chip turn it off. On screen only; nothing about the script changes.

export const NOIR_COMBO = 'Ctrl+Shift+Alt+N';
export const NOIR_WORD = 'noir';
export const NOIR_CLASS = 'film-noir-mode';

/** Ctrl+Shift+Alt+N (or ⌘⇧⌥N). Matched on the physical N key: ⌥ changes the character on a Mac. */
export const isNoirShortcut = (e) => e.code === 'KeyN' && e.shiftKey && e.altKey && (e.ctrlKey || e.metaKey);

/** The search / filter boxes in the drawers that listen for "noir". */
export const NOIR_SEARCH_SELECTOR = 'input[type="search"], .pb-search, .nav-search, input[placeholder^="Filter"], input[placeholder^="Find"]';

/** Is this what was typed into a search box? (any case, spaces around it ignored) */
export const isNoirQuery = (value) => String(value || '').trim().toLowerCase() === NOIR_WORD;

/**
 * Noir state for a key press: 'on' / 'off' (the shortcut), 'off' for Esc while it's on, or null.
 */
export function noirKeyAction(e, active) {
  if (isNoirShortcut(e)) return active ? 'off' : 'on';
  if (active && e.key === 'Escape') return 'off';
  return null;
}
