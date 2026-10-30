import { Fragment, useEffect, useRef, useState } from 'react';
import ExpandToggle from './ExpandToggle.jsx';
import { useExpandedPanel } from '../hooks/useExpandedPanel.js';
import { escapeAction } from '../lib/panelExpand.js';
import AutoTextarea from './AutoTextarea.jsx';
import TabIcon from './TabIcon.jsx';
import { RichLine } from './FormattedText.jsx';
import {
  ACT_STRUCTURES, BIBLE_TABS, DEFAULT_BIBLE_TAB, TREATMENT, actsFor, addSection, bibleTabBadge, treatmentTargets,
  importNotes, markdownBlocks, normalizeSynopsis, normalizeTreatment, removeSection, setSynopsisAct, setTreatmentAct,
  storyNotesMarkdown, synopsisHasText, synopsisIndex, treatmentHasText, updateSection,
} from '../lib/bible.js';
import StoryDna from './StoryDna.jsx';
import { storyDnaProgress, DNA_QUESTIONS } from '../lib/storyDna.js';
import './ProjectBibleDrawer.css';
import Select from './Select.jsx';

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

function ImportPanel({ notes, onImport, onCancel, actMode = 3 }) {
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
          <Select
            value={target}
            onChange={setTarget}
            ariaLabel="Import into"
            options={[
              ...notes.sections.map((s) => ({ value: s.id, label: s.title || 'Untitled section' })),
              ...treatmentTargets(actMode, notes.treatment).map((t) => ({ value: t.id, label: t.label })),
            ]}
          />
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

/**
 * A three-act card — Act I: Setup · Act II: Confrontation · Act III: Resolution — each act with
 * its own labelled box when editing, and as three labelled blocks otherwise. The Synopsis and
 * the Treatment are both this card, so they look and behave the same.
 */
function ActsCard({ label, className, acts, value, editing, onToggle, onChange }) {
  return (
    <section className={`pb-section pb-acts-card ${className}`} aria-label={label}>
      <header>
        <span className="pb-section-title pb-fixed-title">{label}</span>
        <button type="button" className="btn pb-mini" onClick={onToggle} aria-pressed={editing}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </header>
      {editing ? (
        <div className="pb-acts">
          {acts.map((a) => (
            <label key={a.key} className="pb-act">
              <span className="micro-label">{a.label}</span>
              <AutoTextarea
                className="pb-section-body pb-act-body"
                value={value[a.key]}
                placeholder={a.placeholder}
                aria-label={`${label}: ${a.short}`}
                data-act={a.key}
                onChange={(e) => onChange(a.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : (
        <div
          className="pb-section-view pb-acts"
          role="button"
          tabIndex={0}
          title="Click to edit"
          onClick={(e) => !e.target.closest('a') && onToggle()}
          onKeyDown={(e) => (e.key === 'Enter' ? onToggle() : null)}
        >
          {acts.map((a) => (
            <div key={a.key} className="pb-act" data-act={a.key}>
              <span className="micro-label">{a.label}</span>
              {value[a.key].trim() ? <MarkdownView text={value[a.key]} /> : <p className="pb-md-empty">Not written yet.</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StoryNotes({ notes, onChange, onUndoable, projectTitle = '', actMode = 3, onActModeChange, onRealignActs }) {
  const [synopsisEditing, setSynopsisEditing] = useState(() => !synopsisHasText(notes.synopsis));
  const [treatmentEditing, setTreatmentEditing] = useState(() => !treatmentHasText(notes.treatment));
  const [copied, setCopied] = useState(false);
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(storyNotesMarkdown(notes, projectTitle, actMode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const [editing, setEditing] = useState(() => new Set(notes.sections.filter((s) => !s.body.trim()).map((s) => s.id)));
  const [importing, setImporting] = useState(false);
  // The Synopsis and, right below it, the Treatment — the same three acts — together, after Pitch.
  const fixedCards = (
    <>
      <ActsCard
        label="Synopsis"
        className="pb-synopsis"
        acts={actsFor('synopsis', actMode, notes.synopsis)}
        value={normalizeSynopsis(notes.synopsis)}
        editing={synopsisEditing}
        onToggle={() => setSynopsisEditing((v) => !v)}
        onChange={(key, text) => onChange(setSynopsisAct(notes, key, text))}
      />
      <ActsCard
        label={TREATMENT.label}
        className="pb-treatment"
        acts={actsFor('treatment', actMode, notes.treatment)}
        value={normalizeTreatment(notes.treatment)}
        editing={treatmentEditing}
        onToggle={() => setTreatmentEditing((v) => !v)}
        onChange={(key, text) => onChange(setTreatmentAct(notes, key, text))}
      />
    </>
  );
  const toggle = (id) => setEditing((e) => {
    const n = new Set(e);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <div className="pb-pane">
      <div className="pb-tools is-end">
        {onActModeChange && (
          <div className="seg seg-sm pb-act-mode" role="radiogroup" aria-label="Acts in the Synopsis and Treatment" title="Synopsis and Treatment in 3 or 4 acts — the same switch as the Scene Board's">
            {ACT_STRUCTURES.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={actMode === n} className={`seg-btn${actMode === n ? ' is-on' : ''}`} onClick={() => onActModeChange(n)}>
                {n} Acts
              </button>
            ))}
          </div>
        )}
        {onRealignActs && actMode === 4 && (
          <button
            type="button"
            className="btn btn-sm pb-realign"
            onClick={onRealignActs}
            title="Re-split Act 2A / 2B in the Synopsis and Treatment: Act 2B starts at the first paragraph naming the first Act 2B scene on the Scene Board, or the midpoint. Text only moves between the two."
          >
            Auto-Align Acts
          </button>
        )}
        <span className="pb-tools-spacer" />
        <button
          type="button"
          className="btn"
          onClick={copyMarkdown}
          title="Copy every note — Logline, Tone, Timeline, Pitch, the three-act Synopsis and Treatment… — as Markdown"
        >
          {copied ? 'Copied ✓' : 'Copy as Markdown'}
        </button>
        <button type="button" className="btn" onClick={() => setImporting((v) => !v)} aria-expanded={importing}>
          Import from Notes
        </button>
      </div>

      {importing && (
        <ImportPanel
          notes={notes}
          actMode={actMode}
          onCancel={() => setImporting(false)}
          onImport={(text, opts) => {
            onUndoable('Imported notes', notes);
            onChange(importNotes(notes, text, opts));
            setImporting(false);
          }}
        />
      )}

      <div className="pb-sections">
        {notes.sections.map((s, i) => {
          const isEditing = editing.has(s.id);
          return (
            <Fragment key={s.id}>
            {i === synopsisIndex(notes.sections) && fixedCards}
            <section className="pb-section">
              <header>
                <input
                  className="pb-section-title"
                  value={s.title}
                  placeholder="Section title"
                  aria-label="Section title"
                  onChange={(e) => onChange(updateSection(notes, s.id, { title: e.target.value }))}
                />
                <button type="button" className="btn pb-mini" onClick={() => toggle(s.id)}>
                  {isEditing ? 'Done' : 'Edit'}
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
            </Fragment>
          );
        })}
        {synopsisIndex(notes.sections) >= notes.sections.length && fixedCards}
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
  open, onClose, projectTitle, storyNotes, onStoryNotesChange, actMode = 3, onActModeChange, onRealignActs,
  storyDna, onStoryDnaChange, dictionary, onDictionaryEdit, tab = DEFAULT_BIBLE_TAB, onTabChange, glossaryTerm = null,
}) {
  const [undo, setUndo] = useState(null); // { message, restore }
  const panelRef = useRef(null);
  // Expanded over the whole workspace (lib/panelExpand.js, hooks/useExpandedPanel.js).
  const [expanded, setExpanded] = useExpandedPanel(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && panelRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        if (escapeAction(expanded) === 'collapse') setExpanded(false); // first Esc collapses, the next one closes
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, expanded, setExpanded]);

  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  return (
    <aside
      ref={panelRef}
      className={`pb${open ? ' is-open' : ''}${expanded ? ' is-expanded' : ''}`}
      aria-label="Story Bible"
      aria-hidden={!open}
      inert={open ? undefined : true}
    >
      <header className="pb-head">
        <div>
          <h2>Story Bible</h2>
          <div className="pb-sub">{projectTitle?.trim() || 'Untitled'} · saved with this script</div>
        </div>
        <div className="pb-head-actions">
          <ExpandToggle expanded={expanded} onToggle={() => setExpanded((x) => !x)} />
          <button type="button" className="btn btn-icon pb-close" onClick={onClose} aria-label="Close the Story Bible" title="Close (Esc)">×</button>
        </div>
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
          <StoryDna dna={storyDna} onChange={onStoryDnaChange} dictionary={dictionary} onDictionaryEdit={onDictionaryEdit} showTerm={glossaryTerm} />
        ) : (
          <StoryNotes
            notes={storyNotes}
            projectTitle={projectTitle}
            actMode={actMode}
            onActModeChange={onActModeChange}
            onRealignActs={onRealignActs}
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
