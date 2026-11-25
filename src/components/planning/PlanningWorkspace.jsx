import { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, CornerUpLeft, Plus, Trash2, X } from 'lucide-react';
import { breakdownTotals, buildBreakdown } from '../../lib/productionEngine.js';
import { CATEGORIES, nameKey, needText } from '../../lib/elements.js';
import ElementPopover from './ElementPopover.jsx';
import Reports from './Reports.jsx';
import PlanFilter from './PlanFilter.jsx';
import UnattachedModal from './UnattachedModal.jsx';
import ScheduleBoard from './ScheduleBoard.jsx';
import { StripHead, StripLegend, StripRow } from './strips.jsx';
import { elementUsage, scheduleModel } from '../../lib/schedule.js';
import { linkedIds } from '../../lib/productionData.js';
import { EMPTY_PLAN_FILTER, filterPlanRows, planFilterActive } from '../../lib/planFilter.js';
import './PlanningWorkspace.css';

/**
 * The Plan workspace (header: [ Write | Plan ]). Its controls — [ Breakdowns | Stripboard ],
 * Collapse All, + Shooting Day — sit in the main header, in the slots Write's own use; the
 * workspace itself starts with one summary line, then the cards or strips.
 * Everything shown is derived from the script each time (lib/productionEngine.js buildBreakdown);
 * only the asset lists and notes are typed here, and they're saved with the project.
 *   view: 'breakdowns' | 'stripboard' | 'reports'
 *   fold: { closed, except: Set } from the header's Collapse All (a card is open when closed !== except.has(id))
 *   onToggleCard(sceneId): fold or open one card
 *   blocks, analysis, scenes, production: the script, analyzeScript(), the measured scenes and the
 *     stored asset lists — turned into rows here (buildBreakdown), so all of it loads with Plan
 *   elementOps: App's shared-element operations (lib/elements.js; each one undo step) · onNotes(sceneId, text)
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
  view, fold, onToggleCard, blocks, analysis, scenes, production, elementOps, onNotes, onOpenScene,
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
  // Where each shared element is used (scenes, shooting days): for an item's details.
  const usage = useMemo(() => (view === 'breakdowns' ? elementUsage(rows, schedule) : null), [view, rows, schedule]);
  const linked = useMemo(() => (view === 'breakdowns' ? linkedIds(production) : null), [view, production]);
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
                : <>{plural(totals.scenes, 'scene')} · {totals.length} {totals.eighths > 8 ? 'pages' : 'page'}<span className="plan-summary-more"> · cast, sluglines and lengths come from the script</span></>}
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
              : <Breakdowns rows={shown.rows} fold={fold} onToggle={onToggleCard} elements={production?.elements || {}} usage={usage} linked={linked} ops={elementOps} onNotes={onNotes} onOpenScene={onOpenScene} onJump={onToggleCard} />}
          </>
        )}
      </div>
      {reviewing && (
        <UnattachedModal
          items={unattached}
          elements={production?.elements || {}}
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

function Breakdowns({ rows, fold, onToggle, elements, usage, linked, ops, onNotes, onOpenScene }) {
  const [open, setOpen] = useState(null); // an item's details: { need, sceneId, sceneNumber, anchor }
  const isOpenCard = (id) => fold.closed === fold.except.has(id);
  /** "Used in → Sc 17": open that scene's card and bring it into view. */
  const jump = (id) => {
    setOpen(null);
    if (!isOpenCard(id)) onToggle(id);
    requestAnimationFrame(() => document.querySelector(`.plan-card[data-scene="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };
  return (
    <div className="plan-breakdowns" role="region" aria-label="Breakdowns">
      {rows.map((r) => {
        const isOpen = isOpenCard(r.id);
        return (
          <article key={r.id} data-scene={r.id} className={`plan-card strip-${r.color}${isOpen ? ' is-open' : ''}`} aria-label={`Scene ${r.number}`}>
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
                  {CATEGORIES.map((c) => (
                    <Bucket
                      key={c.id}
                      category={c}
                      items={r.needs?.[c.id] || []}
                      elements={elements}
                      usage={usage}
                      linked={linked}
                      onAdd={(what) => ops?.add(r.id, c.id, what)}
                      onPurge={(e) => ops?.purge(e.id)}
                      onUndo={() => ops?.undo()}
                      onRemove={(n) => ops?.remove(r.id, n.id, n.name)}
                      onOpen={(need, anchor) => setOpen({ need, sceneId: r.id, sceneNumber: r.number, anchor })}
                    />
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
      {open && ops && (() => {
        // Always the item as it is now (after a change in its card, or undo): gone → the card closes.
        const row = rows.find((x) => x.id === open.sceneId);
        const need = row && CATEGORIES.flatMap((c) => row.needs?.[c.id] || []).find((n) => n.id === open.need.id);
        if (!need) return null;
        return (
          <ElementPopover
            key={`${open.sceneId}:${need.id}:${need.category}:${need.name}`}
            need={need}
            sceneId={open.sceneId}
            sceneNumber={open.sceneNumber}
            anchor={open.anchor}
            elements={elements}
            usage={usage?.get(need.id)}
            ops={ops}
            onJump={jump}
            onClose={() => setOpen(null)}
          />
        );
      })()}
    </div>
  );
}

/**
 * One category's items: each opens its details (the name), × removes it from this scene; then + Add.
 * Typing suggests elements already in the project in this category (other scenes', or unused ones
 * kept for reuse): ↑ ↓ and Enter (or a tap) reuse one. Enter on typed text reuses the one element of
 * that name, or makes a new one; "+ New … (separate)" makes a new one even when the name exists.
 * Commas add several at once, as before. Only Enter or a pick adds: Esc, or clicking away, leaves
 * what was typed unadded. An unused element (no scene links to it) has a trash can in its row that
 * deletes it from the project (Shift+Delete on the highlighted row); Ctrl+Z, still in the field,
 * brings it back.
 */
function Bucket({ category, items, elements, usage, linked, onAdd, onRemove, onOpen, onPurge, onUndo }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(-1);
  const [purged, setPurged] = useState(false); // a delete from this field, so Ctrl+Z here undoes it
  const listId = `sg-${category.id}-${useId().replace(/:/g, '')}`;
  const q = nameKey(text);
  const here = new Set(items.map((i) => i.id));
  const options = [];
  if (q && !text.includes(',')) {
    const pool = Object.values(elements || {}).filter((e) => e.category === category.id && !here.has(e.id));
    const found = pool.filter((e) => nameKey(e.name).includes(q))
      .sort((a, b) => Number(!nameKey(a.name).startsWith(q)) - Number(!nameKey(b.name).startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 6);
    for (const e of found) {
      const sc = usage?.get(e.id)?.scenes || [];
      const unused = !!linked && !linked.has(e.id);
      options.push({ key: e.id, pick: { id: e.id }, label: e.name, hint: sc.length ? `sc ${sc.map((x) => x.number).join(', ')}` : 'not in a scene', unused, element: e });
    }
    const exists = Object.values(elements || {}).some((e) => e.category === category.id && nameKey(e.name) === q);
    const inHere = items.some((i) => nameKey(i.name) === q);
    if (!inHere) {
      options.push({ key: '+new', pick: { name: text, reuse: false }, label: `+ New “${text.trim()}”`, hint: exists ? 'separate' : '' });
    }
  }
  const pick = (o) => {
    onAdd(o.pick);
    setText('');
    setActive(-1);
    setPurged(false);
  };
  const purge = (o) => {
    onPurge(o.element);
    setActive(-1);
    setPurged(true);
  };
  const commit = () => {
    const parts = text.split(',').filter((part) => part.trim()).map((name) => ({ name }));
    if (parts.length) onAdd(parts); // one step for them all
    setText('');
    setActive(-1);
  };
  const close = () => {
    setText('');
    setActive(-1);
    setAdding(false);
    setPurged(false);
  };
  return (
    <div className="plan-bucket">
      <span className="plan-label">{category.label}</span>
      <div className="plan-tags">
        {items.map((n) => (
          <span key={n.id} className="plan-tag">
            <button type="button" className="plan-tag-name" onClick={(e) => onOpen(n, e.currentTarget)} title={`${needText(n)} — details`} aria-haspopup="dialog">
              {n.name}{n.qty !== undefined && <span className="plan-tag-qty"> ×{n.qty}</span>}
            </button>
            <button type="button" onClick={() => onRemove(n)} aria-label={`Remove ${n.name}`} title="Remove from this scene"><X size={11} strokeWidth={2} aria-hidden /></button>
          </span>
        ))}
        {adding ? (
          <span className="plan-add-wrap">
            <input
              className="plan-add-input"
              autoFocus
              value={text}
              placeholder={category.placeholder}
              aria-label={`Add to ${category.label}`}
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 && options[active] ? `${listId}-${active}` : undefined}
              onChange={(e) => {
                setText(e.target.value);
                setActive(-1);
                setPurged(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && options.length) {
                  e.preventDefault();
                  setActive((i) => (i + 1) % options.length);
                } else if (e.key === 'ArrowUp' && options.length) {
                  e.preventDefault();
                  setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (active >= 0 && options[active]) pick(options[active]);
                  else commit();
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  close();
                } else if (e.key === 'Delete' && e.shiftKey && options[active]?.unused) {
                  e.preventDefault();
                  purge(options[active]);
                } else if (purged && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                  e.preventDefault(); // the delete just made from this list, not the field's text
                  onUndo();
                  setPurged(false);
                }
              }}
              onBlur={close} // clicking away never adds what was typed: Enter or a pick does
            />
            {options.length > 0 && (
              <ul className="plan-suggest" role="listbox" id={listId} aria-label={`${category.label} already in the project`}>
                {options.map((o, i) => (
                  <li
                    key={o.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'is-active' : undefined}
                    onMouseDown={(e) => e.preventDefault()} // keep the field's focus (its blur would close the list)
                    onClick={() => pick(o)}
                  >
                    <span className="plan-suggest-name">{o.label}</span>
                    {o.hint && <span className="plan-suggest-hint">{o.hint}</span>}
                    {o.unused && (
                      <button
                        type="button"
                        className="plan-suggest-del"
                        tabIndex={-1}
                        aria-label={`Delete “${o.label}” from the project`}
                        title={`Delete “${o.label}” from the project (no scene uses it) · Shift+Delete`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation(); // never picks the row
                          purge(o);
                        }}
                      >
                        <Trash2 size={12} strokeWidth={2} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </span>
        ) : (
          <button type="button" className="plan-add" onClick={() => setAdding(true)} aria-label={`Add to ${category.label}`}>
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
