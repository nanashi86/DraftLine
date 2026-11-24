import { useEffect, useRef } from 'react';
import './SceneRangeModal.css';

/**
 * Two versions of the open script, and the writer picks which to keep working on. The other one is
 * kept as a snapshot (⋮ → View Snapshots), so nothing is lost.
 *
 *   source 'folder' (default): its file in the linked folder was saved somewhere else (another computer,
 *     through Drive) after this browser's copy was last in step with it, so DraftLine didn't overwrite it
 *     (folderSync checkBeforeWrite). Esc decides later: the folder stays untouched and this browser keeps
 *     saving locally.
 *   source 'tab': another tab or window of DraftLine saved it while this one had unsaved changes, so
 *     neither was written over (projectStorage ConflictError). This tab doesn't save until the writer
 *     chooses, so there's no "Decide later".
 *   source 'deleted': it was deleted in another tab or window while open here (or a closed tab left
 *     unsaved changes to it). Restore brings it back from this version; the other choice lets it go,
 *     and says plainly that this tab's unsaved changes go with it.
 *     With `closedTab`: a tab that closed (or crashed) left unsaved changes to a script deleted since.
 * `busy` while a choice is being saved; `dirty` (deleted only): this version has unsaved changes.
 */
export default function SyncConflictModal({
  title, folderName, theirsAt, oursAt, onKeepMine, onUseTheirs, onLater, source = 'folder', busy = false, dirty = false, closedTab = false,
}) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    d?.querySelector('.btn-primary')?.focus(); // showModal focuses the first button; the safe choice is the primary one
  }, []);
  const when = (t) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown');
  const name = `“${title || 'Untitled'}”`;
  return (
    <dialog
      ref={dialogRef}
      className="sr-modal sc-modal"
      aria-labelledby="sc-title"
      aria-describedby="sc-desc"
      onCancel={(e) => {
        e.preventDefault();
        if (source === 'folder') onLater();
      }}
    >
      {source === 'folder' && (
        <>
          <header className="sr-head">
            <h2 id="sc-title">{name} changed somewhere else</h2>
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
        </>
      )}
      {source === 'tab' && (
        <>
          <header className="sr-head">
            <h2 id="sc-title">{name} changed in another tab</h2>
            <p id="sc-desc">
              It was saved in another DraftLine tab or window while this one had unsaved changes, so neither was overwritten.
              Choose the version to keep working on: the other one will be kept as a snapshot (⋮ → View Snapshots).
            </p>
          </header>
          <dl className="sc-versions">
            <div><dt>In the other tab</dt><dd>saved {when(theirsAt)}</dd></div>
            <div><dt>In this tab</dt><dd>unsaved changes</dd></div>
          </dl>
          <footer className="sr-foot">
            <span className="sr-spacer" />
            <button type="button" className="btn" onClick={onUseTheirs} disabled={busy}>Use the other tab’s version</button>
            <button type="button" className="btn btn-primary" onClick={onKeepMine} disabled={busy} autoFocus>Keep this version</button>
          </footer>
        </>
      )}
      {source === 'deleted' && (
        <>
          <header className="sr-head">
            <h2 id="sc-title">{name} was deleted in another tab</h2>
            <p id="sc-desc">
              {closedTab
                ? 'It was deleted in another DraftLine tab or window, but a tab that closed had changes to it that weren’t saved. Restore it with those changes (it goes back into Projects), or let them go.'
                : dirty
                  ? 'It was deleted in another DraftLine tab or window, and this tab has changes to it that aren’t saved. Restore it to keep working on it, or let it go along with those changes.'
                  : 'It was deleted in another DraftLine tab or window. Restore it to keep working on it here, or close it.'}
            </p>
          </header>
          <footer className="sr-foot">
            <span className="sr-spacer" />
            <button type="button" className="btn" onClick={onUseTheirs} disabled={busy}>{dirty ? 'Discard these changes' : 'Close it'}</button>
            <button type="button" className="btn btn-primary" onClick={onKeepMine} disabled={busy} autoFocus>Restore it</button>
          </footer>
        </>
      )}
    </dialog>
  );
}
