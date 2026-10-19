import { useEffect, useRef, useState } from 'react';
import AutoTextarea from './AutoTextarea.jsx';
import {
  CONFLICT_TYPES, DNA_QUESTIONS, DNA_TOGGLES, GENRES, setAnswer, setField, setToggle, storyDnaProgress, toggleGenre,
} from '../lib/storyDna.js';
import { dictionaryEntry, searchDictionary } from '../lib/structureDictionary.js';

/** ℹ with the term's Structure Dictionary definition on hover / focus; click opens the entry. */
function InfoTip({ entry, onOpen }) {
  if (!entry) return null;
  return (
    <span className="dna-tip">
      <button
        type="button"
        className="dna-info"
        aria-label={`${entry.term}: definition`}
        aria-describedby={`tip-${entry.id}`}
        onClick={() => onOpen(entry.id)}
      >
        i
      </button>
      <span role="tooltip" id={`tip-${entry.id}`} className="dna-tip-pop">
        <b>{entry.term}</b>
        <span className="dna-tip-def">{entry.definition}</span>
        {entry.items && (
          <span className="dna-tip-items">{entry.items.map((it) => it.term).join(' · ')}</span>
        )}
        <span className="dna-tip-more">Click for the Structure Dictionary</span>
      </span>
    </span>
  );
}

function YesNo({ value, onChange, label }) {
  return (
    <span className="seg seg-sm dna-yn" role="radiogroup" aria-label={label}>
      {[[true, 'Yes'], [false, 'No']].map(([v, t]) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`seg-btn${value === v ? ' is-on' : ''}`}
          onClick={() => onChange(v)}
        >
          {t}
        </button>
      ))}
    </span>
  );
}

function Blueprint({ dna, onChange, dictionary, onOpenTerm }) {
  const done = storyDnaProgress(dna);
  return (
    <div className="dna-blueprint">
      <div className="dna-meta">
        <fieldset className="dna-genres">
          <legend>Genre <em>— tick all that apply</em></legend>
          {GENRES.map((g) => {
            const on = dna.genres.includes(g);
            return (
              <span key={g} className={`dna-genre${g === 'Other' ? ' is-other' : ''}`}>
                <label className={`dna-genre-chip${on ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={(e) => onChange(toggleGenre(dna, g, e.target.checked))} />
                  {g}
                </label>
                {g === 'Other' && on && (
                  <input
                    className="dna-genre-other"
                    autoFocus={!dna.genreOther}
                    value={dna.genreOther}
                    placeholder="e.g. Political drama"
                    aria-label="Other genre"
                    onChange={(e) => onChange(setField(dna, 'genreOther', e.target.value))}
                  />
                )}
              </span>
            );
          })}
        </fieldset>
        <label className="pb-field">
          <span>Theme <em>— revealed by the Climax</em></span>
          <input value={dna.theme} placeholder="What the story finally says" onChange={(e) => onChange(setField(dna, 'theme', e.target.value))} />
        </label>
        {DNA_TOGGLES.map((t) => (
          <div key={t.key} className={`dna-toggle${dna[t.key].on ? ' is-on' : ''}`}>
            <div className="dna-toggle-row">
              <span className="dna-toggle-label">
                {t.label}
                <InfoTip entry={t.dict && dictionaryEntry(dictionary, t.dict)} onOpen={onOpenTerm} />
              </span>
              <YesNo label={t.label} value={dna[t.key].on} onChange={(on) => onChange(setToggle(dna, t.key, { on }))} />
            </div>
            {(dna[t.key].on || dna[t.key].notes) && (
              <AutoTextarea
                className="dna-notes"
                value={dna[t.key].notes}
                placeholder={`How the script uses ${t.label.toLowerCase()}…`}
                aria-label={`${t.label} notes`}
                onChange={(e) => onChange(setToggle(dna, t.key, { notes: e.target.value }))}
              />
            )}
          </div>
        ))}
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
        aria-label="Search the Structure Dictionary"
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

/** Story DNA tab: [ Story Blueprint | Structure Dictionary ]. */
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
        {[['blueprint', 'Story Blueprint'], ['dictionary', 'Structure Dictionary']].map(([id, label]) => (
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
