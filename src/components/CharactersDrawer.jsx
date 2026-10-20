import { useEffect, useRef, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';
import DialogueTuner from './DialogueTuner.jsx';
import {
  CHARACTER_FIELDS, CHARACTER_TABS, DEFAULT_CHARACTER_TAB, addCharacter, bibleTabBadge, filterCharacters,
  missingFromScript, moveCharacter, removeCharacter, sortCharacters, updateCharacter,
} from '../lib/bible.js';
import './ProjectBibleDrawer.css';

// ---- Character Bios -----------------------------------------------------------------------

function CharacterCard({ c, open, canMove, onToggle, onChange, onMove, onDelete, onRename, autoFocus }) {
  const nameRef = useRef(null);
  useEffect(() => {
    if (autoFocus) nameRef.current?.focus();
  }, [autoFocus]);
  const name = c.name.trim();
  return (
    <li className={`pb-char${open ? ' is-open' : ''}`}>
      <div className="pb-char-head">
        <button type="button" className="pb-char-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="pb-chev" aria-hidden="true">▸</span>
          <span className="pb-char-name">{name || 'Unnamed character'}</span>
          <span className="pb-char-meta">{[c.role.trim(), c.age.trim()].filter(Boolean).join(' · ')}</span>
        </button>
        {canMove && (
          <span className="pb-move">
            <button type="button" onClick={() => onMove(-1)} aria-label={`Move ${name || 'character'} up`} title="Move up">↑</button>
            <button type="button" onClick={() => onMove(1)} aria-label={`Move ${name || 'character'} down`} title="Move down">↓</button>
          </span>
        )}
      </div>
      {open && (
        <div className="pb-char-body">
          {CHARACTER_FIELDS.map((f) => (
            <label key={f.key} className="pb-field">
              <span>{f.label}</span>
              {f.multiline ? (
                <AutoTextarea
                  value={c[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => onChange({ [f.key]: e.target.value })}
                />
              ) : (
                <input
                  ref={f.key === 'name' ? nameRef : undefined}
                  value={c[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => onChange({ [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <div className="pb-char-foot">
            {onRename && name && (
              <button
                type="button"
                className="btn pb-rename"
                onClick={() => onRename(name)}
                title={`Rename ${name} in cues, dialogue, action, the Beat Board and the Story Bible`}
              >
                Rename across script…
              </button>
            )}
            <button type="button" className="btn pb-danger" onClick={onDelete}>Delete character</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CharacterBios({ characters, onChange, speakers, onUndoable, onRename }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const shown = filterCharacters(characters, query);
  const missing = missingFromScript(characters, speakers);

  const add = (fields = {}) => {
    const { list, character } = addCharacter(characters, fields);
    onChange(list);
    setQuery('');
    setOpenId(character.id);
    setFocusId(character.id);
  };

  return (
    <div className="pb-pane">
      <div className="pb-tools">
        <input
          className="pb-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…"
          aria-label="Filter characters by name"
        />
        <button
          type="button"
          className="btn pb-sort"
          onClick={() => onChange(sortCharacters(characters))}
          disabled={characters.length < 2}
          title="Sort A–Z by name"
        >
          A–Z
        </button>
        <button type="button" className="btn btn-primary" onClick={() => add()}>+ Add Character</button>
      </div>

      {missing.length > 0 && (
        <div className="pb-suggest">
          <span>In the script without a bio:</span>
          {missing.slice(0, 8).map((n) => (
            <button key={n} type="button" className="pb-chip" onClick={() => add({ name: n })} title={`Add a bio for ${n}`}>
              + {n}
            </button>
          ))}
          {missing.length > 8 && <span className="pb-more">and {missing.length - 8} more</span>}
        </div>
      )}

      {characters.length === 0 ? (
        <p className="pb-empty">No characters yet. Add one, or pick a name from the script above.</p>
      ) : shown.length === 0 ? (
        <p className="pb-empty">No character matches “{query}”.</p>
      ) : (
        <ul className="pb-chars">
          {shown.map((c) => (
            <CharacterCard
              key={c.id}
              c={c}
              open={openId === c.id}
              canMove={!query && characters.length > 1}
              autoFocus={focusId === c.id}
              onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))}
              onChange={(patch) => onChange(updateCharacter(characters, c.id, patch))}
              onMove={(dir) => onChange(moveCharacter(characters, c.id, dir))}
              onRename={onRename}
              onDelete={() => {
                onUndoable(`Deleted ${c.name.trim() || 'character'}`, characters);
                onChange(removeCharacter(characters, c.id));
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Drawer -----------------------------------------------------------------------------

/**
 * Characters: a right-hand drawer (sharing the dock with the Story Bible) with two tabs —
 * Bios (profiles, traits, backstory, rename across the script) and Dialogue (every line a
 * character speaks, editable in place). Bios are stored on the project as `characters`.
 */
export default function CharactersDrawer({
  open, onClose, tab = DEFAULT_CHARACTER_TAB, onTabChange, characters, onCharactersChange, speakers,
  onRenameCharacter, dialogue,
}) {
  const [undo, setUndo] = useState(null); // { message, restore }
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && panelRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const speaking = speakers.length;
  return (
    <aside
      ref={panelRef}
      className={`pb pb-characters${open ? ' is-open' : ''}`}
      aria-label="Characters"
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <header className="pb-head">
        <div>
          <h2>Characters</h2>
          <div className="pb-sub">
            {speaking} speaking · {characters.length} {characters.length === 1 ? 'bio' : 'bios'}
          </div>
        </div>
        <button type="button" className="btn btn-icon pb-close" onClick={onClose} aria-label="Close Characters" title="Close (Esc)">×</button>
      </header>

      <div className="pb-tabs" role="tablist" aria-label="Characters sections">
        {CHARACTER_TABS.map((t) => {
          const badge = bibleTabBadge(t.id, { characters, speakers });
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`pb-tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => onTabChange(t.id)}
              title={t.title}
            >
              <span aria-hidden="true">{t.icon}</span> {t.label}{badge != null && <b>{badge}</b>}
            </button>
          );
        })}
      </div>

      {tab === 'dialogue' ? (
        <div className="pb-dialogue" role="tabpanel">
          <DialogueTuner {...dialogue} open={open && tab === 'dialogue'} onRename={onRenameCharacter} />
        </div>
      ) : (
        <div className="pb-scroll" role="tabpanel">
          <CharacterBios
            characters={characters}
            onChange={onCharactersChange}
            speakers={speakers}
            onUndoable={(message, prev) => setUndo({ message, restore: () => onCharactersChange(prev) })}
            onRename={onRenameCharacter}
          />
        </div>
      )}

      {undo && (
        <div className="pb-undo" role="status">
          {undo.message}
          <button
            type="button"
            className="btn"
            onClick={() => {
              undo.restore();
              setUndo(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </aside>
  );
}
