import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Theater, X } from 'lucide-react';
import { stepperPosition } from '../lib/dialogueFilter.js';

const ICON = { size: 13, strokeWidth: 1.75, 'aria-hidden': true };

/**
 * Status bar: steps through the filtered character's speeches while the Characters → Dialogue
 * filter is on.  [ 🎭 MARIE 3 of 12  ‹  › ] [ × ]
 *   pill   → a list of every speech (Sc. · p. — "snippet"); a row jumps there
 *   ‹ ›    → previous / next speech, looping (also Alt+↑ / Alt+↓, and [ / ] outside the text)
 *   ×      → clears the filter
 * `stops` come from dialogueStops(); `index` is the current one (-1 before the first step).
 */
export default function DialogueStepper({ name, stops, index, onStep, onGo, onClear }) {
  const [listOpen, setListOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const popRef = useRef(null);
  const total = stops.length;

  useEffect(() => {
    if (!listOpen) return undefined;
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setListOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // the list closes; the filter stays
        setListOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [listOpen]);

  // The status bar clips overflow, so the list floats in a portal, opening upward from the pill.
  useLayoutEffect(() => {
    if (!listOpen || !anchorRef.current || !popRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const w = popRef.current.offsetWidth;
    const next = { left: Math.max(8, Math.min(a.left, window.innerWidth - w - 8)), bottom: window.innerHeight - a.top + 6 };
    setPos((p) => (p && p.left === next.left && p.bottom === next.bottom ? p : next));
  }, [listOpen]);

  // A list from another character never lingers.
  const [listFor, setListFor] = useState(name);
  if (listFor !== name) {
    setListFor(name);
    setListOpen(false);
  }

  return (
    <span className="dlg-stepper" ref={anchorRef} role="group" aria-label={`${name}’s dialogue`}>
      <span className="dlg-pill">
        <button
          type="button"
          className={`dlg-main${listOpen ? ' is-open' : ''}`}
          onClick={() => setListOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={listOpen}
          title={`Every speech by ${name} — pick one to jump to it`}
        >
          <Theater {...ICON} className="dlg-icon" />
          <span className="dlg-name">{name}</span>
          <span className="dlg-pos">{stepperPosition(index, total)}</span>
        </button>
        <button type="button" className="dlg-step" onClick={() => onStep('prev')} disabled={!total} aria-label={`Previous speech by ${name}`} title="Previous speech (Alt+↑ or [)">
          <ChevronLeft {...ICON} />
        </button>
        <button type="button" className="dlg-step" onClick={() => onStep('next')} disabled={!total} aria-label={`Next speech by ${name}`} title="Next speech (Alt+↓ or ])">
          <ChevronRight {...ICON} />
        </button>
      </span>
      <button type="button" className="dlg-clear" onClick={() => { setListOpen(false); onClear(); }} aria-label="Clear the dialogue filter" title="Clear the filter (Esc)">
        <X {...ICON} />
      </button>
      {listOpen && createPortal(
        <div
          ref={popRef}
          className="menu-pop density-list dlg-list"
          role="menu"
          aria-label={`${name}’s speeches`}
          style={pos ? { left: pos.left, bottom: pos.bottom } : { left: -9999, bottom: 0 }}
        >
          <div className="menu-heading">{name} · {total} {total === 1 ? 'speech' : 'speeches'}</div>
          <div className="density-list-items">
            {stops.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                className={`menu-item${i === index ? ' is-current' : ''}`}
                onClick={() => {
                  setListOpen(false);
                  onGo(i);
                }}
              >
                <span className="density-list-n">{i + 1}</span>
                <span className="menu-label"><span>{s.label}</span></span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
