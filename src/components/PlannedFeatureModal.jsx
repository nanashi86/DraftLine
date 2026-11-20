import { useEffect, useRef } from 'react';
import { PLANNED_FEATURES } from '../lib/plannedFeatures.js';
import './SceneRangeModal.css';

/**
 * A planned feature's short preview: its name, who it's planned for, one line, a sentence and Close.
 * Informational only: it reads and changes nothing (no view switch, no project data), and it only
 * ever opens because the writer clicked its tab or menu item. Closing puts focus back on what opened it.
 */
export default function PlannedFeatureModal({ id, onClose, returnFocus = null }) {
  const dialogRef = useRef(null);
  const feature = PLANNED_FEATURES[id];

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);

  if (!feature) return null;
  return (
    <dialog
      ref={dialogRef}
      className="sr-modal pf-modal"
      aria-labelledby="pf-title"
      aria-describedby="pf-desc"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="sr-head">
        <h2 id="pf-title">{feature.title}</h2>
        <p className="pf-status">{feature.status}</p>
      </header>
      <div className="pf-desc" id="pf-desc">
        <p className="pf-headline">{feature.headline}</p>
        <p>{feature.body}</p>
        {feature.note && <p className="pf-note">{feature.note}</p>}
      </div>
      <footer className="sr-foot">
        <span className="sr-spacer" />
        <button type="button" className="btn" onClick={onClose} autoFocus>Close</button>
      </footer>
    </dialog>
  );
}
