import { useCallback, useRef, useState } from 'react';

const LIMIT = 300;
const COALESCE_MS = 1200;

/**
 * Undo/redo for the block array. Calls sharing a `coalesceKey` within a short window
 * (e.g. typing into one block) collapse into a single undo step.
 * `normalize(prev, next)` (stable, pure) gets a chance to adjust every new state —
 * DraftLine uses it to carry inline formatting along with text edits.
 */
export function useHistory(initial, normalize = null) {
  const [hist, setHist] = useState(() => ({ past: [], present: initial, future: [] }));
  const last = useRef({ key: null, t: 0 });

  const set = useCallback((next, coalesceKey = null) => {
    const now = Date.now();
    const coalesce = coalesceKey !== null && last.current.key === coalesceKey && now - last.current.t < COALESCE_MS;
    last.current = { key: coalesceKey, t: now };
    setHist((h) => {
      let value = typeof next === 'function' ? next(h.present) : next;
      if (normalize) value = normalize(h.present, value);
      if (value === h.present) return h;
      if (coalesce) return { ...h, present: value, future: [] };
      return { past: [...h.past.slice(-LIMIT), h.present], present: value, future: [] };
    });
  }, [normalize]);

  const undo = useCallback(() => {
    last.current = { key: null, t: 0 };
    setHist((h) => (h.past.length
      ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
      : h));
  }, []);

  const redo = useCallback(() => {
    last.current = { key: null, t: 0 };
    setHist((h) => (h.future.length
      ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
      : h));
  }, []);

  const reset = useCallback((value) => {
    last.current = { key: null, t: 0 };
    setHist({ past: [], present: value, future: [] });
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
