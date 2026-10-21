import { useEffect, useRef } from 'react';
import { deleteWarning } from '../lib/deleteConfirm.js';
import { TRASH_DIR } from '../lib/folderSync.js';
import './DeleteProjectModal.css';

/**
 * "Delete Screenplay?" — nothing is deleted until Permanently Delete is pressed. Cancel (focused when
 * the dialog opens, so a stray Enter never deletes), Esc or a click outside closes it with nothing changed.
 *
 * stage 'confirm': the confirmation. With a linked folder the .draftline file is moved into the
 *   folder's Trash/ (recoverable), not erased.
 * stage 'hard': the move to Trash failed for `failed` files, which are still in the folder. Only
 *   here can the writer choose to erase them for good; keeping them is the default.
 */
export default function DeleteProjectModal({ title, synced = false, folderName = '', stage = 'confirm', failed = [], busy = false, onConfirm, onHardDelete, onCancel }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dp-modal"
      aria-labelledby="dp-title"
      aria-describedby="dp-warning"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current && !busy) onCancel();
      }}
    >
      {stage === 'confirm' ? (
        <div>
          <h2 id="dp-title">Delete Screenplay?</h2>
          <p id="dp-warning" className="dp-warning">{deleteWarning(title, { synced })}</p>
          {synced && (
            <p className="dp-note">
              The file is moved into the <strong>{TRASH_DIR}</strong> folder inside “{folderName}”, so you can still get it back from there.
            </p>
          )}
          <div className="dp-actions">
            <button ref={cancelRef} type="button" className="btn dp-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className="btn dp-delete" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : 'Permanently Delete'}</button>
          </div>
        </div>
      ) : (
        <div>
          <h2 id="dp-title">Couldn’t move the file to Trash</h2>
          <p id="dp-warning" className="dp-warning">
            “{title}” is gone from this browser, but {failed.length === 1 ? 'its file' : 'these files'} couldn’t be moved into {TRASH_DIR} and{' '}
            {failed.length === 1 ? 'is' : 'are'} still in “{folderName}”: {failed.join(', ')}.
          </p>
          <p className="dp-note">
            If you keep {failed.length === 1 ? 'it' : 'them'}, the script will come back from the folder the next time DraftLine opens. Deleting erases {failed.length === 1 ? 'it' : 'them'} for good.
          </p>
          <div className="dp-actions">
            <button type="button" className="btn dp-cancel" onClick={onCancel} disabled={busy} autoFocus>Keep the file</button>
            <button type="button" className="btn dp-delete" onClick={onHardDelete} disabled={busy}>Delete permanently</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
