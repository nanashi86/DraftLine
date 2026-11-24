import { useEffect, useRef } from 'react';
import '../SceneRangeModal.css';

/**
 * Plan → Stripboard → ⋮ → Renumber Cast… (only once a shooting day has fixed the cast numbers). The
 * numbers belong to the whole project, not to a day, so this lives with the Stripboard's own tools.
 * Renumbering is never done silently: this asks first, and Ctrl+Z takes it back.
 *   count: how many characters have a number
 */
export default function RenumberCastModal({ count, onConfirm, onClose, returnFocus = null }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={dialogRef}
      className="sr-modal rc-modal"
      aria-labelledby="rc-title"
      aria-describedby="rc-desc"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="sr-head">
        <h2 id="rc-title">Renumber cast?</h2>
        <p id="rc-desc">
          Cast numbers have stayed fixed since the first shooting day. Renumbering gives all {count} characters a new number
          by how many lines they have now (1 = most). Schedules, call sheets or breakdowns you’ve already shared will no
          longer match. Ctrl+Z undoes it.
        </p>
      </header>
      <footer className="sr-foot">
        <span className="sr-spacer" />
        <button type="button" className="btn" onClick={onClose} autoFocus>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={() => { onConfirm(); onClose(); }}>Renumber</button>
      </footer>
    </dialog>
  );
}
