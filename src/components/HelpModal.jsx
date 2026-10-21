import { useEffect, useRef, useState } from 'react';
import { SHORTCUT_SECTIONS as SECTIONS, keycaps } from '../lib/shortcuts.js';
import pkg from '../../package.json';
import './HelpModal.css';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** A shortcut as keycaps, with ⌘ / ⌥ / ⇧ on a Mac. */
function Keys({ combo }) {
  return (
    <span className="hm-keys">
      {keycaps(combo, IS_MAC).map((k, i) => <kbd key={i}>{k}</kbd>)}
    </span>
  );
}

function fmtBytes(n) {
  return n < 1024 ? `${n} bytes` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
}

/** Keyboard Shortcuts or About DraftLine, from the ⋮ menu. */
export default function HelpModal({ kind, storage, onBackup, onClose }) {
  const dialogRef = useRef(null);
  const [lib, setLib] = useState({ count: null, persisted: null, usage: null });

  // About: how many scripts, whether the browser has promised not to evict them, space used.
  useEffect(() => {
    if (kind !== 'about') return;
    storage.countProjects?.().then((count) => setLib((l) => ({ ...l, count })), () => {});
    navigator.storage?.persisted?.().then((persisted) => setLib((l) => ({ ...l, persisted })), () => {});
    navigator.storage?.estimate?.().then(({ usage }) => setLib((l) => ({ ...l, usage })), () => {});
  }, [kind, storage]);

  const askPersist = () => {
    navigator.storage?.persist?.().then((persisted) => setLib((l) => ({ ...l, persisted })), () => {});
  };

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`hm-modal is-${kind}`}
      aria-labelledby="hm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="hm-head">
        <h2 id="hm-title">{kind === 'about' ? 'About DraftLine' : 'Keyboard Shortcuts'}</h2>
        <button type="button" className="btn" onClick={onClose} autoFocus>Close</button>
      </header>

      {kind === 'shortcuts' ? (
        <div className="hm-grid">
          {SECTIONS.map((sec) => (
            <section key={sec.title}>
              <h3>{sec.title}</h3>
              <dl>
                {sec.rows.map(([combo, what]) => (
                  <div key={combo} className="hm-row">
                    <dt><Keys combo={combo} /></dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
              {sec.note && <p className="hm-note">{sec.note}</p>}
            </section>
          ))}
        </div>
      ) : (
        <div className="hm-about">
          <div className="hm-brand">
            <span className="brand-mark" aria-hidden="true">D</span>
            <div>
              <div className="hm-name">DraftLine</div>
              <div className="hm-version">Version {pkg.version}</div>
            </div>
          </div>
          <p>
            A fast, distraction‑free screenwriting app using Courier Prime at 12 pt. Projects save in DraftLine’s
            native <b>.draftline</b> format and export to Fountain or Final Draft (.fdx).
          </p>
          <section className="hm-origin" aria-labelledby="hm-origin-title">
            <h3 id="hm-origin-title">Origin Story</h3>
            <p>
              I began storytelling at eight on my father’s electric typewriter. Decades later, while writing my first
              feature, <em>What Happened to Haiti?</em>, I refused to pay bloated subscriptions and drafted all six
              drafts in raw Google Docs. That grind taught me structure and what tools screenwriters truly need. So I
              teamed up with my AI buddies to build DraftLine: a clean, independent editor with dramatic
              architecture built right in.
            </p>
          </section>
          {onBackup && (
            <div className="hm-backup">
              <button type="button" className="btn btn-primary" onClick={onBackup}>
                Backup Project (.draftline)
              </button>
              <span>
                Downloads this script complete — title page, Scene Board and Story Bible included — to restore here or on
                any other browser.
              </span>
            </div>
          )}
          <dl className="hm-facts">
            <div><dt>Created by</dt><dd>Eric Lemaire Jr.</dd></div>
            <div>
              <dt>Storage</dt>
              <dd>
                {!storage.ok
                  ? 'Not saving — browser storage is blocked or full'
                  : storage.sync?.active
                    ? `Synced folder (${storage.sync.folderName}) · Dual-saved locally`
                    : storage.sync?.needsPermission
                      ? `Synced folder (${storage.sync.folderName}) · paused until you allow access (click the status bar) · Saved locally`
                      : 'Project library in this browser (IndexedDB)'}
                {!storage.sync?.active && !storage.sync?.needsPermission && lib.count != null
                  && ` · ${lib.count} ${lib.count === 1 ? 'script' : 'scripts'}`}
              </dd>
            </div>
            <div><dt>Last saved</dt><dd>{storage.savedAt ? new Date(storage.savedAt).toLocaleString() : 'Not yet'}</dd></div>
            <div>
              <dt>This script</dt>
              <dd>{fmtBytes(storage.bytes)}{lib.usage != null && ` · ${fmtBytes(lib.usage)} used by DraftLine in total`}</dd>
            </div>
            {lib.persisted != null && (
              <div>
                <dt>Protected</dt>
                <dd>
                  {lib.persisted
                    ? 'Yes — the browser won’t clear your scripts to free up space'
                    : (
                      <>
                        Not yet — the browser may clear site data when the disk is nearly full.{' '}
                        <button type="button" className="hm-link" onClick={askPersist}>Ask it to keep them</button>
                      </>
                    )}
                </dd>
              </div>
            )}
            <div><dt>Network</dt><dd>
                {navigator.onLine ? 'Online' : 'Offline'} — {storage.sync?.active
                  ? `DraftLine uploads nothing — if “${storage.sync.folderName}” is a Drive folder, your Drive app syncs it`
                  : 'your script never leaves this computer'}
              </dd></div>
          </dl>
          <p className="hm-note">
            Everything runs locally: nothing is uploaded and no account is needed, so writing works offline. The only
            network use is loading Google Fonts (cached after the first visit). By default, scripts belong to this browser
            profile. If you link a local or Google Drive folder, your scripts and snapshots save directly to disk with every
            edit. Without folder sync, clearing browser site data removes local drafts — so use
            Export (.draftline / .fountain / .fdx) or Backup Project to keep offline copies.
          </p>
        </div>
      )}
    </dialog>
  );
}
