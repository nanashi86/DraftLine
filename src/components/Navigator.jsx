import { useEffect, useRef, useState } from 'react';
import './Navigator.css';

/**
 * Left sidebar listing every scene in order with its number, start page and length
 * in eighths. Clicking a scene scrolls the editor to it.
 */
export default function Navigator({ open, scenes, pageCount, currentSceneId, onJump, onClose, coverVisible, onShowCover }) {
  const [query, setQuery] = useState('');
  const listRef = useRef(null);
  const q = query.trim().toLowerCase();
  const visible = q
    ? scenes.filter((s) => s.heading.toLowerCase().includes(q) || s.snippet.toLowerCase().includes(q))
    : scenes;

  // Keep the current scene in view as the writer moves through the script.
  useEffect(() => {
    if (!open || !currentSceneId) return;
    const el = listRef.current?.querySelector(`[data-scene="${currentSceneId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, currentSceneId]);

  return (
    <aside className={`nav${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open} aria-label="Scenes">
      <header className="nav-head">
        <div>
          <h2>Scenes</h2>
          <p className="nav-sub">
            {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} title="Collapse (Alt+S)" aria-label="Collapse scene list">
          ‹
        </button>
      </header>

      <div className="nav-tools">
        <input
          className="nav-search"
          type="search"
          placeholder="Find a scene…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ol className="nav-list" ref={listRef}>
        {!q && (
          <li>
            <button className="nav-item nav-cover" onClick={onShowCover} title="Show the title page above Page 1">
              <span className="nav-num">0</span>
              <span className="nav-body">
                <span className="nav-heading">Title Page</span>
                <span className="nav-snippet">{coverVisible ? 'Showing above Page 1' : 'Click to view at full size'}</span>
              </span>
              <span className="nav-meta"><span>p.0</span></span>
            </button>
          </li>
        )}
        {scenes.length === 0 && <li className="nav-empty">No scene headings yet.</li>}
        {scenes.length > 0 && visible.length === 0 && <li className="nav-empty">No matches.</li>}
        {visible.map((s) => (
          <li key={s.id}>
            <button
              data-scene={s.id}
              className={`nav-item${s.id === currentSceneId ? ' is-current' : ''}`}
              onClick={() => onJump(s.id)}
            >
              <span className="nav-num">{s.number}</span>
              <span className="nav-body">
                <span className="nav-heading">{s.heading || 'Untitled scene'}</span>
                {s.snippet && <span className="nav-snippet">{s.snippet}</span>}
              </span>
              <span className="nav-meta">
                <span title={`Starts on page ${s.page}`}>p.{s.page}</span>
                <span className="nav-len" title="Scene length in eighths of a page">{s.length}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
