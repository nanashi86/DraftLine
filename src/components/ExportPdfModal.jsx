import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import './ExportPdfModal.css';

const ICON = { size: 15, strokeWidth: 1.75, 'aria-hidden': true };

/**
 * File → PDF: a compact dialog before the compiled PDF downloads. One choice: scene numbers
 * (off for a spec script, on for a production draft). The choice is saved with the script
 * (meta.showSceneNumbers), so it's remembered next time, and Print Script… (Ctrl+P) follows it
 * with no dialog of its own.
 */
export default function ExportPdfModal({ showSceneNumbers, onChange, onDownload, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="xp-modal"
      aria-labelledby="xp-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onDownload();
        }}
      >
        <h2 id="xp-title" className="xp-title">Export PDF</h2>

        <label className="xp-option">
          <input type="checkbox" checked={showSceneNumbers} onChange={(e) => onChange(e.target.checked)} />
          <span>
            <b>Include Scene Numbers (Production Draft)</b>
            <small>Leave unchecked for spec script and competition submissions.</small>
          </span>
        </label>

        <footer className="xp-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn xp-download" autoFocus>
            <Download {...ICON} />
            Download PDF
          </button>
        </footer>
      </form>
    </dialog>
  );
}
