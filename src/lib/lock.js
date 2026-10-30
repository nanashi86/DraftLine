// Viewing mode: Ctrl+Alt+L (Cmd+Option+L on a Mac) or the status bar badge switches the script
// between Editing and Viewing (stored as viewOnly). Locked, the page can be read, scrolled, selected and copied, and
// character cues still show their bio cards, but nothing on it can be typed, deleted, formatted,
// retyped (Element / Alt+1…8 / Tab) or undone. Margin notes stay available (they never change the
// script). The lock is per session, not saved with the project.

/** Ctrl+Alt+L or Cmd+Option+L. Matched on the physical key: Option+L types "¬" on a Mac. */
export function isLockShortcut(e) {
  return e.code === 'KeyL' && e.altKey && (e.ctrlKey || e.metaKey) && !e.shiftKey;
}

export const LOCK_COMBO = 'Ctrl+Alt+L';

/** The status bar badge: label, tooltip and style for each state. */
export function lockBadge(locked) {
  return locked
    ? { label: 'Viewing', icon: 'locked', title: `Switch to Editing — ${LOCK_COMBO}`, className: 'status-lock is-locked' }
    : { label: 'Editing', icon: 'unlocked', title: `Switch to Viewing (read only) — ${LOCK_COMBO}`, className: 'status-lock' };
}

const MUTATING_KEYS = new Set(['Enter', 'Backspace', 'Delete', 'Tab']);
// Ctrl/Cmd + Z Y (history) · B I U, Shift+X, \ (formatting) · X V (cut, paste) · D, K… are left alone.
const MUTATING_MOD = new Set(['KeyZ', 'KeyY', 'KeyB', 'KeyI', 'KeyU', 'KeyX', 'KeyV', 'Backslash']);

/**
 * What a key in a locked script does:
 *   'blocked' — it would change the script (typing, Enter, Backspace, Delete, Tab, paste, cut,
 *               undo/redo, B/I/U, Alt+1…8 element types, Alt+D dual dialogue): swallow it.
 *   'nav'     — ↑ / ↓ moving between lines: the editor handles it as usual.
 *   'note'    — Alt+N, the margin note: allowed.
 *   'native'  — everything else (Ctrl+C, Ctrl+A, ← →, Home/End, Page keys, Shift+arrows, …).
 */
export function lockedKeyAction(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey) return MUTATING_MOD.has(e.code) ? 'blocked' : 'native';
  if (e.altKey && !mod) {
    if (e.code === 'KeyN') return 'note';
    if (e.code === 'KeyD' || /^(Digit|Numpad)[1-8]$/.test(e.code)) return 'blocked';
    return 'native';
  }
  if (MUTATING_KEYS.has(e.key)) return 'blocked';
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !mod) return 'nav';
  if (!mod && e.key.length === 1) return 'blocked'; // a printable character
  return 'native';
}
