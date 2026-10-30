import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, CornerUpLeft, Plus, X } from 'lucide-react';
import { PRODUCTION_BUCKETS, STRIP_COLORS, breakdownTotals, buildBreakdown } from '../../lib/productionEngine.js';
import Reports from './Reports.jsx';
import PlanFilter from './PlanFilter.jsx';
import { EMPTY_PLAN_FILTER, filterPlanRows, planFilterActive } from '../../lib/planFilter.js';
import './PlanningWorkspace.css';

/**
 * The Plan workspace (header: [ Write | Plan ]). Its controls — [ Breakdowns | Stripboard ],
 * Collapse All, Export Breakdown — sit in the main header, in the slots Write's own use; the
 * workspace itself starts with one summary line, then the cards or strips.
 * Everything shown is derived from the script each time (lib/productionEngine.js buildBreakdown);
 * only the asset lists and notes are typed here, and they're saved with the project.
 *   view: 'breakdowns' | 'stripboard' | 'reports'
 *   fold: { closed, except: Set } from the header's Collapse All (a card is open when closed !== except.has(id))
 *   onToggleCard(sceneId): fold or open one card
 *   blocks, analysis, scenes, production: the script, analyzeScript(), the measured scenes and the
 *     stored asset lists — turned into rows here (buildBreakdown), so all of it loads with Plan
 *   onAdd(sceneId, bucket, text) · onRemove(sceneId, bucket, text) · onNotes(sceneId, text)
 *   onOpenScene(sceneId): back to Write, at that scene
 *   layout: the script's pagination (Reports: characters' pages, the page count)
 *   onOpenCharacter(name): back to Write with that character's Dialogue spotlight (Reports)
 *   onReportCsv(kind, reports): download one report as .csv
 *   filter, onFilter(next), onCount({ shown, total }): the header's scene filter (lib/planFilter.js),
 *     applied to Breakdowns and Stripboard (Reports always cover the whole script). On narrower
 *     windows the same filter shows at the top of the workspace instead of in the header.
 */
export default function PlanningWorkspace({
  view, fold, onToggleCard, blocks, analysis, scenes, production, onAdd, onRemove, onNotes, onOpenScene,
  layout = null, onOpenCharacter, onReportCsv, filter = EMPTY_PLAN_FILTER, onFilter, onCount,
}) {
  const rows = useMemo(() => buildBreakdown({ blocks, analysis, scenes, production }), [blocks, analysis, scenes, production]);
  const totals = useMemo(() => breakdownTotals(rows), [rows]);
  const shown = useMemo(() => filterPlanRows(rows, filter), [rows, filter]);
  const shownTotals = useMemo(() => breakdownTotals(shown.rows), [shown]);
  const filtering = view !== 'reports' && planFilterActive(filter);
  useEffect(() => {
    onCount?.({ shown: shown.shown, total: shown.total });
  }, [onCount, shown.shown, shown.total]);
  return (
    <section className="plan" data-view={view} aria-label="Plan">
      <div className="plan-scroll">
        {!rows.length ? (
          <p className="plan-empty">No scenes yet. Scene headings you write (INT. / EXT. …) appear here as breakdowns and strips.</p>
        ) : (
          <>
            {view !== 'reports' && onFilter && (
              <PlanFilter filter={filter} onChange={onFilter} place="workspace" />
            )}
            <p className="plan-summary" role="status">
              {filtering
                ? <>{shown.shown} of {plural(totals.scenes, 'scene')} · {shownTotals.length} of {totals.length} {totals.eighths > 8 ? 'pages' : 'page'} · filtered</>
                : <>{plural(totals.scenes, 'scene')} · {totals.length} {totals.eighths > 8 ? 'pages' : 'page'} · cast, sluglines and lengths come from the script</>}
            </p>
            {view === 'reports' ? (
              <Reports rows={rows} blocks={blocks} analysis={analysis} layout={layout} onOpenScene={onOpenScene} onOpenCharacter={onOpenCharacter} onCsv={onReportCsv} />
            ) : filtering && !shown.shown ? (
              <p className="plan-empty">
                No scenes match.{' '}
                <button type="button" className="plan-clear" onClick={() => onFilter?.(EMPTY_PLAN_FILTER)}>Clear the filter</button>
              </p>
            ) : view === 'stripboard'
              ? <Stripboard rows={shown.rows} totals={shownTotals} onOpenScene={onOpenScene} />
              : <Breakdowns rows={shown.rows} fold={fold} onToggle={onToggleCard} onAdd={onAdd} onRemove={onRemove} onNotes={onNotes} onOpenScene={onOpenScene} />}
          </>
        )}
      </div>
    </section>
  );
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function SettingBadges({ row }) {
  return (
    <span className="plan-badges">
      <span className={`plan-badge${row.setting ? '' : ' is-missing'}`} title={row.setting ? undefined : 'No INT. / EXT. in the heading'}>{row.setting || 'INT/EXT?'}</span>
      <span
        className={`plan-badge is-${row.period || 'unknown'}${row.time ? '' : ' is-missing'}`}
        title={!row.time ? 'No time of day in the heading' : row.timeOfDay && row.time !== row.timeOfDay ? `${row.time}: ${row.timeOfDay.toLowerCase()}` : undefined}
      >
        {row.time || 'DAY/NIGHT?'}
      </span>
      {row.modifier && <span className="plan-badge plan-modifier" title="From the heading’s parentheses">{row.modifier}</span>}
    </span>
  );
}

function CastPills({ cast }) {
  if (!cast.length) return <span className="plan-none">No one speaks</span>;
  return cast.map((c) => (
    <span key={c.name} className="pill plan-cast" title={`Cast #${c.number}`}>
      <b>{c.number}</b>{c.name}
    </span>
  ));
}

// ---- Breakdowns ---------------------------------------------------------------------------------

function Breakdowns({ rows, fold, onToggle, onAdd, onRemove, onNotes, onOpenScene }) {
  return (
    <div className="plan-breakdowns" role="region" aria-label="Breakdowns">
      {rows.map((r) => {
        const isOpen = fold.closed === fold.except.has(r.id);
        return (
          <article key={r.id} className={`plan-card strip-${r.color}${isOpen ? ' is-open' : ''}`} aria-label={`Scene ${r.number}`}>
            <header className="plan-card-head">
              <button type="button" className="plan-toggle" onClick={() => onToggle(r.id)} aria-expanded={isOpen} aria-label={isOpen ? 'Collapse' : 'Expand'}>
                <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
              </button>
              <span className="plan-num">{r.number}</span>
              <span className="plan-slug" title={r.heading}>{r.heading}</span>
              <SettingBadges row={r} />
              <span className="plan-len" title="Length in page eighths">{r.length} pgs</span>
              <button type="button" className="plan-go" onClick={() => onOpenScene(r.id)} title="Open this scene in Write">
                <CornerUpLeft size={13} strokeWidth={1.75} aria-hidden /> Write
              </button>
            </header>
            {isOpen && (
              <div className="plan-card-body">
                <div className="plan-row">
                  <span className="plan-label">Cast (Speaking)</span>
                  <span className="plan-cast-list"><CastPills cast={r.cast} /></span>
                </div>
                <div className="plan-buckets">
                  {PRODUCTION_BUCKETS.map((b) => (
                    <Bucket key={b.id} bucket={b} items={r[b.id]} onAdd={(t) => onAdd(r.id, b.id, t)} onRemove={(t) => onRemove(r.id, b.id, t)} />
                  ))}
                </div>
                <label className="plan-notes">
                  <span className="plan-label">Production Notes</span>
                  <textarea
                    value={r.notes}
                    rows={r.notes ? Math.min(6, r.notes.split('\n').length + 1) : 2}
                    placeholder="Permits, locations to scout, a stunt to rehearse…"
                    onChange={(e) => onNotes(r.id, e.target.value)}
                  />
                </label>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** One tag list: its items (× removes), then + to add — Enter adds; commas add several at once. */
function Bucket({ bucket, items, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const commit = () => {
    for (const part of text.split(',')) if (part.trim()) onAdd(part);
    setText('');
  };
  return (
    <div className="plan-bucket">
      <span className="plan-label">{bucket.label}</span>
      <div className="plan-tags">
        {items.map((t) => (
          <span key={t} className="plan-tag">
            {t}
            <button type="button" onClick={() => onRemove(t)} aria-label={`Remove ${t}`} title="Remove"><X size={11} strokeWidth={2} aria-hidden /></button>
          </span>
        ))}
        {adding ? (
          <input
            className="plan-add-input"
            autoFocus
            value={text}
            placeholder={bucket.placeholder}
            aria-label={`Add to ${bucket.label}`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                setText('');
                setAdding(false);
              }
            }}
            onBlur={() => {
              commit();
              setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="plan-add" onClick={() => setAdding(true)} aria-label={`Add to ${bucket.label}`}>
            <Plus size={12} strokeWidth={2} aria-hidden /> Add
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Stripboard ---------------------------------------------------------------------------------

function Stripboard({ rows, totals, onOpenScene }) {
  return (
    <div className="plan-stripboard" role="region" aria-label="Stripboard">
      <div className="strip-legend">
        {Object.entries(STRIP_COLORS).filter(([k]) => k !== 'unknown' || totals.colors.unknown).map(([k, c]) => (
          <span key={k} className="strip-key"><span className={`strip-swatch strip-${k}`} aria-hidden="true" />{c.label} · {totals.colors[k]}</span>
        ))}
      </div>
      <div className="strips" role="table" aria-label="Stripboard, in script order">
        <div className="strip strip-head" role="row">
          <span role="columnheader">Sc.</span>
          <span role="columnheader">I/E</span>
          <span role="columnheader">Slugline</span>
          <span role="columnheader">D/N</span>
          <span role="columnheader">Pages</span>
          <span role="columnheader">Cast</span>
        </div>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            role="row"
            className={`strip strip-${r.color}`}
            onClick={() => onOpenScene(r.id)}
            title={`${STRIP_COLORS[r.color].label} — open scene ${r.number} in Write`}
          >
            <span role="cell" className="strip-num">{r.number}</span>
            <span role="cell" className="strip-ie">{r.setting || '–'}</span>
            <span role="cell" className="strip-slug">
              <span className="strip-loc">{r.location || r.heading}</span>
              {r.modifier && <span className="strip-mod">{r.modifier}</span>}
            </span>
            <span role="cell" title={r.time && r.time !== r.timeOfDay ? `${r.time}${r.timeOfDay ? ` → ${r.timeOfDay}` : ''}` : undefined}>
              {r.timeOfDay || '–'}
            </span>
            <span role="cell" className="strip-len">{r.length}</span>
            <span role="cell" className="strip-cast" title={r.cast.map((c) => `${c.number}. ${c.name}`).join(', ')}>
              {r.cast.map((c) => c.number).join(', ') || '–'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
