// The Budget (Stage 2, Phase 3A): estimates built on the breakdowns, shared elements, cast and
// schedule. Spec: docs/specs/budget.md.
//
// A sparse overlay. Every element in a scene, every speaking character and every filming location is
// a budget row already (a "candidate", computed, never stored); a line is stored only once the writer
// gives it something (a rate, a method, a quantity, a note), or adds a cost of their own. Opening a
// project writes nothing, and a row nobody touched can never be orphaned.
//
// Stored at production.budget, losslessly: lines and settings are kept exactly as found, and read
// with validation (an unreadable value is shown as missing, never dropped). A newer build's budget
// (version above BUDGET_VERSION) is kept untouched and is never changed here.
//
//   { version: 1, currency: 'USD', plannedDays: 12,
//     week: { days: 5 | 7, rounding: 'prorate' | 'up' },
//     contingency: { bp: 1000 },                                  10 %, on the subtotal
//     fees: [{ id, label, bp | amount, base: 'subtotal' | 'withContingency', note }],
//     lines: { [id]: Line } }
//   Line: { id, section, label, source: { kind: 'element', id } | { kind: 'cast', name } | { kind: 'site', id },
//           method, rate (minor units; 0 = confirmed free; absent / null = unknown),
//           qty: { from: 'derived' } | { from: 'manual', value }, days: { from: 'use' | 'span' | 'calendar' | 'shoot' } | { from: 'manual', value },
//           usage: 'reuse' | 'consume', holds: 'unpaid' | 'paid', week: { days, rounding }, note,
//           origin: [{ kind, id | name, name }]     every source it has been re-pointed from (provenance)
//           review: { reason: 'merged' | 'deleted' | 'renamed', group, from, footprint } }

import { jsonCopy } from './passThrough.js';
import { CATEGORIES } from './elements.js';
import {
  amountOf, applyBasisPoints, currencyDigits, hundredths, isAmount, isBasisPoints, isCurrency, isQuantity, quantityText, sumAmounts,
} from './money.js';
import { siteName, siteUsage } from './locations.js';

export const BUDGET_VERSION = 1;

/** The sections, in order: cast, the eight element categories, then costs entered by hand. */
export const SECTIONS = [
  { id: 'cast', label: 'Cast' },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  { id: 'locations', label: 'Locations' },
  { id: 'crew', label: 'Crew' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'transport', label: 'Transport' },
  { id: 'catering', label: 'Catering' },
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'pre', label: 'Pre-production' },
  { id: 'post', label: 'Post-production' },
  { id: 'other', label: 'Other' },
];
const SECTION_IDS = new Set(SECTIONS.map((s) => s.id));
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

/**
 * How a line is costed. needs: what it multiplies the rate by.
 *   flat       a fee or a one-time purchase                    rate
 *   unit       per item                                        rate × quantity
 *   day        a package per shooting day                      rate × days
 *   unitDay    per item per day                                rate × quantity × days
 *   week       a package per week                              rate × weeks
 *   unitWeek   per item per week                               rate × quantity × weeks
 *   personDay  background: per person per day                  rate × person-days (from the schedule, or
 *                                                              people × days entered) — never × days again
 */
export const METHODS = {
  flat: { label: 'Flat fee', qty: false, days: false },
  unit: { label: 'Per unit', qty: true, days: false },
  day: { label: 'Per day', qty: false, days: true },
  unitDay: { label: 'Per unit per day', qty: true, days: true },
  week: { label: 'Per week', qty: false, days: true, weeks: true },
  unitWeek: { label: 'Per unit per week', qty: true, days: true, weeks: true },
  personDay: { label: 'Per person-day', qty: true, days: true },
};
export const DAYS_FROM = ['use', 'span', 'calendar', 'shoot', 'manual'];
export const DEFAULT_WEEK = { days: 5, rounding: 'prorate' };
const REVIEWS = new Set(['merged', 'deleted', 'renamed']);

const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const cleanText = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
export const newLineId = () => `bl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const newGroupId = () => `rv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---- Stored data ------------------------------------------------------------------------------------

/** Can this version read and change it? (Absent; or an object, not newer.) */
export const budgetReadable = (raw) => raw == null || (plain(raw) && !(Number.isInteger(raw.version) && raw.version > BUDGET_VERSION));

/**
 * Stored → clean, or null when there's nothing. Lossless: values are kept as found, read with
 * validation; something in a shape this version doesn't know is kept exactly as it is.
 */
export function normalizeBudget(raw) {
  if (raw == null) return null;
  const copy = jsonCopy(raw);
  if (copy === undefined) return null;
  if (!budgetReadable(copy)) return copy; // a newer build's (or a shape this one doesn't know): untouched
  // Exactly as stored: nothing added on reading (a line's id is its key; changes add what they need).
  const keys = Object.keys(copy).filter((k) => k !== 'version' && !(k === 'lines' && plain(copy.lines) && !Object.keys(copy.lines).length));
  return keys.length ? copy : null;
}

/** The budget to change: a copy, created when absent. null when a newer build's (never changed). */
function draftOf(production) {
  const cur = production?.budget;
  if (cur != null && !budgetReadable(cur)) return null;
  const d = jsonCopy(cur) || {};
  d.version = BUDGET_VERSION;
  if (!plain(d.lines)) d.lines = {};
  for (const [id, l] of Object.entries(d.lines)) if (plain(l)) l.id = id;
  return d;
}
/** production with `fn` applied to its budget (normalized after). fn may return a result object. */
function withBudget(production, fn) {
  const d = draftOf(production);
  if (!d) return { production, error: 'newer' };
  const result = fn(d) || {};
  if (result.error || result.needsConfirm) return { production, ...result };
  const next = { ...production, budget: normalizeBudget(d) };
  if (!next.budget) delete next.budget;
  return { ...result, production: next };
}
const sourceKey = (s) => (s?.kind === 'cast' ? `cast:${s.name}` : s?.kind && s?.id ? `${s.kind}:${s.id}` : null);
/** A source as stored: { kind: 'element' | 'site', id } or { kind: 'cast', name } (names in capitals). */
export function cleanSource(s) {
  if (!plain(s)) return null;
  if ((s.kind === 'element' || s.kind === 'site') && typeof s.id === 'string' && s.id) return { kind: s.kind, id: s.id };
  if (s.kind === 'cast' && cleanText(s.name)) return { kind: 'cast', name: cleanText(s.name).toUpperCase() };
  return null;
}

// ---- Changes to lines and settings (each: production in, { production, … } out) ----------------------

/**
 * Validate a line's fields from the writer. → { fields } or { error: 'field name' }. A field set to
 * null clears it (rate: null makes it unknown again; 0 is confirmed free).
 */
function lineFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (v === null || v === undefined) {
      out[k] = undefined;
      continue;
    }
    if (k === 'rate' && isAmount(v)) out.rate = v;
    else if (k === 'method' && v in METHODS) out.method = v;
    else if (k === 'section' && SECTION_IDS.has(v)) out.section = v;
    else if ((k === 'label' || k === 'note') && typeof v === 'string') out[k] = cleanText(v) || undefined;
    else if (k === 'source' && cleanSource(v)) out.source = cleanSource(v);
    else if (k === 'usage' && (v === 'reuse' || v === 'consume')) out.usage = v;
    else if (k === 'holds' && (v === 'paid' || v === 'unpaid')) out.holds = v;
    else if (k === 'qty' && plain(v) && (v.from === 'derived' || (v.from === 'manual' && isQuantity(v.value)))) out.qty = v.from === 'manual' ? { from: 'manual', value: v.value } : { from: 'derived' };
    else if (k === 'days' && plain(v) && DAYS_FROM.includes(v.from) && (v.from !== 'manual' || isQuantity(v.value))) out.days = v.from === 'manual' ? { from: 'manual', value: v.value } : { from: v.from };
    else if (k === 'week' && plain(v) && [5, 7, undefined].includes(v.days) && ['prorate', 'up', undefined].includes(v.rounding)) {
      out.week = { ...(v.days ? { days: v.days } : {}), ...(v.rounding ? { rounding: v.rounding } : {}) };
    } else return { error: k };
  }
  return { fields: out };
}

/**
 * Create a line (id null: a new one, or the first stored line for a candidate row) or change one.
 * → { production, id } or { error }. A new line needs a section or a source.
 */
export function setLine(production, id, fields) {
  const v = lineFields(fields);
  if (v.error) return { production, error: v.error };
  return withBudget(production, (d) => {
    if (isAmount(v.fields.rate) && !isCurrency(d.currency)) return { error: 'currency' }; // an amount means nothing without one
    let line = id ? d.lines[id] : null;
    if (id && !plain(line)) return { error: 'missing' };
    if (!line) {
      if (!v.fields.section && !v.fields.source) return { error: 'section' };
      id = newLineId();
      line = { id };
      d.lines[id] = line;
    }
    for (const [k, val] of Object.entries(v.fields)) {
      if (val === undefined) delete line[k];
      else line[k] = val;
    }
    return { id };
  });
}

/** Remove a line (an explicit, undoable choice). */
export const removeLine = (production, id) => withBudget(production, (d) => {
  if (!plain(d.lines[id])) return { error: 'missing' };
  delete d.lines[id];
});

/**
 * Settings: { plannedDays, week: { days, rounding }, contingency: bp } (null clears one).
 * Contingency is always on the subtotal of confirmed lines.
 */
export function setBudgetSettings(production, { plannedDays, week, contingency } = {}) {
  if (plannedDays !== undefined && plannedDays !== null && !isQuantity(plannedDays)) return { production, error: 'plannedDays' };
  if (contingency !== undefined && contingency !== null && !isBasisPoints(contingency)) return { production, error: 'contingency' };
  if (week !== undefined && week !== null && !(plain(week) && [5, 7].includes(week.days ?? 5) && ['prorate', 'up'].includes(week.rounding ?? 'prorate'))) {
    return { production, error: 'week' };
  }
  return withBudget(production, (d) => {
    if (plannedDays !== undefined) { if (plannedDays === null) delete d.plannedDays; else d.plannedDays = plannedDays; }
    if (contingency !== undefined) { if (contingency === null) delete d.contingency; else d.contingency = { bp: contingency }; }
    if (week !== undefined) { if (week === null) delete d.week; else d.week = { days: week.days ?? 5, rounding: week.rounding ?? 'prorate' }; }
  });
}

/**
 * Fees and taxes: { id?, label, bp | amount, base: 'subtotal' | 'withContingency', note }. A fee is
 * worked out on its base only, never on another fee, so nothing is circular. id null adds one.
 */
export function setFee(production, id, fee) {
  const label = cleanText(fee?.label);
  const pct = fee?.bp !== undefined && fee?.bp !== null;
  const ok = label && (pct ? isBasisPoints(fee.bp) && ['subtotal', 'withContingency'].includes(fee.base) : isAmount(fee?.amount));
  if (!ok) return { production, error: 'fee' };
  return withBudget(production, (d) => {
    if (!pct && !isCurrency(d.currency)) return { error: 'currency' };
    if (!Array.isArray(d.fees)) d.fees = [];
    const clean = { label, ...(pct ? { bp: fee.bp, base: fee.base } : { amount: fee.amount }), ...(cleanText(fee.note) ? { note: cleanText(fee.note) } : {}) };
    if (id) {
      const i = d.fees.findIndex((f) => plain(f) && f.id === id);
      if (i < 0) return { error: 'missing' };
      d.fees[i] = { ...d.fees[i], ...clean, id };
      if (!pct) { delete d.fees[i].bp; delete d.fees[i].base; } else delete d.fees[i].amount;
      if (!clean.note) delete d.fees[i].note;
      return { id };
    }
    const nid = newLineId().replace('bl-', 'fee-');
    d.fees.push({ id: nid, ...clean });
    return { id: nid };
  });
}
export const removeFee = (production, id) => withBudget(production, (d) => {
  const before = Array.isArray(d.fees) ? d.fees.length : 0;
  d.fees = (Array.isArray(d.fees) ? d.fees : []).filter((f) => !(plain(f) && f.id === id));
  if (d.fees.length === before) return { error: 'missing' };
  if (!d.fees.length) delete d.fees;
});

/** Every stored amount (rates, fixed fees): what a currency change would affect. */
const amountsIn = (d) => [
  ...Object.values(d.lines).filter((l) => plain(l) && isAmount(l.rate)).map((l) => ({ kind: 'line', id: l.id, amount: l.rate })),
  ...(Array.isArray(d.fees) ? d.fees : []).filter((f) => plain(f) && isAmount(f.amount)).map((f) => ({ kind: 'fee', id: f.id, amount: f.amount })),
];

/**
 * The project's currency. With amounts already entered it asks first ({ needsConfirm, count }), and
 * then keeps every amount's face value — 12.50 stays 12.50, nothing is converted. An amount the new
 * currency can't hold (12.50 in yen) stops it: { error: 'precision', lines: [...] }.
 */
export function setCurrency(production, code, { confirm = false } = {}) {
  if (!isCurrency(code)) return { production, error: 'currency' };
  return withBudget(production, (d) => {
    if (d.currency === code) return {};
    const amounts = amountsIn(d);
    const from = isCurrency(d.currency) ? currencyDigits(d.currency) : null;
    const to = currencyDigits(code);
    if (amounts.length && !confirm) return { needsConfirm: true, count: amounts.length };
    if (amounts.length && from === null) return { error: 'precision', lines: amounts.map((a) => a.id) }; // no known scale to keep
    const shift = from === null ? 0 : to - from;
    const scale = 10 ** Math.abs(shift);
    const lost = amounts.filter((a) => shift < 0 && a.amount % scale !== 0);
    if (lost.length) return { error: 'precision', lines: lost.map((a) => a.id) };
    const conv = (v) => (shift >= 0 ? v * scale : v / scale);
    const too = amounts.filter((a) => !Number.isSafeInteger(conv(a.amount)));
    if (too.length) return { error: 'range', lines: too.map((a) => a.id) };
    for (const a of amounts) {
      if (a.kind === 'line') d.lines[a.id].rate = conv(a.amount);
      else d.fees.find((f) => f.id === a.id).amount = conv(a.amount);
    }
    d.currency = code;
    return {};
  });
}

/**
 * Settle a line under review:
 *   'keep'     keep it as a cost of its own: its source goes into `origin`, and the last known
 *              quantity and days (values: { qty, days }, from the model) become manual
 *   'relink'   point it at another source (values: { source }); the old one goes into `origin`
 *   'separate' (merged / renamed) this and the other lines are intentionally separate costs
 *   'remove'   delete it
 */
export function resolveReview(production, id, action, values = {}) {
  return withBudget(production, (d) => {
    const line = d.lines[id];
    if (!plain(line)) return { error: 'missing' };
    const pastOf = (l) => [...(Array.isArray(l.origin) ? l.origin : []), ...(l.source ? [{ ...l.source, name: l.lastName || l.review?.from?.name || '' }] : [])];
    if (action === 'remove') {
      delete d.lines[id];
    } else if (action === 'keep') {
      line.origin = pastOf(line);
      delete line.source;
      if (values.qty !== undefined && isQuantity(values.qty)) line.qty = { from: 'manual', value: values.qty };
      if (values.days !== undefined && isQuantity(values.days)) line.days = { from: 'manual', value: values.days };
      line.label ||= line.review?.from?.name || line.lastName || 'Kept cost';
      line.section ||= sectionOfSource(line.review?.from, line.review?.footprint) || 'other';
      delete line.review;
    } else if (action === 'relink') {
      const src = cleanSource(values.source);
      if (!src) return { error: 'source' };
      line.origin = pastOf(line);
      line.source = src;
      delete line.review;
    } else if (action === 'separate') {
      const group = line.review?.group;
      for (const l of Object.values(d.lines)) if (plain(l) && l.review && (l.id === id || (group && l.review.group === group))) delete l.review;
    } else return { error: 'action' };
    // A review group left with one line: nothing left to compare it with.
    const groups = new Map();
    for (const l of Object.values(d.lines)) if (plain(l) && l.review?.group && l.review.reason !== 'deleted') groups.set(l.review.group, [...(groups.get(l.review.group) || []), l]);
    for (const list of groups.values()) if (list.length === 1) delete list[0].review;
    return {};
  });
}
const sectionOfSource = (from, footprint) => (from?.kind === 'cast' ? 'cast' : from?.kind === 'site' ? 'locations'
  : CATEGORY_IDS.has(footprint?.element?.category) ? footprint.element.category : null);

// ---- What production changes do to the budget (called inside productionData's own changes) ------------

const linesFor = (d, src) => Object.values(d.lines).filter((l) => plain(l) && sourceKey(cleanSource(l.source)) === sourceKey(src));

/**
 * Element `from` merged into `into`: its lines now cost `into`, with `from` kept as their origin. If
 * both had lines they may be the same cost twice: every one of them goes to review, together.
 */
export function budgetAfterMerge(budget, from, into) {
  const d = budget != null && budgetReadable(budget) ? jsonCopy(budget) : null;
  if (!d || !plain(d.lines)) return budget;
  const moving = linesFor(d, { kind: from.kind, id: from.id, name: from.name });
  if (!moving.length) return budget;
  const staying = linesFor(d, { kind: into.kind, id: into.id, name: into.name });
  const group = staying.length ? newGroupId() : null;
  for (const l of moving) {
    l.origin = [...(Array.isArray(l.origin) ? l.origin : []), { ...cleanSource(l.source), name: from.label }];
    l.source = into.kind === 'cast' ? { kind: 'cast', name: into.name } : { kind: into.kind, id: into.id };
    if (group) l.review = { reason: from.kind === 'cast' ? 'renamed' : 'merged', group, from: { ...cleanSource(from), name: from.label } };
  }
  for (const l of staying) if (group) l.review = { reason: from.kind === 'cast' ? 'renamed' : 'merged', group, from: { ...cleanSource(from), name: from.label } };
  return d;
}

/**
 * A priced source deleted (an element or a filming location): its lines stay, in review, with what
 * they need to show their last amount (`footprint`: the element and its links, or the site and the
 * places and scenes it covered). Never turned into ordinary costs without the writer saying so.
 */
export function budgetAfterDelete(budget, src, footprint, label) {
  const d = budget != null && budgetReadable(budget) ? jsonCopy(budget) : null;
  if (!d || !plain(d.lines)) return budget;
  const hit = linesFor(d, src);
  if (!hit.length) return budget;
  for (const l of hit) {
    l.lastName = label;
    l.review = { reason: 'deleted', from: { ...cleanSource(src), name: label }, footprint: jsonCopy(footprint) };
  }
  return d;
}

/** A character renamed: its cast lines follow (both names' lines in review if the new name had some). */
export const budgetAfterCastRename = (budget, oldName, newName) => budgetAfterMerge(budget,
  { kind: 'cast', name: String(oldName).trim().toUpperCase(), label: String(oldName).trim().toUpperCase() },
  { kind: 'cast', name: String(newName).trim().toUpperCase() });

// ---- The calculation --------------------------------------------------------------------------------

/**
 * Everything the Budget shows, worked out from the production, the breakdown rows (buildBreakdown)
 * and the schedule model (scheduleModel(rows, schedule)). Pure: it never writes.
 *
 * → { readable, currency, digits,
 *     sections: [{ id, label, rows: [Row], subtotal, unknown }],
 *     totals: { subtotal, contingency, fees: [{ id, label, amount, basis }], total, unresolved },
 *     status: 'complete' | 'estimated' | 'incomplete',
 *     gaps: { missingRates, missingQuantities, unscheduledScenes, unassignedPlaces, reviews, assumed, estimates },
 *     scheduled, shootingDays }
 *   Row: { key, lineId, candidate, section, name, source, method, rate, qty, days, weeks, total,
 *          flags: [...], review, basis }
 *     flags: missingRate · invalid · missingQty · missingDays · needsSchedule · unscheduled ·
 *            datesUncertain · assumedQty · estimate · notInScript · missingSource · review · overflow
 */
export function budgetModel(production, rows, model) {
  const budget = production?.budget;
  if (budget != null && !budgetReadable(budget)) return { readable: false };
  const b = normalizeBudget(budget) || { version: BUDGET_VERSION, lines: {} };
  const lines = Object.entries(plain(b.lines) ? b.lines : {}).filter(([, l]) => plain(l)).map(([id, l]) => ({ ...l, id }));
  const currency = isCurrency(b.currency) ? b.currency : null;
  const ctx = context(production, rows, model, b);
  const out = [];

  // Candidates: every source in the production, with its stored lines (or one virtual row).
  const bySource = new Map();
  for (const l of lines) {
    const k = sourceKey(cleanSource(l.source));
    if (k) bySource.set(k, [...(bySource.get(k) || []), l]);
  }
  const candidates = [
    ...[...ctx.cast.keys()].map((name) => candidateOf(ctx, { kind: 'cast', name })),
    ...[...ctx.elements.keys()].map((id) => candidateOf(ctx, { kind: 'element', id })),
    ...Object.keys(ctx.sites).map((id) => candidateOf(ctx, { kind: 'site', id })),
  ];
  const seen = new Set();
  for (const c of candidates) {
    const k = sourceKey(c.src);
    seen.add(k);
    const stored = bySource.get(k) || [null];
    for (const l of stored) out.push(rowOf(ctx, l, c));
  }
  // Lines whose source isn't a candidate (deleted, renamed by an older build, not in the script any
  // more) and lines of their own.
  for (const l of lines) {
    const k = sourceKey(cleanSource(l.source));
    if (k && seen.has(k)) continue;
    out.push(rowOf(ctx, l, null));
  }

  // Sections and totals. A line under review, or whose source is gone, is kept out of the subtotal
  // (its amount shows apart, as unresolved) until the writer settles it.
  const sections = SECTIONS.map((s) => ({ ...s, rows: [] }));
  const sectionOf = new Map(sections.map((s) => [s.id, s]));
  for (const r of out) (sectionOf.get(r.section) || sectionOf.get('other')).rows.push(r);
  for (const s of sections) {
    s.rows.sort((x, y) => (x.order - y.order) || x.name.localeCompare(y.name) || String(x.lineId).localeCompare(String(y.lineId)));
    const counted = s.rows.filter((r) => !r.unresolved && r.total !== null);
    s.subtotal = sumAmounts(counted.map((r) => r.total));
    s.unknown = s.rows.filter((r) => !r.unresolved && r.total === null).length;
  }
  const all = sections.flatMap((s) => s.rows);
  const subtotal = sumAmounts(all.filter((r) => !r.unresolved && r.total !== null).map((r) => r.total));
  const unresolved = sumAmounts(all.filter((r) => r.unresolved && r.total !== null).map((r) => r.total));
  const contingencyBp = isBasisPoints(b.contingency?.bp) ? b.contingency.bp : null;
  const contingency = contingencyBp !== null && subtotal !== null ? applyBasisPoints(subtotal, contingencyBp) : null;
  const fees = (Array.isArray(b.fees) ? b.fees : []).filter(plain).map((f) => {
    if (isAmount(f.amount)) return { id: f.id, label: cleanText(f.label), amount: f.amount, basis: 'fixed amount' };
    if (!isBasisPoints(f.bp)) return { id: f.id, label: cleanText(f.label), amount: null, basis: 'unreadable' };
    const base = f.base === 'withContingency' ? sumAmounts([subtotal ?? 0, contingency ?? 0]) : subtotal;
    return { id: f.id, label: cleanText(f.label), amount: base === null ? null : applyBasisPoints(base, f.bp), bp: f.bp, basis: f.base === 'withContingency' ? 'subtotal + contingency' : 'subtotal' };
  });
  const total = subtotal === null ? null : sumAmounts([subtotal, contingency ?? 0, ...fees.map((f) => f.amount ?? 0)]);

  const flagged = (f) => all.filter((r) => r.flags.includes(f)).length;
  const gaps = {
    missingRates: all.filter((r) => !r.unresolved && r.flags.includes('missingRate')).length,
    missingQuantities: all.filter((r) => !r.unresolved && (r.flags.includes('missingQty') || r.flags.includes('missingDays') || r.flags.includes('needsSchedule'))).length,
    unscheduledScenes: ctx.scheduled ? ctx.unscheduled.length : 0,
    unassignedPlaces: ctx.unassigned.length,
    reviews: all.filter((r) => r.unresolved).length,
    assumed: flagged('assumedQty'),
    estimates: flagged('estimate'),
    overflow: flagged('overflow') + (subtotal === null || total === null ? 1 : 0),
  };
  const incomplete = gaps.missingRates || gaps.missingQuantities || gaps.unscheduledScenes || gaps.reviews || gaps.overflow
    || fees.some((f) => f.amount === null) || all.some((r) => r.flags.includes('invalid'))
    || (gaps.unassignedPlaces && all.some((r) => r.section === 'locations'));
  return {
    readable: true, currency, digits: currency ? currencyDigits(currency) : null,
    sections, totals: { subtotal, contingency, contingencyBp, fees, total, unresolved },
    status: incomplete ? 'incomplete' : gaps.estimates || gaps.assumed ? 'estimated' : 'complete',
    gaps, scheduled: ctx.scheduled, shootingDays: ctx.scheduled ? ctx.days.length : null, plannedDays: isQuantity(b.plannedDays) ? b.plannedDays : null,
    unassigned: ctx.unassigned,
  };
}

/** A source as budgetModel lists it (section, name, order), or null when it isn't in the production now. */
function candidateOf(ctx, src) {
  if (src?.kind === 'cast') {
    const use = ctx.cast.get(src.name);
    return use ? { src, section: 'cast', name: src.name, order: use.number ?? 999 } : null;
  }
  if (src?.kind === 'element') {
    const use = ctx.elements.get(src.id);
    return use ? { src, section: use.category, name: use.name, order: 0 } : null;
  }
  if (src?.kind === 'site') {
    return src.id in ctx.sites ? { src, section: 'locations', name: siteName(ctx.production?.locations, src.id) || 'Untitled location', order: 0 } : null;
  }
  return null;
}

/** The stored lines of a readable budget, each with its id. */
const linesOf = (b) => Object.entries(plain(b.lines) ? b.lines : {}).filter(([, l]) => plain(l)).map(([id, l]) => ({ ...l, id }));

/**
 * One source's rows, exactly as budgetModel would show them (the same calculation), without working out
 * the rest of the budget: for an element's card in Breakdowns. [] when unreadable or not costed anywhere.
 */
export function budgetRowsFor(production, rows, model, source) {
  const budget = production?.budget;
  const src = cleanSource(source);
  if (!src || (budget != null && !budgetReadable(budget))) return [];
  const b = normalizeBudget(budget) || { version: BUDGET_VERSION, lines: {} };
  const ctx = context(production, rows, model, b);
  const c = candidateOf(ctx, src);
  const mine = linesOf(b).filter((l) => sourceKey(cleanSource(l.source)) === sourceKey(src));
  if (!mine.length) return c ? [rowOf(ctx, null, c)] : [];
  return mine.map((l) => rowOf(ctx, l, c));
}

/**
 * What one row would be with some of its fields changed (a popover's choices, before choosing):
 * `at` is { lineId } or { source } (a candidate), `variants` a list of line fields. Same calculation.
 */
export function rowVariants(production, rows, model, at, variants) {
  const budget = production?.budget;
  if (budget != null && !budgetReadable(budget)) return [];
  const b = normalizeBudget(budget) || { version: BUDGET_VERSION, lines: {} };
  const ctx = context(production, rows, model, b);
  const line = at?.lineId ? linesOf(b).find((l) => l.id === at.lineId) || null : null;
  const src = cleanSource(line?.source) || cleanSource(at?.source);
  const c = src ? candidateOf(ctx, src) : null;
  return variants.map((v) => rowOf(ctx, { ...(line || {}), ...v, id: line?.id || 'preview' }, c));
}

/** What the rows and schedule say about each source (built once per model). */
function context(production, rows, model, b) {
  const days = model?.days || [];
  const scheduled = days.length > 0;
  const dayOf = new Map();
  days.forEach((d, i) => d.rows.forEach((r) => dayOf.set(r.id, i)));
  const unscheduled = scheduled ? rows.filter((r) => !dayOf.has(r.id)).map((r) => r.id) : rows.map((r) => r.id);
  // Elements: the scenes needing each one, with that scene's quantity.
  const elements = new Map();
  for (const r of rows) {
    for (const [cat, list] of Object.entries(r.needs || {})) {
      for (const n of list) {
        if (!elements.has(n.id)) elements.set(n.id, { name: n.name, category: cat, uses: [] });
        elements.get(n.id).uses.push({ sceneId: r.id, qty: n.qty });
      }
    }
  }
  // Cast: the scenes each speaks in; their working and held days (Day-Out-of-Days).
  const cast = new Map();
  for (const r of rows) {
    for (const c of r.cast || []) {
      if (!cast.has(c.name)) cast.set(c.name, { number: c.number, scenes: [], work: [], hold: [] });
      cast.get(c.name).scenes.push(r.id);
    }
  }
  days.forEach((d, i) => {
    for (const c of d.cast || []) cast.get(c.name)?.work.push(i);
    for (const c of d.hold || []) cast.get(c.name)?.hold.push(i); // Day-Out-of-Days H
  });
  const loc = production?.locations;
  const usage = siteUsage(loc, rows);
  const sites = {};
  if (loc && plain(loc.sites)) for (const id of Object.keys(loc.sites)) if (plain(loc.sites[id])) sites[id] = usage.sites.get(id) || [];
  return {
    production, rows, days, scheduled, dayOf, unscheduled, elements, cast, sites, unassigned: usage.unassigned, budget: b,
    plannedDays: isQuantity(b.plannedDays) ? b.plannedDays : null,
    week: { ...DEFAULT_WEEK, ...(plain(b.week) && [5, 7].includes(b.week.days) ? { days: b.week.days } : {}), ...(plain(b.week) && ['prorate', 'up'].includes(b.week.rounding) ? { rounding: b.week.rounding } : {}) },
  };
}

/** Uses of an element: from the rows, or (deleted, in review) from its footprint against today's rows. */
function elementUses(ctx, id, line) {
  const use = ctx.elements.get(id);
  if (use) return use;
  const fp = line?.review?.footprint;
  if (!plain(fp?.element) || !plain(fp.links)) return null;
  const inScript = new Set(ctx.rows.map((r) => r.id));
  return {
    name: cleanText(fp.element.name), category: fp.element.category,
    uses: Object.entries(fp.links).filter(([sid]) => inScript.has(sid)).map(([sceneId, l]) => ({ sceneId, qty: plain(l) ? l.qty : undefined })),
  };
}
function siteScenes(ctx, id, line) {
  if (id in ctx.sites) return ctx.sites[id];
  const fp = line?.review?.footprint;
  if (!plain(fp)) return null;
  const places = new Set(Array.isArray(fp.places) ? fp.places : []);
  const own = new Set(Array.isArray(fp.scenes) ? fp.scenes : []);
  return ctx.rows.filter((r) => own.has(r.id) || places.has(basePlaceOf(r))).map((r) => r.id);
}
const basePlaceOf = (r) => String(r.location || r.heading || '').split(/\s+[-–—]+\s+/)[0].trim().toUpperCase();

/** One row: a stored line (or null for a candidate nobody has touched yet) for candidate `c` (or none). */
function rowOf(ctx, line, c) {
  const src = cleanSource(line?.source) || c?.src || null;
  const flags = [];
  const basis = [];
  const review = plain(line?.review) && REVIEWS.has(line.review.reason) ? line.review : null;

  // What the source is now.
  let name = cleanText(line?.label);
  let section = SECTION_IDS.has(line?.section) ? line.section : null;
  let uses = null; // element: [{ sceneId, qty }]; cast / site: scene ids
  let castUse = null;
  let missingSource = false;
  if (src?.kind === 'element') {
    const el = elementUses(ctx, src.id, line);
    const registered = ctx.production?.elements?.[src.id];
    if (el) {
      uses = el.uses;
      name ||= el.name;
      section ||= CATEGORY_IDS.has(el.category) ? el.category : null;
    } else if (registered) { // in the project, in no scene now
      uses = [];
      name ||= cleanText(registered.name);
      section ||= registered.category;
      flags.push('notInScript');
    } else missingSource = true;
  } else if (src?.kind === 'cast') {
    castUse = ctx.cast.get(src.name) || null;
    name ||= src.name;
    section ||= 'cast';
    if (castUse) uses = castUse.scenes;
    else missingSource = true;
  } else if (src?.kind === 'site') {
    uses = siteScenes(ctx, src.id, line);
    name ||= siteName(ctx.production?.locations, src.id) || cleanText(line?.review?.footprint?.site?.name);
    section ||= 'locations';
    if (!uses) missingSource = true;
  }
  name ||= cleanText(line?.lastName) || cleanText(review?.from?.name) || c?.name || 'Untitled cost';
  section ||= c?.section || 'other';
  if (missingSource && !review) flags.push('missingSource'); // never guessed: the writer relinks or keeps it
  if (review) flags.push('review');

  const isExtras = src?.kind === 'element' && section === 'extras';
  const method = line?.method in METHODS ? line.method
    : src?.kind === 'cast' || src?.kind === 'site' ? 'day' : isExtras ? 'personDay' : src?.kind === 'element' ? 'unit' : 'flat';
  const m = METHODS[method];

  // Rate: unknown (absent / null) is never zero; zero is confirmed free.
  let rate = null;
  if (line && line.rate !== undefined && line.rate !== null) {
    if (isAmount(line.rate)) rate = line.rate;
    else flags.push('invalid');
  }
  if (rate === null) flags.push('missingRate');

  // Quantity.
  let qty = null;
  const qtyFrom = line?.qty?.from === 'manual' ? 'manual' : 'derived';
  const usage = line?.usage === 'consume' ? 'consume' : 'reuse';
  let personDays = null;
  if (m.qty) {
    if (qtyFrom === 'manual') {
      if (isQuantity(line.qty.value)) {
        qty = line.qty.value;
        basis.push(`${quantityText(qty)} (entered)`);
      } else flags.push(line?.qty?.value !== undefined ? 'invalid' : 'missingQty');
    } else if (method === 'personDay' && src?.kind === 'element') {
      personDays = personDaysOf(ctx, uses || [], flags, basis);
    } else if (src?.kind === 'element' && uses) {
      const qs = uses.map((u) => (Number.isInteger(u.qty) && u.qty > 0 ? u.qty : (flags.includes('assumedQty') || flags.push('assumedQty'), 1)));
      qty = !qs.length ? 0 : usage === 'consume' ? qs.reduce((s, x) => s + x, 0) : Math.max(...qs);
      basis.push(!qs.length ? 'in no scene' : usage === 'consume'
        ? `${qty} used up (${qs.join(' + ')} across scenes)` : `${qty} (most in one scene, reused)`);
    } else if (src && !missingSource) {
      qty = 1;
    } else flags.push('missingQty'); // a vanished source: unknown, never guessed
  }

  // Days.
  let days = null;
  const daysFrom = DAYS_FROM.includes(line?.days?.from) ? line.days.from : src ? 'use' : 'shoot';
  if (m.days && personDays === null) {
    if (missingSource && daysFrom !== 'manual' && daysFrom !== 'shoot') flags.push('missingDays');
    else days = daysOf(ctx, daysFrom, line, src, uses, castUse, flags, basis);
  }

  // The amount.
  let total = null;
  let weeks = null;
  const factors = [];
  const dens = [];
  if (method === 'personDay' && personDays !== null) {
    factors.push(hundredths(personDays)); dens.push(100n);
  } else {
    if (m.qty && qty !== null) {
      factors.push(qty === 0 ? 0n : hundredths(qty)); // 0: in no scene now
      dens.push(100n);
    }
    if (m.days) {
      if (days !== null) {
        if (m.weeks) {
          const w = { ...ctx.week, ...(plain(line?.week) && [5, 7].includes(line.week.days) ? { days: line.week.days } : {}), ...(plain(line?.week) && ['prorate', 'up'].includes(line.week.rounding) ? { rounding: line.week.rounding } : {}) };
          if (w.rounding === 'up') {
            weeks = Math.ceil((Math.round(days * 100)) / (w.days * 100));
            factors.push(BigInt(weeks));
            basis.push(`${quantityText(days)} days ÷ ${w.days} → ${weeks} week${weeks === 1 ? '' : 's'} (part weeks rounded up)`);
          } else {
            weeks = Math.round((days / w.days) * 100) / 100;
            factors.push(hundredths(days)); dens.push(100n, BigInt(w.days));
            basis.push(`${quantityText(days)} days ÷ ${w.days} = ${quantityText(weeks)} weeks (prorated)`);
          }
        } else { factors.push(hundredths(days)); dens.push(100n); }
      }
    }
  }
  const derivedPd = method === 'personDay' && qtyFrom === 'derived' && src?.kind === 'element';
  const known = derivedPd ? personDays !== null : (!m.qty || qty !== null) && (!m.days || days !== null);
  if (rate !== null && known) {
    total = amountOf(rate, factors, dens);
    if (total === null) flags.push('overflow');
  }
  if (method === 'personDay' && qtyFrom === 'manual' && qty !== null && days !== null) basis.unshift(`${quantityText(qty)} people × ${quantityText(days)} days`);

  return {
    key: line ? line.id : `${src.kind}:${src.id || src.name}`, lineId: line?.id || null, candidate: !line,
    section, name, source: src, method, rate, qty, days, weeks, personDays, usage, total,
    flags: [...new Set(flags)], review, basis: basis.join(' · '), note: cleanText(line?.note),
    origin: Array.isArray(line?.origin) ? line.origin : [],
    unresolved: !!review || missingSource,
    order: c?.order ?? 1000,
  };
}

/** Background: each shooting day's largest call for it, added up over days (the same people may cover
 *  several scenes in a day — an estimate the basis says plainly). */
function personDaysOf(ctx, uses, flags, basis) {
  if (!ctx.scheduled) {
    flags.push('needsSchedule');
    return null;
  }
  const perDay = new Map();
  let unsched = 0;
  for (const u of uses) {
    const q = Number.isInteger(u.qty) && u.qty > 0 ? u.qty : (flags.includes('assumedQty') || flags.push('assumedQty'), 1);
    const day = ctx.dayOf.get(u.sceneId);
    if (day === undefined) { unsched += 1; continue; }
    perDay.set(day, Math.max(perDay.get(day) || 0, q));
  }
  if (unsched) flags.push('unscheduled');
  const parts = [...perDay].sort((a, b) => a[0] - b[0]);
  const total = parts.reduce((s, [, q]) => s + q, 0);
  basis.push(parts.length ? `${parts.map(([d, q]) => `${q} on Day ${d + 1}`).join(' + ')} = ${total} person-days (the most needed in one day, assuming the same people cover that day's scenes)` : 'on no shooting day yet');
  return total;
}

/** The days a line counts, by its rule; null (with a flag) when they can't be known yet. */
function daysOf(ctx, from, line, src, uses, castUse, flags, basis) {
  if (from === 'manual') {
    if (isQuantity(line?.days?.value)) {
      basis.push(`${quantityText(line.days.value)} days (entered)`);
      return line.days.value;
    }
    flags.push('missingDays');
    return null;
  }
  if (from === 'shoot') {
    if (ctx.scheduled) {
      if (ctx.unscheduled.length) flags.push('unscheduled');
      basis.push(`${ctx.days.length} shooting days`);
      return ctx.days.length;
    }
    if (ctx.plannedDays !== null) {
      flags.push('estimate');
      basis.push(`est. ${quantityText(ctx.plannedDays)} shooting days (no schedule yet)`);
      return ctx.plannedDays;
    }
    flags.push('needsSchedule');
    return null;
  }
  if (!src) { flags.push('missingDays'); return null; }
  if (!ctx.scheduled) { flags.push('needsSchedule'); return null; }
  // The shooting days it's used on.
  let used;
  let held = [];
  if (src.kind === 'cast') {
    used = castUse ? [...new Set(castUse.work)] : [];
    held = castUse ? [...new Set(castUse.hold)] : [];
  } else {
    const sceneIds = (uses || []).map((u) => (typeof u === 'string' ? u : u.sceneId));
    used = [...new Set(sceneIds.map((sid) => ctx.dayOf.get(sid)).filter((d) => d !== undefined))];
    if (sceneIds.some((sid) => !ctx.dayOf.has(sid))) flags.push('unscheduled');
  }
  if (src.kind === 'cast' && castUse && castUse.scenes.some((sid) => !ctx.dayOf.has(sid))) flags.push('unscheduled');
  used.sort((a, b) => a - b);
  if (from === 'use') {
    let n = used.length;
    if (src.kind === 'cast') {
      const paid = line?.holds === 'paid';
      if (paid) n += held.length;
      basis.push(`${used.length} work day${used.length === 1 ? '' : 's'}${held.length ? ` + ${held.length} hold${held.length === 1 ? '' : 's'} (${paid ? 'paid' : 'unpaid: not counted'})` : ''}`);
    } else basis.push(`used on ${n} shooting day${n === 1 ? '' : 's'}`);
    return n;
  }
  if (!used.length) { basis.push('on no shooting day yet'); return 0; }
  const first = Math.min(...used, ...(src.kind === 'cast' ? held : []));
  const last = Math.max(...used, ...(src.kind === 'cast' ? held : []));
  if (from === 'span') {
    const n = last - first + 1;
    basis.push(`Day ${first + 1} to Day ${last + 1}: ${n} shooting day${n === 1 ? '' : 's'} (continuous)`);
    return n;
  }
  // 'calendar': every day in the span dated, in order, no two the same — or it isn't definitive.
  const dates = ctx.days.slice(first, last + 1).map((d) => d.date);
  const t = dates.map((d) => (d ? Date.parse(`${d}T00:00:00Z`) : NaN));
  const ok = t.every((x) => Number.isFinite(x)) && t.every((x, i) => i === 0 || x > t[i - 1]);
  if (!ok) {
    flags.push('datesUncertain');
    basis.push('calendar span unclear: dates missing, repeated or out of order (enter the days)');
    return null;
  }
  const n = Math.round((t[t.length - 1] - t[0]) / 86400000) + 1;
  basis.push(`${dates[0]} to ${dates[dates.length - 1]}: ${n} calendar days (continuous)`);
  return n;
}
