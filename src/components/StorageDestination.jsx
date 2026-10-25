import { useState } from 'react';

const ago = (ts) => {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/**
 * Storage Destination (top of the Projects drawer): where scripts are kept.
 *   Standalone (This Device Only) — always; the default.
 *   Synced Folder (Local Disk / Cloud) — only in browsers with the File System Access API. Its folder
 *   status and actions (Allow access · Change Folder… · Disconnect, or Link Folder…) sit inside its card.
 * Every save goes to the browser first either way; the folder gets a .draftline copy of each
 * script, and Snapshots/ a file per snapshot.
 */
export default function StorageDestination({ sync, onChoose, onLink, onDisconnect, onAllow }) {
  const [busy, setBusy] = useState(false);
  const run = (fn) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const folder = sync.destination === 'folder';

  return (
    <section className="sd" aria-labelledby="sd-title">
      <h3 id="sd-title" className="sd-title micro-label">Storage Destination</h3>
      <div className="sd-options" role="radiogroup" aria-labelledby="sd-title">
        <div className={`sd-card${!folder ? ' is-on' : ''}`}>
          <label className="sd-option">
            <input type="radio" name="sd-dest" checked={!folder} disabled={busy} onChange={run(() => onChoose('browser'))} />
            <span>
              <b>Standalone (This Device Only)</b>
              <small>Scripts stay private in this browser. No external setup required.</small>
            </span>
          </label>
        </div>
        {sync.supported && (
          <div className={`sd-card${folder ? ' is-on' : ''}`}>
            <label className="sd-option">
              <input type="radio" name="sd-dest" checked={folder} disabled={busy} onChange={run(() => onChoose('folder'))} />
              <span>
                <b>Synced Folder (Local Disk / Cloud)</b>
                <small>Saves scripts directly as .draftline files in a folder you choose — link a Google Drive or local folder to keep your files permanent.</small>
              </span>
            </label>

            {/* The folder's status and actions live inside its card, outside the <label> so a button click never toggles the radio. */}
            {sync.linked ? (
              <div className={`sd-folder${sync.needsPermission ? ' is-warn' : ''}`}>
                <div className="sd-folder-name">
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                  <span>Linked: <b>{sync.folderName}</b></span>
                </div>
                <div className="sd-folder-state">
                  {sync.needsPermission
                    ? 'The browser needs your OK to write to this folder again.'
                    : !folder
                      ? 'Not syncing — select this option to turn it back on.'
                      : sync.error
                        ? `Paused: ${sync.error}`
                        : sync.lastSyncedAt ? `Synced ${ago(sync.lastSyncedAt)} · snapshots go in ${sync.folderName}/Snapshots` : `Snapshots go in ${sync.folderName}/Snapshots`}
                  {!sync.persisted && ' · This browser won’t remember the folder after a reload.'}
                </div>
                <div className="sd-buttons">
                  {sync.needsPermission && <button type="button" className="btn btn-primary" disabled={busy} onClick={run(onAllow)}>Allow access</button>}
                  <button type="button" className="btn" disabled={busy} onClick={run(onLink)}>Change Folder…</button>
                  <button type="button" className="btn" disabled={busy} onClick={run(onDisconnect)}>Disconnect</button>
                </div>
              </div>
            ) : (
              <div className="sd-buttons sd-link">
                <button type="button" className="btn" disabled={busy} onClick={run(onLink)}>Link Folder…</button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
