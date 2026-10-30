import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import './ExportPdfModal.css';

const ICON = { size: 15, strokeWidth: 1.75, 'aria-hidden': true };

/**
 * File → Final Draft: a compact dialog before the .fdx downloads (the same shape as Export PDF).
 * One choice: include margin notes as Final Draft Script Notes. Off by default, since margin notes
 * are private editorial notes; the choice is saved with the script (meta.fdxIncludeNotes).
 *   noteCount — how many margin notes the script has (the option is disabled when there are none)
 */
export default function ExportFdxModal({ includeNotes, noteCount = 0, onChange, onDownload, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const none = noteCount === 0;
  return (
    <dialog
      ref={dialogRef}
      className="xp-modal"
      aria-labelledby="xf-title"
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
        <h2 id="xf-title" className="xp-title">Export Final Draft</h2>

        <label className="xp-option">
          <input type="checkbox" checked={includeNotes && !none} disabled={none} onChange={(e) => onChange(e.target.checked)} />
          <span>
            <b>Include margin notes (as Final Draft Script Notes)</b>
            <small>
              {none
                ? 'This script has no margin notes.'
                : `${noteCount} ${noteCount === 1 ? 'note' : 'notes'} in this script. Leave unchecked when the script goes to readers, contests or productions.`}
            </small>
          </span>
        </label>

        <footer className="xp-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn xp-download" autoFocus>
            <Download {...ICON} />
            Download .fdx
          </button>
        </footer>
      </form>
    </dialog>
  );
}
