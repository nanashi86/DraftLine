import { useEffect, useRef, useState } from 'react';
import { hasNote, noteHistory, notedLines } from '../lib/editorialNotes.js';
import './NotesDrawer.css';

const stamp = (ms) => (ms ? new Date(ms).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '');

/**
 * Margin Notes: the right-dock drawer for private editorial notes. With a note open it shows the
 * line it belongs to, the note editor, and the note's earlier versions; below, every note in the
 * script. Notes never print and are never exported.
 */
export default function NotesDrawer({
  open, blocks, noteId, pageOf, projectTitle, onSelect, onChange, onDelete, onRestoreVersion, onJump, onClose,
}) {
  const panelRef = useRef(null);
  const editorRef = useRef(null);
  const [confirmId, setConfirmId] = useState(null); // the note asking "Delete?"
  const block = noteId ? blocks.find((b) => b.id === noteId) : null;
  const current = block && hasNote(block) ? block : null;
  const lines = notedLines(blocks, pageOf);
  const at = current ? lines.findIndex((l) => l.id === current.id) : -1;
  const history = current ? noteHistory(current) : [];
  const confirmDelete = !!current && confirmId === current.id;
  const setConfirmDelete = (on) => setConfirmId(on && current ? current.id : null);

  // Focus the editor whenever a (different) note opens.
  useEffect(() => {
    if (!open || !current) return undefined;
    const t = requestAnimationFrame(() => {
      const el = editorRef.current;
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true });
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && panelRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        if (confirmId) setConfirmId(null);
        else onClose(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, confirmId]);

  const go = (dir) => {
    if (!lines.length) return;
    const i = at < 0 ? (dir < 0 ? lines.length - 1 : 0) : (at + dir + lines.length) % lines.length;
    onSelect(lines[i].id);
  };

  return (
    <aside
      ref={panelRef}
      className={`pb nd-drawer${open ? ' is-open' : ''}`}
      aria-label="Margin Notes"
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <header className="pb-head">
        <div>
          <h2>Margin Notes</h2>
          <div className="pb-sub">
            {projectTitle?.trim() || 'Untitled'} · {lines.length} {lines.length === 1 ? 'note' : 'notes'} · private — never printed or exported
          </div>
        </div>
        <button type="button" className="btn btn-icon pb-close" onClick={() => onClose(false)} aria-label="Close Margin Notes" title="Close (Esc)">×</button>
      </header>

      <div className="pb-scroll">
        {current ? (
          <section className="nd-current" aria-label="This note">
            <div className="nd-nav">
              <button type="button" className="btn btn-icon" onClick={() => go(-1)} disabled={lines.length < 2} aria-label="Previous note" title="Previous note">‹</button>
              <span>{at + 1} of {lines.length}</span>
              <button type="button" className="btn btn-icon" onClick={() => go(1)} disabled={lines.length < 2} aria-label="Next note" title="Next note">›</button>
              <span className="nd-spacer" />
              {confirmDelete ? (
                <span className="nd-confirm" role="group" aria-label="Delete this note?">
                  Delete note and its history?
                  <button type="button" className="btn nd-danger" onClick={() => { setConfirmDelete(false); onDelete(current.id); }}>Delete</button>
                  <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep</button>
                </span>
              ) : (
                <button type="button" className="btn nd-del" onClick={() => setConfirmDelete(true)}>Delete note</button>
              )}
            </div>
            <button type="button" className="nd-anchor" onClick={() => onJump(current.id)} title="Go to this line in the script">
              <span className="nd-anchor-type">
                {lines[at]?.label}{lines[at]?.page ? ` · p. ${lines[at].page}` : ''}
              </span>
              <span className="nd-anchor-text">{lines[at]?.excerpt}</span>
            </button>
            <textarea
              ref={editorRef}
              className="nd-editor"
              value={current.note}
              placeholder="Editorial feedback, a reminder, a foreshadowing note… only you see it."
              aria-label="Margin note"
              onChange={(e) => onChange(current.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.altKey && e.code === 'KeyN') {
                  e.preventDefault();
                  onClose(true);
                }
                if (e.key !== 'Escape') e.stopPropagation(); // keep editor/global shortcuts out of the note
              }}
            />
            <p className="nd-meta">
              {current.noteAt ? `Edited ${stamp(current.noteAt)}` : 'New note'} · Esc returns to the script
            </p>
            {history.length > 0 && (
              <details className="nd-history" open>
                <summary>History · {history.length} earlier {history.length === 1 ? 'version' : 'versions'}</summary>
                <ol>
                  {history.map((h) => (
                    <li key={`${h.at}-${h.index}`}>
                      <div className="nd-history-head">
                        <time dateTime={new Date(h.at).toISOString()}>{stamp(h.at)}</time>
                        <button type="button" className="nd-link" onClick={() => onRestoreVersion(current.id, h.index)}>Restore</button>
                      </div>
                      <p>{h.text}</p>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
        ) : (
          <p className="nd-hint">
            Hover a line and click <b>＋</b> in the left margin — or press <kbd>Alt+N</kbd>, with words selected to
            quote them — to add a note. Notes are private: they never appear in print, PDFs, or .fountain / .fdx exports.
          </p>
        )}

        {lines.length > 0 && (
          <section className="nd-all" aria-label="All notes">
            <h3>All notes</h3>
            <ol>
              {lines.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`nd-row${l.id === current?.id ? ' is-on' : ''}`}
                    onClick={() => onSelect(l.id)}
                    aria-current={l.id === current?.id ? 'true' : undefined}
                  >
                    <span className="nd-row-head">
                      <span>{l.label}{l.page ? ` · p. ${l.page}` : ''}</span>
                      {l.versions > 0 && <small>{l.versions} earlier</small>}
                    </span>
                    <span className="nd-row-line">{l.excerpt}</span>
                    <span className="nd-row-note">{l.preview}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </aside>
  );
}
