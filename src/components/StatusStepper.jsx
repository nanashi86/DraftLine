import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const ICON = { size: 13, strokeWidth: 1.75, 'aria-hidden': true };

/**
 * The status bar's tool stepper — one capsule shared by the Dialogue and Density steppers, so both
 * look and behave the same:
 *
 *   [ icon  Label · 3 of 12   ‹  › ] (✕)
 *
 *   label  → opens / closes the dropup `list` (anchored above the capsule; Esc or a click outside closes it)
 *   ‹ ›    → onStep('prev' | 'next'), without opening the list
 *   ✕      → onDismiss
 *
 * Without `onStep` it's a single pill (`onLabel` runs on click) — the Density stepper before it's on.
 *   tone: 'neutral' (Dialogue, Format) | 'amber' (Density)
 *   list: { heading, ariaLabel, items: [{ key, n, label, tag?, sub?, mono?, actions?: [{ label, onClick, primary?, title? }] }],
 *           (tag: a small pill after the label, e.g. "p. 4"; mono: the sub line is script text, in Courier)
 *           current, onPick(i), footer?: { label, onClick } } | null
 */
export default function StatusStepper({
  tone = 'neutral', icon, name, label, position, title, ariaLabel, onLabel, onStep, stepNoun = 'item',
  onDismiss, dismissLabel = 'Close', list = null, openSignal = 0,
}) {
  const [listOpen, setListOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const popRef = useRef(null);

  // Opened from outside (e.g. right-click on the Density pill before it's on).
  const [seenSignal, setSeenSignal] = useState(openSignal);
  if (seenSignal !== openSignal) {
    setSeenSignal(openSignal);
    setListOpen(true); // shows as soon as there's a list to show
  }
  // A list that no longer applies (another character, the stepper turned off) never lingers.
  const [listFor, setListFor] = useState(name);
  if (listFor !== name) {
    setListFor(name);
    setListOpen(false);
  }
  const showList = listOpen && !!list;

  useEffect(() => {
    if (!showList) return undefined;
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setListOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // the list closes; the stepper stays
        setListOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [showList]);

  // The status bar clips overflow, so the list floats in a portal: 4px above the status bar (not on
  // it), its right edge lined up with the capsule's so it never covers the page / zoom controls.
  useLayoutEffect(() => {
    if (!showList || !anchorRef.current || !popRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const barTop = anchorRef.current.closest('.status')?.getBoundingClientRect().top ?? a.top;
    const w = popRef.current.offsetWidth;
    const next = { left: Math.max(8, Math.min(a.right - w, window.innerWidth - w - 8)), bottom: window.innerHeight - barTop + 4 };
    setPos((p) => (p && p.left === next.left && p.bottom === next.bottom ? p : next));
  }, [showList]);

  const stepping = typeof onStep === 'function';
  const labelClick = () => {
    if (list && stepping) setListOpen((o) => !o);
    else onLabel?.();
  };

  return (
    <span className={`stepper is-${tone}${stepping ? ' is-stepping' : ''}`} role="group" aria-label={ariaLabel}>
      <span className="stepper-capsule" ref={anchorRef}>
        <button
          type="button"
          className={`stepper-main${showList ? ' is-open' : ''}`}
          onClick={labelClick}
          onContextMenu={list || (!stepping && onLabel) ? (e) => {
            e.preventDefault();
            if (stepping) setListOpen((o) => !o);
            else onLabel?.({ list: true });
          } : undefined}
          aria-haspopup={list && stepping ? 'menu' : undefined}
          aria-expanded={list && stepping ? showList : undefined}
          title={title}
        >
          {icon && <span className="stepper-icon">{icon}</span>}
          <span className="stepper-label">{label}</span>
          {position && (
            <>
              <span className="stepper-dot" aria-hidden="true">·</span>
              <span className="stepper-pos">{position}</span>
            </>
          )}
        </button>
        {stepping && (
          <>
            <button type="button" className="stepper-step" onClick={() => onStep('prev')} aria-label={`Previous ${stepNoun}`} title={`Previous ${stepNoun}`}>
              <ChevronLeft {...ICON} />
            </button>
            <button type="button" className="stepper-step" onClick={() => onStep('next')} aria-label={`Next ${stepNoun}`} title={`Next ${stepNoun}`}>
              <ChevronRight {...ICON} />
            </button>
          </>
        )}
      </span>
      {onDismiss && (
        <button type="button" className="stepper-dismiss" onClick={() => { setListOpen(false); onDismiss(); }} aria-label={dismissLabel} title={dismissLabel}>
          <X size={11} strokeWidth={2} aria-hidden />
        </button>
      )}
      {showList && createPortal(
        <div
          ref={popRef}
          className={`menu-pop stepper-list is-${tone}`}
          role="menu"
          aria-label={list.ariaLabel}
          style={pos ? { left: pos.left, bottom: pos.bottom } : { left: -9999, bottom: 0 }}
        >
          <div className="menu-heading">{list.heading}</div>
          <div className="stepper-list-items">
            {list.items.map((it, i) => {
              const row = (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  className={`menu-item${i === list.current ? ' is-current' : ''}`}
                  onClick={() => {
                    setListOpen(false);
                    list.onPick(i);
                  }}
                >
                  <span className="stepper-list-n">{it.n ?? i + 1}</span>
                  <span className="menu-label">
                    <span className="stepper-list-title">
                      <span className="stepper-list-label">{it.label}</span>
                      {it.tag && <span className="stepper-list-tag">{it.tag}</span>}
                    </span>
                    {it.sub && <small className={`menu-sub${it.mono ? ' is-mono' : ''}`}>{it.sub}</small>}
                  </span>
                </button>
              );
              if (!it.actions?.length) return row;
              // A row with its own buttons (Format Doctor: Fix / Ignore); the list stays open for the next one.
              return (
                <div key={it.key} className={`stepper-list-row${i === list.current ? ' is-current' : ''}`}>
                  {row}
                  <span className="stepper-list-actions">
                    {it.actions.map((a) => (
                      <button key={a.label} type="button" className={`stepper-list-act${a.primary ? ' is-primary' : ''}`} onClick={a.onClick} title={a.title || a.label}>
                        {a.label}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          {list.footer && (
            <button type="button" className="menu-item stepper-list-footer" onClick={() => { setListOpen(false); list.footer.onClick(); }}>
              {list.footer.label}
            </button>
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}
