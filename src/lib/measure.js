/**
 * Size a textarea to its content. With `snap`, the height is stored as a whole
 * number of screenplay lines (`calc(var(--line) * N)`), so:
 *   - a font whose glyphs overflow the line box by a pixel can't drift the page grid;
 *   - zoom changes rescale every line for free, with no re-measuring.
 * Returns false, leaving the height as it was, when the textarea isn't laid out (display: none —
 * the editor behind Board view): it measures 0 then, so no separate visibility check (and the forced
 * layout it costs) is needed first.
 */
export function measureTextarea(el, snap) {
  // Read style before mutating so we pay for one forced layout, not two.
  const lh = snap ? parseFloat(getComputedStyle(el).lineHeight) : 0;
  const was = el.style.height;
  el.style.height = '0px';
  const sh = el.scrollHeight;
  if (!sh) {
    el.style.height = was;
    return false;
  }
  el.style.height = snap ? `calc(var(--line) * ${Math.max(1, Math.round(sh / (lh || 16)))})` : `${sh}px`;
  delete el.dataset.stale;
  return true;
}

// ---- Script lines that appear together are measured together ----------------------------------
// Opening a script mounts every line at once. Measuring each as it mounts forced a full layout per
// line (two, with the visibility check) — about 4,900 for a 120-page script, most of the time it
// took to open. Instead each new line is queued, and the editor measures the queue in one batch
// (remeasureTextareas: one layout) at the end of the same commit, before anything is painted.
const firstMeasures = new Set();
let flushQueued = false;

/** Queue a newly mounted script line for the batch. A microtask flushes it if nothing else does. */
export function queueFirstMeasure(el) {
  firstMeasures.add(el);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flushFirstMeasures);
}

/** Measure every queued line in one layout. Lines not laid out yet (Board view) wait until shown. */
export function flushFirstMeasures() {
  flushQueued = false;
  if (!firstMeasures.size) return;
  const list = [...firstMeasures].filter((el) => el.isConnected);
  firstMeasures.clear();
  remeasureTextareas(list);
  for (const el of list) if (!el.offsetParent) el.dataset.stale = '1';
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
