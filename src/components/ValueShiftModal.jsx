import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, Zap } from 'lucide-react';
import { valueShiftInfo } from '../lib/beats.js';
import { shiftsToApply } from '../lib/valueShiftScanner.js';
import './ValueShiftModal.css';

/**
 * Scene Board → Analyze Value Shifts: every scene with the shift the scanner reads in it
 * (lib/valueShiftScanner.js) beside the one its card has now. ✓ sets one card; Apply to All Cards
 * sets every linked card at once (the board offers Undo). Scenes without a card are listed but
 * can't be set — Import Scenes makes their cards.
 *   suggestions: scanValueShifts(blocks) · beats: the board's cards
 *   onApply(Map cardId → shift, { all }) · onClose()
 */
export default function ValueShiftModal({ suggestions, beats, onApply, onClose }) {
  const dialogRef = useRef(null);
  const [applied, setApplied] = useState(() => new Set()); // scene ids set from here this time
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const cardOf = useMemo(() => {
    const m = new Map();
    for (const b of beats) if (b.sceneId && !m.has(b.sceneId)) m.set(b.sceneId, b);
    return m;
  }, [beats]);
  const all = useMemo(() => shiftsToApply(beats, suggestions, new Set(suggestions.map((s) => s.id))), [beats, suggestions]);
  const linked = suggestions.filter((s) => cardOf.has(s.id)).length;

  const acceptOne = (s) => {
    onApply(shiftsToApply(beats, [s], new Set([s.id])), { all: false });
    setApplied((a) => new Set(a).add(s.id));
  };

  return (
    <dialog
      ref={dialogRef}
      className="vsm-modal"
      aria-labelledby="vsm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="vsm-head">
        <h2 id="vsm-title"><Zap size={16} strokeWidth={1.75} aria-hidden /> Value Shifts</h2>
        <p>
          How each scene’s charge turns, read from its opening and closing quarter: calm, help and agreement count as +;
          threats, obstacles, weapons, violence, sudden exits and discoveries as −. A suggestion, not a verdict — accept the ones that ring true.
        </p>
        <button type="button" className="vsm-close" onClick={onClose} aria-label="Close" title="Close (Esc)">
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      {suggestions.length ? (
        <div className="vsm-table" role="table" aria-label="Suggested Value Shifts">
          <div className="vsm-row vsm-th" role="row">
            <span role="columnheader">Sc.</span>
            <span role="columnheader">Slugline</span>
            <span role="columnheader">Suggested</span>
            <span role="columnheader">Current</span>
            <span role="columnheader" aria-label="Accept" />
          </div>
          {suggestions.map((s) => {
            const card = cardOf.get(s.id);
            const info = valueShiftInfo(s.shift);
            const cur = valueShiftInfo(card?.valueShift);
            const same = card && card.valueShift === s.shift;
            const cueText = (list) => list.map((c) => c.word).join(', ') || 'nothing charged';
            return (
              <div key={s.id} className={`vsm-row${card ? '' : ' is-unlinked'}`} role="row">
                <span role="cell" className="vsm-num">{s.number}</span>
                <span role="cell" className="vsm-slug" title={s.heading}>{s.heading}</span>
                <span role="cell">
                  <span
                    className={`vsm-chip${info.static ? ' is-static' : ''}${s.confidence === 'weak' ? ' is-weak' : ''}`}
                    title={`${info.name} — ${info.hint}\nOpens: ${cueText(s.cues.open)}\nEnds: ${cueText(s.cues.close)}${s.confidence === 'weak' ? '\nLittle to go on: check this one yourself' : ''}`}
                  >
                    {info.label}
                  </span>
                  {s.confidence === 'weak' && <span className="vsm-weak">weak</span>}
                </span>
                <span role="cell">
                  {!card ? <span className="vsm-none">No card</span>
                    : cur ? <span className={`vsm-chip is-current${cur.static ? ' is-static' : ''}`} title={cur.name}>{cur.label}</span>
                      : <span className="vsm-none">—</span>}
                </span>
                <span role="cell" className="vsm-act">
                  {card && (
                    <button
                      type="button"
                      className={`vsm-accept${same ? ' is-done' : ''}`}
                      disabled={same}
                      onClick={() => acceptOne(s)}
                      aria-label={same ? `Scene ${s.number}: set` : `Accept ${info.label} for scene ${s.number}`}
                      title={same ? (applied.has(s.id) ? 'Set' : 'The card already has this') : `Set this card to ${info.label}`}
                    >
                      <Check size={14} strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="vsm-empty">No scene headings yet — write a few scenes first.</p>
      )}

      <footer className="vsm-foot">
        <span className="vsm-note">
          {linked < suggestions.length
            ? `${suggestions.length - linked} ${suggestions.length - linked === 1 ? 'scene has' : 'scenes have'} no card — Import Scenes makes them.`
            : 'Hover a suggestion to see the words it’s based on.'}
        </span>
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!all.size}
          onClick={() => onApply(all, { all: true })}
          title={all.size ? `Set ${all.size} ${all.size === 1 ? 'card' : 'cards'} to the suggested shift` : 'Every card already matches'}
        >
          Apply to All Cards{all.size ? ` (${all.size})` : ''}
        </button>
      </footer>
    </dialog>
  );
}
