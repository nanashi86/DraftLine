import { useCallback, useEffect, useRef, useState } from 'react';
import Menu from './Menu.jsx';
import { relativeTime } from '../lib/projectStorage.js';
import './ProjectsDrawer.css';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function NewScriptForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState('');
  return (
    <form
      className="pd-new"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(title.trim() || 'Untitled');
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title of the new script"
        aria-label="Title of the new script"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <button type="submit" className="btn btn-primary">Create</button>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function RenameInput({ initial, onDone }) {
  const [v, setV] = useState(initial);
  const finished = useRef(false);
  const finish = (value) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  };
  return (
    <input
      className="pd-rename"
      autoFocus
      value={v}
      aria-label="Script title"
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => finish(v.trim() || initial)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(v.trim() || initial);
        if (e.key === 'Escape') finish(null);
      }}
    />
  );
}

/**
 * Projects drawer: every script in the local library, most recently edited first.
 * Click a card to switch; ⋮ on a card to rename, duplicate, export or delete it.
 * `live` carries the open script's unsaved title/author/counts so its card is current.
 */
export default function ProjectsDrawer({
  open, activeId, live, loadProjects, onClose, onSwitch, onCreate, onRename, onDuplicate, onExport, onDelete,
}) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setList(await loadProjects());
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not read your projects');
    }
    setNow(Date.now());
  }, [loadProjects]);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    loadProjects().then(
      (l) => {
        if (!live) return;
        setList(l);
        setError(null);
        setNow(Date.now());
      },
      (e) => live && setError(e.message || 'Could not read your projects'),
    );
    const t = setInterval(() => setNow(Date.now()), 30_000);
    // Move focus into the drawer (the active card) so the keyboard follows it.
    const f = requestAnimationFrame(() => panelRef.current?.querySelector('.pd-card.is-active, .pd-card')?.focus());
    return () => {
      live = false;
      clearInterval(t);
      cancelAnimationFrame(f);
    };
  }, [open, loadProjects]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      // Esc closes an open card menu first (the menu handles that), then the drawer.
      const menuOpen = panelRef.current?.querySelector('.menu [aria-expanded="true"]');
      if (e.key === 'Escape' && !creating && !renaming && !menuOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, creating, renaming, onClose]);

  /** Run an action, then re-read the library. */
  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  // The open script's card shows its live (possibly not-yet-saved) state.
  const rows = (list || []).map((p) => (p.id === activeId && live ? { ...p, ...live } : p));
  const count = rows.length;

  return (
    <>
      <div className={`pd-backdrop${open ? ' is-open' : ''}`} onMouseDown={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={`pd${open ? ' is-open' : ''}`}
        aria-label="Projects"
        aria-hidden={!open}
        inert={open ? undefined : true}
      >
        <header className="pd-head">
          <div>
            <h2>Projects</h2>
            <div className="pd-count">{list ? plural(count, 'Script') : 'Loading…'} · saved in this browser</div>
          </div>
          <button type="button" className="btn btn-icon pd-close" onClick={onClose} aria-label="Close projects" title="Close (Esc)">×</button>
        </header>

        <div className="pd-actions">
          {creating ? (
            <NewScriptForm
              onCancel={() => setCreating(false)}
              onCreate={(title) => {
                setCreating(false);
                act(() => onCreate(title));
              }}
            />
          ) : (
            <button type="button" className="btn pd-new-btn" onClick={() => setCreating(true)} disabled={busy}>
              <span aria-hidden="true">+</span> New Script
            </button>
          )}
        </div>

        {error && <p className="pd-error" role="alert">{error}</p>}

        <ul className="pd-list" aria-busy={busy}>
          {rows.map((p) => {
            const isActive = p.id === activeId;
            const title = p.title?.trim() || 'Untitled';
            return (
              <li key={p.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`pd-card${isActive ? ' is-active' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  title={isActive ? 'The script you’re working on' : `Switch to “${title}”`}
                  onClick={() => !busy && renaming !== p.id && act(() => onSwitch(p.id))}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                      e.preventDefault();
                      if (!busy) act(() => onSwitch(p.id));
                    }
                  }}
                >
                  <div className="pd-card-top">
                    {renaming === p.id ? (
                      <RenameInput
                        initial={title}
                        onDone={(v) => {
                          setRenaming(null);
                          if (v && v !== title) act(() => onRename(p.id, v));
                        }}
                      />
                    ) : (
                      <span className="pd-title">{title}</span>
                    )}
                    {isActive && <span className="pd-badge">Active</span>}
                    <div className="pd-more" onClick={(e) => e.stopPropagation()}>
                      <Menu
                        label={<span aria-hidden="true">⋮</span>}
                        caret={false}
                        className="btn btn-icon"
                        align="right"
                        ariaLabel={`Actions for ${title}`}
                        title="Rename, duplicate, export or delete"
                        items={[
                          { label: 'Rename', onSelect: () => setRenaming(p.id) },
                          { label: 'Duplicate', onSelect: () => act(() => onDuplicate(p.id)) },
                          { divider: true },
                          { label: 'Export Final Draft', hint: '.fdx', onSelect: () => onExport(p.id, 'fdx') },
                          { label: 'Export Fountain', hint: '.fountain', onSelect: () => onExport(p.id, 'fountain') },
                          { divider: true },
                          {
                            label: 'Delete…',
                            danger: true,
                            disabled: count <= 1,
                            hint: count <= 1 ? 'only script' : undefined,
                            onSelect: () => act(() => onDelete(p.id, title)),
                          },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="pd-author">{p.author?.trim() ? `by ${p.author.trim()}` : 'No author yet'}</div>
                  <div className="pd-stats">
                    <span>{plural(p.pages ?? 1, 'page')}</span>
                    <span>{plural(p.scenes ?? 0, 'scene')}</span>
                    <span className="pd-when" title={p.updatedAt ? new Date(p.updatedAt).toLocaleString() : ''}>
                      {isActive && live?.dirty ? 'Saving…' : `Last edited ${relativeTime(p.updatedAt, now)}`}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <footer className="pd-foot">
          Scripts are stored in this browser’s local database — nothing is uploaded. Export to keep files or move
          between computers.
        </footer>
      </aside>
    </>
  );
}
