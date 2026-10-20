import { useCallback, useRef, useState } from 'react';

const LIMIT = 300;
const COALESCE_MS = 1200;

/**
 * Undo/redo for the block array. Calls sharing a `coalesceKey` within a short window
 * (e.g. typing into one block) collapse into a single undo step.
 * `normalize(prev, next)` (stable, pure) gets a chance to adjust every new state —
 * DraftLine uses it to carry inline formatting along with text edits.
 *
 * A step can also change state that lives outside the block array (a character rename
 * touches beats and the Bible too): pass `effect = { undo(), redo() }` as the third
 * argument and it runs when that exact step is undone or redone, so the whole change is
 * one Ctrl+Z.
 */
export function useHistory(initial, normalize = null) {
  const [hist, setHist] = useState(() => ({ past: [], present: initial, future: [] }));
  const histRef = useRef(hist);
  const last = useRef({ key: null, t: 0 });
  const effects = useRef(new WeakMap()); // step's resulting block array → { undo, redo }

  const commit = (h) => {
    histRef.current = h;
    setHist(h);
  };

  const set = useCallback((next, coalesceKey = null, effect = null) => {
    const now = Date.now();
    const coalesce = !effect && coalesceKey !== null && last.current.key === coalesceKey && now - last.current.t < COALESCE_MS;
    last.current = { key: effect ? null : coalesceKey, t: now };
    const h = histRef.current;
    let value = typeof next === 'function' ? next(h.present) : next;
    if (normalize) value = normalize(h.present, value);
    if (value === h.present) return;
    if (effect && value && typeof value === 'object') effects.current.set(value, effect);
    if (coalesce) commit({ ...h, present: value, future: [] });
    else commit({ past: [...h.past.slice(-LIMIT), h.present], present: value, future: [] });
  }, [normalize]);

  const undo = useCallback(() => {
    last.current = { key: null, t: 0 };
    const h = histRef.current;
    if (!h.past.length) return;
    const leaving = h.present;
    commit({ past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] });
    effects.current.get(leaving)?.undo();
  }, []);

  const redo = useCallback(() => {
    last.current = { key: null, t: 0 };
    const h = histRef.current;
    if (!h.future.length) return;
    const arriving = h.future[0];
    commit({ past: [...h.past, h.present], present: arriving, future: h.future.slice(1) });
    effects.current.get(arriving)?.redo();
  }, []);

  const reset = useCallback((value) => {
    last.current = { key: null, t: 0 };
    commit({ past: [], present: value, future: [] });
  }, []);

  return {
    present: hist.present,
    set,
    undo,
    redo,
    reset,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
  };
}
