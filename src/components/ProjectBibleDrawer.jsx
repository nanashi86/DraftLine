import { useEffect, useRef, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';
import TabIcon from './TabIcon.jsx';
import { RichLine } from './FormattedText.jsx';
import {
  BIBLE_TABS, DEFAULT_BIBLE_TAB, addSection, bibleTabBadge, importNotes, markdownBlocks, removeSection, updateSection,
} from '../lib/bible.js';
import StoryDna from './StoryDna.jsx';
import { storyDnaProgress, DNA_QUESTIONS } from '../lib/storyDna.js';
import './ProjectBibleDrawer.css';

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
      <div className="pb-tools is-end">
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
 * Story Bible: a right-hand drawer with two tabs — DNA (Blueprint & Glossary)
 * and Notes. Character bios live in the Characters drawer. Everything edits the
 * project in place, so it autosaves with the script and switches with it in Projects.
 */
export default function ProjectBibleDrawer({
  open, onClose, projectTitle, storyNotes, onStoryNotesChange,
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
      aria-label="Story Bible"
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <header className="pb-head">
        <div>
          <h2>Story Bible</h2>
          <div className="pb-sub">{projectTitle?.trim() || 'Untitled'} · saved with this script</div>
        </div>
        <button type="button" className="btn btn-icon pb-close" onClick={onClose} aria-label="Close the Story Bible" title="Close (Esc)">×</button>
      </header>

      <div className="pb-tabs" role="tablist" aria-label="Story Bible sections">
        {BIBLE_TABS.map((t) => {
          const badge = bibleTabBadge(t.id, { dnaAnswered: storyDnaProgress(storyDna), dnaTotal: DNA_QUESTIONS.length });
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
              <TabIcon name={t.id} />{t.label}{badge != null && <b>{badge}</b>}
            </button>
          );
        })}
      </div>

      <div className="pb-scroll" role="tabpanel">
        {tab === 'dna' ? (
          <StoryDna dna={storyDna} onChange={onStoryDnaChange} dictionary={dictionary} onDictionaryEdit={onDictionaryEdit} />
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
