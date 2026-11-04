import { useEffect, useRef } from 'react';
import './SceneRangeModal.css';

/**
 * Import Scenes → "Clear Board…": the failsafe when the board has gone wrong. Removes every card
 * (titles, synopses, tags, Value Shifts); the script is never touched. Undo follows on the board.
 */
export default function ClearBoardModal({ count, onClear, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="sr-modal cb-modal"
      aria-labelledby="cb-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="sr-head">
        <h2 id="cb-title">Clear the Scene Board?</h2>
        <p>
          This removes all {count} {count === 1 ? 'card' : 'cards'}, with their titles, synopses, tags and Value Shifts.
          Your script isn’t touched. Run <b>Import Scenes</b> afterwards to start over from the script.
        </p>
      </header>
      <footer className="sr-foot">
        <span className="sr-spacer" />
        <button type="button" className="btn" onClick={onClose} autoFocus>Cancel</button>
        <button type="button" className="btn btn-primary cb-clear" onClick={onClear}>Clear Board</button>
      </footer>
    </dialog>
  );
}
