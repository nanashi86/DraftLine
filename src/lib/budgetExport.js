// File → Export Planning & Production → Budget (.pdf / .csv): the Budget as a printable report and
// as a spreadsheet.
//
// Every figure comes from budgetModel (lib/budget.js), with the same inputs Plan → Budget uses, and
// every word from lib/budgetUi.js: nothing here adds, multiplies or rounds money. Amounts are written
// from their integer minor units as text, so a spreadsheet gets exactly what the Budget holds.
// Exporting reads the project and never writes to it.
//
//   budgetForExport({ production, rows, schedule }) → { available, reason?, model? }
//   budgetReportPayload(…)  → plain data for the report (tested apart from how it looks)
//   budgetReportHtml(…)     → a self-contained HTML document, printed like the Story Bible
//                             (lib/printTitle.js printDocument), so Save as PDF names the file
//   budgetCsv(…)            → the spreadsheet text (UTF-8 with BOM, CRLF, like every DraftLine CSV)

import { DEFAULT_WEEK, budgetModel, budgetReadable } from './budget.js';
import { METHOD_CHOICES, amountField, basisDetail, basisShort, currencyName, money, percentText } from './budgetUi.js';
import { csvField } from './exportCsvOutline.js';
import { currencyDigits, quantityText } from './money.js';
import { printDocument } from './printTitle.js';
import { scheduleModel } from './schedule.js';

/** The overall status, in the Budget's own words (BudgetView.jsx). */
export const TOTAL_LABEL = { complete: 'Total', estimated: 'Estimated total', incomplete: 'Partial total' };

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const methodLabel = (id) => METHOD_CHOICES.find((m) => m.id === id)?.label || 'Flat fee';
const lineOf = (production, r) => (r.lineId ? production?.budget?.lines?.[r.lineId] || null : null);

/**
 * The model to export, or why there's nothing: a budget from a newer DraftLine ('newer'), or
 * genuinely nothing to budget — no cast, breakdown element, filming location or cost ('empty').
 * A budget with rows but no rates (or no currency yet) is exportable: a costing worksheet.
 */
export function budgetForExport({ production, rows = [], schedule = null }) {
  if (!budgetReadable(production?.budget)) return { available: false, reason: 'newer' };
  const model = budgetModel(production, rows, schedule ? scheduleModel(rows, schedule) : null);
  if (!model.readable) return { available: false, reason: 'newer' };
  if (!model.sections.some((s) => s.rows.length)) return { available: false, reason: 'empty', model };
  return { available: true, model };
}
export const UNAVAILABLE = {
  newer: 'This budget was made with a newer version of DraftLine: update DraftLine to export it',
  empty: 'Nothing to budget yet: cast, breakdown items, filming locations or your own costs make the budget',
};

/**
 * A quick check for the File menu (no breakdown arithmetic): is there anything a budget could hold?
 * Speaking cast in a scene, a breakdown item in a scene, a filming location or a cost. The export
 * itself checks the model (budgetForExport).
 *   scenes: the script's scenes ({ id }); analysis: the script analysis (characterList, sceneOfBlock)
 */
export function anythingToBudget({ production, analysis, scenes = [] }) {
  const has = (o) => !!o && typeof o === 'object' && Object.keys(o).length > 0;
  if (has(production?.budget?.lines) || has(production?.locations?.sites)) return true;
  const ids = new Set(scenes.map((s) => s.id));
  if ((analysis?.characterList || []).some((c) => (c.entries || []).some((en) => ids.has(analysis.sceneOfBlock?.[en.cue?.id])))) return true;
  return [...ids].some((id) => Object.values(production?.scenes?.[id]?.links || {})
    .some((list) => Array.isArray(list) && list.some((l) => production?.elements?.[l?.id])));
}

/** Integer minor units → plain decimal text with the currency's digits ("1250.50", "1250", "1.234"); no floats. */
export function decimalText(minor, currency) {
  if (!Number.isSafeInteger(minor)) return '';
  const d = currencyDigits(currency) ?? 2;
  const neg = minor < 0;
  const s = String(Math.abs(minor)).padStart(d + 1, '0');
  const out = d ? `${s.slice(0, -d)}.${s.slice(-d)}` : s;
  return neg ? `-${out}` : out;
}

/** A spreadsheet can't read user text as a formula: a leading = + - @ (or tab / CR), after any spaces, gets a '. */
export const sheetText = (v) => {
  const s = v == null ? '' : String(v);
  return /^[\s\u00a0]*[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

/** How a row's quantity, days and weeks are worked out, in words (from its stored line; never computed). */
function rules(production, r) {
  const line = lineOf(production, r);
  const f = new Set(r.flags);
  const hasQty = ['unit', 'unitDay', 'unitWeek'].includes(r.method);
  const hasDays = ['day', 'unitDay', 'week', 'unitWeek'].includes(r.method) || (r.method === 'personDay' && line?.qty?.from === 'manual');
  let qty = '';
  if (r.method === 'personDay') qty = line?.qty?.from === 'manual' ? 'Entered (people)' : 'From the schedule';
  else if (hasQty) {
    qty = line?.qty?.from === 'manual' ? 'Entered'
      : r.source?.kind === 'element' ? `From breakdowns, ${r.usage === 'consume' ? 'used up' : 'reusable'}` : 'One';
  }
  let days = '';
  if (hasDays) {
    const from = line?.days?.from || (r.source ? 'use' : 'shoot');
    days = f.has('estimate') ? 'Planned shooting days (estimate)'
      : { use: 'Days used', span: 'First to last day', calendar: 'Calendar days', shoot: 'All shooting days', manual: 'Entered' }[from] || 'Days used';
    if (r.source?.kind === 'cast' && line?.holds === 'paid') days += ', holds paid';
  }
  let week = '';
  if (['week', 'unitWeek'].includes(r.method)) {
    const ok = (w, k, vals) => (w && typeof w === 'object' && vals.includes(w[k]) ? { [k]: w[k] } : {});
    const b = production?.budget?.week;
    const w = { ...DEFAULT_WEEK, ...ok(b, 'days', [5, 7]), ...ok(b, 'rounding', ['prorate', 'up']), ...ok(line?.week, 'days', [5, 7]), ...ok(line?.week, 'rounding', ['prorate', 'up']) };
    week = `${w.days}-day week, ${w.rounding === 'up' ? 'part weeks rounded up' : 'prorated'}`;
  }
  return { qty, days, week, line };
}

/** Short warnings for a row (the CSV's Warnings column). */
function warnings(r) {
  const f = new Set(r.flags);
  const out = [];
  if (f.has('missingSource')) out.push('No longer in the project');
  if (r.review?.reason === 'merged') out.push(`Merged from ${r.review.from?.name || 'another item'}`);
  if (r.review?.reason === 'renamed') out.push(`Renamed from ${r.review.from?.name || 'another name'}`);
  if (r.review?.reason === 'deleted') out.push('Deleted from Breakdowns');
  if (f.has('needsSchedule')) out.push('After scheduling');
  if (f.has('missingQty')) out.push('Quantity to enter');
  if (f.has('missingDays')) out.push('Days to enter');
  if (f.has('unscheduled') && !f.has('needsSchedule')) out.push(r.days === 0 || r.personDays === 0 ? 'Not scheduled' : 'Partly scheduled');
  if (f.has('estimate')) out.push('Estimate (planned days)');
  if (f.has('assumedQty')) out.push('Quantity assumed');
  if (f.has('notInScript')) out.push('In no scene now');
  if (f.has('datesUncertain')) out.push('Dates unclear');
  if (f.has('invalid')) out.push('A stored value can’t be read');
  if (f.has('overflow')) out.push('Too large to add up');
  return out;
}

/** Priced · Free · No rate · Incomplete · Waiting for review. */
function rowStatus(r) {
  if (r.unresolved) return 'Waiting for review';
  if (r.total !== null) return r.rate === 0 ? 'Free' : 'Priced';
  if (r.rate === null) return 'No rate';
  return 'Incomplete';
}

const SOURCE = { cast: 'Cast', element: 'Breakdowns', site: 'Filming location' };
const feeBasis = (f) => (f.amount !== null && f.basis === 'fixed amount' ? 'Fixed amount'
  : f.basis === 'unreadable' ? 'Can’t be read' : `${percentText(f.bp)} of the ${f.basis}`);

// ---- CSV ------------------------------------------------------------------------------------------

export const BUDGET_CSV_COLUMNS = [
  'Row Type', 'Category', 'Item', 'Source', 'Costing Method', 'Quantity', 'Quantity Rule', 'Days', 'Days Rule',
  'Person-Days', 'Weeks', 'Week Rule', 'Rate', 'Rate Per', 'Amount', 'Excluded Amount', 'Currency', 'Budget Status',
  'Status', 'Warnings', 'Basis', 'Note',
];
/** Columns holding text a person typed or the app worded: guarded against formulas. The rest are numbers or blank. */
const TEXT_COLUMNS = new Set(['Row Type', 'Category', 'Item', 'Source', 'Costing Method', 'Quantity Rule', 'Days Rule',
  'Week Rule', 'Rate Per', 'Currency', 'Budget Status', 'Status', 'Warnings', 'Basis', 'Note']);

/**
 * The spreadsheet: one row per budget row, then the contingency and each fee. No subtotal or total
 * rows, so SUM(Amount) is the Budget's total exactly; a cost waiting for review has its amount in
 * Excluded Amount only. Unknown amounts are blank; a confirmed zero is 0 at the currency's precision.
 */
export function budgetCsvRows(production, model) {
  const cur = model.currency || '';
  const status = TOTAL_LABEL[model.status];
  const n = (v) => (v === null || v === undefined ? '' : quantityText(v));
  const out = [];
  for (const s of model.sections) {
    for (const r of s.rows) {
      const { qty, days, week, line } = rules(production, r);
      const pd = r.method === 'personDay' && line?.qty?.from !== 'manual';
      out.push({
        'Row Type': r.unresolved ? 'Review' : 'Item',
        Category: s.label,
        Item: r.name,
        Source: SOURCE[r.source?.kind] || 'Own cost',
        'Costing Method': methodLabel(r.method),
        Quantity: pd ? '' : n(r.qty),
        'Quantity Rule': qty,
        Days: days ? n(r.days) : '',
        'Days Rule': days,
        'Person-Days': pd ? n(r.personDays) : '',
        Weeks: week ? n(r.weeks) : '',
        'Week Rule': week,
        Rate: r.rate === null ? '' : decimalText(r.rate, cur),
        'Rate Per': METHOD_CHOICES.find((m) => m.id === r.method)?.per || '',
        Amount: r.unresolved || r.total === null ? '' : decimalText(r.total, cur),
        'Excluded Amount': r.unresolved && r.total !== null ? decimalText(r.total, cur) : '',
        Currency: cur,
        'Budget Status': status,
        Status: rowStatus(r),
        Warnings: warnings(r).join('; '),
        Basis: basisDetail(r),
        Note: r.note || '',
      });
    }
  }
  const extra = (type, item, method, amount) => ({
    ...Object.fromEntries(BUDGET_CSV_COLUMNS.map((c) => [c, ''])),
    'Row Type': type, Item: item, 'Costing Method': method, Amount: amount === null ? '' : decimalText(amount, cur),
    Currency: cur, 'Budget Status': status, Status: amount === null ? 'Incomplete' : 'Priced',
  });
  const t = model.totals;
  if (t.contingencyBp !== null && t.contingencyBp !== undefined) {
    out.push(extra('Contingency', 'Contingency', `${percentText(t.contingencyBp)} of the subtotal`, t.contingency));
  }
  for (const f of t.fees) out.push(extra('Fee', f.label || 'Fee', feeBasis(f), f.amount));
  return out;
}

export function budgetCsv(production, model) {
  const body = budgetCsvRows(production, model).map((row) => BUDGET_CSV_COLUMNS.map((c) => (TEXT_COLUMNS.has(c) ? sheetText(row[c]) : row[c])));
  return `\uFEFF${[BUDGET_CSV_COLUMNS, ...body].map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
}

/** "The Last Ferry" → "The_Last_Ferry_Budget.csv" (only characters safe in a file name). */
export function budgetCsvFileName(title) {
  const stem = clean(title).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_').replace(/^_+|_+$/g, '') || 'Untitled';
  return `${stem}_Budget.csv`;
}
export const budgetFileTitle = (title, kind) => `${clean(title) || 'Untitled'} - ${kind === 'summary' ? 'Budget Summary' : 'Budget'}`;

// ---- The report -------------------------------------------------------------------------------------

/** What the report says, as plain data: every amount straight from the model. */
export function budgetReportPayload({ production, model, meta = {}, kind = 'detailed', locale, date = new Date() }) {
  const cur = model.currency || null;
  const m = model;
  const g = m.gaps;
  const sections = m.sections.filter((s) => s.rows.some((r) => !r.unresolved)).map((s) => {
    const rows = s.rows.filter((r) => !r.unresolved);
    return {
      id: s.id,
      label: s.label,
      items: rows.length,
      counted: rows.filter((r) => r.total !== null).length,
      unknown: s.unknown,
      subtotal: s.subtotal,
      rows: rows.map((r) => ({
        name: r.name,
        note: r.note || '',
        places: r.source?.kind === 'site' ? placesOf(production, r.source.id) : [],
        method: methodLabel(r.method),
        basis: basisShort(r, lineOf(production, r)),
        rate: r.rate,
        per: METHOD_CHOICES.find((x) => x.id === r.method)?.per || '',
        total: r.total,
        status: rowStatus(r),
      })),
    };
  });
  const review = m.sections.flatMap((s) => s.rows.filter((r) => r.unresolved).map((r) => ({
    name: r.name, category: s.label, method: methodLabel(r.method),
    // Why it waits (merged, renamed, deleted, gone), then how it was counted (the short basis, without its review word).
    why: [...warnings(r).slice(0, 1), ...basisShort(r, lineOf(production, r)).split(' · ').filter((x) => !/: review$/.test(x) && x !== 'no longer in the project')].filter(Boolean).join(' · '),
    rate: r.rate, per: METHOD_CHOICES.find((x) => x.id === r.method)?.per || '', total: r.total,
  })));
  const rowsAll = m.sections.flatMap((s) => s.rows.filter((r) => !r.unresolved));
  const names = (pred) => rowsAll.filter(pred).map((r) => r.name);
  const reasons = [];
  if (g.missingRates) reasons.push(`${plural(g.missingRates, 'item')} without a rate (${list(names((r) => r.flags.includes('missingRate')))}): not counted`);
  if (g.missingQuantities) reasons.push(`${plural(g.missingQuantities, 'quantity or days', 'quantities or days')} to enter: not counted`);
  if (g.unscheduledScenes) reasons.push(`${plural(g.unscheduledScenes, 'scene')} not scheduled: days count scheduled scenes only`);
  if (g.unassignedPlaces) reasons.push(`${plural(g.unassignedPlaces, 'scripted place')} without a filming location`);
  if (g.reviews) reasons.push(`${plural(g.reviews, 'cost')} waiting for review${m.totals.unresolved ? ` (${money(m.totals.unresolved, cur, locale)})` : ''}: not included`);
  // Estimates and assumptions among the counted items (one waiting for review says so in its own list).
  const estimated = names((r) => r.flags.includes('estimate')).length;
  const assumedN = names((r) => r.flags.includes('assumedQty')).length;
  if (estimated) reasons.push(`${plural(estimated, 'item')} counted on planned shooting days: an estimate`);
  if (assumedN) reasons.push(`${plural(assumedN, 'item')} with a quantity assumed (a scene’s quantity not set, counted as 1)`);
  if (g.overflow) reasons.push('Some amounts are too large to add up');

  // Calculation notes: only the rules this budget uses.
  const notes = [];
  if (rowsAll.some((r) => r.source?.kind === 'element' && ['unit', 'unitDay', 'unitWeek'].includes(r.method))) {
    notes.push('Reusable items count the most needed in any one scene; used-up items add every scene’s quantity.');
  }
  if (rowsAll.some((r) => r.method === 'personDay')) notes.push('Person-days add, for each shooting day, the most people needed in one of its scenes.');
  if (rowsAll.some((r) => r.source?.kind === 'cast' && ['day', 'unitDay', 'week', 'unitWeek'].includes(r.method))) {
    notes.push('Cast days are the shooting days they work; holds between their first and last day count only when marked paid.');
  }
  const weekly = rowsAll.filter((r) => ['week', 'unitWeek'].includes(r.method)).map((r) => ({ name: r.name, rule: rules(production, r).week }));
  if (weekly.length) {
    const byRule = new Map();
    for (const w of weekly) byRule.set(w.rule, [...(byRule.get(w.rule) || []), w.name]);
    notes.push(`Weeks: ${[...byRule].map(([rule, ns]) => `${rule} (${list(ns)})`).join('; ')}.`);
  }
  const assumed = names((r) => r.flags.includes('assumedQty'));
  if (assumed.length) notes.push(`Quantity assumed: a scene’s quantity wasn’t set, so it counts as 1 (${list(assumed)}).`);
  const est = names((r) => r.flags.includes('estimate'));
  if (est.length) notes.push(`Estimated on ${m.plannedDays ? plural(m.plannedDays, 'planned shooting day') : 'planned shooting days'}, as there’s no schedule yet (${list(est)}).`);
  notes.push('A rate of 0 is free; “No rate” is not priced and not counted. Amounts are as entered: nothing is converted between currencies.');
  if (review.length) notes.push('Costs waiting for review are listed apart and left out of every total until they’re settled in DraftLine.');

  const t = m.totals;
  return {
    kind,
    title: clean(meta.title) || 'Untitled',
    author: clean(meta.author),
    docTitle: budgetFileTitle(meta.title, kind),
    date: new Date(date).toLocaleDateString(locale || 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    currency: cur,
    currencyText: cur ? `${cur} (${currencyName(cur, locale)})` : 'No currency chosen yet',
    schedule: m.scheduled
      ? `${plural(m.shootingDays, 'shooting day')} scheduled${g.unscheduledScenes ? ` · ${plural(g.unscheduledScenes, 'scene')} not on a day` : ''}`
      : `No shooting schedule yet${m.plannedDays ? ` · ${plural(m.plannedDays, 'planned shooting day')}` : ''}`,
    status: m.status,
    label: TOTAL_LABEL[m.status],
    total: t.total,
    reasons,
    sections,
    subtotal: t.subtotal,
    contingency: t.contingencyBp !== null && t.contingencyBp !== undefined ? { bp: t.contingencyBp, amount: t.contingency } : null,
    fees: t.fees.map((f) => ({ label: f.label || 'Fee', basis: feeBasis(f).replace(/^Fixed amount$/, 'fixed amount'), amount: f.amount })),
    unresolved: t.unresolved,
    review,
    notes,
  };
}
function list(names) {
  const max = 6;
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}
function placesOf(production, siteId) {
  const places = production?.locations?.places;
  return places && typeof places === 'object' ? Object.keys(places).filter((p) => places[p] === siteId).sort() : [];
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CSS = `
@page { margin: 0.7in 0.75in 0.75in; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #111; background: #fff; font: 9.5pt/1.4 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.head { padding-bottom: 0.12in; border-bottom: 1.5pt solid #111; margin-bottom: 0.16in; }
.kicker { font-size: 8pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #444; }
h1 { margin: 0.06in 0 0.02in; font: 700 20pt/1.2 Georgia, 'Times New Roman', serif; overflow-wrap: anywhere; }
.by { font: italic 11pt/1.3 Georgia, 'Times New Roman', serif; color: #333; overflow-wrap: anywhere; }
.facts { margin-top: 0.08in; font-size: 8.5pt; color: #444; }
.status { margin: 0 0 0.18in; padding: 0.09in 0.13in; border: 0.75pt solid #777; border-left: 3pt solid #111; break-inside: avoid; }
.status-line { font-size: 11pt; }
.status ul { margin: 0.05in 0 0; padding-left: 0.18in; color: #222; }
.status li { margin: 0 0 1pt; }
h2 { margin: 0.16in 0 0.07in; font-size: 12pt; font-weight: 700; break-after: avoid; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 600; }
.n { text-align: right; }
.nowrap { white-space: nowrap; }
.cols th, .sum thead th { padding: 3pt 4pt; font-size: 7.5pt; letter-spacing: 0.05em; white-space: nowrap; text-transform: uppercase; color: #444; border-bottom: 0.9pt solid #111; }
.sum td { padding: 3pt 4pt; border-bottom: 0.5pt solid #bbb; vertical-align: top; }
.sum td:first-child { overflow-wrap: anywhere; }
.gap { color: #444; font-size: 8.5pt; }
.totals { width: 62%; margin: 0.1in 0 0 38%; break-inside: avoid; }
.totals td { padding: 2.5pt 4pt; vertical-align: top; }
.totals td:first-child { overflow-wrap: anywhere; }
.totals .b { color: #444; font-size: 8.5pt; }
.totals .grand td { border-top: 1.2pt solid #111; font-weight: 700; font-size: 11pt; padding-top: 4pt; }
.totals .excl td { color: #444; font-style: italic; }
.none { font-style: italic; color: #444; }
.detail { break-before: page; }
table.run { table-layout: fixed; }
table.run > thead > tr > td { padding: 0 0 6pt; }
.rh { display: flex; justify-content: space-between; gap: 12pt; padding-bottom: 3pt; border-bottom: 0.5pt solid #999; font-size: 7.5pt; color: #444; }
.rh span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rh span:last-child { flex: none; }
table.run > tbody > tr > td { padding: 0; }
.cat { margin: 0 0 0.08in; }
/* The detailed pages, a little tighter (the Summary keeps its spacing). */
.run h2 { margin: 0.12in 0 0.05in; }
.run ~ .foot { margin-top: 0.14in; }
.cat.keep, .items tbody.end { break-inside: avoid; page-break-inside: avoid; }
table.items { table-layout: fixed; }
.c1 { width: 26%; } .c2 { width: 14%; } .c3 { width: 28%; } .c4 { width: 17%; } .c5 { width: 15%; }
.items td { padding: 2.5pt 4pt; vertical-align: top; border-bottom: 0.5pt solid #ccc; overflow-wrap: anywhere; }
.items tr { break-inside: avoid; }
/* A category's name, once; on a page it runs onto, its repeated heading says "(continued)" (the first
   one is covered by .cat-head, which isn't repeated), so a heading is never read as another cost. */
.cat-head, .cont th { height: 18pt; padding: 3pt 4pt 1pt; font-size: 10pt; font-weight: 700; line-height: 14pt; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cat-head { position: relative; z-index: 1; margin-bottom: -18pt; background: #fff; break-after: avoid; }
.cont span { font-weight: 400; font-style: italic; color: #444; }
.item { font-weight: 600; }
.sub-text { margin-top: 1pt; font-weight: 400; font-size: 8pt; color: #444; }
.per { color: #444; font-size: 8pt; }
.subtotal td { border-bottom: 0; font-weight: 700; }
.review .cat-head, .review .cont th { font-style: italic; }
.notes { break-inside: auto; }
.notes h2 { break-after: avoid; }
.notes ul { margin: 0; padding-left: 0.18in; color: #222; }
.notes li { margin: 0 0 1pt; break-inside: avoid; }
.foot { margin-top: 0.22in; font-size: 7pt; color: #888; text-align: center; }
@media screen { body { max-width: 7.2in; margin: 0.5in auto; } }
`;

/** Categories this short are kept on one page (a longer one runs across pages, its heading repeated). */
export const KEEP_WHOLE = 4;

/** The printable report (budgetReportPayload). Every piece of text a person typed is escaped. */
export function budgetReportHtml(p, { locale } = {}) {
  const cur = p.currency;
  const amt = (v) => (v === null || v === undefined ? '<span class="none">—</span>' : esc(amountField(v, cur, locale)));
  const sym = (v) => (v === null || v === undefined ? '<span class="none">—</span>' : esc(money(v, cur, locale)));
  const curTag = cur ? ` (${esc(cur)})` : '';
  const statusLine = p.total === null
    ? `<b>${esc(p.label)}</b>: can’t be added up`
    : `<b>${esc(p.label)} ${esc(money(p.total, cur, locale))}</b>${p.status === 'incomplete' ? ' — not a full budget yet' : p.status === 'estimated' ? ' — includes estimates' : ''}`;
  const head = `
<header class="head">
  <div class="kicker">${p.kind === 'summary' ? 'Budget summary' : 'Budget'}</div>
  <h1>${esc(p.title)}</h1>
  ${p.author ? `<div class="by">by ${esc(p.author)}</div>` : ''}
  <div class="facts">${esc(p.date)} · Currency: ${esc(p.currencyText)} · ${esc(p.schedule)}</div>
</header>
<div class="status">
  <div class="status-line">${statusLine}</div>
  ${p.reasons.length ? `<ul>${p.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<ul><li>Every item is priced and scheduled.</li></ul>'}
</div>`;
  const summary = `
<h2>Summary</h2>
<table class="sum">
  <thead><tr><th>Category</th><th class="n">Items</th><th class="n">Amount${curTag}</th></tr></thead>
  <tbody>
  ${p.sections.map((s) => `<tr><td>${esc(s.label)}${s.unknown ? ` <span class="gap">· ${s.unknown} not priced</span>` : ''}</td><td class="n">${s.items}</td><td class="n nowrap">${s.counted ? amt(s.subtotal) : '<span class="none">—</span>'}</td></tr>`).join('')}
  </tbody>
</table>
<table class="totals">
  <tr><td>Subtotal</td><td></td><td class="n nowrap">${amt(p.subtotal)}</td></tr>
  ${p.contingency ? `<tr><td>Contingency</td><td class="b">${esc(percentText(p.contingency.bp))} of the subtotal</td><td class="n nowrap">${amt(p.contingency.amount)}</td></tr>` : ''}
  ${p.fees.map((f) => `<tr><td>${esc(f.label)}</td><td class="b">${esc(f.basis)}</td><td class="n nowrap">${amt(f.amount)}</td></tr>`).join('')}
  <tr class="grand"><td>${esc(p.label)}</td><td class="b">${p.status === 'incomplete' ? 'not a full budget yet' : p.status === 'estimated' ? 'includes estimates' : ''}</td><td class="n nowrap">${sym(p.total)}</td></tr>
  ${p.review.length ? `<tr class="excl"><td>Waiting for review</td><td class="b">not included</td><td class="n nowrap">${p.unresolved ? sym(p.unresolved) : '<span class="none">—</span>'}</td></tr>` : ''}
</table>`;
  const cols = '<colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"></colgroup>';
  const rate = (v, per) => (v === null || v === undefined ? '<span class="none">No rate</span>' : `${amt(v)}${per ? `<span class="per"> /${esc(per)}</span>` : ''}`);
  const sub = (r) => [r.note, r.places.length ? `Scripted places: ${r.places.join(', ')}` : ''].filter(Boolean).map((t) => `<div class="sub-text">${esc(t)}</div>`).join('');
  // A category's last item and its subtotal share a tbody that isn't split across pages, so a subtotal is
  // never alone under a repeated heading; a category of KEEP_WHOLE items or fewer stays on one page.
  const table = (name, cls, third, rowList, subtotal) => `
<section class="cat${cls}${rowList.length <= KEEP_WHOLE ? ' keep' : ''}">
  <div class="cat-head">${esc(name)}</div>
  <table class="items">${cols}
    <thead>
      <tr class="cont"><th colspan="5">${esc(name)} <span>(continued)</span></th></tr>
      <tr class="cols"><th>Item</th><th>Method</th><th>${third}</th><th class="n">Rate${curTag}</th><th class="n">Amount${curTag}</th></tr>
    </thead>
    ${rowList.length > 1 ? `<tbody>${rowList.slice(0, -1).join('')}</tbody>` : ''}
    <tbody class="end">${rowList.slice(-1).join('')}${subtotal}</tbody>
  </table>
</section>`;
  const detail = p.sections.map((s) => table(s.label, '', 'Basis', s.rows.map((r) => `
      <tr><td class="item">${esc(r.name)}${sub(r)}</td><td>${esc(r.method)}</td><td>${esc(r.basis)}</td><td class="n">${rate(r.rate, r.per)}</td><td class="n nowrap">${amt(r.total)}</td></tr>`),
  `<tr class="subtotal"><td colspan="4">${esc(s.label)} subtotal${s.unknown ? ` <span class="gap">(${s.unknown} not priced)</span>` : ''}</td><td class="n nowrap">${s.counted ? amt(s.subtotal) : '<span class="none">—</span>'}</td></tr>`)).join('');
  const review = p.review.length ? table('Waiting for review — not included in any total', ' review', 'Why', p.review.map((r) => `
      <tr><td class="item">${esc(r.name)}<div class="sub-text">${esc(r.category)}</div></td><td>${esc(r.method)}</td><td>${esc(r.why)}</td><td class="n">${rate(r.rate, r.per)}</td><td class="n nowrap">${r.total === null ? '<span class="none">—</span>' : `(${amt(r.total)})`}</td></tr>`), '') : '';
  const notes = `<section class="notes"><h2>Calculation notes</h2><ul>${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`;
  const running = `${esc(p.title)} — ${p.kind === 'summary' ? 'Budget summary' : 'Detailed budget'}`;
  const detailed = p.kind === 'summary' ? '' : `
<table class="run detail">
  <thead><tr><td><div class="rh"><span>${running}</span><span>${cur ? `Amounts in ${esc(cur)}` : 'No currency chosen yet'} · ${esc(p.date)}</span></div></td></tr></thead>
  <tbody><tr><td>
    <h2>Detailed budget</h2>
    ${detail}${review}${notes}
  </td></tr></tbody>
</table>`;
  return `<!doctype html>
<html lang="${esc((locale || 'en').split('-')[0])}"><head><meta charset="utf-8"><title>${esc(p.docTitle)}</title><style>${CSS}</style></head>
<body>
${head}${summary}${detailed}
<div class="foot">Made with DraftLine</div>
</body></html>`;
}

/** Export PDF: print the report (the print dialog's Save as PDF names it "<Title> - Budget.pdf"). */
export function exportBudgetPdf({ production, model, meta, kind, locale, date }, print = printDocument) {
  const payload = budgetReportPayload({ production, model, meta, kind, locale, date });
  return print({ html: budgetReportHtml(payload, { locale }), title: payload.docTitle });
}
