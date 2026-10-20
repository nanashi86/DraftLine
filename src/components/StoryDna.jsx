import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AutoTextarea from './AutoTextarea.jsx';
import {
  CONFLICT_TYPES, DNA_QUESTIONS, GENRES, addDevice, plotDeviceLayout, removeDevice, setAnswer, setDevice,
  setField, storyDnaProgress, toggleGenre,
} from '../lib/storyDna.js';
import { dictionaryEntry, searchDictionary } from '../lib/structureDictionary.js';
import { TIP_MAX_WIDTH, clipToViewport, placeTooltip } from '../lib/tooltip.js';
import { DNA_VIEWS } from '../lib/bible.js';

/**
 * (i) with the term's Glossary definition on hover / focus; click opens the entry.
 * The definition is drawn in a fixed layer (a portal on <body>) and placed with
 * placeTooltip, so the drawer's edges and scrolling can never clip it.
 */
function InfoTip({ entry, onOpen }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!open || !btn || !pop) return;
    const drawer = btn.closest('.pb')?.getBoundingClientRect() ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const bounds = clipToViewport(drawer, window.innerWidth, window.innerHeight);
    pop.style.width = `${Math.min(TIP_MAX_WIDTH, bounds.right - bounds.left - 16)}px`;
    const r = pop.getBoundingClientRect();
    const at = placeTooltip(btn.getBoundingClientRect(), { width: r.width, height: r.height }, bounds);
    Object.assign(pop.style, { left: `${at.left}px`, top: `${at.top}px`, width: `${at.width}px`, visibility: 'visible' });
    pop.dataset.placement = at.placement;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const hide = () => setOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', hide, true); // the drawer scrolled: the anchor moved
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!entry) return null;
  return (
    <span className="dna-tip">
      <button
        ref={btnRef}
        type="button"
        className="dna-info"
        aria-label={`${entry.term}: definition`}
        aria-describedby={open ? id : undefined}
        onClick={() => onOpen(entry.id)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && createPortal(
        <span ref={popRef} role="tooltip" id={id} className="dna-tip-pop">
          <b>{entry.term}</b>
          <span className="dna-tip-def">{entry.definition}</span>
          {entry.items && (
            <span className="dna-tip-items">{entry.items.map((it) => it.term).join(' · ')}</span>
          )}
          <span className="dna-tip-more">Click for the Glossary</span>
        </span>,
        document.body,
      )}
    </span>
  );
}

function YesNo({ value, onChange, label }) {
  return (
    <span className="dna-yn" role="radiogroup" aria-label={label}>
      {[[true, 'Yes'], [false, 'No']].map(([v, t]) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`dna-yn-btn${value === v ? ' is-on' : ''}`}
          onClick={() => onChange(v)}
        >
          {t}
        </button>
      ))}
    </span>
  );
}

/**
 * Plot Devices: a plain "Plot Devices" label, then the rows — Foreshadowing and Flashback always
 * (No and collapsed until switched to Yes), then any added ones — and the "+ Add device…"
 * picklist below them, so new devices appear just above it.
 */
function PlotDevices({ dna, onChange, dictionary, onOpenTerm }) {
  return (
    <section className="dna-devices" aria-labelledby="dna-devices-title">
      <h3 className="dna-label dna-devices-title" id="dna-devices-title">Plot Devices</h3>
      {plotDeviceLayout(dna).map((item) => {
        if (item.kind === 'add') {
          return (
            <select
              key="add"
              className="dna-device-add"
              value=""
              aria-label="Add a plot device"
              onChange={(e) => e.target.value && onChange(addDevice(dna, e.target.value))}
            >
              <option value="">+ Add device…</option>
              {item.options.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          );
        }
        const { id, info, notes } = item;
        return (
          <div key={id} className={`dna-toggle${item.on ? ' is-on' : ''}`} data-device={id}>
            <div className="dna-toggle-row">
              <span className="dna-toggle-label">
                {info.label}
                <InfoTip entry={info.dict && dictionaryEntry(dictionary, info.dict)} onOpen={onOpenTerm} />
              </span>
              <YesNo label={info.label} value={item.on} onChange={(on) => onChange(setDevice(dna, id, { on }))} />
              {item.removable ? (
                <button
                  type="button"
                  className="dna-device-remove"
                  aria-label={`Remove ${info.label}`}
                  title={notes.trim() ? 'Remove (its notes go with it — Ctrl+Z won’t bring them back)' : 'Remove'}
                  onClick={() => {
                    if (notes.trim() && !window.confirm(`Remove ${info.label} and its notes?`)) return;
                    onChange(removeDevice(dna, id));
                  }}
                >
                  ×
                </button>
              ) : <span className="dna-device-remove is-placeholder" aria-hidden="true" />}
            </div>
            {item.expanded && (
              <AutoTextarea
                className="dna-notes"
                value={notes}
                placeholder={`How the script uses ${info.label.toLowerCase()}…`}
                aria-label={`${info.label} notes`}
                onChange={(e) => onChange(setDevice(dna, id, { notes: e.target.value }))}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}

function Blueprint({ dna, onChange, dictionary, onOpenTerm }) {
  const done = storyDnaProgress(dna);
  return (
    <div className="dna-blueprint">
      <div className="dna-meta">
        <fieldset className="dna-genres">
          <legend className="dna-label">Genre<span className="dna-hint">pick all that apply</span></legend>
          <div className="dna-pills">
            {GENRES.map((g) => {
              const on = dna.genres.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  className={`pill dna-pill${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onChange(toggleGenre(dna, g, !on))}
                >
                  {g}
                </button>
              );
            })}
          </div>
          {dna.genres.includes('Other') && (
            <input
              className="dna-genre-other"
              autoFocus={!dna.genreOther}
              value={dna.genreOther}
              placeholder="Other genre — e.g. Political drama"
              aria-label="Other genre"
              onChange={(e) => onChange(setField(dna, 'genreOther', e.target.value))}
            />
          )}
        </fieldset>
        <label className="pb-field">
          <span className="dna-label">Theme<span className="dna-hint">revealed by the climax</span></span>
          <input value={dna.theme} placeholder="What the story finally says" onChange={(e) => onChange(setField(dna, 'theme', e.target.value))} />
        </label>
        <PlotDevices dna={dna} onChange={onChange} dictionary={dictionary} onOpenTerm={onOpenTerm} />
      </div>

      <div className="dna-progress" aria-live="polite">
        <span className="dna-bar"><span style={{ width: `${(done / DNA_QUESTIONS.length) * 100}%` }} /></span>
        {done} of {DNA_QUESTIONS.length} answered
      </div>

      <ol className="dna-questions">
        {DNA_QUESTIONS.map((q, i) => (
          <li key={q.key} className={`dna-q${dna.answers[q.key].trim() ? ' is-answered' : ''}`}>
            <header>
              <span className="dna-n">{i + 1}</span>
              <span className="dna-q-text">
                <b>{q.label}</b> — {q.question}
              </span>
              <InfoTip entry={dictionaryEntry(dictionary, q.dict)} onOpen={onOpenTerm} />
            </header>
            {q.conflictType && (
              <select
                className="dna-select"
                value={dna.conflictType}
                onChange={(e) => onChange(setField(dna, 'conflictType', e.target.value))}
                aria-label="Type of conflict"
              >
                <option value="">Type of conflict…</option>
                {CONFLICT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <AutoTextarea
              className="dna-answer"
              value={dna.answers[q.key]}
              placeholder={q.question}
              aria-label={`${q.label}: ${q.question}`}
              onChange={(e) => onChange(setAnswer(dna, q.key, e.target.value))}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function EntryEditor({ entry, onSave, onCancel, onReset }) {
  const [definition, setDefinition] = useState(entry.definition);
  const [example, setExample] = useState(entry.example || '');
  return (
    <div className="dict-edit">
      <label className="pb-field">
        <span>Definition (paste your source’s wording)</span>
        <AutoTextarea autoFocus value={definition} onChange={(e) => setDefinition(e.target.value)} />
      </label>
      {(entry.example !== undefined || entry.id === 'textSubtext') && (
        <label className="pb-field">
          <span>Example</span>
          <AutoTextarea value={example} onChange={(e) => setExample(e.target.value)} />
        </label>
      )}
      <div className="dict-edit-foot">
        {!entry.starter && <button type="button" className="btn dict-reset" onClick={onReset}>Reset to starter text</button>}
        <span className="pb-spacer" />
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSave({ definition, ...(example || entry.example !== undefined ? { example } : {}) })}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Dictionary({ dictionary, openId, setOpenId, onEdit }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const listRef = useRef(null);
  const shown = searchDictionary(dictionary, query);

  useEffect(() => {
    if (openId) listRef.current?.querySelector(`[data-term="${openId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [openId]);

  const starterCount = dictionary.filter((e) => e.starter).length;

  return (
    <div className="dict">
      <input
        className="pb-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search terms and definitions…"
        aria-label="Search the Glossary"
      />
      {starterCount > 0 && (
        <p className="dict-starter-note">
          {starterCount === dictionary.length ? 'These are' : `${starterCount} of these are`} DraftLine’s starter
          definitions. Use <b>Edit</b> to paste your own reference’s wording — it’s kept for all your projects.
        </p>
      )}
      <ol className="dict-list" ref={listRef}>
        {shown.map((e) => {
          const open = openId === e.id || !!query.trim();
          const n = dictionary.indexOf(e) + 1;
          return (
            <li key={e.id} data-term={e.id} className={`dict-entry${open ? ' is-open' : ''}`}>
              <button type="button" className="dict-head" onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={open}>
                <span className="pb-chev" aria-hidden="true">▸</span>
                <span className="dict-n">{n}.</span>
                <b>{e.term}</b>
                {e.starter ? <span className="dict-badge">starter</span> : <span className="dict-badge is-yours">yours</span>}
              </button>
              {open && (
                editing === e.id ? (
                  <EntryEditor
                    entry={e}
                    onCancel={() => setEditing(null)}
                    onReset={() => {
                      onEdit(e.id, null);
                      setEditing(null);
                    }}
                    onSave={(o) => {
                      onEdit(e.id, o);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <div className="dict-body">
                    <p className="dict-def">{e.definition}</p>
                    {e.items && (
                      <ul className="dict-items">
                        {e.items.map((it) => <li key={it.term}><b>{it.term}</b> — {it.definition}</li>)}
                      </ul>
                    )}
                    {e.example && <pre className="dict-example">{e.example}</pre>}
                    <button type="button" className="btn pb-mini" onClick={() => setEditing(e.id)}>Edit</button>
                  </div>
                )
              )}
            </li>
          );
        })}
        {!shown.length && <li className="pb-empty">Nothing matches “{query}”.</li>}
      </ol>
    </div>
  );
}

/** Story DNA tab: [ Blueprint | Glossary ]. */
export default function StoryDna({ dna, onChange, dictionary, onDictionaryEdit }) {
  const [view, setView] = useState('blueprint');
  const [openId, setOpenId] = useState(null);
  const openTerm = (id) => {
    setOpenId(id);
    setView('dictionary');
  };
  return (
    <div className="pb-pane">
      <div className="seg dna-view" role="radiogroup" aria-label="Story DNA view">
        {DNA_VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={view === id}
            className={`seg-btn${view === id ? ' is-on' : ''}`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'blueprint'
        ? <Blueprint dna={dna} onChange={onChange} dictionary={dictionary} onOpenTerm={openTerm} />
        : <Dictionary dictionary={dictionary} openId={openId} setOpenId={setOpenId} onEdit={onDictionaryEdit} />}
    </div>
  );
}
