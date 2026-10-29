// Characters → Dialogue: a long cast list folds after the biggest speakers, so the stats and speeches
// stay near the top. The list is already sorted by lines spoken (analyzeScript), most first.
//   - CAST_TOP characters show; the rest sit behind "+N more" (like Missing Bios' "and 19 more").
//   - Only casts over CAST_FOLD_MIN fold: folding 2 or 3 pills wouldn't help.
//   - The picked character always shows, lit, right after the top ones when it's in the fold.
//   - Opened or folded is remembered (localStorage), and "Show fewer" folds it again.

export const CAST_TOP = 12;
export const CAST_FOLD_MIN = 15;
export const CAST_FOLD_KEY = 'draftline_cast_expanded';

/**
 * Which pills to show: { shown, hidden (how many are folded away), foldable, top }.
 * `list` is analyzeScript().characterList (objects with .name), `selected` the picked name.
 */
export function foldCast(list = [], { expanded = false, selected = null, top = CAST_TOP, min = CAST_FOLD_MIN } = {}) {
  const foldable = list.length > min;
  if (!foldable || expanded) return { shown: list, hidden: 0, foldable, top };
  const head = list.slice(0, top);
  const pick = selected && !head.some((c) => c.name === selected) ? list.find((c) => c.name === selected) : null;
  const shown = pick ? [...head, pick] : head;
  return { shown, hidden: list.length - shown.length, foldable, top };
}

/** Opened last time? Blocked storage reads as folded. */
export function readCastExpanded(storage, key = CAST_FOLD_KEY) {
  try {
    return storage?.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** Remember opened / folded; blocked storage just means it lasts as long as the page. */
export function writeCastExpanded(storage, key, open) {
  try {
    storage?.setItem(key, open ? 'true' : 'false');
  } catch { /* private window */ }
}
