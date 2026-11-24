// Floating cards in Plan (a shooting day's details, a strip's Move menu, an element's details): placed
// beside their anchor and kept inside the window, closed by a click outside, focus back where it was.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const HIDDEN = { visibility: 'hidden', top: 0, left: 0 };

/**
 * Keep a floating card next to its anchor and inside the window, following it as the board scrolls
 * (strips moving change the board's height, which scrolls it a little); `gone` once the anchor has
 * scrolled out of sight or left the page, which closes the card.
 */
export function useFloating(anchor, ref, onGone) {
  const gone = useRef(onGone);
  useLayoutEffect(() => {
    gone.current = onGone;
  });
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const a = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
      if (!a || a.bottom < 0 || a.top > window.innerHeight) {
        gone.current?.();
        return;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.max(8, Math.min(a.left, window.innerWidth - w - 8));
      const below = a.bottom + 6;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, a.top - h - 6) : below;
      setPos({ left, top });
    };
    place();
    const onScroll = (e) => {
      if (!ref.current?.contains(e.target)) place();
    };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor, ref]);
  return pos;
}

/**
 * Close a floating card on a click outside; when it closes, focus goes back to its anchor (without
 * scrolling). Set up once per card, whatever re-renders in between.
 */
export function useDismiss(ref, anchor, onClose) {
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const down = (e) => {
      if (!ref.current?.contains(e.target) && !anchor?.contains(e.target) && !e.target.closest?.('.dl-select-list')) close.current();
    };
    document.addEventListener('mousedown', down);
    return () => {
      document.removeEventListener('mousedown', down);
      if (anchor?.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [ref, anchor]);
}

/** Focus `selector` inside the card once it's in place (a hidden element can't take focus). */
export function useFocusWhenPlaced(ref, pos, selector) {
  const done = useRef(false);
  useEffect(() => {
    if (!pos || done.current) return;
    done.current = true;
    ref.current?.querySelector(selector)?.focus({ preventScroll: true });
  }, [ref, pos, selector]);
}
