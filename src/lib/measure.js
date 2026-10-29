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

/**
 * Re-measure many snapped textareas at once (after a font loads): every write, then one layout for
 * every read, then every write — not a forced layout per line, which froze long scripts. The
 * nearest scrolling ancestor's position is kept, since the lines collapse for that one layout.
 * Returns how many changed height.
 */
export function remeasureTextareas(els) {
  const list = [...els].filter((el) => el.offsetParent);
  if (!list.length) return 0;
  let scroller = list[0].parentElement;
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) {
    scroller = scroller.parentElement;
  }
  const top = scroller?.scrollTop ?? 0;
  const lh = parseFloat(getComputedStyle(list[0]).lineHeight) || 16;
  const before = list.map((el) => el.style.height);
  for (const el of list) el.style.height = '0px';
  const lines = list.map((el) => Math.max(1, Math.round(el.scrollHeight / lh)));
  let changed = 0;
  list.forEach((el, i) => {
    const h = `calc(var(--line) * ${lines[i]})`;
    if (h !== before[i]) changed += 1;
    el.style.height = h;
    delete el.dataset.stale;
  });
  if (scroller) scroller.scrollTop = top;
  return changed;
}
