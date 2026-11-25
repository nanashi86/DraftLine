// Stage 2, Phase 3C: the Budget's exports (lib/budgetExport.js) — the report (Summary / Detailed, printed
// to PDF) and the spreadsheet (.csv). Both are checked against budgetModel on the same fixtures: every
// amount, subtotal and total is the model's, unknown is never zero, review costs stay out, the
// currency's precision is kept, and user text can't become a formula or HTML. Exporting writes nothing.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUDGET_CSV_COLUMNS, KEEP_WHOLE, TOTAL_LABEL, UNAVAILABLE, anythingToBudget, budgetCsv, budgetCsvFileName, budgetCsvRows, budgetFileTitle,
  budgetForExport, budgetReportHtml, budgetReportPayload, decimalText, exportBudgetPdf, sheetText,
} from '../src/lib/budgetExport.js';
import { BUDGET_VERSION, setBudgetSettings, setCurrency, setFee, setLine } from '../src/lib/budget.js';
import { addNeed, addSite, deleteElement, mapPlace, normalizeProduction, setNeed } from '../src/lib/productionData.js';
import { sceneNeeds } from '../src/lib/elements.js';
import { addDay, moveScene } from '../src/lib/schedule.js';
import { fileMenuItems } from '../src/lib/toolbar.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const read = (f) => readFileSync(join(root, f), 'utf8');

/** RFC 4180 reader for the tests (quotes, doubled quotes, commas and line breaks inside fields). */
function parseCsv(text) {
  assert.equal(text[0], '﻿', 'UTF-8 with a BOM, like every DraftLine CSV');
  const s = text.slice(1);
  const rows = [];
  let row = []; let f = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; } else if (c === '\r' && s[i + 1] === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; } else f += c;
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
/** "1250.50" (2 digits) → 125050n: back to minor units without a float. */
const minor = (text, digits) => {
  if (!text) return null;
  const [a, b = ''] = text.split('.');
  assert.equal(b.length, digits, `${text}: the currency's ${digits} decimals`);
  return BigInt(a + b);
};
const sum = (list) => list.reduce((s, v) => s + BigInt(v), 0n);

const CAST = ['MARIE', 'THEO', 'GRANDMÈRE'];
const SCENES = [
  { id: 's1', location: 'HARBOR', cast: ['MARIE', 'THEO'] },
  { id: 's2', location: 'FERRY', cast: ['MARIE'] },
  { id: 's3', location: 'PIER', cast: ['THEO'] },
  { id: 's4', location: 'HOME', cast: ['GRANDMÈRE'] },
];
const rowsOf = (p) => SCENES.map((x, i) => ({
  id: x.id, number: i + 1, heading: `EXT. ${x.location} - DAY`, location: x.location, eighths: 8,
  cast: x.cast.map((name) => ({ name, number: CAST.indexOf(name) + 1 })), needs: sceneNeeds(p.scenes[x.id], p.elements),
}));
function scheduleOf(days) {
  let s = null;
  for (const ids of days) {
    const d = addDay(s);
    s = d.schedule;
    for (const id of ids) s = moveScene(s, id, d.dayId);
  }
  return s;
}

/**
 * The film: every costing method, a confirmed zero, an unpriced item, a cost waiting for review, one
 * filming location for two scripted places, contingency, a fixed fee and two percentage fees, and text
 * that tries to be a formula or HTML.
 */
function film(currency = 'USD', { priced = true } = {}) {
  let p = normalizeProduction({ version: 1, scenes: {} });
  if (currency) p = setCurrency(p, currency).production;
  const ids = {};
  const need = (scene, cat, name, qty) => {
    const r = addNeed(p, scene, cat, ids[name] ? { id: ids[name] } : { name });
    ids[name] = r.id;
    p = qty ? setNeed(r.production, scene, r.id, { qty }) : r.production;
  };
  need('s1', 'props', 'Wine bottle', 2); need('s2', 'props', 'Wine bottle', 3);
  need('s1', 'sfx', 'Breakaway bottle', 6); need('s3', 'sfx', 'Breakaway bottle', 6);
  need('s1', 'extras', 'Ferry passengers', 20); need('s2', 'extras', 'Ferry passengers', 25);
  need('s1', 'vehicles', 'Black SUV'); need('s3', 'vehicles', 'Black SUV');
  need('s2', 'wardrobe', 'Raincoat', 2);
  need('s1', 'props', 'Family photo');
  need('s3', 'props', '=HYPERLINK("http://x","click") & <script>alert(1)</script>', 1);
  need('s2', 'props', 'Lantern');
  need('s4', 'makeup', 'Old-age prosthetics', 1);
  let a = addSite(p, { name: 'Port de Fécamp' });
  p = mapPlace(mapPlace(a.production, 'HARBOR', a.id).production, 'PIER', a.id).production; // one location, two places
  const port = a.id;
  if (!priced || !currency) return { p, ids, port };
  const L = (fields) => { const r = setLine(p, null, fields); assert.ok(!r.error, r.error); p = r.production; };
  L({ source: { kind: 'cast', name: 'MARIE' }, method: 'day', rate: 45000, note: 'Lead, "union" scale, 10% agent' });
  L({ source: { kind: 'cast', name: 'THEO' }, method: 'week', rate: 120000 });
  L({ source: { kind: 'element', id: ids['Wine bottle'] }, method: 'unit', rate: 1505 });
  L({ source: { kind: 'element', id: ids['Breakaway bottle'] }, method: 'unit', usage: 'consume', rate: 2500 });
  L({ source: { kind: 'element', id: ids['Ferry passengers'] }, method: 'personDay', rate: 15000 });
  L({ source: { kind: 'element', id: ids['Black SUV'] }, method: 'unitWeek', week: { days: 7, rounding: 'up' }, rate: 60000 });
  L({ source: { kind: 'element', id: ids.Raincoat }, method: 'unitDay', rate: 1800 });
  L({ source: { kind: 'element', id: ids['Family photo'] }, method: 'unit', rate: 0 }); // free: confirmed
  L({ source: { kind: 'element', id: ids['=HYPERLINK("http://x","click") & <script>alert(1)</script>'] }, rate: 999 });
  L({ source: { kind: 'element', id: ids.Lantern }, rate: 4000 });
  L({ source: { kind: 'site', id: port }, method: 'day', rate: 80000, note: '@SUM(1+1) permit, quai Bérigny' });
  L({ section: 'crew', label: '+1 gaffer (night)', method: 'day', rate: 38000 });
  L({ section: 'equipment', label: 'Camera package', method: 'flat', rate: 420000, note: 'Quote: two zooms,\nprimes & a "wireless" follow-focus' });
  p = deleteElement(p, ids.Lantern); // priced, then deleted: waits for review, out of every total
  p = setBudgetSettings(p, { contingency: 1000 }).production;
  p = setFee(p, null, { label: 'Production insurance', amount: 120055 }).production;
  p = setFee(p, null, { label: 'VAT', bp: 2000, base: 'withContingency' }).production;
  p = setFee(p, null, { label: '-Payroll fee', bp: 350, base: 'subtotal' }).production;
  return { p, ids, port };
}
const SCHEDULED = [['s1', 's2'], ['s3', 's4']];
const exportOf = (p, days = SCHEDULED) => budgetForExport({ production: p, rows: rowsOf(p), schedule: days ? scheduleOf(days) : null });
const all = (m) => m.sections.flatMap((s) => s.rows);
const fees = (rows) => rows.filter((r) => r['Row Type'] === 'Fee' || r['Row Type'] === 'Contingency');

describe('the spreadsheet (.csv) reconciles with the Budget', () => {
  const { p } = film('USD');
  const { model } = exportOf(p);
  const csv = budgetCsv(p, model);
  const rows = parseCsv(csv);

  it('the approved columns, CRLF, one row per budget row, then contingency and each fee', () => {
    assert.deepEqual(Object.keys(rows[0]), BUDGET_CSV_COLUMNS);
    assert.ok(BUDGET_CSV_COLUMNS.includes('Budget Status') && BUDGET_CSV_COLUMNS.includes('Excluded Amount'));
    assert.ok(csv.endsWith('\r\n'), 'CRLF line ends, like every DraftLine CSV');
    assert.equal(csv.split('\r\n').length - 2, rows.length, 'one line per row (no line break outside a quoted field)');
    assert.equal(rows.filter((r) => ['Item', 'Review'].includes(r['Row Type'])).length, all(model).length);
    assert.deepEqual(fees(rows).map((r) => [r['Row Type'], r.Item]), [
      ['Contingency', 'Contingency'], ['Fee', 'Production insurance'], ['Fee', 'VAT'], ['Fee', "'-Payroll fee"],
    ]);
  });
  it('SUM(Amount) is the total, exactly; review amounts only in Excluded Amount; no subtotal or total rows', () => {
    const amounts = rows.map((r) => minor(r.Amount, 2)).filter((v) => v !== null);
    assert.equal(sum(amounts), BigInt(model.totals.total), 'items + contingency + every fee = the Budget total');
    const items = rows.filter((r) => r['Row Type'] === 'Item').map((r) => minor(r.Amount, 2)).filter((v) => v !== null);
    assert.equal(sum(items), BigInt(model.totals.subtotal));
    const review = rows.filter((r) => r['Row Type'] === 'Review');
    assert.equal(review.length, 1);
    assert.equal(review[0].Amount, '', 'never in Amount');
    assert.equal(sum(review.map((r) => minor(r['Excluded Amount'], 2))), BigInt(model.totals.unresolved));
    assert.ok(rows.every((r) => r['Row Type'] === 'Review' || r['Excluded Amount'] === ''));
    assert.ok(!rows.some((r) => /total/i.test(r['Row Type'])), 'nothing counted twice');
  });
  it('every row is the model’s row: rate, amount, quantity, days, person-days, weeks', () => {
    const byName = new Map(all(model).map((r) => [r.name, r]));
    for (const r of rows.filter((x) => ['Item', 'Review'].includes(x['Row Type']))) {
      const m = byName.get(r.Item.replace(/^'/, ''));
      assert.ok(m, r.Item);
      assert.equal(r.Rate, m.rate === null ? '' : decimalText(m.rate, 'USD'), `${m.name}: rate`);
      if (!m.unresolved) assert.equal(r.Amount, m.total === null ? '' : decimalText(m.total, 'USD'), `${m.name}: amount`);
      if (r.Days) assert.equal(Number(r.Days), m.days, `${m.name}: days`);
      if (r.Weeks) assert.equal(Number(r.Weeks), m.weeks, `${m.name}: weeks`);
      if (r['Person-Days']) assert.equal(Number(r['Person-Days']), m.personDays);
      if (r.Quantity) assert.equal(Number(r.Quantity), m.qty);
    }
  });
  it('all seven costing methods, each with its rules in words', () => {
    const by = (name) => rows.find((r) => r.Item === name);
    assert.deepEqual(['Per day', 'Per week', 'Per unit', 'Per person-day', 'Per unit per week', 'Per unit per day', 'Flat fee'].every((m) => rows.some((r) => r['Costing Method'] === m)), true);
    assert.equal(by('Breakaway bottle')['Quantity Rule'], 'From breakdowns, used up');
    assert.equal(by('Breakaway bottle').Quantity, '12');
    assert.equal(by('Wine bottle')['Quantity Rule'], 'From breakdowns, reusable');
    assert.equal(by('Black SUV')['Week Rule'], '7-day week, part weeks rounded up');
    assert.equal(by('THEO')['Week Rule'], '5-day week, prorated');
    assert.equal(by('Ferry passengers')['Person-Days'], '25', 's1 (20) and s2 (25) are both on Day 1: the most in one day');
    assert.equal(by('Ferry passengers')['Quantity Rule'], 'From the schedule');
    assert.equal(by('MARIE')['Days Rule'], 'Days used');
    assert.equal(by("'+1 gaffer (night)")['Days Rule'], 'All shooting days');
    assert.equal(by('Camera package')['Costing Method'], 'Flat fee');
    assert.equal(by('Camera package').Days, '', 'a flat fee has no days');
  });
  it('free is 0.00 and Free; unknown is blank and No rate; Budget Status in the Budget’s own words', () => {
    const photo = rows.find((r) => r.Item === 'Family photo');
    assert.deepEqual([photo.Amount, photo.Rate, photo.Status], ['0.00', '0.00', 'Free']);
    const gm = rows.find((r) => r.Item === 'GRANDMÈRE');
    assert.deepEqual([gm.Amount, gm.Rate, gm.Status], ['', '', 'No rate']);
    assert.ok(rows.every((r) => r['Budget Status'] === TOTAL_LABEL[model.status]));
    assert.ok(rows.every((r) => r.Currency === 'USD'));
  });
  it('contingency and fees say their basis; a fixed fee and percentage fees add up with the rest', () => {
    const f = Object.fromEntries(fees(rows).map((r) => [r.Item, r]));
    assert.equal(f.Contingency['Costing Method'], '10% of the subtotal');
    assert.equal(f['Production insurance']['Costing Method'], 'Fixed amount');
    assert.equal(f['Production insurance'].Amount, '1200.55');
    assert.equal(f.VAT['Costing Method'], '20% of the subtotal + contingency');
    assert.equal(f["'-Payroll fee"]['Costing Method'], '3.5% of the subtotal');
    const m = Object.fromEntries(model.totals.fees.map((x) => [x.label, x.amount]));
    assert.equal(minor(f.VAT.Amount, 2), BigInt(m.VAT));
    assert.equal(minor(f["'-Payroll fee"].Amount, 2), BigInt(m['-Payroll fee']));
    assert.equal(minor(f.Contingency.Amount, 2), BigInt(model.totals.contingency));
  });
  it('the Basis is the Budget’s full account; notes and line breaks kept', () => {
    const by = (name) => rows.find((r) => r.Item === name);
    assert.match(by('Ferry passengers').Basis, /^25 on Day 1 = 25 person-days \(the most needed in one day/);
    assert.equal(by('Camera package').Note, all(model).find((r) => r.name === 'Camera package').note, 'the note as the Budget keeps it');
    assert.equal(by('Camera package').Note, 'Quote: two zooms, primes & a "wireless" follow-focus');
    assert.equal(by('MARIE').Note, 'Lead, "union" scale, 10% agent');
  });
});

describe('a spreadsheet can’t run what people typed; amounts stay numbers', () => {
  it('= + - @ tab and CR, after spaces too, get a leading apostrophe; ordinary text doesn’t', () => {
    for (const bad of ['=1+1', '+1 gaffer', '-Payroll', '@SUM(1)', '\t=x', '\r=x', '   =cmd', ' +x']) assert.equal(sheetText(bad), `'${bad}`, JSON.stringify(bad));
    for (const ok of ['Gaffer', 'Raincoat (2)', '1 unit', '', 'Port de Fécamp', 'a=b']) assert.equal(sheetText(ok), ok);
  });
  it('in the file: names, notes and fee labels guarded; Rate, Amount and counts left as numbers', () => {
    const { p } = film('USD');
    const { model } = exportOf(p);
    const rows = parseCsv(budgetCsv(p, model));
    assert.ok(rows.some((r) => r.Item === "'=HYPERLINK(\"http://x\",\"click\") & <script>alert(1)</script>"));
    assert.ok(rows.some((r) => r.Item === "'+1 gaffer (night)"));
    assert.ok(rows.some((r) => r.Note === "'@SUM(1+1) permit, quai Bérigny"));
    assert.ok(rows.some((r) => r.Item === "'-Payroll fee"));
    for (const r of rows) {
      for (const c of ['Quantity', 'Days', 'Person-Days', 'Weeks', 'Rate', 'Amount', 'Excluded Amount']) {
        assert.match(r[c], /^(\d+(\.\d+)?)?$/, `${r.Item} · ${c}: a plain number or blank`);
      }
    }
    // The model has no negative amounts; if one ever came, a number column would still be a number.
    assert.equal(decimalText(-125050, 'USD'), '-1250.50');
  });
});

describe('the currency’s precision, never through a float', () => {
  it('JPY 0, USD 2, KWD 3 decimals: exact text from minor units', () => {
    assert.equal(decimalText(1250, 'JPY'), '1250');
    assert.equal(decimalText(0, 'JPY'), '0');
    assert.equal(decimalText(125050, 'USD'), '1250.50');
    assert.equal(decimalText(5, 'USD'), '0.05');
    assert.equal(decimalText(0, 'USD'), '0.00');
    assert.equal(decimalText(1234, 'KWD'), '1.234');
    assert.equal(decimalText(9007199254740991, 'USD'), '90071992547409.91', 'the largest safe amount, exactly');
  });
  for (const [cur, digits] of [['JPY', 0], ['USD', 2], ['KWD', 3]]) {
    it(`${cur}: CSV amounts reconcile, the report shows ${digits} decimals`, () => {
      let { p } = film(cur, { priced: false });
      p = setLine(p, null, { section: 'crew', label: 'Gaffer', method: 'day', rate: 38001 }).production;
      p = setLine(p, null, { section: 'other', label: 'Stamps', method: 'flat', rate: 7 }).production;
      p = setBudgetSettings(p, { contingency: 333 }).production;
      const { model } = exportOf(p);
      const rows = parseCsv(budgetCsv(p, model));
      assert.equal(sum(rows.map((r) => minor(r.Amount, digits)).filter((v) => v !== null)), BigInt(model.totals.total));
      assert.equal(rows.find((r) => r.Item === 'Stamps').Amount, decimalText(7, cur));
      const html = budgetReportHtml(budgetReportPayload({ production: p, model, kind: 'detailed', locale: 'en-US' }), { locale: 'en-US' });
      const g = model.sections.find((s) => s.id === 'crew').rows[0];
      const shown = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(g.total / 10 ** digits);
      assert.ok(html.includes(`>${shown}<`), `${cur}: ${shown}`);
      assert.ok(html.includes(`Amount (${cur})`));
    });
  }
});

describe('the report (Summary / Detailed) is the Budget', () => {
  const { p } = film('USD');
  const { model } = exportOf(p);
  const payload = budgetReportPayload({ production: p, model, meta: { title: 'The Last Ferry', author: 'Ana' }, kind: 'detailed', locale: 'en-US', date: new Date(2026, 10, 25) });
  const html = budgetReportHtml(payload, { locale: 'en-US' });

  it('every subtotal, the contingency, each fee and the total are the model’s', () => {
    assert.equal(payload.total, model.totals.total);
    assert.equal(payload.subtotal, model.totals.subtotal);
    assert.equal(payload.contingency.amount, model.totals.contingency);
    assert.deepEqual(payload.fees.map((f) => f.amount), model.totals.fees.map((f) => f.amount));
    for (const s of payload.sections) assert.equal(s.subtotal, model.sections.find((x) => x.id === s.id).subtotal, s.label);
    assert.equal(payload.sections.flatMap((s) => s.rows).length + payload.review.length, all(model).length, 'every row, once');
    assert.equal(payload.label, TOTAL_LABEL[model.status]);
    for (const v of [model.totals.subtotal, model.totals.contingency, ...model.totals.fees.map((f) => f.amount)]) {
      assert.ok(html.includes(new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(v / 100)), String(v));
    }
    assert.ok(html.includes(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(model.totals.total / 100)), 'the total, with its symbol');
  });
  it('a review cost is listed apart and in no total; unpriced shows No rate and —, never 0; zero shows 0.00', () => {
    assert.equal(payload.review.length, 1);
    assert.equal(payload.review[0].name, 'Lantern');
    assert.ok(!payload.sections.some((s) => s.rows.some((r) => r.name === 'Lantern')));
    assert.match(html, /Waiting for review — not included in any total/);
    assert.match(html, /<td class="n nowrap">\(40\.00\)<\/td>/);
    const gm = payload.sections.flatMap((s) => s.rows).find((r) => r.name === 'GRANDMÈRE');
    assert.equal(gm.total, null);
    assert.match(html, /GRANDMÈRE<\/td><td>Per day<\/td><td>[^<]*<\/td><td class="n"><span class="none">No rate<\/span><\/td><td class="n nowrap"><span class="none">—<\/span>/);
    assert.match(html, /Family photo<\/td><td>Per unit<\/td><td>[^<]*<\/td><td class="n">0\.00<span class="per"> \/unit<\/span><\/td><td class="n nowrap">0\.00<\/td>/);
  });
  it('one filming location for two scripted places: its row says both, counted once', () => {
    const port = payload.sections.find((s) => s.id === 'locations').rows.find((r) => r.name === 'Port de Fécamp');
    assert.deepEqual(port.places, ['HARBOR', 'PIER']);
    assert.match(html, /Scripted places: HARBOR, PIER/);
    assert.equal(port.total, all(model).find((r) => r.name === 'Port de Fécamp').total);
  });
  it('Method, Calculation notes, currency in the headings; the running header names the project and currency; continuations say so', () => {
    assert.match(html, /<th>Method<\/th>/);
    assert.doesNotMatch(html, /Costed/);
    assert.match(html, /<h2>Calculation notes<\/h2>/);
    assert.match(html, /Rate \(USD\)<\/th><th class="n">Amount \(USD\)/);
    assert.match(html, /<thead><tr><td><div class="rh"><span>The Last Ferry — Detailed budget<\/span><span>Amounts in USD · November 25, 2026<\/span>/);
    assert.match(html, /<tr class="cont"><th colspan="5">Cast <span>\(continued\)<\/span><\/th><\/tr>/, 'a repeated heading is a continuation');
    assert.match(html, /<tr class="subtotal"><td colspan="4">Cast subtotal/, 'the subtotal once, after the rows');
    assert.doesNotMatch(html, /class="cont"[^<]*<th[^>]*>[^<]*\d/, 'no amount in a repeated heading');
    assert.match(html, /\.cat-head, \.cont th \{ height: 18pt;/);
    assert.match(html, /\.cat-head \{ position: relative; z-index: 1; margin-bottom: -18pt;/, 'the first heading covers its "(continued)": the same height');
    assert.match(html, /<div class="foot">Made with DraftLine<\/div>/);
    assert.doesNotMatch(html, /@page \{[^}]*size:/, 'paper size: the print dialog’s (A4 or Letter)');
    assert.doesNotMatch(html, /color: #(?!111|222|333|444|777|888|999|bbb|ccc|fff)[0-9a-f]{3,6}/i, 'black, white and greys only');
  });
  it('the Summary: the header, what’s missing, the categories and totals; no item tables', () => {
    const s = budgetReportHtml(budgetReportPayload({ production: p, model, meta: { title: 'The Last Ferry' }, kind: 'summary', locale: 'en-US' }), { locale: 'en-US' });
    assert.match(s, /Budget summary/);
    assert.match(s, /<h2>Summary<\/h2>/);
    assert.doesNotMatch(s, /class="items"|Detailed budget|Calculation notes/);
    assert.match(s, /Partial total|Estimated total|Total/);
  });
  it('what a person typed is escaped everywhere: title, author, names, notes, fee labels', () => {
    const q = budgetReportPayload({ production: p, model, meta: { title: '<img src=x onerror=alert(1)> & "Co"', author: "O'Neil <b>" }, kind: 'detailed', locale: 'en-US' });
    const h = budgetReportHtml(q, { locale: 'en-US' });
    assert.ok(!h.includes('<img src=x') && !h.includes('<script>alert(1)') && !h.includes("O'Neil <b>"));
    assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Co&quot;'));
    assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(h.includes('O&#39;Neil &lt;b&gt;'));
    assert.ok(h.includes('Lead, &quot;union&quot; scale, 10% agent'));
    assert.match(h, /<title>&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;Co&quot; - Budget<\/title>/);
  });
  it('the file names Save as PDF and the download suggest', () => {
    assert.equal(budgetFileTitle('The Last Ferry', 'detailed'), 'The Last Ferry - Budget');
    assert.equal(budgetFileTitle('The Last Ferry', 'summary'), 'The Last Ferry - Budget Summary');
    assert.equal(budgetFileTitle('  ', 'summary'), 'Untitled - Budget Summary');
    assert.equal(budgetCsvFileName('What Happened to Haiti? The Long Way Home'), 'What_Happened_to_Haiti_The_Long_Way_Home_Budget.csv');
    let printed = null;
    exportBudgetPdf({ production: p, model, meta: { title: 'The Last Ferry' }, kind: 'summary', locale: 'en-US' }, (x) => { printed = x; return 'window'; });
    assert.equal(printed.title, 'The Last Ferry - Budget Summary');
    assert.match(printed.html, /^<!doctype html>/);
  });
});

describe('pagination: no subtotal alone on a page; small categories kept whole; large ones run on', () => {
  const { p } = film('USD');
  let q = p;
  for (let i = 0; i < 40; i++) q = setLine(q, null, { section: 'catering', label: `Meal ${i + 1}`, method: 'flat', rate: 1500 }).production;
  const { model } = exportOf(q);
  const html = budgetReportHtml(budgetReportPayload({ production: q, model, kind: 'detailed', locale: 'en-US' }), { locale: 'en-US' });
  const sections = [...html.matchAll(/<section class="cat([^"]*)">([\s\S]*?)<\/section>/g)].map((m) => ({ cls: m[1], body: m[2] }));
  it('every category: its last item and its subtotal share one tbody that print won’t split', () => {
    const cats = sections.filter((x) => !x.cls.includes('review'));
    assert.equal(cats.length, model.sections.filter((s) => s.rows.some((r) => !r.unresolved)).length);
    for (const c of cats) {
      const end = c.body.match(/<tbody class="end">([\s\S]*?)<\/tbody>/);
      assert.ok(end, c.body.slice(0, 80));
      assert.equal((end[1].match(/<tr>/g) || []).length, 1, 'exactly the last item row');
      assert.match(end[1], /<tr class="subtotal">/, 'and the subtotal');
      assert.equal((c.body.match(/class="subtotal"/g) || []).length, 1, 'one subtotal, after the rows');
    }
    assert.match(html, /\.cat\.keep, \.items tbody\.end \{ break-inside: avoid; page-break-inside: avoid; \}/);
  });
  it(`up to ${KEEP_WHOLE} items: kept whole; more: free to run across pages (rows never split, headings repeat)`, () => {
    const rowsIn = (c) => (c.body.match(/<tr>/g) || []).length;
    for (const c of sections) assert.equal(c.cls.includes('keep'), rowsIn(c) <= KEEP_WHOLE, `${rowsIn(c)} rows`);
    const catering = sections.find((c) => c.body.includes('Meal 40'));
    assert.ok(!catering.cls.includes('keep'), '40 meals: not held together');
    assert.match(catering.body, /<thead>\s*<tr class="cont"><th colspan="5">Catering <span>\(continued\)<\/span>/);
    assert.match(html, /\.items tr \{ break-inside: avoid; \}/);
  });
  it('the Summary has no item tables, so none of this changes it', () => {
    const s = budgetReportHtml(budgetReportPayload({ production: q, model, kind: 'summary', locale: 'en-US' }), { locale: 'en-US' });
    assert.doesNotMatch(s, /<section class="cat|tbody class="end"/);
  });
});

describe('Total, Estimated total, Partial total: the PDF and the CSV say the same as the Budget', () => {
  const cases = () => {
    // Complete: every row priced and scheduled, no review, places all at a location.
    let c = normalizeProduction({ version: 1, scenes: {} });
    c = setCurrency(c, 'EUR').production;
    for (const name of CAST) c = setLine(c, null, { source: { kind: 'cast', name }, method: 'day', rate: 10000 }).production;
    for (const place of ['HARBOR', 'FERRY', 'PIER', 'HOME']) {
      const a = addSite(c, { name: `${place} site` });
      c = setLine(mapPlace(a.production, place, a.id).production, null, { source: { kind: 'site', id: a.id }, method: 'flat', rate: 5000 }).production;
    }
    const complete = exportOf(c);
    // Estimated: no schedule, planned days for crew.
    let e = setLine(setCurrency(normalizeProduction({ version: 1, scenes: {} }), 'EUR').production, null, { section: 'crew', label: 'Gaffer', method: 'day', rate: 30000 }).production;
    e = setBudgetSettings(e, { plannedDays: 4 }).production;
    const rowsNoCast = rowsOf(e).map((r) => ({ ...r, cast: [] }));
    const estimated = budgetForExport({ production: e, rows: rowsNoCast, schedule: null });
    return { complete: [c, complete.model], estimated: [e, estimated.model], incomplete: [film('USD').p, exportOf(film('USD').p).model] };
  };
  for (const [status, [p, model]] of Object.entries(cases())) {
    it(`${status}: “${TOTAL_LABEL[status]}” in the CSV’s Budget Status and the report`, () => {
      assert.equal(model.status, status);
      const rows = parseCsv(budgetCsv(p, model));
      assert.ok(rows.every((r) => r['Budget Status'] === TOTAL_LABEL[status]));
      const html = budgetReportHtml(budgetReportPayload({ production: p, model, kind: 'summary', locale: 'en-US' }), { locale: 'en-US' });
      assert.match(html, new RegExp(`<b>${TOTAL_LABEL[status]} `));
      if (status === 'incomplete') assert.match(html, /not a full budget yet/);
      if (status === 'estimated') assert.match(html, /includes estimates/);
      if (status === 'complete') assert.doesNotMatch(html, /not a full budget yet|includes estimates/);
    });
  }
});

describe('what can be exported', () => {
  it('nothing to budget: no cast, items, locations or costs → not available (empty)', () => {
    const p = normalizeProduction({ version: 1, scenes: {} });
    const rows = rowsOf(p).map((r) => ({ ...r, cast: [] }));
    assert.deepEqual(budgetForExport({ production: p, rows, schedule: null }).reason, 'empty');
    assert.equal(anythingToBudget({ production: p, analysis: { characterList: [] }, scenes: [{ id: 's1' }] }), false);
  });
  it('populated but unpriced, even without a currency: available, a costing worksheet with blank amounts', () => {
    const { p } = film(null, { priced: false });
    const r = exportOf(p);
    assert.equal(r.available, true);
    const rows = parseCsv(budgetCsv(p, r.model));
    assert.ok(rows.length > 5);
    assert.ok(rows.every((x) => x.Amount === '' && x.Rate === '' && x.Currency === ''), 'nothing invented: no amount, no currency');
    assert.ok(rows.every((x) => x.Status === 'No rate' && x['Budget Status'] === 'Partial total'));
    const html = budgetReportHtml(budgetReportPayload({ production: p, model: r.model, kind: 'detailed', locale: 'en-US' }), { locale: 'en-US' });
    assert.match(html, /No currency chosen yet/);
    // No item or category is shown as 0: each is "No rate" and —. The totals are the Budget's own
    // (Partial total 0.00 of what's priced, as on screen), said to be partial, with why.
    assert.equal((html.match(/<span class="none">No rate<\/span>/g) || []).length, all(r.model).length);
    assert.doesNotMatch(html.slice(html.indexOf('<table class="sum">'), html.indexOf('<table class="totals">')), />0\.00</);
    assert.doesNotMatch(html.slice(html.indexOf('Detailed budget')), /<td class="n nowrap">0\.00<\/td>/);
    assert.match(html, /<b>Partial total 0\.00<\/b> — not a full budget yet/);
    assert.match(html, /items? without a rate/);
    assert.equal(anythingToBudget({ production: p, analysis: { characterList: [] }, scenes: SCENES }), true, 'breakdown items');
  });
  it('the quick check sees speaking cast, a location or a cost', () => {
    const p = normalizeProduction({ version: 1, scenes: {} });
    const analysis = { characterList: [{ name: 'MARIE', entries: [{ cue: { id: 'c1' } }] }], sceneOfBlock: { c1: 's1' } };
    assert.equal(anythingToBudget({ production: p, analysis, scenes: [{ id: 's1' }] }), true);
    assert.equal(anythingToBudget({ production: addSite(p, { name: 'Pier' }).production, analysis: {}, scenes: [] }), true);
    assert.equal(anythingToBudget({ production: setLine(p, null, { section: 'crew', label: 'Gaffer' }).production, analysis: {}, scenes: [] }), true);
  });
  it('a budget from a newer DraftLine: not available (newer), never read or rewritten', () => {
    const p = { ...normalizeProduction({ version: 1, scenes: {} }), budget: { version: BUDGET_VERSION + 1, lines: { x: { future: true } } } };
    assert.equal(budgetForExport({ production: p, rows: rowsOf(p), schedule: null }).reason, 'newer');
    assert.match(UNAVAILABLE.newer, /newer version of DraftLine/);
  });
  it('File ▾ → Export Planning & Production: Budget .pdf and .csv right after Scene Breakdown; greyed out with the reason', () => {
    const items = fileMenuItems({ onBreakdownCsv: () => {}, onBudgetPdf: () => {}, onBudgetCsv: () => {}, hasScenes: true, onOutlineCsv: () => {}, onOutlineMd: () => {}, onOutlineFountain: () => {} });
    const at = items.findIndex((i) => i.label === 'Scene Breakdown');
    assert.deepEqual(items.slice(at + 1, at + 3).map((i) => `${i.label} ${i.ext}`), ['Budget .pdf', 'Budget .csv']);
    assert.ok(items.slice(at + 1, at + 3).every((i) => !i.disabled));
    const off = fileMenuItems({ onBreakdownCsv: () => {}, onBudgetPdf: () => {}, onBudgetCsv: () => {}, budgetUnavailable: UNAVAILABLE.empty, hasScenes: true });
    const b = off.filter((i) => i.label === 'Budget');
    assert.ok(b.every((i) => i.disabled && i.title === UNAVAILABLE.empty));
  });
});

describe('a schedule change shows in both exports', () => {
  it('moving a scene to another day changes days and amounts exactly as the Budget does', () => {
    const { p } = film('USD');
    const a = exportOf(p, [['s1', 's2'], ['s3', 's4']]).model;
    const b = exportOf(p, [['s1'], ['s2'], ['s3', 's4']]).model;
    const day = (model, name) => parseCsv(budgetCsv(p, model)).find((r) => r.Item === name);
    assert.equal(day(a, 'MARIE').Days, '1');
    assert.equal(day(b, 'MARIE').Days, '2');
    assert.equal(day(b, 'MARIE').Amount, decimalText(all(b).find((r) => r.name === 'MARIE').total, 'USD'));
    assert.notEqual(a.totals.total, b.totals.total);
    assert.equal(sum(parseCsv(budgetCsv(p, b)).map((r) => minor(r.Amount, 2)).filter((v) => v !== null)), BigInt(b.totals.total));
    assert.equal(budgetReportPayload({ production: p, model: b, kind: 'summary', locale: 'en-US' }).total, b.totals.total);
  });
});

describe('large budgets, long names and notes', () => {
  it('600 items: every amount reconciles; long text is kept whole (it wraps in print)', () => {
    let p = setCurrency(normalizeProduction({ version: 1, scenes: {} }), 'USD').production;
    const long = `${'Very long equipment name '.repeat(12)}end`;
    for (let i = 0; i < 600; i++) {
      p = setLine(p, null, { section: ['crew', 'equipment', 'transport', 'catering'][i % 4], label: i === 7 ? long : `Item ${i}`, method: 'flat', rate: 123457 + i, note: i === 9 ? 'n'.repeat(900) : undefined }).production;
    }
    const { model } = budgetForExport({ production: p, rows: [], schedule: null });
    const rows = parseCsv(budgetCsv(p, model));
    assert.equal(rows.length, 600);
    assert.equal(sum(rows.map((r) => minor(r.Amount, 2))), BigInt(model.totals.total));
    const html = budgetReportHtml(budgetReportPayload({ production: p, model, kind: 'detailed', locale: 'en-US' }), { locale: 'en-US' });
    assert.ok(html.includes(long) && html.includes('n'.repeat(900)));
    assert.match(html, /\.items td \{[^}]*overflow-wrap: anywhere;/, 'never clipped: long words break');
  });
});

describe('exporting never changes the project', () => {
  const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
  it('a frozen project exports both ways, unchanged (any write would throw)', () => {
    const { p } = film('USD');
    const before = JSON.stringify(p);
    const frozen = deepFreeze(structuredClone(p));
    const rows = rowsOf(frozen);
    const { model } = budgetForExport({ production: frozen, rows, schedule: scheduleOf(SCHEDULED) });
    budgetCsv(frozen, model);
    budgetCsvRows(frozen, model);
    for (const kind of ['summary', 'detailed']) budgetReportHtml(budgetReportPayload({ production: frozen, model, kind, locale: 'en-US' }));
    assert.equal(JSON.stringify(frozen), before);
  });
  it('the File menu reads; nothing in the export path saves, steps or touches storage or the network', () => {
    const src = read('lib/budgetExport.js');
    assert.doesNotMatch(src, /setLine|setCurrency|setFee|setBudgetSettings|productionStep|localStorage|indexedDB|fetch\(|XMLHttpRequest/);
    assert.doesNotMatch(src, /amountOf|applyBasisPoints|sumAmounts|roundDiv|BigInt|\.total\s*[+*/-]|\* 10 \*\*|\/ 10 \*\*/, 'no money worked out here');
    const app = read('App.jsx');
    assert.match(app, /const budgetExportFor = async \(\) => \{\s*const \{ buildBreakdown \} = await import\('\.\/lib\/productionEngine\.js'\);\s*const rows = buildBreakdown\(\{ blocks, analysis, scenes, production \}\);\s*return budgetForExport\(\{ production, rows, schedule: scheduleIsReadable\(production\.schedule\) \? production\.schedule : null \}\);/);
    const modal = read('components/ExportBudgetModal.jsx');
    assert.doesNotMatch(modal + app.slice(app.indexOf('const budgetExportFor'), app.indexOf('// Format stepper')), /productionStep|setProduction|budgetStep/);
  });
  it('the Budget’s words: the export’s labels are BudgetView’s', () => {
    assert.match(read('components/planning/BudgetView.jsx'), /m\.status === 'complete' \? 'Total' : m\.status === 'estimated' \? 'Estimated total' : 'Partial total'/);
    assert.deepEqual(TOTAL_LABEL, { complete: 'Total', estimated: 'Estimated total', incomplete: 'Partial total' });
  });
});
