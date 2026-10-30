import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AutoTextarea from './AutoTextarea.jsx';
import {
  CONFLICT_LEVELS, DNA_QUESTIONS, GENRES, addDevice, plotDeviceLayout, removeDevice, setAnswer, setDevice,
  setField, storyDnaProgress, toggleGenre,
} from '../lib/storyDna.js';
import { dictionaryEntry, glossarySections } from '../lib/structureDictionary.js';
import { nativePickerOpen } from '../lib/pickerGuard.js';
import { TIP_MAX_WIDTH, clipToViewport, placeTooltip } from '../lib/tooltip.js';
import { DNA_VIEWS } from '../lib/bible.js';

/**
 * (i) with the term's Glossary definition on hover / focus; click opens the entry.
 * The definition is drawn in a fixed layer (a portal on <body>) and placed with
 * placeTooltip, so the drawer's edges and scrolling can never clip it.
 */
/** Hover intent: the pointer has to rest on an ⓘ this long before its card opens. */
export const TIP_HOVER_DELAY = 350;

// Start following native dropdown lists as soon as this module loads (before any picker is used).
nativePickerOpen();

/**
 * An ⓘ with the term's definition card. The card opens after a short hover (or at once on keyboard
 * focus), never while a dropdown list is open (the browser draws that list above everything, so the
 * card would sit hidden behind it), and closes on any click, scroll, resize or Escape.
 */
export function InfoTip({ entry, onOpen }) {
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef(0);
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
    window.addEventListener('pointerdown', hide, true); // any click, opening a dropdown included
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', hide, true);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const show = () => {
    if (!nativePickerOpen()) setOpen(true);
  };
  const hoverIn = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(show, TIP_HOVER_DELAY);
  };
  const hoverOut = () => {
    clearTimeout(hoverTimer.current);
    setOpen(false);
  };

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
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onFocus={(e) => {
          if (e.target.matches(':focus-visible')) show(); // keyboard focus: at once (a click's focus doesn't count)
        }}
        onBlur={hoverOut}
      >
        i
      </button>
      {open && createPortal(
        <span ref={popRef} role="tooltip" id={id} className="dna-tip-pop">
          <b>{entry.term}</b>
          <span className="dna-tip-def">{entry.definition}</span>
          {entry.items && (
            <span className="dna-tip-items">
              {itemGroups(entry.items).map(({ level, items }) => {
                const terms = items.map((it) => it.term).join(level ? ', ' : ' · ');
                return level ? `${level}: ${terms}` : terms;
              }).join(' · ')}
            </span>
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
                {CONFLICT_LEVELS.map((lv) => (
                  <optgroup key={lv.id} label={lv.group}>
                    {lv.types.map((t) => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                ))}
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

/** A term's sub-items in runs by `level` (Conflict's three levels); items without one stay as they are. */
function itemGroups(items) {
  const runs = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    if (last && last.level === (it.level || null)) last.items.push(it);
    else runs.push({ level: it.level || null, items: [it] });
  }
  return runs;
}

function Dictionary({ dictionary, openId, setOpenId, onEdit }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const listRef = useRef(null);
  const sections = glossarySections(dictionary, query);
  const searching = !!query.trim();

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
      <div className="dict-list" ref={listRef}>
        {sections.map((sec) => (
          <section key={sec.id} className="dict-section" data-section={sec.id} aria-labelledby={`dict-sec-${sec.id}`}>
            <h3 id={`dict-sec-${sec.id}`} className="dict-section-head micro-label">
              {sec.label}
              <span className="dict-section-count">{searching ? `${sec.entries.length} of ${sec.total}` : sec.total}</span>
            </h3>
            <ul className="dict-entries">
              {sec.entries.map((e) => {
                const open = openId === e.id || searching;
                return (
                  <li key={e.id} data-term={e.id} className={`dict-entry${open ? ' is-open' : ''}`}>
                    <button type="button" className="dict-head" onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={open}>
                      <span className="pb-chev" aria-hidden="true">▸</span>
                      <b>{e.term}</b>
                      {e.starter ? (
                        <span className="dict-badge" title="DraftLine’s starter definition. Open the term and click Edit to use your own wording">starter</span>
                      ) : (
                        <span className="dict-badge is-yours" title="Your wording, kept for all your projects. Edit → Reset to starter text brings DraftLine’s back">yours</span>
                      )}
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
                              {itemGroups(e.items).map(({ level, items }) => (level ? (
                                // Conflict: the six types nested under Inner / Personal / Wider World
                                <li key={level} className="dict-item-group">
                                  <b>{level}</b>
                                  <ul className="dict-items">
                                    {items.map((it) => <li key={it.term}><b>{it.term}</b> — {it.definition}</li>)}
                                  </ul>
                                </li>
                              ) : items.map((it) => <li key={it.term}><b>{it.term}</b> — {it.definition}</li>)))}
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
            </ul>
          </section>
        ))}
        {!sections.length && <p className="pb-empty">Nothing matches “{query}”.</p>}
      </div>
    </div>
  );
}

/** Story DNA tab: [ Blueprint | Glossary ]. */
export default function StoryDna({ dna, onChange, dictionary, onDictionaryEdit, showTerm = null }) {
  const [view, setView] = useState('blueprint');
  const [openId, setOpenId] = useState(null);
  // A term opened from elsewhere (Characters → Bios role ⓘ): switch to the Glossary, open it.
  const [shownTerm, setShownTerm] = useState(showTerm);
  if (showTerm !== shownTerm) {
    setShownTerm(showTerm);
    if (showTerm?.id) {
      setOpenId(showTerm.id);
      setView('dictionary');
    }
  }
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
