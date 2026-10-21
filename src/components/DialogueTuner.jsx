import { useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';
import './DialogueTuner.css';

/**
 * Characters → Dialogue tab: pick a character, read every line they speak top-to-bottom, and
 * edit in place. Edits write straight back to the script blocks (same ids), so the main
 * editor and this tab are always two views of one source of truth. `open` is whether the tab
 * is showing (so its text fields can measure themselves on return).
 */
export default function DialogueTuner({
  open,
  analysis,
  pageOfBlock,
  selected,
  onSelect,
  onEditText,
  onJump,
  onHover,
  onRename,
}) {
  const [showContext, setShowContext] = useState(true);
  const [query, setQuery] = useState('');

  const { characterList } = analysis;
  const current = analysis.characters.get(selected) || characterList[0] || null;
  const q = query.trim().toLowerCase();
  const entries = current
    ? current.entries.filter((en) => !q || en.parts.some((p) => p.text.toLowerCase().includes(q)))
    : [];

  return (
    <div className="tuner" aria-label="Dialogue">

      {characterList.length === 0 ? (
        <p className="tuner-empty">No characters yet. Add a Character cue followed by Dialogue and it'll show up here.</p>
      ) : (
        <>
          <div className="tuner-cast" role="listbox" aria-label="Characters">
            {characterList.map((c) => (
              <button
                key={c.name}
                role="option"
                aria-selected={current?.name === c.name}
                className={`pill cast-chip${current?.name === c.name ? ' is-selected' : ''}`}
                onClick={() => onSelect(selected === c.name ? null : c.name)}
                title={selected === c.name ? `Showing ${c.name} in the script — click again (or Esc) to clear` : `Spotlight ${c.name}’s speeches in the script`}
              >
                <span className="cast-name">{c.name}</span>
                <span className="pill-count cast-count">{c.lines}</span>
              </button>
            ))}
          </div>

          {current && (
            <div className="tuner-stats">
              <span><b>{current.lines}</b> lines</span>
              <span><b>{current.words}</b> words</span>
              <span><b>{current.scenes.size}</b> {current.scenes.size === 1 ? 'scene' : 'scenes'}</span>
              <span><b>{current.lines ? Math.round(current.words / current.lines) : 0}</b> avg words/line</span>
              {onRename && (
                <button
                  type="button"
                  className="btn btn-outline tuner-rename"
                  onClick={() => onRename(current.name)}
                  title={`Rename ${current.name} across the script, Scene Board and Story Bible`}
                >
                  Rename…
                </button>
              )}
            </div>
          )}

          <div className="tuner-tools">
            <input
              className="tuner-search"
              type="search"
              placeholder="Filter lines…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="tuner-toggle">
              <input type="checkbox" checked={showContext} onChange={(e) => setShowContext(e.target.checked)} />
              Cue context
            </label>
          </div>

          <div className="tuner-stream">
            {entries.length === 0 && <p className="tuner-empty">No matching lines.</p>}
            {entries.map((en) => (
              <article
                key={en.cue.id}
                className="tune-entry"
                onMouseEnter={() => onHover(en.cue.id)}
                onMouseLeave={() => onHover(null)}
              >
                <header className="tune-meta">
                  <span className="tune-scene">{en.scene ? `SC ${en.scene}` : 'PRE'}</span>
                  <span className="tune-heading" title={en.heading}>{en.heading || 'Before first scene'}</span>
                  {en.extension && <span className="tune-ext">{en.extension}</span>}
                  {en.dual && <span className="tune-dual" title="Dual dialogue">DUAL</span>}
                  {pageOfBlock[en.cue.id] && <span className="tune-page">p.{pageOfBlock[en.cue.id]}</span>}
                  <button className="tune-jump" onClick={() => onJump(en.cue.id)} title="Show in script">
                    Go ↗
                  </button>
                </header>

                {showContext && en.context && (
                  <p className="tune-context">
                    <span>{en.context.name}:</span> {en.context.text}
                  </p>
                )}

                {en.parts.length === 0 && <p className="tune-missing">(cue has no dialogue)</p>}
                {en.parts.map((p) => (
                  <AutoTextarea
                    key={p.id}
                    className={p.type === 'parenthetical' ? 'tune-paren' : 'tune-line'}
                    value={p.text}
                    measureKey={open}
                    spellCheck
                    aria-label={p.type === 'parenthetical' ? 'Parenthetical' : 'Dialogue'}
                    onChange={(e) => onEditText(p.id, e.target.value)}
                    onFocus={() => onHover(p.id)}
                    onBlur={() => onHover(null)}
                  />
                ))}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
