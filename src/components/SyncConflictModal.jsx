import { useEffect, useRef } from 'react';
import './SceneRangeModal.css';

/**
 * The open script's file in the linked folder was saved somewhere else (another computer, through
 * Drive) after this browser's copy was last in step with it, so DraftLine didn't overwrite it
 * (folderSync checkBeforeWrite). The writer picks which version to keep working on; the other one
 * is kept as a snapshot either way, so nothing is lost. Esc decides later: the folder stays
 * untouched and this browser keeps saving locally.
 */
export default function SyncConflictModal({ title, folderName, theirsAt, oursAt, onKeepMine, onUseTheirs, onLater }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);
  const when = (t) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown');
  return (
    <dialog
      ref={dialogRef}
      className="sr-modal sc-modal"
      aria-labelledby="sc-title"
      aria-describedby="sc-desc"
      onCancel={(e) => {
        e.preventDefault();
        onLater();
      }}
    >
      <header className="sr-head">
        <h2 id="sc-title">“{title || 'Untitled'}” changed somewhere else</h2>
        <p id="sc-desc">
          The copy in <b>{folderName || 'your linked folder'}</b> was saved on another computer or app after this one last
          synced, so DraftLine didn’t overwrite it. Your changes are safe in this browser. Choose the version to keep working
          on: the other one is kept as a snapshot (⋮ → View Snapshots).
        </p>
      </header>
      <dl className="sc-versions">
        <div><dt>In the folder</dt><dd>saved {when(theirsAt)}</dd></div>
        <div><dt>In this browser</dt><dd>saved {when(oursAt)}</dd></div>
      </dl>
      <footer className="sr-foot">
        <button type="button" className="btn" onClick={onLater}>Decide later</button>
        <span className="sr-spacer" />
        <button type="button" className="btn" onClick={onUseTheirs}>Use the folder’s version</button>
        <button type="button" className="btn btn-primary" onClick={onKeepMine} autoFocus>Keep this version</button>
      </footer>
    </dialog>
  );
}
