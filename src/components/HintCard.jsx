import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb } from 'lucide-react';
import { HINTS, hintRoomFor } from '../lib/hints.js';
import './HintCard.css';

const GAP = 8;
const MARGIN = 10;

/**
 * A feature hint's card (lib/hints.js), drawn beside the tool's own button: two sentences, the
 * tool's button and Got it. It never takes focus and never covers the script on its own: it only
 * appears once the panel holding the tool is open. Nothing runs until the writer clicks.
 *   id       — the hint; its target button is found by HINTS[id].target
 *   action   — the button's words when they depend on the script (Spotlight MARIE); else HINTS[id].action
 *   onAction — click the tool (the same as clicking its button); onDismiss — Got it
 * It checks its place a few times a second: if the tool moves it follows, and if the tool is covered
 * or a menu or toast would overlap it, it hides until there's room again (hintRoomFor).
 */
export default function HintCard({ id, action, onAction, onDismiss }) {
  const hint = HINTS[id];
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!hint) return undefined;
    const place = () => {
      const target = document.querySelector(hint.target);
      const card = cardRef.current;
      if (!target || !card) {
        setPos(null);
        return;
      }
      const t = target.getBoundingClientRect();
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const want = hint.align === 'start' ? t.left : t.right - w;
      const left = Math.max(MARGIN, Math.min(want, window.innerWidth - MARGIN - w));
      const below = t.bottom + GAP;
      const above = below + h > window.innerHeight - MARGIN;
      const top = above ? Math.max(MARGIN, t.top - GAP - h) : below;
      if (!hintRoomFor(target, { left, top, right: left + w, bottom: top + h })) {
        setPos(null);
        return;
      }
      setPos((p) => (p && p.left === left && p.top === top ? p : { left, top, above, arrow: Math.min(w - 18, Math.max(12, t.left + t.width / 2 - left)) }));
    };
    place();
    // Keep checking while it's up: a drawer slides in, the board loads, a menu opens, a toast arrives.
    const again = setInterval(place, 250);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      clearInterval(again);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [hint]);

  if (!hint) return null;
  return createPortal(
    <aside
      ref={cardRef}
      className={`hint-card${pos ? '' : ' is-measuring'}${pos?.above ? ' is-above' : ''}`}
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
        <button type="button" className="btn hint-go" onClick={onAction}>{action || hint.action}</button>
        <button type="button" className="btn hint-dismiss" onClick={onDismiss}>Got it</button>
      </div>
    </aside>,
    document.body,
  );
}
