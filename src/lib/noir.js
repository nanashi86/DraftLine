// Film Noir mode: Ctrl+Shift+Alt+N (⌘⇧⌥N), or picking the Noir genre in Story DNA, turns the
// workspace 1940s: warm monochrome, Venetian-blind shadows, grain, rain and a turning record. The
// same keys, Esc, or the status bar chip turn it off. On screen only: entering or leaving it never
// changes the script or its Story DNA — the Noir genre stays picked after you leave.

export const NOIR_COMBO = 'Ctrl+Shift+Alt+N';
export const NOIR_CLASS = 'film-noir-mode';

/** Ctrl+Shift+Alt+N (or ⌘⇧⌥N). Matched on the physical N key: ⌥ changes the character on a Mac. */
export const isNoirShortcut = (e) => e.code === 'KeyN' && e.shiftKey && e.altKey && (e.ctrlKey || e.metaKey);

/** Genres that mean Noir: the Story DNA pill ("Noir"), or "Film Noir" written out. */
export const isNoirGenre = (g) => /^(?:film[\s-]+)?noir$/i.test(String(g ?? '').trim());

/** Did this Story DNA change just pick a Noir genre (not there before, there now)? */
export const noirGenrePicked = (prev, next) => !(prev?.genres || []).some(isNoirGenre) && (next?.genres || []).some(isNoirGenre);

/**
 * Noir state for a key press: 'on' / 'off' (the shortcut), 'off' for Esc while it's on, or null.
 */
export function noirKeyAction(e, active) {
  if (isNoirShortcut(e)) return active ? 'off' : 'on';
  if (active && e.key === 'Escape') return 'off';
  return null;
}
