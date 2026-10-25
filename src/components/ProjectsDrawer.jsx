import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import Menu from './Menu.jsx';
import StorageDestination from './StorageDestination.jsx';
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
 * Click a card to switch; ⋮ on a card to rename, duplicate, export or delete it. The padlock beside ⋮
 * locks a script (Project Lock): it can't be deleted, and imports or snapshot restores never overwrite it.
 * `live` carries the open script's unsaved title/author/counts so its card is current.
 */
export default function ProjectsDrawer({
  open, activeId, live, loadProjects, onClose, onSwitch, onCreate, onRename, onDuplicate, onExport, onDelete, onToggleLock, libraryRev = 0,
  storage, // { sync, onChoose, onLink, onDisconnect, onAllow } — the Storage Destination block
  focusStorage = 0, // bumped by the status bar: open on the storage settings
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

  // Re-read when the drawer opens, when a folder is linked, changed or allowed (its scripts join the
  // list), and when the app changes the library itself (libraryRev: e.g. a deletion confirmed in its dialog).
  const syncKey = storage ? `${storage.sync.active}|${storage.sync.folderName}` : '';
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
  }, [open, loadProjects, syncKey, libraryRev]);

  // Opened from the status bar: show the storage settings.
  useEffect(() => {
    if (!open || !focusStorage) return undefined;
    const f = requestAnimationFrame(() => {
      const sd = panelRef.current?.querySelector('.sd');
      sd?.scrollIntoView({ block: 'start' });
      sd?.querySelector('input:checked')?.focus();
    });
    return () => cancelAnimationFrame(f);
  }, [open, focusStorage]);

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
            <div className="pd-count">
              {list ? plural(count, 'Script') : 'Loading…'} · saved in this browser
              {storage?.sync.active ? ` · synced to ${storage.sync.folderName}` : ''}
            </div>
          </div>
          <button type="button" className="btn btn-icon pd-close" onClick={onClose} aria-label="Close projects" title="Close (Esc)">×</button>
        </header>

        {storage && (
          <StorageDestination
            sync={storage.sync}
            onChoose={storage.onChoose}
            onLink={storage.onLink}
            onDisconnect={storage.onDisconnect}
            onAllow={storage.onAllow}
          />
        )}

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
                    {p.source === 'folder' && !isActive && (
                      <span className="pd-badge is-folder" title={`Only in ${storage?.sync.folderName || 'the synced folder'} so far — open it to add it to this browser`}>In folder</span>
                    )}
                    {p.source === 'folder-newer' && !isActive && (
                      <span className="pd-badge is-folder" title="The copy in the synced folder is newer (edited on another computer?) — opening the script loads it">Newer in folder</span>
                    )}
                    {onToggleLock && (
                      <button
                        type="button"
                        className={`pd-lock${p.isLocked ? ' is-locked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!busy) act(() => onToggleLock(p.id));
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-pressed={p.isLocked === true}
                        aria-label={p.isLocked ? `Unlock “${title}”` : `Lock “${title}”`}
                        title={p.isLocked ? 'Project locked (Deletions and overwrites disabled)' : 'Lock project'}
                      >
                        {p.isLocked
                          ? <Lock size={14} strokeWidth={2} aria-hidden />
                          : <LockOpen size={14} strokeWidth={1.75} aria-hidden />}
                      </button>
                    )}
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
                          { label: 'Backup Project', hint: '.draftline', onSelect: () => onExport(p.id, 'draftline') },
                          { divider: true },
                          {
                            label: 'Delete…',
                            danger: true,
                            disabled: count <= 1 || p.isLocked === true,
                            hint: p.isLocked ? 'locked' : count <= 1 ? 'only script' : undefined,
                            title: p.isLocked ? 'Unlock the script (the padlock) to delete it' : undefined,
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
          {storage?.sync.destination === 'folder'
            ? 'Scripts are saved directly to your chosen folder and mirrored locally for instant offline editing.'
            : storage?.sync.supported === false
              ? 'Scripts are saved privately in this browser on this device. Use Backup to keep a copy as a file.'
              : 'Scripts are saved privately in this browser on this device. Link a folder anytime to keep physical files on your drive.'}
        </footer>
      </aside>
    </>
  );
}
