import { useEffect, useRef, useState } from 'react';
import { defaultRevisionLabel, revisionSummary, revisionsNewestFirst } from '../lib/revisions.js';
import './Snapshots.css';

const when = (iso) => new Date(iso).toLocaleString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

/** A small modal shell (native <dialog>): Esc and a click on the backdrop close it. */
function Dialog({ className = '', labelledBy, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sn-modal ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

/** Snapshot → name the checkpoint (defaults to "Draft - [time]") and save it. */
export function SnapshotPrompt({ count, onSave, onViewAll, onClose }) {
  const [placeholder] = useState(() => defaultRevisionLabel(new Date()));
  const [label, setLabel] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <Dialog labelledBy="sn-title" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(label.trim() || placeholder);
        }}
      >
        <header className="sn-head">
          <h2 id="sn-title">Take a snapshot</h2>
          <p>Saves this draft — script, title page, Scene Board and Story Bible — as a checkpoint you can restore later.</p>
        </header>
        <label className="sn-field">
          <span>Label</span>
          <input
            ref={inputRef}
            value={label}
            placeholder={placeholder}
            maxLength={120}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Snapshot label"
          />
        </label>
        <footer className="sn-actions">
          {count > 0 && (
            <button type="button" className="sn-link" onClick={onViewAll}>
              View Snapshots ({count})
            </button>
          )}
          <span className="sn-spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save Snapshot</button>
        </footer>
      </form>
    </Dialog>
  );
}

/** Restore → put a snapshot back, offering to snapshot the current draft first (on by default). */
export function RestorePrompt({ revision, dirty, onRestore, onClose }) {
  const [keep, setKeep] = useState(true);
  return (
    <Dialog labelledBy="sn-restore-title" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRestore(keep);
        }}
      >
        <header className="sn-head">
          <h2 id="sn-restore-title">Restore “{revision.label}”?</h2>
          <p>
            The script, title page, Scene Board and Story Bible go back to how they were on {when(revision.timestamp)}.
            {' '}Ctrl+Z undoes the restore.
          </p>
        </header>
        <label className="sn-check">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} autoFocus />
          <span>
            <b>Snapshot the current draft first</b>
            <small>{dirty ? 'Recommended — you have changes that aren’t in any snapshot yet.' : 'Keeps what’s on screen now as a snapshot you can come back to.'}</small>
          </span>
        </label>
        <footer className="sn-actions">
          <span className="sn-spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{keep ? 'Snapshot & Restore' : 'Restore'}</button>
        </footer>
      </form>
    </Dialog>
  );
}

/** View Snapshots: the slide-out list, newest first, each with Restore and Delete. */
export function SnapshotsDrawer({
  open, revisions, projectTitle, onClose, onSnapshot, onRestore, onDelete,
}) {
  const panelRef = useRef(null);
  const [confirmId, setConfirmId] = useState(null);
  const list = revisionsNewestFirst(revisions);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && panelRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        if (confirmId) setConfirmId(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, confirmId]);

  return (
    <aside
      ref={panelRef}
      className={`pb sn-drawer${open ? ' is-open' : ''}`}
      aria-label="Snapshots"
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <header className="pb-head">
        <div>
          <h2>Snapshots</h2>
          <div className="pb-sub">
            {projectTitle?.trim() || 'Untitled'} · {list.length} {list.length === 1 ? 'snapshot' : 'snapshots'} · saved with this script
          </div>
        </div>
        <button type="button" className="btn btn-icon pb-close" onClick={onClose} aria-label="Close Snapshots" title="Close (Esc)">×</button>
      </header>
      <div className="sn-tools">
        <button type="button" className="btn btn-primary" onClick={onSnapshot}>+ Snapshot this draft</button>
      </div>
      <div className="pb-scroll">
        {list.length === 0 ? (
          <p className="pb-empty sn-empty">
            No snapshots yet. Take one before a big rewrite — you can always come back to it. Snapshots are kept with the
            script and included in .draftline backups.
          </p>
        ) : (
          <ol className="sn-list">
            {list.map((r, i) => (
              <li key={r.id} className="sn-item" data-revision={r.id}>
                <div className="sn-item-text">
                  <b title={r.label}>{r.label}</b>
                  <time dateTime={r.timestamp}>{when(r.timestamp)}{i === 0 && <span className="sn-latest">Latest</span>}</time>
                  <small>{revisionSummary(r)}</small>
                </div>
                {confirmId === r.id ? (
                  <div className="sn-item-actions is-confirm" role="group" aria-label={`Delete ${r.label}?`}>
                    <span>Delete?</span>
                    <button type="button" className="btn sn-danger" onClick={() => { setConfirmId(null); onDelete(r.id); }}>Delete</button>
                    <button type="button" className="btn" onClick={() => setConfirmId(null)}>Keep</button>
                  </div>
                ) : (
                  <div className="sn-item-actions">
                    <button type="button" className="btn btn-outline" onClick={() => onRestore(r.id)} aria-label={`Restore ${r.label}`}>Restore</button>
                    <button type="button" className="btn" onClick={() => setConfirmId(r.id)} aria-label={`Delete ${r.label}`}>Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
