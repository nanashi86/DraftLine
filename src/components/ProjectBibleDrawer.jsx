import { useEffect, useRef, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';
import { RichLine } from './FormattedText.jsx';
import {
  BIBLE_TABS, CHARACTER_FIELDS, DEFAULT_BIBLE_TAB, addCharacter, addSection, bibleTabBadge, filterCharacters,
  importNotes, markdownBlocks, missingFromScript, moveCharacter, removeCharacter, removeSection, sortCharacters,
  updateCharacter, updateSection,
} from '../lib/bible.js';
import StoryDna from './StoryDna.jsx';
import { storyDnaProgress, DNA_QUESTIONS } from '../lib/storyDna.js';
import './ProjectBibleDrawer.css';

// ---- Character Bios -----------------------------------------------------------------------

function CharacterCard({ c, open, canMove, onToggle, onChange, onMove, onDelete, autoFocus }) {
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
            <button type="button" className="btn pb-danger" onClick={onDelete}>Delete character</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CharacterBios({ characters, onChange, speakers, onUndoable }) {
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

// ---- Story Notes ------------------------------------------------------------------------

function MarkdownView({ text }) {
  const blocks = markdownBlocks(text);
  if (!blocks.length) return <p className="pb-md-empty">Nothing here yet — click Edit to write.</p>;
  return (
    <div className="pb-md">
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const H = `h${Math.min(6, b.level + 2)}`;
          return <H key={i}><RichLine text={b.text} /></H>;
        }
        if (b.type === 'hr') return <hr key={i} />;
        if (b.type === 'quote') return <blockquote key={i}><RichLine text={b.text} /></blockquote>;
        if (b.type === 'ul') return <ul key={i}>{b.items.map((t, k) => <li key={k}><RichLine text={t} /></li>)}</ul>;
        if (b.type === 'ol') return <ol key={i} start={b.start}>{b.items.map((t, k) => <li key={k}><RichLine text={t} /></li>)}</ol>;
        return <p key={i}><RichLine text={b.text} /></p>;
      })}
    </div>
  );
}

function ImportPanel({ notes, onImport, onCancel }) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState(notes.sections[notes.sections.length - 1]?.id || '');
  const [mode, setMode] = useState('append');
  const hasHeadings = /^\s{0,3}#{1,3}\s+\S/m.test(text);
  return (
    <div className="pb-import">
      <div className="pb-import-head">
        <b>Import from Notes</b>
        <span>Paste from Docs, Word, Notion, Apple Notes…</span>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Paste your notes here.\n\n# Headings like this can become their own sections.'}
        aria-label="Notes to import"
      />
      <div className="pb-import-opts">
        <label>
          Into
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {notes.sections.map((s) => <option key={s.id} value={s.id}>{s.title || 'Untitled section'}</option>)}
          </select>
        </label>
        <div className="seg seg-sm" role="radiogroup" aria-label="How to import">
          {[['append', 'Append'], ['replace', 'Replace'], ['sections', 'Split by headings']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              className={`seg-btn${mode === id ? ' is-on' : ''}`}
              disabled={id === 'sections' && !hasHeadings}
              title={id === 'sections' ? 'Each # Heading becomes a section (or adds to the section with that name)' : undefined}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="pb-import-foot">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!text.trim()}
          onClick={() => onImport(text, { targetId: target, mode: mode === 'sections' && !hasHeadings ? 'append' : mode })}
        >
          Import
        </button>
      </div>
    </div>
  );
}

function StoryNotes({ notes, onChange, onUndoable }) {
  const [editing, setEditing] = useState(() => new Set(notes.sections.filter((s) => !s.body.trim()).map((s) => s.id)));
  const [importing, setImporting] = useState(false);
  const toggle = (id) => setEditing((e) => {
    const n = new Set(e);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <div className="pb-pane">
      <div className="pb-tools">
        <span className="pb-hint">Markdown: # heading, **bold**, *italic*, - lists</span>
        <button type="button" className="btn" onClick={() => setImporting((v) => !v)} aria-expanded={importing}>
          Import from Notes
        </button>
      </div>

      {importing && (
        <ImportPanel
          notes={notes}
          onCancel={() => setImporting(false)}
          onImport={(text, opts) => {
            onUndoable('Imported notes', notes);
            onChange(importNotes(notes, text, opts));
            setImporting(false);
          }}
        />
      )}

      <div className="pb-sections">
        {notes.sections.map((s) => {
          const isEditing = editing.has(s.id);
          return (
            <section key={s.id} className="pb-section">
              <header>
                <input
                  className="pb-section-title"
                  value={s.title}
                  placeholder="Section title"
                  aria-label="Section title"
                  onChange={(e) => onChange(updateSection(notes, s.id, { title: e.target.value }))}
                />
                <button type="button" className="btn pb-mini" onClick={() => toggle(s.id)}>
                  {isEditing ? 'Preview' : 'Edit'}
                </button>
                <button
                  type="button"
                  className="btn pb-mini pb-x"
                  aria-label={`Remove section ${s.title}`}
                  title="Remove section"
                  onClick={() => {
                    onUndoable(`Removed “${s.title || 'Untitled section'}”`, notes);
                    onChange(removeSection(notes, s.id));
                  }}
                >
                  ×
                </button>
              </header>
              {isEditing ? (
                <AutoTextarea
                  className="pb-section-body"
                  value={s.body}
                  placeholder="Write freely — it saves as you type."
                  aria-label={`${s.title} notes`}
                  onChange={(e) => onChange(updateSection(notes, s.id, { body: e.target.value }))}
                />
              ) : (
                <div
                  className="pb-section-view"
                  role="button"
                  tabIndex={0}
                  title="Click to edit"
                  onClick={(e) => !e.target.closest('a') && toggle(s.id)}
                  onKeyDown={(e) => (e.key === 'Enter' ? toggle(s.id) : null)}
                >
                  <MarkdownView text={s.body} />
                </div>
              )}
            </section>
          );
        })}
      </div>
      <button
        type="button"
        className="btn pb-add-section"
        onClick={() => {
          const { notes: n, section } = addSection(notes);
          onChange(n);
          setEditing((e) => new Set(e).add(section.id));
        }}
      >
        + Add section
      </button>
    </div>
  );
}

// ---- Drawer -----------------------------------------------------------------------------

/**
 * Project Bible: a right-hand drawer with the open project's Character Bios and Story
 * Notes. Everything edits the project in place, so it autosaves with the script and
 * switches with it in the Projects drawer.
 */
export default function ProjectBibleDrawer({
  open, onClose, projectTitle, characters, onCharactersChange, storyNotes, onStoryNotesChange, speakers,
  storyDna, onStoryDnaChange, dictionary, onDictionaryEdit, tab = DEFAULT_BIBLE_TAB, onTabChange,
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

  return (
    <aside
      ref={panelRef}
      className={`pb${open ? ' is-open' : ''}`}
      aria-label="Project Bible"
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <header className="pb-head">
        <div>
          <h2>Project Bible</h2>
          <div className="pb-sub">{projectTitle?.trim() || 'Untitled'} · saved with this script</div>
        </div>
        <button type="button" className="btn btn-icon pb-close" onClick={onClose} aria-label="Close the Bible" title="Close (Esc)">×</button>
      </header>

      <div className="pb-tabs" role="tablist" aria-label="Bible sections">
        {BIBLE_TABS.map((t) => {
          const badge = bibleTabBadge(t.id, {
            characters, dnaAnswered: storyDnaProgress(storyDna), dnaTotal: DNA_QUESTIONS.length,
          });
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`pb-tab${tab === t.id ? ' is-on' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              <span aria-hidden="true">{t.icon}</span> {t.label}{badge != null && <b>{badge}</b>}
            </button>
          );
        })}
      </div>

      <div className="pb-scroll" role="tabpanel">
        {tab === 'dna' ? (
          <StoryDna dna={storyDna} onChange={onStoryDnaChange} dictionary={dictionary} onDictionaryEdit={onDictionaryEdit} />
        ) : tab === 'characters' ? (
          <CharacterBios
            characters={characters}
            onChange={onCharactersChange}
            speakers={speakers}
            onUndoable={(message, prev) => setUndo({ message, restore: () => onCharactersChange(prev) })}
          />
        ) : (
          <StoryNotes
            notes={storyNotes}
            onChange={onStoryNotesChange}
            onUndoable={(message, prev) => setUndo({ message, restore: () => onStoryNotesChange(prev) })}
          />
        )}
      </div>

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
