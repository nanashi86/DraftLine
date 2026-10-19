// Where a margin note's popover opens. Pure geometry (all rects in viewport pixels), so
// the "never cover the script" rule is unit-tested.
//
// Preference order:
//   1. gutter-right — beside the page, in the desk area right of the paper
//   2. gutter-left  — beside the page, left of the paper
//   3. below / above the annotated element — when the window is too narrow for a gutter;
//      it may cover neighbouring lines, but never the element (or line) being annotated
// Gutter placements never overlap the page at all, so they can't cover any script text.

const GAP = 10;

/**
 * @param {object} g
 *   anchor — rect of the annotated element { left, top, right, bottom }
 *   page   — rect of the page card
 *   view   — visible area the popover must stay inside (scroller ∩ window)
 *   size   — popover { width, height }
 * @returns {{ placement: string, x: number, y: number }}
 */
export function placeNote({ anchor, page, view, size }) {
  const { width: w, height: h } = size;
  const clampY = (y) => Math.max(view.top + 4, Math.min(y, view.bottom - h - 4));
  const clampX = (x) => Math.max(view.left + 4, Math.min(x, view.right - w - 4));

  if (page.right + GAP + w <= view.right) {
    return { placement: 'gutter-right', x: page.right + GAP, y: clampY(anchor.top) };
  }
  if (page.left - GAP - w >= view.left) {
    return { placement: 'gutter-left', x: page.left - GAP - w, y: clampY(anchor.top) };
  }
  // Inside the page's width: right-align with the element, below it if there's room, else above.
  const x = clampX(anchor.right - w);
  if (anchor.bottom + 6 + h <= view.bottom) return { placement: 'below', x, y: anchor.bottom + 6 };
  if (anchor.top - 6 - h >= view.top) return { placement: 'above', x, y: anchor.top - 6 - h };
  return { placement: 'below', x, y: anchor.bottom + 6 }; // tiny window: below, and the page scrolls
}

/** True when two rects overlap (touching edges don't count). */
export function intersects(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export const popRect = ({ x, y }, { width, height }) => ({ left: x, top: y, right: x + width, bottom: y + height });
