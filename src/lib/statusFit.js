// The status bar's step-aside order. When everything doesn't fit on one line, helpers leave one at a
// time — never the status (element, saved / synced, Editing / Viewing, page) or an active stepper:
//   1 key hints (Enter / Tab)   2 scene, note and word counts   3 Paper's label (the swatch stays)
//   4 undo / redo (Ctrl+Z / Ctrl+Shift+Z still work)            5 zoom − + (the % stays; click resets)
//   6 steppers go compact: icon · position · ‹ › ✕ (the word or name stays in the tooltip and list)
//   7 on the narrowest windows the status itself goes to its icons — the saved / synced dot and the
//     Editing / Viewing lock — so it's still there, with its words in the tooltip, rather than cut off
// The bar is measured, not guessed: steppers vary in width (a long character name, "12 of 140"),
// so fixed breakpoints would be wrong half the time. It's re-checked when the bar or a stepper
// changes size — never on a keystroke — and applied as data-fit="0…7" on the bar (App.css).

export const STATUS_FIT_STEPS = ['hints', 'counts', 'paper-label', 'undo-redo', 'zoom-buttons', 'stepper-labels', 'status-icons'];
export const MAX_STATUS_FIT = STATUS_FIT_STEPS.length;

/** Does the bar fit at its current step? Nothing on the right overflows and nothing on the left is cut off. */
export function statusFits(bar) {
  const left = bar.querySelector('.status-left');
  const counts = bar.querySelector('.status-counts');
  const cut = (el) => !!el && el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1;
  return !(bar.scrollWidth > bar.clientWidth + 1 || cut(left) || cut(counts));
}

/** The fewest steps that make `bar` fit (it's left set there); MAX_STATUS_FIT if even that doesn't. */
export function fitStatusBar(bar, fits = statusFits) {
  if (!bar) return 0;
  for (let step = 0; step <= MAX_STATUS_FIT; step++) {
    bar.dataset.fit = String(step);
    if (step === MAX_STATUS_FIT || fits(bar)) return step;
  }
  return MAX_STATUS_FIT;
}

/**
 * Keep `bar` fitted: on its own resizes and on those of the parts whose width changes (steppers,
 * saved / synced, the element name). Returns a cleanup. No-op where ResizeObserver is missing.
 */
export function watchStatusFit(bar) {
  if (!bar || typeof ResizeObserver === 'undefined') return () => {};
  let frame = 0;
  const refit = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => fitStatusBar(bar));
  };
  const ro = new ResizeObserver(refit);
  ro.observe(bar);
  for (const sel of ['.status-tools', '.status-save', '.status-type', '.status-lock']) {
    const el = bar.querySelector(sel);
    if (el) ro.observe(el);
  }
  // Steppers come and go (the tools box can be hidden): watch for parts appearing too.
  const mo = new MutationObserver(() => {
    for (const sel of ['.status-tools', '.status-save', '.status-type', '.status-lock']) {
      const el = bar.querySelector(sel);
      if (el) ro.observe(el);
    }
    refit();
  });
  mo.observe(bar, { childList: true, subtree: false });
  fitStatusBar(bar);
  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    mo.disconnect();
  };
}
