import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { caretLine } from '../lib/caret.js';
import { ELEMENT_BAR, elementBarTop, scrollToClear } from '../lib/mobile.js';
import './ElementBar.css';

const AIR = 8; // px kept between the line being written and the bar

/** The script line that has the cursor, if any. */
function activeLine() {
  const a = document.activeElement;
  return a?.classList?.contains('el-input') && a.closest('.sheet') ? a : null;
}

/**
 * Phones: Scene · Action · Character · Dialogue · ( ) · Transition, in a slim row on top of the
 * on-screen keyboard while you write (lib/mobile.js decides when). Tapping one switches the line
 * you're on — through the editor's own setType, so it's one undo step like Alt+1…8 — and never takes
 * the focus, so the keyboard stays up and the cursor stays put. It also keeps the line you're
 * writing (and its suggestion list) clear of the keyboard and the bar.
 */
export default function ElementBar({ type, onPick }) {
  const ref = useRef(null);
  const [top, setTop] = useState(null);
  const [narrow, setNarrow] = useState(() => (globalThis.innerWidth || 0) < 375);

  const place = useCallback(() => {
    const bar = ref.current;
    if (!bar) return;
    const vv = globalThis.visualViewport;
    const statusH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--status-h')) || 0;
    const barH = bar.offsetHeight;
    const t = elementBarTop({ vv, innerHeight: globalThis.innerHeight, statusH, barH });
    setTop(t);
    setNarrow(globalThis.innerWidth < 375);
    // Room to scroll the last lines up past the keyboard and the bar (the layout viewport doesn't
    // shrink for an iPhone keyboard, so the script's own end padding isn't enough). Only while the
    // bar is up; the page itself — and its pagination — is untouched.
    document.documentElement.style.setProperty('--eb-clear', `${Math.max(0, globalThis.innerHeight - t) + 48}px`);
    // Keep the cursor's line — and the suggestion list under it, when one is open — above the bar.
    const ta = activeLine();
    const scroller = ta?.closest('.scroller');
    if (!ta || !scroller) return;
    const r = ta.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 16;
    const caretBottom = r.top + (caretLine(ta, ta.selectionEnd) + 1) * lh;
    const ac = document.querySelector('.sheet .ac');
    const bottom = Math.max(caretBottom, ac ? ac.getBoundingClientRect().bottom : 0);
    // getBoundingClientRect and the bar's top are both in layout-viewport px.
    const dy = scrollToClear(bottom, t - AIR);
    if (dy) scroller.scrollTop += dy;
  }, []);

  useLayoutEffect(() => { place(); }, [place, type]);
  useLayoutEffect(() => {
    document.documentElement.classList.add('has-element-bar');
    return () => {
      document.documentElement.classList.remove('has-element-bar');
      document.documentElement.style.removeProperty('--eb-clear');
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    const vv = globalThis.visualViewport;
    vv?.addEventListener('resize', later);
    vv?.addEventListener('scroll', later);
    window.addEventListener('resize', later);
    document.addEventListener('selectionchange', later);
    document.addEventListener('input', later, true);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener('resize', later);
      vv?.removeEventListener('scroll', later);
      window.removeEventListener('resize', later);
      document.removeEventListener('selectionchange', later);
      document.removeEventListener('input', later, true);
    };
  }, [place]);

  // Never take the focus: the script line keeps it, so the keyboard stays up.
  const keep = (e) => e.preventDefault();

  return (
    <div
      ref={ref}
      className="element-bar"
      role="toolbar"
      aria-label="Element"
      style={top == null ? { visibility: 'hidden' } : { transform: `translateY(${top}px)` }}
    >
      {ELEMENT_BAR.map((b) => (
        <button
          key={b.type}
          type="button"
          tabIndex={-1}
          className={`eb-btn${type === b.type ? ' is-on' : ''}`}
          aria-pressed={type === b.type}
          aria-label={b.title}
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={() => onPick(b.type)}
        >
          {narrow ? b.short : b.label}
        </button>
      ))}
    </div>
  );
}
