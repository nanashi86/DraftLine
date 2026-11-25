import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus } from 'lucide-react';
import Select from '../Select.jsx';
import BudgetRowPopover from './BudgetRowPopover.jsx';
import { HIDDEN, useDismiss, useFloating, useFocusWhenPlaced } from './floating.js';
import { SECTIONS, budgetModel, removeFee, setBudgetSettings, setCurrency, setFee, setLine } from '../../lib/budget.js';
import { addSite, mapPlace } from '../../lib/productionData.js';
import {
  amountField, basisDetail, basisShort, currencyChoices, currencyName, money, parsePercent, parseQuantity, parseRate, perLabel, percentText, suggestCurrency,
} from '../../lib/budgetUi.js';
import { scheduleModel } from '../../lib/schedule.js';
import './BudgetView.css';

/**
 * Plan → Budget (Stage 2, Phase 3B): one editorial table over lib/budget.js's model. Every element in a
 * scene, every speaking character and every filming location is already a row; most are priced by typing a
 * rate. Everything else (the costing method, quantities, days, notes, review) is in the row's popover,
 * showing only what applies. Spec: docs/specs/budget.md.
 *
 * No money is worked out here: rows, subtotals and totals are budgetModel's. Each change is one undo
 * step through `step(label, change)` (App.jsx budgetStep), `change` being lib functions composed:
 * production in, { production } (or { error }) out. Opening the Budget writes nothing.
 *
 *   rows, schedule: the breakdown rows and the stored schedule (null when there's none or it's unreadable)
 *   readOnly: a newer build's budget or project (shown, never changed)
 *   focus: { key, n } — a row to show (the element card's Budget link); addCost: { anchor, n } — + Cost
 */
export default function BudgetView({ production, rows, schedule, step, readOnly = false, focus = null, addCost = null, notify }) {
  const locale = globalThis.navigator?.language || 'en-US';
  const sched = useMemo(() => (schedule ? scheduleModel(rows, schedule) : null), [rows, schedule]);
  const m = useMemo(() => budgetModel(production, rows, sched), [production, rows, sched]);
  const [folded, setFolded] = useState(() => new Set());
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);
  const [open, setOpen] = useState(null); // { key, anchor } a row's popover
  const [adding, setAdding] = useState(null); // a section with a new cost being typed
  const [picker, setPicker] = useState(null); // + Cost's section list: { anchor }
  const [currencyAsk, setCurrencyAsk] = useState(null); // first amount: { anchor, text, apply, label, onCancel }
  const [currencyChange, setCurrencyChange] = useState(null); // { code, count } or { code, refused: [names] }
  const [feeEdit, setFeeEdit] = useState(null); // { anchor, fee }
  const [assign, setAssign] = useState(null); // { anchor, place }
  const [placesOpen, setPlacesOpen] = useState(false); // the scripted places not yet at a filming location
  // + Cost in the header: each press (a new `n`) opens the section list.
  const [seenAdd, setSeenAdd] = useState(addCost?.n ?? 0);
  if (addCost && addCost.n !== seenAdd) {
    setSeenAdd(addCost.n);
    setPicker({ anchor: addCost.anchor });
  }
  // The element card's link: show that row (scroll to it, a brief highlight, the caret in its rate).
  useEffect(() => {
    if (!focus?.key) return undefined;
    const el = document.querySelector(`[data-budget-key="${CSS.escape(focus.key)}"]`);
    if (!el) return undefined;
    el.scrollIntoView({ block: 'center' });
    el.querySelector('.bud-rate input')?.focus();
    el.classList.add('is-flash');
    const t = setTimeout(() => el.classList.remove('is-flash'), 1600);
    return () => clearTimeout(t);
  }, [focus]);

  if (!m.readable) {
    return <p className="plan-empty">This budget was made by a newer version of DraftLine. It’s kept exactly as it is: update DraftLine to see or change it.</p>;
  }
  const currency = m.currency;
  const all = m.sections.flatMap((s) => s.rows);
  const rowByKey = new Map(all.map((r) => [r.key, r]));
  const openRow = open ? rowByKey.get(open.key) : null;

  // ---- Writing (each one undo step) --------------------------------------------------------------------
  /** An amount typed with no currency set: ask which one first (once), then save both together. */
  const withCurrency = (anchor, text, label, apply, onCancel) => {
    if (currency) {
      const r = parseRate(text, currency, locale);
      if (r.error || r.empty) return r;
      return step(label, (p) => apply(p, r.value));
    }
    setCurrencyAsk({ anchor, text, label, apply, onCancel, after: onCancel }); // either way the field shows what's saved
    return { pending: true };
  };
  const rateOf = (r, value) => (p) => (r.lineId ? setLine(p, r.lineId, { rate: value }) : setLine(p, null, { source: r.source, rate: value }));

  // ---- The summary -----------------------------------------------------------------------------------
  const g = m.gaps;
  const gaps = [
    g.missingRates && <button key="r" type="button" className="plan-clear" aria-pressed={onlyUnpriced} onClick={() => setOnlyUnpriced((v) => !v)}>{plural(g.missingRates, 'item')} without a rate</button>,
    g.missingQuantities && <span key="q">{plural(g.missingQuantities, 'quantity', 'quantities')} or days to enter</span>,
    g.unscheduledScenes && <span key="u">{plural(g.unscheduledScenes, 'scene')} not scheduled</span>,
    g.unassignedPlaces && all.some((r) => r.section === 'locations') && <span key="p">{plural(g.unassignedPlaces, 'place')} without a filming location</span>,
    g.reviews && <span key="v" className="bud-warn">{plural(g.reviews, 'cost')} to review</span>,
    g.overflow && <span key="o" className="bud-warn">an amount too large to add up</span>,
  ].filter(Boolean);
  const totalLabel = m.status === 'complete' ? 'Total' : m.status === 'estimated' ? 'Estimated total' : 'Partial total';
  const firstRate = all.find((r) => r.lineId && r.rate)?.rate;
  const example = firstRate ? amountField(firstRate, currency, locale) : null;

  const sections = m.sections.map((s) => {
    const rowsShown = onlyUnpriced ? s.rows.filter((r) => !r.unresolved && r.flags.includes('missingRate')) : s.rows;
    return { ...s, shown: rowsShown };
  });
  const visible = sections.filter((s) => s.shown.length || adding === s.id || (s.id === 'locations' && !onlyUnpriced && (m.unassigned.length || s.rows.length)));

  return (
    <div className="bud">
      <div className="plan-summary-row bud-summary">
        <p className="plan-summary" role="status">
          {/* Each part keeps its " ·", so a line never starts with one; a button (which a line may break
              after) is held to its dot. */}
          {[
            <span key="t" className="bud-total-line">{totalLabel} <b>{money(m.totals.total, currency, locale)}</b></span>,
            ...gaps.map((el, i) => <span key={`g${i}`} className={`bud-gaps${el.type === 'button' ? ' bud-part' : ''}`}>{el}</span>),
            ...(m.status === 'estimated' ? [<span key="e">includes estimates</span>] : []),
          ].map((el, i, all) => (i < all.length - 1
            ? <span key={el.key} className={el.props.className?.includes('bud-part') ? 'bud-part' : undefined}>{el}{'\u00a0·'} </span>
            : el))}
        </p>
        <CurrencyControl
          currency={currency}
          locale={locale}
          readOnly={readOnly}
          onPick={(code) => {
            const r = setCurrency(production, code);
            if (r.needsConfirm) return setCurrencyChange({ code, count: r.count });
            if (r.error === 'precision') return setCurrencyChange({ code, refused: namesOf(r.lines, production) });
            if (!r.error) step(`Currency: ${code}`, () => r);
          }}
        />
      </div>
      {currencyChange && (
        <div className="el-pop-confirm bud-confirm" role="group" aria-label="Change the currency">
          {currencyChange.refused ? (
            <>
              <p>{currencyName(currencyChange.code, locale)} can’t hold these amounts exactly, so nothing was changed: {currencyChange.refused.join(', ')}. Change those amounts first, or keep {currency}.</p>
              <button type="button" className="btn" onClick={() => setCurrencyChange(null)}>OK</button>
            </>
          ) : (
            <>
              <p>Change to {currencyName(currencyChange.code, locale)} ({currencyChange.code})? Your {plural(currencyChange.count, 'amount')} keep their numbers{example ? ` (${example} stays ${example})` : ''}. Nothing is converted.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const code = currencyChange.code;
                  const r = setCurrency(production, code, { confirm: true });
                  if (r.error === 'precision') return setCurrencyChange({ code, refused: namesOf(r.lines, production) });
                  if (!r.error) step(`Currency: ${code}`, () => r);
                  setCurrencyChange(null);
                }}
              >
                Change currency
              </button>
              <button type="button" className="btn" onClick={() => setCurrencyChange(null)}>Cancel</button>
            </>
          )}
        </div>
      )}
      {!m.scheduled && (
        <p className="bud-planned">
          No shooting schedule yet ·{' '}
          <label>
            Planned shooting days{' '}
            <QuantityField
              value={m.plannedDays}
              ariaLabel="Planned shooting days"
              readOnly={readOnly}
              notify={notify}
              onCommit={(v) => step(v === null ? 'Planned shooting days cleared' : `Planned shooting days: ${v}`, (p) => setBudgetSettings(p, { plannedDays: v }))}
              locale={locale}
              allowClear
            />
          </label>
        </p>
      )}
      {onlyUnpriced && (
        <p className="bud-filter" role="status">
          Showing {plural(g.missingRates, 'item')} without a rate ·{' '}
          <button type="button" className="plan-clear" onClick={() => setOnlyUnpriced(false)}>Show all</button>
        </p>
      )}

      <div className="bud-table" role="table" aria-label="Budget">
        <div className="bud-row bud-head" role="row">
          <span role="columnheader">Item</span>
          <span role="columnheader">Basis</span>
          <span role="columnheader" className="bud-rate">Rate</span>
          <span role="columnheader" className="bud-num">Total</span>
        </div>
        {visible.map((s) => {
          const isFolded = folded.has(s.id);
          const unpriced = s.rows.filter((r) => !r.unresolved && r.flags.includes('missingRate')).length;
          return (
            <div key={s.id} className="bud-section" role="rowgroup" aria-label={s.label}>
              <div className="bud-sec-head" role="row">
                <button
                  type="button"
                  className="bud-fold"
                  aria-expanded={!isFolded}
                  onClick={() => setFolded((f) => {
                    const n = new Set(f);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })}
                >
                  <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className="bud-chev" />
                  <span className="bud-sec-name">{s.label}</span>
                  {unpriced > 0 && <span className="bud-sec-note">{unpriced} without a rate</span>}
                </button>
                <span className="bud-num bud-sec-sub" role="cell">{s.subtotal ? money(s.subtotal, currency, locale) : ''}</span>
              </div>
              {!isFolded && (
                <>
                  {s.shown.map((r) => (
                    <BudgetRow
                      key={r.key}
                      r={r}
                      line={r.lineId ? production.budget?.lines?.[r.lineId] : null}
                      currency={currency}
                      locale={locale}
                      readOnly={readOnly}
                      notify={notify}
                      onOpen={(anchor) => setOpen({ key: r.key, anchor })}
                      onRate={(text, anchor, revert) => withCurrency(anchor, text, `Rate for “${r.name}”`, (p, v) => rateOf(r, v)(p), revert)}
                    />
                  ))}
                  {s.id === 'locations' && !onlyUnpriced && m.unassigned.length > 0 && (
                    <div className="bud-unassigned">
                      <button type="button" className="bud-unassigned-toggle" aria-expanded={placesOpen} onClick={() => setPlacesOpen((v) => !v)}>
                        <ChevronDown size={13} strokeWidth={2} className="bud-chev" aria-hidden="true" />
                        {plural(m.unassigned.length, 'scripted place')} without a filming location
                      </button>
                      {placesOpen && (
                        <ul className="bud-unassigned-list" aria-label="Scripted places without a filming location">
                          {m.unassigned.map((u) => (
                            <li key={u.place}>
                              <button
                                type="button"
                                className="bud-place"
                                disabled={readOnly}
                                aria-haspopup="dialog"
                                title={`Choose or add the filming location for ${u.place}`}
                                onClick={(e) => setAssign({ anchor: e.currentTarget, place: u.place })}
                              >
                                {u.place}
                              </button>
                              <span className="bud-muted">{plural(u.sceneIds.length, 'scene')}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {adding === s.id && (
                    <NewCost
                      section={s}
                      currency={currency}
                      locale={locale}
                      onCancel={() => setAdding(null)}
                      onSave={(label, rateText, anchor) => {
                        const make = (p, rate) => setLine(p, null, { section: s.id, label, method: 'flat', ...(rate !== undefined ? { rate } : {}) });
                        if (!rateText.trim()) {
                          step(`“${label}” added to ${s.label}`, (p) => make(p));
                          setAdding(null);
                          return {};
                        }
                        const r = withCurrency(anchor, rateText, `“${label}” added to ${s.label}`, make, () => {});
                        if (!r?.error && !r?.pending) setAdding(null);
                        if (r?.pending) setCurrencyAsk((a) => ({ ...a, after: () => setAdding(null) }));
                        return r;
                      }}
                    />
                  )}
                  {!readOnly && adding !== s.id && (
                    <div className="bud-add-row">
                      <button type="button" className="plan-add" aria-label={`Add a cost to ${s.label}`} onClick={() => setAdding(s.id)}>
                        <Plus size={12} strokeWidth={2} aria-hidden="true" /> Cost
                      </button>
                      {s.id === 'locations' && (
                        <button
                          type="button"
                          className="plan-add"
                          aria-label="Add a filming location"
                          onClick={(e) => setAssign({ anchor: e.currentTarget, place: null })}
                        >
                          <Plus size={12} strokeWidth={2} aria-hidden="true" /> Filming location
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {!visible.length && <p className="plan-empty">{onlyUnpriced ? 'Every item has a rate.' : 'Nothing to cost yet: elements you add in Breakdowns, the speaking cast and filming locations appear here.'}</p>}
      </div>

      <Totals m={m} currency={currency} locale={locale} readOnly={readOnly} notify={notify} totalLabel={totalLabel}
        onContingency={(bp) => step(bp === null ? 'Contingency removed' : `Contingency ${percentText(bp)}`, (p) => setBudgetSettings(p, { contingency: bp }))}
        onFee={(anchor, fee) => setFeeEdit({ anchor, fee })}
      />

      {openRow && (
        <BudgetRowPopover
          key={open.key}
          row={openRow}
          anchor={open.anchor}
          production={production}
          rows={rows}
          sched={sched}
          currency={currency}
          locale={locale}
          readOnly={readOnly}
          step={step}
          notify={notify}
          onClose={() => setOpen(null)}
        />
      )}
      {picker && (
        <SectionPicker
          anchor={picker.anchor}
          onPick={(id) => {
            setPicker(null);
            setFolded((f) => { const n = new Set(f); n.delete(id); return n; });
            setOnlyUnpriced(false);
            setAdding(id);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {currencyAsk && (
        <CurrencyAsk
          ask={currencyAsk}
          locale={locale}
          onUse={(code) => {
            const r = parseRate(currencyAsk.text, code, locale);
            if (r.error) return r;
            const res = step(currencyAsk.label, (p) => {
              const c = setCurrency(p, code);
              return c.error ? c : currencyAsk.apply(c.production, r.value);
            });
            if (!res?.error) {
              currencyAsk.after?.();
              setCurrencyAsk(null);
            }
            return res;
          }}
          onCancel={() => {
            currencyAsk.onCancel?.();
            setCurrencyAsk(null);
          }}
        />
      )}
      {feeEdit && (
        <FeeEditor
          edit={feeEdit}
          currency={currency}
          locale={locale}
          onSave={(fee, text) => {
            const save = (p, amount) => setFee(p, fee.id || null, amount !== undefined ? { label: fee.label, amount, note: fee.note } : { label: fee.label, bp: fee.bp, base: fee.base, note: fee.note });
            if (fee.kind === 'amount') {
              const r = withCurrency(feeEdit.anchor, text, `Fee “${fee.label}”`, save, () => {});
              if (r?.pending) setCurrencyAsk((a) => ({ ...a, after: () => setFeeEdit(null) }));
              else if (!r?.error) setFeeEdit(null);
              return r;
            }
            const r = step(`Fee “${fee.label}”`, (p) => save(p));
            if (!r?.error) setFeeEdit(null);
            return r;
          }}
          onRemove={(id, label) => {
            step(`Fee “${label}” removed`, (p) => removeFee(p, id));
            setFeeEdit(null);
          }}
          onClose={() => setFeeEdit(null)}
        />
      )}
      {assign && (
        <AssignPlace
          anchor={assign.anchor}
          place={assign.place}
          production={production}
          onPick={(siteId, newName) => {
            const place = assign.place;
            if (newName) {
              step(place ? `${place} shoots at “${newName}”` : `Filming location “${newName}” added`, (p) => {
                const a = addSite(p, { name: newName });
                return a.error || !place ? a : mapPlace(a.production, place, a.id);
              });
            } else if (siteId && place) {
              step(`${place} shoots at “${production.locations?.sites?.[siteId]?.name || 'a location'}”`, (p) => mapPlace(p, place, siteId));
            }
            setAssign(null);
          }}
          onClose={() => setAssign(null)}
        />
      )}
    </div>
  );
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const namesOf = (ids, production) => (ids || []).map((id) => {
  const l = production?.budget?.lines?.[id];
  const f = (production?.budget?.fees || []).find((x) => x?.id === id);
  return l?.label || l?.lastName || (l?.source?.kind === 'element' ? production?.elements?.[l.source.id]?.name : l?.source?.name) || f?.label || 'a cost';
});

function BudgetRow({ r, line, currency, locale, readOnly, notify, onOpen, onRate }) {
  const basis = basisShort(r, line);
  const zero = r.rate === 0;
  return (
    <div className={`bud-row${r.unresolved ? ' is-review' : ''}`} role="row" data-budget-key={r.key}>
      <span role="cell" className="bud-item">
        <button type="button" className="bud-name" onClick={(e) => onOpen(e.currentTarget)} title="Costing, quantities, days and notes">
          {r.name}
        </button>
        {r.note && <span className="bud-note">{r.note}</span>}
      </span>
      <span role="cell" className={`bud-basis${r.unresolved || r.flags.includes('invalid') ? ' bud-warn' : ''}`} title={basisDetail(r)}>{basis}</span>
      <span role="cell" className="bud-rate">
        <RateField
          amount={r.rate}
          currency={currency}
          locale={locale}
          readOnly={readOnly}
          per={perLabel(r.method)}
          label={`Rate for ${r.name}`}
          notify={notify}
          onCommit={onRate}
        />
      </span>
      <span role="cell" className={`bud-num bud-total${r.unresolved ? ' bud-muted' : ''}`} title={r.unresolved ? 'Not included until reviewed' : zero ? 'Confirmed free' : undefined}>
        {r.total === null ? '—' : money(r.total, currency, locale)}
      </span>
    </div>
  );
}

/**
 * A rate, edited in place. Enter or leaving the field saves a valid amount; Esc puts back what was
 * there. Something that isn't an amount is never saved over a valid one: Enter keeps the text to fix,
 * leaving the field puts back the saved amount and says so. An empty field changes nothing (a rate is
 * cleared in the row's popover); 0 is a confirmed zero.
 */
function RateField({ amount, currency, locale, readOnly, per, label, notify, onCommit }) {
  const saved = amount === null || amount === undefined ? '' : amountField(amount, currency, locale);
  const [text, setText] = useState(null); // null: not editing
  const [error, setError] = useState(null);
  const ref = useRef(null);
  if (readOnly) return <span className="bud-rate-ro">{saved || '—'}{per && saved ? ` /${per}` : ''}</span>;
  const shown = text === null ? saved : text;
  const commit = (how) => {
    if (text === null || text.trim() === saved) {
      setText(null);
      setError(null);
      return;
    }
    if (!text.trim()) { // emptied: nothing changes
      setText(null);
      setError(null);
      return;
    }
    const r = onCommit(text, ref.current, () => { setText(null); setError(null); });
    if (r?.pending) return; // asking for the currency
    if (r?.error) {
      if (how === 'enter') setError(r.message);
      else {
        setText(null);
        setError(null);
        notify?.(`Rate not saved: ${r.message.toLowerCase()}`);
      }
      return;
    }
    setText(null);
    setError(null);
  };
  return (
    <span className={`bud-rate-field${error ? ' has-error' : ''}`}>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder="Add rate"
        aria-label={label}
        aria-invalid={!!error}
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit('enter'); }
          if (e.key === 'Escape' && text !== null) { e.preventDefault(); e.stopPropagation(); setText(null); setError(null); }
        }}
        onBlur={() => commit('blur')}
      />
      {per && <span className="bud-per" aria-hidden="true">/{per}</span>}
      {error && <span className="bud-error" role="alert">{error}</span>}
    </span>
  );
}


/** A number edited in place (planned days): same rules as a rate; `allowClear`: empty clears it. */
export function QuantityField({ value, ariaLabel, readOnly, notify, onCommit, locale, allowClear = false, placeholder = '–' }) {
  const saved = value === null || value === undefined ? '' : String(value);
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);
  if (readOnly) return <span>{saved || '–'}</span>;
  const commit = (how) => {
    if (text === null || text.trim() === saved) { setText(null); setError(null); return; }
    if (!text.trim()) {
      setText(null);
      if (allowClear && saved) onCommit(null);
      return;
    }
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
        placeholder={placeholder}
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

function CurrencyControl({ currency, locale, readOnly, onPick }) {
  const options = useMemo(() => currencyChoices(locale, suggestCurrency(locale)), [locale]);
  if (readOnly) return <span className="bud-currency-ro">{currency || ''}</span>;
  return (
    <Select
      className="bud-currency"
      ariaLabel={currency ? `Currency: ${currencyName(currency, locale)}` : 'Currency (not set yet)'}
      title={currency ? `${currencyName(currency, locale)}: changing it never converts amounts` : 'The budget’s currency (set with the first amount)'}
      value={currency || ''}
      placeholder="Currency"
      options={options}
      renderValue={(opt) => opt.value}
      onChange={onPick}
    />
  );
}

/** The first amount: which currency is this budget in? (Once; nothing is saved until it's chosen.) */
function CurrencyAsk({ ask, locale, onUse, onCancel }) {
  const ref = useRef(null);
  const suggested = suggestCurrency(locale) || 'USD';
  const [code, setCode] = useState(suggested);
  const [error, setError] = useState(null);
  const pos = useFloating(ask.anchor, ref, onCancel);
  useDismiss(ref, ask.anchor, onCancel);
  useFocusWhenPlaced(ref, pos, '.bud-ask-use');
  const options = useMemo(() => currencyChoices(locale, suggested), [locale, suggested]);
  return createPortal(
    <div
      ref={ref}
      className="plan-pop el-pop bud-ask"
      role="dialog"
      aria-label="Choose the budget’s currency"
      style={pos || HIDDEN}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }}
    >
      <p className="bud-ask-q">Which currency is this budget in? You can change it later; amounts are never converted.</p>
      <Select className="bud-ask-select" ariaLabel="Currency" value={code} options={options} onChange={(v) => { setCode(v); setError(null); }} />
      {error && <p className="bud-error" role="alert">{error}</p>}
      <div className="el-pop-foot">
        <button type="button" className="el-pop-act bud-ask-use" onClick={() => { const r = onUse(code); if (r?.error) setError(r.message || 'That amount doesn’t fit this currency'); }}>Use {code}</button>
        <button type="button" className="el-pop-act is-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </div>,
    document.body,
  );
}

function NewCost({ section, currency, locale, onSave, onCancel }) {
  const [label, setLabel] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState(null);
  const rateRef = useRef(null);
  const save = () => {
    const name = label.replace(/\s+/g, ' ').trim();
    if (!name) { setError('Name the cost first'); return; }
    if (rate.trim()) {
      const p = parseRate(rate, currency || 'USD', locale);
      if (p.error) { setError(p.message); return; }
    }
    const r = onSave(name, rate, rateRef.current);
    if (r?.error) setError(r.message || 'Not saved');
  };
  const keys = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };
  return (
    <div className="bud-row bud-new" role="row">
      <span role="cell" className="bud-item">
        <input autoFocus className="bud-new-name" value={label} placeholder={`New ${section.label.toLowerCase()} cost`} aria-label={`Name of the new cost in ${section.label}`} onChange={(e) => { setLabel(e.target.value); setError(null); }} onKeyDown={keys} />
      </span>
      <span role="cell" className="bud-basis bud-muted">flat fee{error && <span className="bud-error" role="alert"> · {error}</span>}</span>
      <span role="cell" className="bud-rate">
        <span className="bud-rate-field">
          <input ref={rateRef} type="text" inputMode="decimal" value={rate} placeholder="Rate" aria-label="Rate of the new cost" onChange={(e) => { setRate(e.target.value); setError(null); }} onKeyDown={keys} />
        </span>
      </span>
      <span role="cell" className="bud-num bud-new-acts">
        <button type="button" className="el-pop-act" onClick={save}>Add</button>
        <button type="button" className="el-pop-act is-quiet" onClick={onCancel}>Cancel</button>
      </span>
    </div>
  );
}

function Totals({ m, currency, locale, readOnly, notify, totalLabel, onContingency, onFee }) {
  const t = m.totals;
  const [editing, setEditing] = useState(false);
  return (
    <div className="bud-totals" aria-label="Totals">
      <div className="bud-tline"><span>Subtotal</span><span className="bud-num">{money(t.subtotal, currency, locale)}</span></div>
      {t.contingencyBp !== null || editing ? (
        <div className="bud-tline">
          <span>
            Contingency{' '}
            {readOnly ? percentText(t.contingencyBp) : (
              <PercentField
                bp={t.contingencyBp}
                locale={locale}
                notify={notify}
                autoFocus={editing && t.contingencyBp === null}
                onCommit={(bp) => { setEditing(false); onContingency(bp); }}
                onDone={() => setEditing(false)}
              />
            )}
            <span className="bud-muted"> of the subtotal</span>
          </span>
          <span className="bud-num">{t.contingency === null ? '—' : money(t.contingency, currency, locale)}</span>
        </div>
      ) : null}
      {t.fees.map((f) => (
        <div key={f.id} className="bud-tline">
          <span>
            {readOnly ? f.label : <button type="button" className="plan-clear" onClick={(e) => onFee(e.currentTarget, { id: f.id, label: f.label, kind: f.bp !== undefined ? 'percent' : 'amount', bp: f.bp, amount: f.amount, base: f.basis === 'subtotal + contingency' ? 'withContingency' : 'subtotal' })}>{f.label}</button>}
            <span className="bud-muted"> · {f.bp !== undefined ? `${percentText(f.bp)} of the ${f.basis}` : f.basis}</span>
          </span>
          <span className="bud-num">{f.amount === null ? '—' : money(f.amount, currency, locale)}</span>
        </div>
      ))}
      {!readOnly && (
        <div className="bud-tline bud-tadd">
          {t.contingencyBp === null && !editing && <button type="button" className="plan-add" onClick={() => setEditing(true)}><Plus size={12} strokeWidth={2} aria-hidden="true" /> Contingency</button>}
          <button type="button" className="plan-add" onClick={(e) => onFee(e.currentTarget, { kind: 'percent', label: '', base: 'subtotal' })}><Plus size={12} strokeWidth={2} aria-hidden="true" /> Fee or tax</button>
        </div>
      )}
      <div className="bud-tline bud-grand">
        <span>{totalLabel}{m.status === 'incomplete' && <span className="bud-muted"> · not a full budget yet</span>}</span>
        <span className="bud-num">{money(t.total, currency, locale)}</span>
      </div>
      {t.unresolved > 0 && (
        <div className="bud-tline bud-muted"><span>Waiting for review (not included)</span><span className="bud-num">{money(t.unresolved, currency, locale)}</span></div>
      )}
    </div>
  );
}

function PercentField({ bp, locale, notify, onCommit, onDone, autoFocus }) {
  const saved = bp === null || bp === undefined ? '' : String(bp / 100);
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);
  const commit = (how) => {
    if (text === null || text.trim() === saved) { setText(null); onDone?.(); return; }
    if (!text.trim()) { setText(null); if (saved) onCommit(null); else onDone?.(); return; }
    const r = parsePercent(text, locale);
    if (r.error) {
      if (how === 'enter') setError(r.message);
      else { setText(null); setError(null); notify?.(`Not saved: ${r.message.toLowerCase()}`); onDone?.(); }
      return;
    }
    setText(null);
    setError(null);
    onCommit(r.value);
  };
  return (
    <span className={`bud-qty-field bud-pct${error ? ' has-error' : ''}`}>
      <input
        autoFocus={autoFocus}
        type="text"
        inputMode="decimal"
        value={text === null ? saved : text}
        placeholder="0"
        aria-label="Contingency percentage"
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit('enter'); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setText(null); setError(null); onDone?.(); }
        }}
        onBlur={() => commit('blur')}
      />
      %
      {error && <span className="bud-error" role="alert">{error}</span>}
    </span>
  );
}

function FeeEditor({ edit, currency, locale, onSave, onRemove, onClose }) {
  const ref = useRef(null);
  const f = edit.fee;
  const [label, setLabel] = useState(f.label || '');
  const [kind, setKind] = useState(f.kind || 'percent');
  const [value, setValue] = useState(f.kind === 'amount' && f.amount !== undefined ? amountField(f.amount, currency, locale) : f.bp !== undefined ? String(f.bp / 100) : '');
  const [base, setBase] = useState(f.base || 'subtotal');
  const [error, setError] = useState(null);
  const pos = useFloating(edit.anchor, ref, onClose);
  useDismiss(ref, edit.anchor, onClose);
  useFocusWhenPlaced(ref, pos, '.bud-fee-label');
  const save = () => {
    const name = label.replace(/\s+/g, ' ').trim();
    if (!name) return setError('Name it (Sales tax, Agency fee…)');
    if (kind === 'percent') {
      const p = parsePercent(value, locale);
      if (p.error || p.empty) return setError(p.message || 'Enter a percentage');
      const r = onSave({ id: f.id, label: name, kind, bp: p.value, base }, value);
      if (r?.error) setError(r.message || 'Not saved');
    } else {
      if (!value.trim()) return setError('Enter an amount');
      const r = onSave({ id: f.id, label: name, kind }, value);
      if (r?.error) setError(r.message || 'Not saved');
    }
    return undefined;
  };
  const keys = (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
  return createPortal(
    <div ref={ref} className="plan-pop el-pop bud-fee" role="dialog" aria-label={f.id ? `Fee: ${f.label}` : 'New fee or tax'} style={pos || HIDDEN}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
      <section className="el-pop-part">
        <span className="plan-label">{f.id ? 'Fee or tax' : 'New fee or tax'}</span>
        <input className="bud-fee-label el-pop-name" value={label} placeholder="Sales tax" aria-label="Name" onChange={(e) => { setLabel(e.target.value); setError(null); }} onKeyDown={keys} />
        <div className="el-pop-row">
          <Select className="bud-fee-kind" ariaLabel="Kind" value={kind} options={[{ value: 'percent', label: 'Percentage' }, { value: 'amount', label: 'Fixed amount' }]} onChange={(v) => { setKind(v); setError(null); }} />
          <span className="bud-qty-field">
            <input type="text" inputMode="decimal" value={value} placeholder={kind === 'percent' ? '7.5' : '250.00'} aria-label={kind === 'percent' ? 'Percentage' : 'Amount'} onChange={(e) => { setValue(e.target.value); setError(null); }} onKeyDown={keys} />
            {kind === 'percent' ? '%' : ''}
          </span>
        </div>
        {kind === 'percent' && (
          <Select className="bud-fee-base" ariaLabel="Worked out on" value={base} options={[{ value: 'subtotal', label: 'Of the subtotal' }, { value: 'withContingency', label: 'Of the subtotal + contingency' }]} onChange={setBase} />
        )}
        <p className="el-pop-hint">A fee is never worked out on another fee.</p>
        {error && <p className="bud-error" role="alert">{error}</p>}
      </section>
      <footer className="el-pop-foot">
        <button type="button" className="el-pop-act" onClick={save}>{f.id ? 'Save' : 'Add'}</button>
        <span className="sr-spacer" />
        {f.id && <button type="button" className="el-pop-act is-danger" onClick={() => onRemove(f.id, f.label)}>Remove</button>}
      </footer>
    </div>,
    document.body,
  );
}

/** + Cost: which section? */
function SectionPicker({ anchor, onPick, onClose }) {
  const ref = useRef(null);
  const pos = useFloating(anchor, ref, onClose);
  useDismiss(ref, anchor, onClose);
  useFocusWhenPlaced(ref, pos, '.bud-pick button');
  return createPortal(
    <div ref={ref} className="plan-pop el-pop bud-picker" role="dialog" aria-label="Add a cost to…" style={pos || HIDDEN}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const items = [...ref.current.querySelectorAll('.bud-pick button')];
          const i = items.indexOf(document.activeElement);
          items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        }
      }}>
      <span className="plan-label">Add a cost to…</span>
      <ul className="bud-pick">
        {SECTIONS.map((s) => <li key={s.id}><button type="button" onClick={() => onPick(s.id)}>{s.label}</button></li>)}
      </ul>
    </div>,
    document.body,
  );
}

/** A scripted place → a filming location (an existing one, or a new one); or a new location on its own. */
function AssignPlace({ anchor, place, production, onPick, onClose }) {
  const ref = useRef(null);
  const [name, setName] = useState('');
  const pos = useFloating(anchor, ref, onClose);
  useDismiss(ref, anchor, onClose);
  useFocusWhenPlaced(ref, pos, place ? '.bud-assign button, .bud-assign-new input' : '.bud-assign-new input');
  const sites = Object.values(production?.locations?.sites || {}).filter((s) => s && typeof s === 'object').sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const add = () => { const n = name.replace(/\s+/g, ' ').trim(); if (n) onPick(null, n); };
  return createPortal(
    <div ref={ref} className="plan-pop el-pop bud-assign-pop" role="dialog" aria-label={place ? `Where is ${place} shot?` : 'New filming location'} style={pos || HIDDEN}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
      <span className="plan-label">{place ? `Where is ${place} shot?` : 'New filming location'}</span>
      {place && sites.length > 0 && (
        <ul className="bud-pick bud-assign">
          {sites.map((s) => <li key={s.id}><button type="button" onClick={() => onPick(s.id)}>{s.name}</button></li>)}
        </ul>
      )}
      <div className="bud-assign-new el-pop-row">
        <input value={name} placeholder="A real place: Port de Fécamp, quai 3" aria-label="Name of a new filming location" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="el-pop-act" onClick={add}>Add</button>
      </div>
      <p className="el-pop-hint">The script’s places stay as written: this is where you’ll actually film.</p>
    </div>,
    document.body,
  );
}
