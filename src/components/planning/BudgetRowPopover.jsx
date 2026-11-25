import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from '../Select.jsx';
import { HIDDEN, useDismiss, useFloating, useFocusWhenPlaced } from './floating.js';
import { DEFAULT_WEEK, METHODS, removeLine, resolveReview, rowVariants, setBudgetSettings, setLine } from '../../lib/budget.js';
import { basePlace } from '../../lib/locations.js';
import { deleteSite, mapPlace, updateSite } from '../../lib/productionData.js';
import { METHOD_CHOICES, basisDetail, money, parseQuantity } from '../../lib/budgetUi.js';
import { quantityText } from '../../lib/money.js';

/**
 * Budget → click an item: how it's costed, showing only what applies (BudgetView.jsx).
 *   Costed:        the seven methods (lib/budget.js METHODS), in plain words
 *   Quantity:      from the breakdowns (or the schedule, for person-days) or entered
 *   Reusable / Used up (elements counted per unit), Days (the rule, each with what it comes to),
 *   Holds (cast), Week (weekly rates), Note
 *   Review:        why it's waiting, and the choices that settle it
 *   Filming location (location rows): name, address, note, the scripted places shot there
 * then Clear costing (back to unpriced) or Delete cost. Each choice is one undo step; a typed field saves
 * on Enter or leaving it, and Esc closes without saving what wasn't confirmed. The figures beside the
 * choices are lib/budget.js rowVariants: the same calculation as the table.
 */
export default function BudgetRowPopover({ row, anchor, production, rows, sched, currency, locale, readOnly, step, notify, onClose }) {
  const ref = useRef(null);
  const pos = useFloating(anchor, ref, onClose);
  useDismiss(ref, anchor, onClose);
  useFocusWhenPlaced(ref, pos, '.bud-pop-first, .dl-select, button');
  const r = row;
  const m = METHODS[r.method];
  const src = r.source;
  const at = r.lineId ? { lineId: r.lineId } : { source: src };
  const name = r.name;
  const isElement = src?.kind === 'element';
  const isCast = src?.kind === 'cast';
  const isSite = src?.kind === 'site';
  const derivedPd = r.method === 'personDay' && isElement && r.qty === null && r.personDays !== null;

  // What each choice comes to (same calculation as the table).
  const variants = useMemo(() => {
    const days = ['use', 'span', 'calendar', 'shoot'].map((from) => ({ days: { from } }));
    const qty = [{ qty: { from: 'derived' }, usage: 'reuse' }, { qty: { from: 'derived' }, usage: 'consume' }];
    const out = rowVariants(production, rows, sched, at, [...days, ...qty]);
    return { use: out[0], span: out[1], calendar: out[2], shoot: out[3], reuse: out[4], consume: out[5] };
  }, [production, rows, sched, at.lineId, src?.kind, src?.id, src?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (fields, label) => step(label || `Costing for “${name}”`, (p) => (r.lineId ? setLine(p, r.lineId, fields) : setLine(p, null, { source: src, ...fields })));
  const daysFrom = r.lineId || src ? (rowDaysFrom(production, r) ?? (src ? 'use' : 'shoot')) : 'shoot';
  const qtyFrom = rowQtyFrom(production, r);
  const dayOptions = [
    ...(src ? [
      { value: 'use', label: `Days used${hint(variants.use, 'days')}` },
      { value: 'span', label: `First to last day${hint(variants.span, 'days')}` },
      { value: 'calendar', label: `Calendar days${variants.calendar?.flags.includes('datesUncertain') ? ' · dates unclear' : hint(variants.calendar, 'days')}` },
    ] : []),
    { value: 'shoot', label: `All shooting days${hint(variants.shoot, 'days')}` },
    { value: 'manual', label: 'Entered' },
  ];
  const week = { ...DEFAULT_WEEK, ...(production?.budget?.week || {}) };
  const lineWeek = production?.budget?.lines?.[r.lineId]?.week || null;

  const review = r.unresolved;
  const keepValues = { qty: r.qty ?? r.personDays ?? undefined, days: r.days ?? undefined };
  const relinkChoices = useMemo(() => relinkOptions(production, rows, src, r), [production, rows, src, r]);

  return createPortal(
    <div
      ref={ref}
      className="plan-pop el-pop bud-pop"
      role="dialog"
      aria-label={`Costing: ${name}`}
      style={pos || HIDDEN}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { // an open dropdown takes its own Esc first (Select.jsx)
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {review && (
        <section className="el-pop-part bud-pop-review" aria-label="Review">
          <span className="plan-label">Review</span>
          <p className="el-pop-hint">{reviewText(r)}</p>
          {!readOnly && (
            <div className="bud-pop-acts">
              {(r.review?.reason === 'merged' || r.review?.reason === 'renamed') && (
                <button type="button" className="el-pop-act bud-pop-first" onClick={() => { step(`“${name}”: kept as separate costs`, (p) => resolveReview(p, r.lineId, 'separate')); onClose(); }}>Keep both</button>
              )}
              {(r.review?.reason === 'deleted' || r.flags.includes('missingSource')) && (
                <button type="button" className="el-pop-act bud-pop-first" onClick={() => { step(`“${name}” kept as its own cost`, (p) => resolveReview(p, r.lineId, 'keep', keepValues)); onClose(); }}>Keep as my own cost</button>
              )}
              {relinkChoices.length > 0 && (
                <Select
                  className="bud-relink"
                  ariaLabel="Relink to"
                  value=""
                  placeholder="Relink to…"
                  options={relinkChoices}
                  onChange={(v) => { const s = JSON.parse(v); step(`“${name}” relinked`, (p) => resolveReview(p, r.lineId, 'relink', { source: s })); onClose(); }}
                />
              )}
              <button type="button" className="el-pop-act is-danger" onClick={() => { step(`“${name}” removed from the budget`, (p) => resolveReview(p, r.lineId, 'remove')); onClose(); }}>Remove this cost</button>
            </div>
          )}
        </section>
      )}

      {!isSite && !src && r.lineId && (
        <section className="el-pop-part">
          <span className="plan-label">Cost</span>
          <TextField value={r.name} ariaLabel="Name" readOnly={readOnly} className="bud-name-input" onCommit={(v) => v && change({ label: v }, `Renamed “${v}”`)} />
        </section>
      )}

      <section className="el-pop-part" aria-label="Costed">
        <span className="plan-label">{name}</span>
        <div className="el-pop-row">
          <Select
            className="bud-method"
            ariaLabel="Costed"
            disabled={readOnly}
            value={r.method}
            options={METHOD_CHOICES.map((c) => ({ value: c.id, label: c.label }))}
            onChange={(v) => change({ method: v }, `“${name}”: ${METHOD_CHOICES.find((c) => c.id === v).label.toLowerCase()}`)}
          />
          <span className="bud-pop-total">{r.total === null ? '' : money(r.total, currency, locale)}</span>
        </div>
        {basisDetail(r) && <p className="el-pop-hint">{basisDetail(r)}</p>}
      </section>

      {m.qty && (
        <section className="el-pop-part" aria-label="Quantity">
          <span className="plan-label">{r.method === 'personDay' ? 'People' : 'Quantity'}</span>
          {(isElement || isCast || isSite) && (
            <label className="bud-choice">
              <input type="radio" name={`q-${r.key}`} disabled={readOnly} checked={qtyFrom === 'derived'} onChange={() => change({ qty: { from: 'derived' } })} />
              {isElement
                ? r.method === 'personDay' ? `From the schedule${variants.use?.personDays !== null && variants.use?.personDays !== undefined ? ` · ${variants.use.personDays} person-days` : ' (after scheduling)'}` : `From the breakdowns · ${quantityText(variants[r.usage === 'consume' ? 'consume' : 'reuse']?.qty ?? 0)}`
                : 'Just one'}
            </label>
          )}
          <label className="bud-choice">
            {(isElement || isCast || isSite) && <input type="radio" name={`q-${r.key}`} disabled={readOnly} checked={qtyFrom === 'manual'} onChange={() => {}} onClick={(e) => e.currentTarget.parentElement.querySelector('input[type=text]')?.focus()} />}
            Entered{' '}
            <NumberField
              value={qtyFrom === 'manual' ? storedQty(production, r) : null}
              ariaLabel={r.method === 'personDay' ? 'Number of people' : 'Quantity'}
              readOnly={readOnly}
              locale={locale}
              notify={notify}
              onCommit={(v) => change({ qty: { from: 'manual', value: v } })}
            />
          </label>
          {isElement && qtyFrom === 'derived' && r.method !== 'personDay' && (
            <div className="seg bud-usage" role="radiogroup" aria-label="Reusable or used up">
              {[['reuse', 'Reusable', variants.reuse], ['consume', 'Used up', variants.consume]].map(([id, label, v]) => (
                <button key={id} type="button" role="radio" aria-checked={r.usage === id} disabled={readOnly} className={`seg-btn${r.usage === id ? ' is-on' : ''}`} title={v?.basis}
                  onClick={() => r.usage !== id && change({ usage: id }, `“${name}”: ${label.toLowerCase()}`)}>
                  {label} · {quantityText(v?.qty ?? 0)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {m.days && !derivedPd && (
        <section className="el-pop-part" aria-label="Days">
          <span className="plan-label">{m.weeks ? 'Days (for weeks)' : 'Days'}</span>
          <Select className="bud-days" ariaLabel="Days" disabled={readOnly} value={daysFrom} options={dayOptions}
            onChange={(v) => (v === 'manual' ? null : change({ days: { from: v } }))} />
          <label className="bud-choice">
            Entered days{' '}
            <NumberField value={daysFrom === 'manual' ? storedDays(production, r) : null} ariaLabel="Days" readOnly={readOnly} locale={locale} notify={notify}
              onCommit={(v) => change({ days: { from: 'manual', value: v } })} />
          </label>
          {isCast && daysFrom === 'use' && (
            <label className="bud-choice">
              <input type="checkbox" disabled={readOnly} checked={r.basis.includes('(paid)')} onChange={(e) => change({ holds: e.target.checked ? 'paid' : 'unpaid' }, `“${name}”: holds ${e.target.checked ? 'paid' : 'not counted'}`)} />
              Count hold days (paid)
            </label>
          )}
        </section>
      )}

      {m.weeks && (
        <section className="el-pop-part" aria-label="Week">
          <span className="plan-label">Week</span>
          <div className="el-pop-row">
            <Select className="bud-week-days" ariaLabel="Days in a week" disabled={readOnly} value={String(lineWeek?.days ?? week.days)}
              options={[{ value: '5', label: '5-day week' }, { value: '7', label: '7-day week' }]}
              onChange={(v) => change({ week: { ...(lineWeek || {}), days: Number(v) } })} />
            <Select className="bud-week-round" ariaLabel="Part weeks" disabled={readOnly} value={lineWeek?.rounding ?? week.rounding}
              options={[{ value: 'prorate', label: 'Part weeks prorated' }, { value: 'up', label: 'Part weeks rounded up' }]}
              onChange={(v) => change({ week: { ...(lineWeek || {}), rounding: v } })} />
          </div>
          <p className="el-pop-hint">
            {lineWeek ? 'For this cost only. ' : `The project’s week: ${week.days} days, part weeks ${week.rounding === 'up' ? 'rounded up' : 'prorated'}. `}
            {!readOnly && lineWeek && (
              <>
                <button type="button" className="plan-clear" onClick={() => step('The project’s week', (p) => setBudgetSettings(p, { week: { days: lineWeek.days ?? week.days, rounding: lineWeek.rounding ?? week.rounding } }))}>Use for the whole project</button>
                {' · '}
                <button type="button" className="plan-clear" onClick={() => change({ week: null })}>Use the project’s</button>
              </>
            )}
          </p>
        </section>
      )}

      {isSite && (
        <SiteDetails production={production} rows={rows} siteId={src.id} readOnly={readOnly} step={step} onClose={onClose} />
      )}

      <section className="el-pop-part" aria-label="Note">
        <TextField value={r.note} ariaLabel="Note" placeholder="Note (quote, supplier, why)…" readOnly={readOnly} onCommit={(v) => change({ note: v || null }, `Note on “${name}”`)} />
      </section>

      {!readOnly && r.lineId && !review && (
        <footer className="el-pop-foot">
          {r.rate !== null && <button type="button" className="el-pop-act is-quiet" onClick={() => change({ rate: null }, `Rate cleared for “${name}”`)}>Clear rate</button>}
          <span className="sr-spacer" />
          {src
            ? <button type="button" className="el-pop-act is-quiet" onClick={() => { step(`Costing cleared for “${name}”`, (p) => removeLine(p, r.lineId)); onClose(); }} title="Back to unpriced: the item stays in the budget">Clear costing</button>
            : <button type="button" className="el-pop-act is-danger" onClick={() => { step(`“${name}” removed from the budget`, (p) => removeLine(p, r.lineId)); onClose(); }}>Delete cost</button>}
        </footer>
      )}
    </div>,
    document.body,
  );
}

const hint = (v, what) => (v && v[what] !== null && v[what] !== undefined ? ` · ${quantityText(v[what])}` : '');
const storedLine = (production, r) => (r.lineId ? production?.budget?.lines?.[r.lineId] : null);
const rowDaysFrom = (production, r) => storedLine(production, r)?.days?.from ?? null;
const rowQtyFrom = (production, r) => (storedLine(production, r)?.qty?.from === 'manual' ? 'manual' : (r.source ? 'derived' : 'manual'));
const storedQty = (production, r) => storedLine(production, r)?.qty?.value ?? null;
const storedDays = (production, r) => storedLine(production, r)?.days?.value ?? null;

function reviewText(r) {
  if (r.flags.includes('missingSource')) return `“${r.name}” is no longer in the project (changed elsewhere), so its amount isn’t known. Keep it as your own cost, link it to another item, or remove it. It isn’t in the total until then.`;
  if (r.review?.reason === 'deleted') return `“${r.review.from?.name || r.name}” was deleted, so this cost is waiting. Its last amount still shows; it isn’t in the total until you choose.`;
  if (r.review?.reason === 'merged') return `“${r.review.from?.name}” was merged into “${r.name}”, and both had costs. Is it the same cost twice, or two costs? Neither is in the total until you choose.`;
  return `“${r.review?.from?.name}” was renamed to “${r.name}”, which had a cost already. Neither is in the total until you choose.`;
}

function relinkOptions(production, rows, src, r) {
  if (!(r.flags.includes('missingSource') || r.review?.reason === 'deleted')) return [];
  const kind = src?.kind || r.review?.from?.kind;
  const out = [];
  if (kind === 'element') {
    const used = new Set(rows.flatMap((row) => Object.values(row.needs || {}).flat().map((n) => n.id)));
    for (const e of Object.values(production?.elements || {})) if (used.has(e.id)) out.push({ value: JSON.stringify({ kind: 'element', id: e.id }), label: e.name });
  } else if (kind === 'cast') {
    for (const n of [...new Set(rows.flatMap((row) => (row.cast || []).map((c) => c.name)))]) out.push({ value: JSON.stringify({ kind: 'cast', name: n }), label: n });
  } else if (kind === 'site') {
    for (const s of Object.values(production?.locations?.sites || {})) if (s?.id) out.push({ value: JSON.stringify({ kind: 'site', id: s.id }), label: s.name });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** A filming location's own details and the scripted places shot there. */
function SiteDetails({ production, rows, siteId, readOnly, step, onClose }) {
  const site = production?.locations?.sites?.[siteId] || {};
  const places = [...new Set(rows.map((r) => basePlace(r.location || r.heading)).filter(Boolean))].sort();
  const mapped = production?.locations?.places || {};
  const [deleting, setDeleting] = useState(false);
  return (
    <section className="el-pop-part" aria-label="Filming location">
      <span className="plan-label">Filming location</span>
      <TextField value={site.name || ''} ariaLabel="Location name" readOnly={readOnly} className="bud-name-input" onCommit={(v) => v && step(`Filming location “${v}”`, (p) => updateSite(p, siteId, { name: v }))} />
      <TextField value={site.address || ''} ariaLabel="Address" placeholder="Address" readOnly={readOnly} onCommit={(v) => step(`Address of “${site.name}”`, (p) => updateSite(p, siteId, { address: v }))} />
      <span className="plan-label">Scripted places shot here</span>
      <div className="bud-places">
        {places.map((pl) => {
          const here = mapped[pl] === siteId;
          const elsewhere = mapped[pl] && !here ? production?.locations?.sites?.[mapped[pl]]?.name : null;
          return (
            <label key={pl} className="bud-choice" title={elsewhere ? `Now at ${elsewhere}` : undefined}>
              <input type="checkbox" disabled={readOnly} checked={here}
                onChange={(e) => step(e.target.checked ? `${pl} shoots at “${site.name}”` : `${pl}: no filming location`, (p) => mapPlace(p, pl, e.target.checked ? siteId : null))} />
              {pl}{elsewhere && <span className="bud-muted"> · now at {elsewhere}</span>}
            </label>
          );
        })}
      </div>
      {!readOnly && (deleting ? (
        <div className="el-pop-confirm" role="group" aria-label="Delete the filming location">
          <p>Delete “{site.name}”? Its scripted places go back to unassigned; a cost on it stays, for review. Ctrl+Z undoes it.</p>
          <button type="button" className="el-pop-act is-danger" onClick={() => { step(`Filming location “${site.name}” deleted`, (p) => deleteSite(p, siteId)); onClose(); }}>Delete location</button>
          <button type="button" className="btn" onClick={() => setDeleting(false)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="el-pop-act is-danger bud-site-del" onClick={() => setDeleting(true)}>Delete location…</button>
      ))}
    </section>
  );
}

/** Text saved on Enter or leaving the field; Esc puts back what was there. */
function TextField({ value, ariaLabel, placeholder, readOnly, className = '', onCommit }) {
  const [text, setText] = useState(null);
  if (readOnly) return value ? <p className="el-pop-hint">{value}</p> : null;
  const commit = () => {
    if (text !== null && text.replace(/\s+/g, ' ').trim() !== (value || '')) onCommit(text.replace(/\s+/g, ' ').trim());
    setText(null);
  };
  return (
    <input
      className={`bud-text ${className}`}
      value={text === null ? value || '' : text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape' && text !== null) { e.preventDefault(); e.stopPropagation(); setText(null); }
      }}
    />
  );
}

/** A quantity or number of days: above 0, two decimals at most; invalid text is never saved. */
function NumberField({ value, ariaLabel, readOnly, locale, notify, onCommit }) {
  const saved = value === null || value === undefined ? '' : String(value);
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);
  if (readOnly) return <span>{saved || '–'}</span>;
  const commit = (how) => {
    if (text === null || !text.trim() || text.trim() === saved) { setText(null); setError(null); return; }
    const r = parseQuantity(text, locale);
    if (r.error) {
      if (how === 'enter') setError(r.message);
      else { setText(null); setError(null); notify?.(`Not saved: ${r.message.toLowerCase()}`); }
      return;
    }
    onCommit(r.value);
    setText(null);
    setError(null);
  };
  return (
    <span className={`bud-qty-field${error ? ' has-error' : ''}`}>
      <input
        type="text"
        inputMode="decimal"
        value={text === null ? saved : text}
        placeholder="–"
        aria-label={ariaLabel}
        aria-invalid={!!error}
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit('enter'); }
          if (e.key === 'Escape' && text !== null) { e.preventDefault(); e.stopPropagation(); setText(null); setError(null); }
        }}
        onBlur={() => commit('blur')}
      />
      {error && <span className="bud-error" role="alert">{error}</span>}
    </span>
  );
}
