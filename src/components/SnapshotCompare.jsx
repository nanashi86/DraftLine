import { useEffect, useMemo, useState } from 'react';
import { foldRows } from '../lib/scriptDiff.js';
import { diffScriptsAsync } from '../lib/scriptDiffAsync.js';
import { CompareRows } from './CompareRows.js';
import { Dialog } from './Snapshots.jsx';
import { snapshotTime as when } from '../lib/revisions.js';
import './SnapshotCompare.css';

const MODE_KEY = 'draftline.compareMode';
const readMode = () => {
  try { return localStorage.getItem(MODE_KEY) === 'split' ? 'split' : 'unified'; } catch { return 'unified'; }
};
const saveMode = (m) => {
  try { localStorage.setItem(MODE_KEY, m); } catch { /* private window: just this session */ }
};

const count = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * Snapshots → Compare: a snapshot's script against the current draft, read-only, in its own
 * modal over the Snapshots list. Inline or Side by Side; Close Comparison (or Esc) goes back
 * to the list. The diff runs off the main thread (scriptDiffAsync); nothing here can change
 * the script, the snapshot or what's saved.
 */
export default function SnapshotCompare({ revision, current, onClose }) {
  const [mode, setMode] = useState(readMode);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  // What's on screen when Compare was clicked: the modal makes the editor inert while it's open.
  const [draft] = useState(current);

  useEffect(() => {
    const ctrl = new AbortController();
    diffScriptsAsync(revision.script, draft, { signal: ctrl.signal }).then(
      (r) => setResult(r),
      (err) => { if (err?.name !== 'AbortError') setError(err); },
    );
    return () => ctrl.abort();
  }, [revision, draft]);

  const rows = useMemo(() => (result ? foldRows(result.rows, { open }) : []), [result, open]);
  const pick = (m) => { setMode(m); saveMode(m); };
  const s = result?.stats;
  const identical = s && !s.added && !s.deleted && !s.changed;

  return (
    <Dialog className="sn-compare" labelledBy="df-title" onClose={onClose}>
      <header className="df-head">
        <div className="df-title">
          <h2 id="df-title">Compare “{revision.label}”</h2>
          <p>
            Snapshot from {when(revision.timestamp)} → the current draft. Script only, read-only: nothing here
            changes your draft or the snapshot.
          </p>
        </div>
        <button type="button" className="btn" onClick={onClose} autoFocus>Close Comparison</button>
      </header>
      <div className="df-bar">
        <div className="df-modes" role="group" aria-label="Comparison view">
          <button type="button" className={mode === 'unified' ? 'is-on' : ''} aria-pressed={mode === 'unified'} onClick={() => pick('unified')}>Inline</button>
          <button type="button" className={mode === 'split' ? 'is-on' : ''} aria-pressed={mode === 'split'} onClick={() => pick('split')}>Side by Side</button>
        </div>
        <div className="df-stats" aria-live="polite">
          {!result && !error && <span className="df-busy">Comparing…</span>}
          {error && <span className="df-error">Couldn’t compare: {error.message}</span>}
          {identical && <span>No changes to the script since this snapshot</span>}
          {s && !identical && (
            <>
              {s.added > 0 && <span className="df-chip is-add">+{count(s.added, 'added', 'added')}</span>}
              {s.deleted > 0 && <span className="df-chip is-del">−{count(s.deleted, 'deleted', 'deleted')}</span>}
              {s.changed > 0 && <span className="df-chip is-change">~{count(s.changed, 'changed', 'changed')}</span>}
            </>
          )}
        </div>
      </div>
      <div className="df-scroll" aria-busy={!result && !error}>
        {result && (
          <CompareRows
            rows={rows}
            mode={mode}
            oldLabel={`Snapshot · ${revision.label}`}
            newLabel="Current draft"
            onOpenFold={(from) => setOpen((o) => new Set(o).add(from))}
          />
        )}
      </div>
    </Dialog>
  );
}
