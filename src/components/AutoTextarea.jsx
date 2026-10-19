import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { measureTextarea } from '../lib/measure.js';

/** A textarea that grows to fit its content (no scrollbars, no fixed rows). */
export default function AutoTextarea({
  value, measureKey, snapToLines = false, fitOnResize = false, ref: externalRef, ...rest
}) {
  const inner = useRef(null);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    // Hidden (e.g. the editor while Board view is showing): measure when shown.
    if (!el.offsetParent) {
      el.dataset.stale = '1';
      return;
    }
    measureTextarea(el, snapToLines);
  }, [value, measureKey, snapToLines]);

  // Re-fit when the textarea's width changes (e.g. board columns in Split view).
  useEffect(() => {
    const el = inner.current;
    if (!fitOnResize || !el) return undefined;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth && el.offsetParent) {
        lastWidth = el.clientWidth;
        measureTextarea(el, snapToLines);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitOnResize, snapToLines]);

  const setRef = useCallback(
    (el) => {
      inner.current = el;
      if (typeof externalRef === 'function') externalRef(el);
      else if (externalRef) externalRef.current = el;
    },
    [externalRef],
  );

  return <textarea ref={setRef} rows={1} value={value} {...rest} />;
}
