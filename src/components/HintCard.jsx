import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb } from 'lucide-react';
import { HINTS } from '../lib/hints.js';
import './HintCard.css';

const GAP = 8;
const MARGIN = 10;

/**
 * A feature hint's card (lib/hints.js), drawn beside the tool's own button: two sentences, the
 * tool's button and Got it. It never takes focus and never covers the script on its own: it only
 * appears once the panel holding the tool is open. Nothing runs until the writer clicks.
 *   id       — the hint; its target button is found by HINTS[id].target
 *   placeKey — changes when the panels move (view, dock, tab), so the card re-measures
 *   onAction — click the tool (the same as clicking its button); onDismiss — Got it
 */
export default function HintCard({ id, placeKey, onAction, onDismiss }) {
  const hint = HINTS[id];
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!hint) return undefined;
    const place = () => {
      const target = document.querySelector(hint.target);
      const card = cardRef.current;
      if (!target || !card || target.offsetParent === null) {
        setPos(null);
        return;
      }
      const t = target.getBoundingClientRect();
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const left = Math.max(MARGIN, Math.min(t.right - w, window.innerWidth - MARGIN - w));
      const below = t.bottom + GAP;
      const top = below + h <= window.innerHeight - MARGIN ? below : Math.max(MARGIN, t.top - GAP - h);
      setPos((p) => (p && p.left === left && p.top === top ? p : { left, top, arrow: Math.min(w - 18, Math.max(12, t.left + t.width / 2 - left)) }));
    };
    place();
    // Look again for a few seconds: a drawer slides in, and the Scene Board loads the first time it opens.
    let tries = 0;
    const again = setInterval(() => {
      place();
      if (++tries >= 20) clearInterval(again);
    }, 250);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      clearInterval(again);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [hint, placeKey]);

  if (!hint) return null;
  return createPortal(
    <aside
      ref={cardRef}
      className={`hint-card${pos ? '' : ' is-measuring'}`}
      role="status"
      aria-live="polite"
      aria-labelledby={`hint-${id}`}
      data-hint={id}
      style={pos ? { left: pos.left, top: pos.top, '--hint-arrow': `${pos.arrow}px` } : undefined}
      onMouseDown={(e) => e.preventDefault()} // never pull focus (or the caret) out of the script
    >
      <div className="hint-head">
        <Lightbulb size={14} strokeWidth={1.75} aria-hidden className="hint-icon" />
        <h2 id={`hint-${id}`}>{hint.title}</h2>
      </div>
      <p className="hint-text">{hint.text}</p>
      <div className="hint-actions">
        <button type="button" className="btn hint-go" onClick={onAction}>{hint.action}</button>
        <button type="button" className="btn hint-dismiss" onClick={onDismiss}>Got it</button>
      </div>
    </aside>,
    document.body,
  );
}
