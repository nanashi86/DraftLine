// Page zoom. The script page is drawn in whole-pixel lines: one line is linePxFor(zoom) px
// (12pt Courier at 6 lines per inch), so the page is 8.5 in × 6 lines = 51 lines wide.

export const PAGE_WIDTH_LINES = 51; // 8.5 in × 6 lines per inch
export const MIN_FIT_ZOOM = 0.5;

/** Pixel height of one script line at `zoom` (16 px at 100 %). */
export function linePxFor(zoom) {
  return Math.max(6, Math.round(16 * zoom));
}

/** The page's on-screen width at `zoom`. */
export const pageWidthAt = (zoom) => linePxFor(zoom) * PAGE_WIDTH_LINES;

/** The largest zoom whose page fits in `width` px — counted in whole lines, so it never overshoots. */
export function fitZoomFor(width) {
  return Math.floor(width / PAGE_WIDTH_LINES) / 16;
}

/**
 * The zoom the page is drawn at. On the Page and Split views the page shrinks to fit the space
 * left beside the Scenes list and the right dock (Story Bible, Characters, Snapshots, Notes) —
 * so it never scrolls sideways — but never zooms in past the writer's own zoom, nor below 50 %.
 */
export function effectiveZoomFor({ view, zoom, width }) {
  if (view === 'board' || !width) return zoom;
  return Math.max(MIN_FIT_ZOOM, Math.min(zoom, fitZoomFor(width)));
}
