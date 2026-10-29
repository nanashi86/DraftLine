import { useMemo, useState } from 'react';
import { CAST_FOLD_KEY, foldCast, readCastExpanded, writeCastExpanded } from '../lib/castFold.js';
import AutoTextarea from './AutoTextarea.jsx';
import { X } from 'lucide-react';
import { CADENCE, MONOLOGUE_LINES, MONOLOGUE_WORDS, isMonologue, speechLength, voiceMetrics } from '../lib/voice.js';
import './DialogueTuner.css';

/**
 * Characters → Dialogue tab: nothing is picked until you pick a character (no pill lit, an empty
 * state below). Picking one lights its pill and spotlights its speeches in the script (the
 * filter, the status bar stepper, a scroll to its first line). Then read every line they speak top-to-bottom, and
 * edit in place. Edits write straight back to the script blocks (same ids), so the main
 * editor and this tab are always two views of one source of truth. `open` is whether the tab
 * is showing (so its text fields can measure themselves on return).
 *
 * The monologue count is a toggle: on, the list keeps only that character's monologues (speeches
 * over MONOLOGUE_LINES printed lines or MONOLOGUE_WORDS words), each tagged with its length, with
 * Go ↗ to jump to it. It belongs to the character it was turned on for, so picking someone else
 * shows all of their speeches again. Nothing is flagged in the script or the status bar.
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
  const current = (selected && analysis.characters.get(selected)) || null; // never a default pick
  // A long cast folds after the 12 biggest speakers (lib/castFold.js); the pick always stays shown.
  const [castOpen, setCastOpen] = useState(() => readCastExpanded(globalThis.localStorage, CAST_FOLD_KEY));
  const cast = foldCast(characterList, { expanded: castOpen, selected: current?.name });
  const toggleCast = () => {
    setCastOpen(!castOpen);
    writeCastExpanded(globalThis.localStorage, CAST_FOLD_KEY, !castOpen);
  };
  const voice = useMemo(() => voiceMetrics(current), [current]);
  const [monoFor, setMonoFor] = useState(null); // the character whose monologues are filtered, if any
  // Picking anyone else turns it off for good (adjusted while rendering, React's pattern for this).
  if (monoFor && monoFor !== current?.name) setMonoFor(null);
  const monoOnly = !!current && monoFor === current.name && voice.monologues > 0;
  const q = query.trim().toLowerCase();
  const entries = current
    ? current.entries.filter((en) => (!q || en.parts.some((p) => p.text.toLowerCase().includes(q))) && (!monoOnly || isMonologue(en)))
    : [];

  return (
    <div className="tuner" aria-label="Dialogue">

      {characterList.length === 0 ? (
        <p className="tuner-empty">No characters yet. Add a Character cue followed by Dialogue and it'll show up here.</p>
      ) : (
        <>
          <div className="tuner-cast">
            <div className="tuner-cast-list" role="listbox" aria-label="Characters">
            {cast.shown.map((c) => (
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
            {cast.foldable && (
              <button
                type="button"
                className="pill cast-more"
                aria-expanded={castOpen}
                onClick={toggleCast}
                title={castOpen ? `Show only the ${cast.top} characters with the most lines` : `Show all ${characterList.length} speaking characters`}
              >
                {castOpen ? 'Show fewer' : `+${cast.hidden} more`}
              </button>
            )}
          </div>

          {current && (
            <div className="tuner-stats">
              <span><b>{current.lines}</b> lines</span>
              <span><b>{current.words}</b> words</span>
              <span><b>{current.scenes.size}</b> {current.scenes.size === 1 ? 'scene' : 'scenes'}</span>
              <span><b>{current.lines ? Math.round(current.words / current.lines) : 0}</b> avg words/line</span>
              {voice.monologues > 0 ? (
                <button
                  type="button"
                  className={`tuner-mono${monoOnly ? ' is-on' : ''}`}
                  aria-pressed={monoOnly}
                  onClick={() => setMonoFor(monoOnly ? null : current.name)}
                  title={monoOnly
                    ? 'Show every speech'
                    : `Show only ${current.name}’s monologues: speeches over ${MONOLOGUE_LINES} printed lines or ${MONOLOGUE_WORDS} words`}
                >
                  <b>{voice.monologues}</b> {voice.monologues === 1 ? 'monologue' : 'monologues'}
                  {monoOnly && <X size={12} strokeWidth={2} aria-hidden className="tuner-mono-x" />}
                </button>
              ) : (
                <span title={`Speeches over ${MONOLOGUE_LINES} printed lines or ${MONOLOGUE_WORDS} words`}><b>0</b> monologues</span>
              )}
              <span title={`Cadence from average words per line: under ${CADENCE.fast} Fast / Banter, over ${CADENCE.expository} Expository, else Balanced`}>
                Cadence <b>{voice.cadence}</b>
              </span>
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

          {!current && (
            <div className="dialogue-empty-state">Select a character to spotlight their dialogue across the script</div>
          )}

          {current && (
          <>
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

          {monoOnly && (
            <p className="tuner-mono-note" role="status">
              Showing {current.name}’s {voice.monologues === 1 ? 'monologue' : `${voice.monologues} monologues`} · click the count again to see every speech
            </p>
          )}

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
                {monoOnly && (
                  <p className="tune-mono-tag">Monologue · {speechLength(en).printed} {speechLength(en).printed === 1 ? 'line' : 'lines'}</p>
                )}

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
        </>
      )}
    </div>
  );
}
