import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, CornerUpLeft, Plus, X } from 'lucide-react';
import { PRODUCTION_BUCKETS, breakdownTotals, buildBreakdown } from '../../lib/productionEngine.js';
import Reports from './Reports.jsx';
import PlanFilter from './PlanFilter.jsx';
import UnattachedModal from './UnattachedModal.jsx';
import ScheduleBoard from './ScheduleBoard.jsx';
import { StripHead, StripLegend, StripRow } from './strips.jsx';
import { scheduleModel } from '../../lib/schedule.js';
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
 *   unattached: breakdowns whose heading left the script (productionData.js unattachedScenes); when there
 *     are any, the summary line ends "· 1 scene’s breakdown is no longer attached · Review", which opens
 *     UnattachedModal: onAttach(fromId, toId) · onRemoveUnattached(id), both undo steps in App
 *   stripView: 'script' | 'schedule', onStripView(v) — the Stripboard's two views once a shooting day
 *     exists (production.schedule, lib/schedule.js). Before that it's Script only, exactly as always,
 *     and the selector isn't shown. Script: script order, read-only, a quiet D3 on scheduled scenes.
 *     Schedule: the same strips in shooting order (ScheduleBoard), moved with scheduleOps (App: undo steps)
 *   scheduleOps: see ScheduleBoard; also forgetMissing() for scheduled scenes no longer in the script
 *   filter, onFilter(next), onCount({ shown, total }): the header's scene filter (lib/planFilter.js),
 *     applied to Breakdowns and Stripboard (Reports always cover the whole script). On narrower
 *     windows the same filter shows at the top of the workspace instead of in the header.
 */
export default function PlanningWorkspace({
  view, fold, onToggleCard, blocks, analysis, scenes, production, onAdd, onRemove, onNotes, onOpenScene,
  layout = null, onOpenCharacter, onReportCsv, filter = EMPTY_PLAN_FILTER, onFilter, onCount,
  unattached = [], onAttach, onRemoveUnattached, stripView = 'script', onStripView, scheduleOps = null,
}) {
  const [reviewing, setReviewing] = useState(null); // the Review link, while its dialog is open
  const rows = useMemo(() => buildBreakdown({ blocks, analysis, scenes, production }), [blocks, analysis, scenes, production]);
  const totals = useMemo(() => breakdownTotals(rows), [rows]);
  const shown = useMemo(() => filterPlanRows(rows, filter), [rows, filter]);
  const shownTotals = useMemo(() => breakdownTotals(shown.rows), [shown]);
  const filtering = view !== 'reports' && planFilterActive(filter);
  const schedule = scheduleOps ? production?.schedule : null;
  const model = useMemo(() => (schedule ? scheduleModel(rows, schedule) : null), [rows, schedule]);
  const scheduling = view === 'stripboard' && !!model?.days.length;
  const inSchedule = scheduling && stripView === 'schedule';
  const visibleIds = useMemo(() => (filtering ? new Set(shown.rows.map((r) => r.id)) : null), [filtering, shown]);
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
            {scheduling ? (
              <div className="plan-summary-row">
                <PlanSummary
                  filtering={filtering} shown={shown} totals={totals} shownTotals={shownTotals}
                  unattached={unattached} onAttach={onAttach} onReview={setReviewing}
                  model={model} inSchedule={inSchedule} onForgetMissing={scheduleOps?.forgetMissing}
                />
                <div className="seg strip-view" role="radiogroup" aria-label="Stripboard order">
                  {[['script', 'Script', 'Scenes in script order'], ['schedule', 'Schedule', 'Scenes in shooting order, by day']].map(([id, label, title]) => (
                    <button key={id} type="button" role="radio" aria-checked={stripView === id} className={`seg-btn${stripView === id ? ' is-on' : ''}`} title={title} onClick={() => onStripView?.(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
            <p className="plan-summary" role="status">
              {filtering
                ? <>{shown.shown} of {plural(totals.scenes, 'scene')} · {shownTotals.length} of {totals.length} {totals.eighths > 8 ? 'pages' : 'page'} · filtered</>
                : <>{plural(totals.scenes, 'scene')} · {totals.length} {totals.eighths > 8 ? 'pages' : 'page'} · cast, sluglines and lengths come from the script</>}
              {unattached.length > 0 && onAttach && (
                <>
                  {' · '}
                  {unattached.length === 1 ? '1 scene’s breakdown is' : `${unattached.length} scenes’ breakdowns are`} no longer attached
                  {' · '}
                  <button type="button" className="plan-clear" onClick={(e) => setReviewing(e.currentTarget)}>Review</button>
                </>
              )}
            </p>
            )}
            {view === 'reports' ? (
              <Reports rows={rows} blocks={blocks} analysis={analysis} layout={layout} onOpenScene={onOpenScene} onOpenCharacter={onOpenCharacter} onCsv={onReportCsv} />
            ) : filtering && !shown.shown && !inSchedule ? (
              <p className="plan-empty">
                No scenes match.{' '}
                <button type="button" className="plan-clear" onClick={() => onFilter?.(EMPTY_PLAN_FILTER)}>Clear the filter</button>
              </p>
            ) : inSchedule
              ? <ScheduleBoard model={model} totals={shownTotals} visible={visibleIds} onOpenScene={onOpenScene} ops={scheduleOps} pagesTarget={schedule?.pagesTarget || null} />
              : view === 'stripboard'
              ? <Stripboard rows={shown.rows} totals={shownTotals} onOpenScene={onOpenScene} dayOf={scheduling ? model.dayOf : null} />
              : <Breakdowns rows={shown.rows} fold={fold} onToggle={onToggleCard} onAdd={onAdd} onRemove={onRemove} onNotes={onNotes} onOpenScene={onOpenScene} />}
          </>
        )}
      </div>
      {reviewing && (
        <UnattachedModal
          items={unattached}
          scenes={rows.map((r) => ({ id: r.id, number: r.number, heading: r.heading }))}
          onAttach={onAttach}
          onRemove={onRemoveUnattached}
          onClose={() => setReviewing(null)}
          returnFocus={reviewing}
        />
      )}
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

function Stripboard({ rows, totals, onOpenScene, dayOf = null }) {
  return (
    <div className="plan-stripboard" role="region" aria-label="Stripboard">
      <StripLegend totals={totals} />
      <div className="strips" role="table" aria-label="Stripboard, in script order">
        <StripHead />
        {rows.map((r) => (
          <StripRow key={r.id} r={r} onOpenScene={onOpenScene} day={dayOf ? dayOf.get(r.id) ?? null : null} />
        ))}
      </div>
    </div>
  );
}

/** The summary line once there's a schedule: the usual totals, then days, unscheduled and notes. */
function PlanSummary({ filtering, shown, totals, shownTotals, unattached, onAttach, onReview, model, inSchedule, onForgetMissing }) {
  const pages = totals.eighths > 8 ? 'pages' : 'page';
  return (
    <p className="plan-summary" role="status">
      {filtering
        ? <>{shown.shown} of {plural(totals.scenes, 'scene')} · {shownTotals.length} of {totals.length} {pages} · filtered{inSchedule && ' · drag is off, use a strip’s handle to move it'}</>
        : <>{plural(totals.scenes, 'scene')} · {totals.length} {pages}</>}
      {' · '}{plural(model.days.length, 'shooting day')} · {model.unscheduled.length} unscheduled
      {model.noteCount > 0 && <> · <span className="plan-summary-note">{plural(model.noteCount, 'day')} with notes</span></>}
      {model.missing.length > 0 && onForgetMissing && (
        <>
          {' · '}{model.missing.length === 1 ? '1 scheduled scene is' : `${model.missing.length} scheduled scenes are`} no longer in the script{' · '}
          <button type="button" className="plan-clear" onClick={onForgetMissing}>Remove from the schedule</button>
        </>
      )}
      {unattached.length > 0 && onAttach && (
        <>
          {' · '}
          {unattached.length === 1 ? '1 scene’s breakdown is' : `${unattached.length} scenes’ breakdowns are`} no longer attached
          {' · '}
          <button type="button" className="plan-clear" onClick={(e) => onReview(e.currentTarget)}>Review</button>
        </>
      )}
    </p>
  );
}
