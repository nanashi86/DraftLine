/**
 * Size a textarea to its content. With `snap`, the height is stored as a whole
 * number of screenplay lines (`calc(var(--line) * N)`), so:
 *   - a font whose glyphs overflow the line box by a pixel can't drift the page grid;
 *   - zoom changes rescale every line for free, with no re-measuring.
 */
export function measureTextarea(el, snap) {
  if (snap) {
    // Read style before mutating so we pay for one forced layout, not two.
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    el.style.height = '0px';
    const n = Math.max(1, Math.round(el.scrollHeight / (lh || 16)));
    el.style.height = `calc(var(--line) * ${n})`;
  } else {
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }
  delete el.dataset.stale;
}
