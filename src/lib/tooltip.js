// Where to put a tooltip so it's never clipped: inside `bounds` (the drawer, clipped to the
// window), below its (i) button if there's room, otherwise above, right-aligned to the button
// and slid left or right just enough to stay in. All numbers are viewport pixels (as from
// getBoundingClientRect), so the tooltip is drawn position: fixed, outside any overflow.

export const TIP_MARGIN = 8; // keep this far from the bounds' edges
export const TIP_GAP = 6; // between the button and the tooltip
export const TIP_MAX_WIDTH = 290;

/** The visible part of `rect` within the window. */
export function clipToViewport(rect, vw, vh) {
  return {
    left: Math.max(0, rect.left),
    top: Math.max(0, rect.top),
    right: Math.min(vw, rect.right),
    bottom: Math.min(vh, rect.bottom),
  };
}

/**
 * anchor — the button's rect · size — { width, height } of the tooltip as it would render ·
 * bounds — the area it must stay inside. Returns { left, top, width, placement }.
 */
export function placeTooltip(anchor, size, bounds, { margin = TIP_MARGIN, gap = TIP_GAP, maxWidth = TIP_MAX_WIDTH } = {}) {
  const room = Math.max(0, bounds.right - bounds.left - margin * 2);
  const width = Math.min(maxWidth, size.width || maxWidth, room);
  // Right-aligned with the button (it usually sits at the right edge of a row) …
  let left = anchor.right + gap - width;
  // … but never past either side of the drawer.
  left = Math.min(left, bounds.right - margin - width);
  left = Math.max(left, bounds.left + margin);

  const h = size.height || 0;
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - h;
  let top;
  let placement;
  if (below + h <= bounds.bottom - margin) {
    top = below;
    placement = 'below';
  } else if (above >= bounds.top + margin) {
    top = above;
    placement = 'above';
  } else {
    top = Math.max(bounds.top + margin, Math.min(below, bounds.bottom - margin - h));
    placement = 'inside';
  }
  return { left: Math.round(left), top: Math.round(top), width: Math.round(width), placement };
}
