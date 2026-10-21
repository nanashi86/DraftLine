import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { densityLabel, densityTitle, riskPositionLabel } from '../lib/pacing.js';

/**
 * Status bar density control.
 *   Optimal                → muted text.
 *   Risks, mode off        → amber pill "Density: 9 Skim Risks": click turns the highlights on and
 *                            jumps to the first risk.
 *   Risks, mode on         → "Density: Risk 1 of 9" (click re-jumps to it) · ‹ › step and loop ·
 *                            ▴ lists every risk by scene and page · ✕ turns the highlights off.
 * Right-click or Alt+click on the pill also opens the list.
 */
export default function DensityNav({ density, on, index, locations, onStart, onStep, onGo, onOff }) {
  const [listOpen, setListOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!listOpen) return undefined;
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setListOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
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

  if (!density.dense) {
    return <span className="status-density" title={densityTitle(density)}>{densityLabel(density)}</span>;
  }

  const openList = () => {
    if (!on) onStart({ jump: false });
    setListOpen((o) => !o);
  };
  const pillClick = (e) => {
    if (e.altKey) {
      openList();
      return;
    }
    if (!on) onStart({ jump: true });
    else onGo(Math.max(index, 0)); // jump (again) to the current risk
  };

  return (
    <span className={`density-nav${on ? ' is-on' : ''}`} ref={anchorRef}>
      <button
        type="button"
        className={`status-density is-risk${on ? ' is-on' : ''}`}
        onClick={pillClick}
        onContextMenu={(e) => {
          e.preventDefault();
          openList();
        }}
        aria-pressed={on}
        title={on ? 'Jump to this skim risk · right-click (or Alt+click) for the list' : densityTitle(density, false)}
      >
        <span className="density-dot" aria-hidden="true" />
        {on ? riskPositionLabel(density, index) : densityLabel(density)}
      </button>
      {on && (
        <span className="density-steps" role="group" aria-label="Skim risks">
          <button type="button" className="density-step" onClick={() => onStep('prev')} aria-label="Previous skim risk" title="Previous risk">‹</button>
          <button type="button" className="density-step" onClick={() => onStep('next')} aria-label="Next skim risk" title="Next risk">›</button>
          <button
            type="button"
            className={`density-step${listOpen ? ' is-open' : ''}`}
            onClick={openList}
            aria-haspopup="menu"
            aria-expanded={listOpen}
            aria-label="List every skim risk"
            title="List every risk"
          >
            ▴
          </button>
          <button type="button" className="density-step" onClick={() => { setListOpen(false); onOff(); }} aria-label="Hide density highlights" title="Hide the highlights">✕</button>
        </span>
      )}
      {listOpen && createPortal(
        <div
          ref={popRef}
          className="menu-pop density-list"
          role="menu"
          aria-label="Skim risks"
          style={pos ? { left: pos.left, bottom: pos.bottom } : { left: -9999, bottom: 0 }}
        >
          <div className="menu-heading">{density.dense} skim {density.dense === 1 ? 'risk' : 'risks'} · {density.percent}% of action</div>
          <div className="density-list-items">
            {locations.map((l, i) => (
              <button
                key={l.id}
                type="button"
                role="menuitem"
                className={`menu-item${i === index ? ' is-current' : ''}`}
                onClick={() => {
                  setListOpen(false);
                  onGo(i);
                }}
              >
                <span className="density-list-n">{i + 1}</span>
                <span className="menu-label">
                  <span>{l.label}</span>
                  <small className="menu-sub">{l.lines} lines</small>
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
