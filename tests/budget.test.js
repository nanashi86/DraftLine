// Stage 2, Phase 3A: the Budget's data, money and calculation (lib/budget.js, lib/money.js,
// lib/locations.js) and what production changes do to it (lib/productionData.js). Spec:
// docs/specs/budget.md. Amounts are in minor units (cents) throughout.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET_VERSION, budgetModel, removeLine, resolveReview, setBudgetSettings, setCurrency, setFee, setLine,
} from '../src/lib/budget.js';
import { amountOf, currencyDigits, parseAmount, roundDiv } from '../src/lib/money.js';
import { siteOfRow } from '../src/lib/locations.js';
import {
  addNeed, addSite, applySlice, assignScene, changedParts, deleteElement, deleteSite, mapPlace, mergeElements, normalizeProduction,
  reclassifyElement, renameCast, renameElement, separateNeed, setNeed, sliceOf,
} from '../src/lib/productionData.js';
import { addDay, moveScene, scheduleModel, setDayDate } from '../src/lib/schedule.js';
import { sceneNeeds } from '../src/lib/elements.js';
import { toDoc, toRecord } from '../src/lib/projectStorage.js';
import { createRevision } from '../src/lib/revisions.js';

// ---- A small production -------------------------------------------------------------------------------

const SCENES = [
  { id: 's1', heading: 'EXT. HARBOR - DOCK - DAY', cast: ['MARIE', 'THEO'] },
  { id: 's2', heading: 'INT. FERRY - DAY', cast: ['MARIE'] },
  { id: 's3', heading: 'EXT. HARBOR - NIGHT', cast: ['THEO'] },
  { id: 's4', heading: 'INT. CAFE - DAY', cast: ['MARIE'] },
  { id: 's5', heading: 'EXT. ROAD - DAY', cast: ['MARIE'] },
];
const NUM = { MARIE: 1, THEO: 2 };
const rowsOf = (p, scenes = SCENES) => scenes.map((s, i) => ({
  id: s.id, number: i + 1, heading: s.heading, location: s.heading.replace(/^(INT|EXT)\. /, '').replace(/ - (DAY|NIGHT)$/, ''), eighths: 8,
  cast: s.cast.map((name) => ({ name, number: NUM[name] })), needs: sceneNeeds(p.scenes?.[s.id], p.elements),
}));
/** Days: [[sceneIds of day 1], [day 2]…] → a schedule. */
function scheduleOf(days, dates = []) {
  let s = null;
  days.forEach((ids, i) => {
    const r = addDay(s);
    s = r.schedule;
    for (const id of ids) s = moveScene(s, id, r.dayId);
    if (dates[i] !== undefined) s = setDayDate(s, r.dayId, dates[i]);
  });
  return s;
}
const need = (p, sceneId, cat, name, qty) => {
  const r = addNeed(p, sceneId, cat, { name });
  return qty === undefined ? r.production : setNeed(r.production, sceneId, r.id, { qty });
};
const elId = (p, name) => Object.values(p.elements).find((e) => e.name === name).id;
const model = (p, days = null, dates = []) => {
  const rows = rowsOf(p);
  return budgetModel(p, rows, days ? scheduleModel(rows, scheduleOf(days, dates)) : scheduleModel(rows, null));
};
const rowFor = (m, pred) => m.sections.flatMap((s) => s.rows).find(pred);
const byName = (m, name) => rowFor(m, (r) => r.name === name);
const line = (p, fields, id = null) => {
  const r = setLine(p, id, fields);
  assert.ok(!r.error, r.error);
  return r;
};
const bare = () => normalizeProduction({ version: 1, scenes: {} });
const base = () => setCurrency(bare(), 'USD').production;

describe('money: exact, in minor units', () => {
  it('knows each currency’s decimals, parses without rounding, and rounds once, half away from zero', () => {
    assert.deepEqual([currencyDigits('USD'), currencyDigits('JPY'), currencyDigits('KWD'), currencyDigits('usd')], [2, 0, 3, null]);
    assert.deepEqual(parseAmount('1,250.50', 2), { value: 125050 });
    assert.deepEqual(parseAmount('1.250,5', 2, { decimal: ',' }), { value: 125050 });
    assert.deepEqual(parseAmount('12.505', 2), { error: 'precision' }, 'never rounded silently');
    assert.deepEqual(parseAmount('1250', 0), { value: 1250 });
    assert.deepEqual(parseAmount('1.2345', 3), { error: 'precision' });
    for (const bad of ['-3', 'abc', '1e5', '', '1.2.3']) assert.equal(parseAmount(bad, 2).error, 'invalid', bad);
    assert.equal(parseAmount('99999999999999999', 2).error, 'range');
    assert.equal(roundDiv(25n, 10n), 3n);
    assert.equal(roundDiv(-25n, 10n), -3n);
    assert.equal(roundDiv(24n, 10n), 2n);
    assert.equal(amountOf(10, [30n], [100n]), 3, '0.10 × 0.3: no floating-point drift');
    assert.equal(amountOf(Number.MAX_SAFE_INTEGER, [200n], [100n]), null, 'out of range: null, never a wrong number');
  });
});

describe('costing methods', () => {
  it('a package per day and a rate per unit per day (no schedule needed when the days are entered)', () => {
    let p = base();
    p = line(p, { section: 'equipment', label: 'Camera package', method: 'day', rate: 50000, days: { from: 'manual', value: 5 } }).production;
    p = line(p, { section: 'equipment', label: 'Cameras', method: 'unitDay', rate: 10000, qty: { from: 'manual', value: 3 }, days: { from: 'manual', value: 5 } }).production;
    const m = model(p);
    assert.equal(byName(m, 'Camera package').total, 250000, '$500/day × 5 days = $2,500');
    assert.equal(byName(m, 'Cameras').total, 150000, '$100/unit/day × 3 × 5 = $1,500');
    assert.equal(m.sections.find((s) => s.id === 'equipment').subtotal, 400000);
  });

  it('background: the most needed on each day, added up over days — and never multiplied by days again', () => {
    let p = base();
    p = need(p, 's1', 'extras', 'Ferry passengers', 20);
    const id = elId(p, 'Ferry passengers');
    p = setNeed(addNeed(p, 's2', 'extras', { id }).production, 's2', id, { qty: 12 });
    p = setNeed(addNeed(p, 's3', 'extras', { id }).production, 's3', id, { qty: 25 });
    p = line(p, { source: { kind: 'element', id }, rate: 15000 }).production;
    const m = model(p, [['s1', 's2'], ['s4'], ['s3', 's5']]);
    const r = byName(m, 'Ferry passengers');
    assert.equal(r.method, 'personDay');
    assert.equal(r.personDays, 45, '20 on Day 1 (not 20 + 12) + 25 on Day 3');
    assert.equal(r.total, 675000);
    assert.equal(r.days, null, 'days are already in the person-days');
    assert.match(r.basis, /assuming the same people cover that day's scenes/, 'the assumption is said');
    // An explicit override: people × days entered.
    const o = line(p, { qty: { from: 'manual', value: 30 }, days: { from: 'manual', value: 2 } }, r.lineId).production;
    assert.equal(byName(model(o, [['s1', 's2'], ['s4'], ['s3', 's5']]), 'Ferry passengers').total, 900000, '30 × 2 × $150');
  });

  it('reusable items count the most in one scene; consumables add up across scenes', () => {
    let p = need(base(), 's1', 'props', 'Wine bottle', 2);
    const wine = elId(p, 'Wine bottle');
    p = setNeed(addNeed(p, 's4', 'props', { id: wine }).production, 's4', wine, { qty: 2 });
    p = need(p, 's1', 'sfx', 'Breakaway bottle', 6);
    const brk = elId(p, 'Breakaway bottle');
    p = setNeed(addNeed(p, 's4', 'sfx', { id: brk }).production, 's4', brk, { qty: 6 });
    p = line(p, { source: { kind: 'element', id: wine }, rate: 1500 }).production;
    p = line(p, { source: { kind: 'element', id: brk }, rate: 2500, usage: 'consume' }).production;
    const m = model(p);
    assert.equal(byName(m, 'Wine bottle').qty, 2);
    assert.equal(byName(m, 'Wine bottle').total, 3000);
    assert.equal(byName(m, 'Breakaway bottle').qty, 12);
    assert.equal(byName(m, 'Breakaway bottle').total, 30000);
  });

  it('usage days, a continuous span in shooting days, and in calendar days only when the dates are definite', () => {
    let p = need(base(), 's2', 'vehicles', 'Black SUV');
    const suv = elId(p, 'Black SUV');
    p = addNeed(p, 's4', 'vehicles', { id: suv }).production;
    p = addNeed(p, 's5', 'vehicles', { id: suv }).production;
    const days = [['s1'], ['s2'], ['s4'], ['s3'], ['s5']]; // used on Days 2, 3, 5
    const at = (from, dates = []) => {
      const q = line(p, { source: { kind: 'element', id: suv }, method: 'day', rate: 20000, days: { from } }).production;
      return byName(model(q, days, dates), 'Black SUV');
    };
    assert.equal(at('use').total, 60000, '3 days used');
    assert.equal(at('span').total, 80000, 'Day 2 to Day 5: 4 shooting days held');
    const dated = ['2026-05-01', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'];
    assert.equal(at('calendar', dated).days, 4, 'Mon 4 to Thu 7');
    const gap = ['2026-04-30', '2026-05-01', '2026-05-08', '2026-05-11', '2026-05-12'];
    assert.equal(at('calendar', gap).days, 12, 'Day 2 (1 May) to Day 5 (12 May): 12 calendar days held, though 4 are shot');
  });

  it('a calendar span with a date missing, repeated or out of order is never presented as definite', () => {
    let p = need(base(), 's2', 'vehicles', 'Black SUV');
    const suv = elId(p, 'Black SUV');
    p = addNeed(p, 's5', 'vehicles', { id: suv }).production;
    const q = line(p, { source: { kind: 'element', id: suv }, method: 'day', rate: 20000, days: { from: 'calendar' } });
    const days = [['s2'], ['s1'], ['s5']];
    for (const dates of [['2026-05-01', null, '2026-05-03'], ['2026-05-01', '2026-05-01', '2026-05-03'], ['2026-05-03', '2026-05-02', '2026-05-01']]) {
      const r = byName(model(q.production, days, dates), 'Black SUV');
      assert.equal(r.total, null, JSON.stringify(dates));
      assert.ok(r.flags.includes('datesUncertain'));
      assert.match(r.basis, /enter the days/);
    }
    const manual = line(q.production, { days: { from: 'manual', value: 3 } }, q.id).production;
    assert.equal(byName(model(manual, days, ['2026-05-01', null, '2026-05-03']), 'Black SUV').total, 60000, 'the manual alternative');
  });

  it('cast: work days, holds shown and counted only when marked paid', () => {
    let p = base();
    p = line(p, { source: { kind: 'cast', name: 'Marie' }, rate: 40000 }).production; // names are stored in capitals
    const days = [['s1'], ['s2'], ['s3'], ['s4'], ['s5']]; // MARIE: 1, 2, 4, 5 work; 3 hold
    const r = byName(model(p, days), 'MARIE');
    assert.equal(r.days, 4);
    assert.equal(r.total, 160000);
    assert.match(r.basis, /4 work days \+ 1 hold \(unpaid: not counted\)/);
    const paid = line(p, { holds: 'paid' }, r.lineId).production;
    assert.equal(byName(model(paid, days), 'MARIE').total, 200000);
  });

  it('weekly rates: 5- or 7-day weeks, prorated unless rounding up is chosen', () => {
    let p = base();
    p = line(p, { section: 'equipment', label: 'Grip truck', method: 'week', rate: 90000, days: { from: 'manual', value: 6 } }).production;
    const id = Object.keys(p.budget.lines)[0];
    assert.equal(byName(model(p), 'Grip truck').total, 108000, '6 ÷ 5 = 1.2 weeks × $900');
    assert.match(byName(model(p), 'Grip truck').basis, /prorated/);
    p = line(p, { week: { rounding: 'up' } }, id).production;
    assert.equal(byName(model(p), 'Grip truck').total, 180000, 'rounded up to 2 weeks, and the basis says so');
    p = line(p, { week: { days: 7, rounding: 'up' } }, id).production;
    assert.equal(byName(model(p), 'Grip truck').total, 90000, 'a 7-day week: 1 week');
    p = setBudgetSettings(p, { week: { days: 7, rounding: 'prorate' } }).production;
    p = line(p, { week: null }, id).production;
    assert.equal(byName(model(p), 'Grip truck').total, roundDivNum(90000 * 6, 7), 'the project’s week');
  });
});
const roundDivNum = (n, d) => Number(roundDiv(BigInt(n), BigInt(d)));

describe('unknown is never zero; incomplete is never complete', () => {
  it('a missing rate is unknown, 0 is confirmed free, an unset scene quantity counts as 1 and says so', () => {
    let p = need(base(), 's1', 'props', 'Rope');
    p = need(p, 's1', 'props', 'Lantern');
    p = line(p, { source: { kind: 'element', id: elId(p, 'Lantern') }, rate: 0 }).production;
    const m = model(p);
    const rope = byName(m, 'Rope');
    assert.equal(rope.total, null);
    assert.ok(rope.flags.includes('missingRate'));
    assert.equal(byName(m, 'Lantern').total, 0, 'confirmed free');
    assert.ok(!byName(m, 'Lantern').flags.includes('missingRate'));
    assert.ok(byName(m, 'Lantern').flags.includes('assumedQty'));
    assert.equal(m.status, 'incomplete');
  });

  it('no schedule: days wait for one, or use the planned number as an estimate; a partial schedule is never complete', () => {
    let p = base();
    p = line(p, { section: 'catering', label: 'Catering', method: 'unitDay', rate: 1500, qty: { from: 'manual', value: 30 }, days: { from: 'shoot' } }).production;
    assert.ok(byName(model(p), 'Catering').flags.includes('needsSchedule'));
    p = setBudgetSettings(p, { plannedDays: 12 }).production;
    let m = model(p);
    assert.equal(byName(m, 'Catering').total, 540000);
    assert.ok(byName(m, 'Catering').flags.includes('estimate'));
    // Every cast row priced, but only some scenes scheduled.
    for (const name of ['MARIE', 'THEO']) p = line(p, { source: { kind: 'cast', name }, rate: 1000 }).production;
    m = model(p, [['s1'], ['s2']]);
    assert.equal(m.gaps.missingRates, 0);
    assert.equal(m.gaps.unscheduledScenes, 3);
    assert.equal(m.status, 'incomplete', 'unscheduled scenes: not a complete budget');
    assert.ok(byName(m, 'MARIE').flags.includes('unscheduled'));
    m = model(p, [['s1', 's2'], ['s3'], ['s4', 's5']]);
    assert.equal(m.status, 'complete');
  });

  it('contingency on the subtotal; each fee on its stated base, never on another fee', () => {
    let p = base();
    p = line(p, { section: 'other', label: 'A', method: 'flat', rate: 100000 }).production;
    p = setBudgetSettings(p, { contingency: 1000 }).production;
    p = setFee(p, null, { label: 'Sales tax', bp: 500, base: 'subtotal' }).production;
    p = setFee(p, null, { label: 'Agency fee', bp: 800, base: 'withContingency' }).production;
    p = setFee(p, null, { label: 'Permit', amount: 2500 }).production;
    const t = model(p).totals;
    assert.equal(t.subtotal, 100000);
    assert.equal(t.contingency, 10000);
    assert.deepEqual(t.fees.map((f) => [f.label, f.amount, f.basis]), [
      ['Sales tax', 5000, 'subtotal'], ['Agency fee', 8800, 'subtotal + contingency'], ['Permit', 2500, 'fixed amount'],
    ]);
    assert.equal(t.total, 126300);
    assert.equal(setFee(p, null, { label: 'Bad', bp: 500, base: 'fees' }).error, 'fee', 'no fee on fees');
  });

  it('three-decimal and zero-decimal currencies round once per line', () => {
    let p = setCurrency(bare(), 'KWD').production;
    p = line(p, { section: 'other', label: 'K', method: 'unit', rate: 1235, qty: { from: 'manual', value: 1.5 } }).production;
    assert.equal(byName(model(p), 'K').total, 1853, '1.235 × 1.5 = 1.8525 → 1.853');
    let y = setCurrency(bare(), 'JPY').production;
    y = line(y, { section: 'other', label: 'Y', method: 'unit', rate: 333, qty: { from: 'manual', value: 1.5 } }).production;
    assert.equal(byName(model(y), 'Y').total, 500, '¥333 × 1.5 = 499.5 → ¥500');
  });

  it('an amount too large is flagged, never a wrong number', () => {
    const p = line(base(), { section: 'other', label: 'Huge', method: 'unit', rate: Number.MAX_SAFE_INTEGER, qty: { from: 'manual', value: 1000 } }).production;
    const m = model(p);
    assert.ok(byName(m, 'Huge').flags.includes('overflow'));
    assert.equal(m.status, 'incomplete');
  });
});

describe('currency: one per project, never silently converted', () => {
  it('asks first when amounts exist, then keeps face value; refuses what the new currency can’t hold', () => {
    let p = setCurrency(base(), 'USD').production;
    assert.equal(setCurrency(p, 'EUR').production.budget.currency, 'EUR', 'nothing entered yet: no question');
    p = line(p, { section: 'other', label: 'A', method: 'flat', rate: 1250 }).production; // $12.50
    assert.deepEqual(setCurrency(p, 'EUR').needsConfirm, true);
    assert.equal(setCurrency(p, 'EUR', { confirm: true }).production.budget.lines[Object.keys(p.budget.lines)[0]].rate, 1250, '€12.50');
    assert.equal(setCurrency(p, 'JPY', { confirm: true }).error, 'precision', '12.50 can’t be yen');
    const whole = line(base(), { section: 'other', label: 'B', method: 'flat', rate: 1200 }).production;
    const yen = setCurrency(whole, 'JPY', { confirm: true }).production;
    assert.equal(Object.values(yen.budget.lines)[0].rate, 12, '$12.00 → ¥12 (face value)');
    assert.equal(Object.values(setCurrency(yen, 'KWD', { confirm: true }).production.budget.lines)[0].rate, 12000, '¥12 → 12.000 KWD');
    assert.equal(setLine(bare(), null, { section: 'other', rate: 100 }).error, 'currency', 'no amount before a currency');
    assert.equal(setCurrency(p, 'XXQ').error, 'currency');
  });
});

describe('production changes keep every financial record', () => {
  const priced = () => {
    let p = need(base(), 's1', 'vehicles', 'Black SUV');
    p = need(p, 's2', 'vehicles', 'Black sedan');
    const a = elId(p, 'Black SUV');
    const b = elId(p, 'Black sedan');
    p = line(p, { source: { kind: 'element', id: a }, rate: 20000 }).production;
    return { p, a, b };
  };

  it('merge into an unpriced element: the line follows, with where it came from', () => {
    const { p, a, b } = priced();
    const m = mergeElements(p, a, b).production;
    const l = Object.values(m.budget.lines)[0];
    assert.deepEqual(l.source, { kind: 'element', id: b });
    assert.deepEqual(l.origin, [{ kind: 'element', id: a, name: 'Black SUV' }]);
    assert.equal(l.review, undefined, 'nothing to compare it with');
  });

  it('merge of two priced elements: both kept, in review together, out of the subtotal until settled', () => {
    const { p, a, b } = priced();
    const q = line(p, { source: { kind: 'element', id: b }, rate: 30000 }).production;
    const m = mergeElements(q, a, b).production;
    const lines = Object.values(m.budget.lines);
    assert.equal(lines.length, 2, 'nothing combined or dropped');
    assert.ok(lines.every((l) => l.review?.reason === 'merged' && l.review.group === lines[0].review.group));
    const bm = model(m);
    assert.equal(bm.totals.subtotal, 0);
    assert.equal(bm.totals.unresolved, 50000, 'shown apart, never double-counted');
    assert.equal(bm.status, 'incomplete');
    // Intentionally separate costs:
    const sep = resolveReview(m, lines[0].id, 'separate').production;
    assert.ok(Object.values(sep.budget.lines).every((l) => !l.review));
    assert.equal(model(sep).totals.subtotal, 50000);
    // Or one was a duplicate:
    const one = resolveReview(m, lines[0].id, 'remove').production;
    assert.equal(Object.values(one.budget.lines).length, 1);
    assert.equal(Object.values(one.budget.lines)[0].review, undefined, 'the one left needs no review');
  });

  it('delete (or purge) a priced element: its line stays in review with its last amount; keep, relink or remove', () => {
    const { p, a, b } = priced();
    const d = deleteElement(p, a);
    const l = Object.values(d.budget.lines)[0];
    assert.equal(l.review.reason, 'deleted');
    assert.deepEqual(l.review.from, { kind: 'element', id: a, name: 'Black SUV' });
    const r = byName(model(d), 'Black SUV');
    assert.equal(r.total, 20000, 'its last amount, from its footprint');
    assert.ok(r.unresolved);
    assert.equal(model(d).totals.unresolved, 20000);
    const kept = resolveReview(d, l.id, 'keep', { qty: r.qty }).production;
    const k = Object.values(kept.budget.lines)[0];
    assert.equal(k.source, undefined);
    assert.equal(k.label, 'Black SUV');
    assert.equal(k.section, 'vehicles');
    assert.deepEqual(k.origin[0], { kind: 'element', id: a, name: 'Black SUV' }, 'provenance kept');
    assert.equal(model(kept).totals.subtotal, 20000);
    const relinked = Object.values(resolveReview(d, l.id, 'relink', { source: { kind: 'element', id: b } }).production.budget.lines)[0];
    assert.deepEqual(relinked.source, { kind: 'element', id: b });
    assert.deepEqual(resolveReview(d, l.id, 'remove').production.budget.lines, {}, 'removed only when asked');
  });

  it('rename, reclassify and separate: the line follows the element, the new one starts unpriced', () => {
    const { p, a } = priced();
    let q = addNeed(p, 's3', 'vehicles', { id: a }).production;
    q = renameElement(q, a, 'Black van');
    assert.ok(byName(model(q), 'Black van'));
    q = reclassifyElement(q, a, 'stunts');
    assert.equal(byName(model(q), 'Black van').section, 'stunts');
    const s = separateNeed(q, 's3', a).production;
    const rows = model(s).sections.flatMap((x) => x.rows).filter((r) => r.name === 'Black van');
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((r) => r.candidate).length, 1, 'the separated one: unpriced');
    assert.equal(rows.find((r) => !r.candidate).qty, 1);
  });

  it('a character renamed: its lines follow; onto a name with lines of its own, both go to review', () => {
    let p = line(base(), { source: { kind: 'cast', name: 'MARIE' }, rate: 40000 }).production;
    p = { ...p, castNumbers: { MARIE: 1, THEO: 2 } };
    const r = renameCast(p, 'Marie', 'Marion');
    assert.deepEqual(r.castNumbers, { MARION: 1, THEO: 2 });
    assert.deepEqual(Object.values(r.budget.lines)[0].source, { kind: 'cast', name: 'MARION' });
    const both = renameCast(line(p, { source: { kind: 'cast', name: 'THEO' }, rate: 1 }).production, 'MARIE', 'THEO');
    assert.ok(Object.values(both.budget.lines).every((l) => l.review?.reason === 'renamed'));
  });

  it('an older build’s edits: unknown budget fields kept, a vanished source flagged — never guessed', () => {
    const { p, a } = priced();
    let q = line(p, { section: 'other', label: 'Extra', method: 'flat', rate: 1 }).production;
    q = { ...q, budget: { ...q.budget, futureSetting: { x: 1 }, lines: Object.fromEntries(Object.entries(q.budget.lines).map(([k, l]) => [k, { ...l, futureField: [1, 2] }])) } };
    // An older DraftLine (Phase 2) deletes the element: it knows nothing of the budget, carries it through.
    const older = JSON.parse(JSON.stringify(q));
    delete older.elements[a];
    for (const s of Object.values(older.scenes)) for (const c of Object.keys(s.links || {})) s.links[c] = s.links[c].filter((l) => l.id !== a);
    older.scenes.s1.vehicles = [];
    const back = normalizeProduction(older);
    assert.deepEqual(back.budget, normalizeProduction(q).budget, 'every budget field exactly as it was');
    const r = rowFor(model(back), (x) => x.source?.id === a);
    assert.ok(r.flags.includes('missingSource'));
    assert.equal(r.total, null, 'no footprint: no amount guessed');
    assert.ok(r.unresolved);
    // An older build renaming a character: the cast line is left on the old name, flagged.
    const c = line(base(), { source: { kind: 'cast', name: 'NOBODY' }, rate: 5 }).production;
    assert.ok(rowFor(model(c), (x) => x.name === 'NOBODY').flags.includes('missingSource'));
  });

  it('a newer build’s budget is never changed, whatever else happens to the production', () => {
    const { p, a, b } = priced();
    const newer = { version: BUDGET_VERSION + 1, lines: { x: { source: { kind: 'element', id: a }, amount: { v: 1 } } }, other: true };
    const q = normalizeProduction({ ...p, budget: newer });
    const same = (x) => assert.deepEqual(normalizeProduction(x).budget, newer);
    same(q);
    same(mergeElements(q, a, b).production);
    same(deleteElement(q, a));
    same(renameCast(q, 'MARIE', 'MARION'));
    same(setNeed(q, 's1', a, { qty: 3 }));
    assert.equal(setLine(q, null, { section: 'other', rate: 1 }).error, 'newer');
    assert.equal(setCurrency(q, 'EUR').error, 'newer');
    assert.equal(budgetModel(q, rowsOf(q), scheduleModel(rowsOf(q), null)).readable, false);
  });
});

describe('stored losslessly, absent until used, undone exactly', () => {
  it('opening a project from before the Budget adds nothing; normalizing is stable', () => {
    const old = normalizeProduction(need(bare(), 's1', 'props', 'Rope'));
    assert.ok(!('budget' in old) && !('locations' in old));
    const p = setBudgetSettings(line(base(), { section: 'crew', label: 'Gaffer', method: 'day', rate: 35000 }).production, { contingency: 500 }).production;
    assert.deepEqual(normalizeProduction(normalizeProduction(p)), normalizeProduction(p));
    assert.equal(removeLine(p, Object.keys(p.budget.lines)[0]).production.budget.contingency.bp, 500);
    const empty = removeLine(line(base(), { section: 'crew', label: 'G', method: 'flat' }).production, Object.keys(line(base(), { section: 'crew', label: 'G', method: 'flat' }).production.budget.lines)[0]);
    assert.equal(empty.error, 'missing', 'another line id: refused');
  });

  it('an unreadable value is kept and shown as unknown, never dropped', () => {
    const p = normalizeProduction({ version: 1, scenes: {}, budget: { version: 1, currency: 'USD', lines: { l1: { section: 'other', label: 'Odd', method: 'flat', rate: '12.5' } } } });
    assert.equal(p.budget.lines.l1.rate, '12.5');
    const r = byName(model(p), 'Odd');
    assert.ok(r.flags.includes('invalid') && r.total === null);
  });

  it('travels with saves, snapshots and copies', () => {
    let p = line(base(), { section: 'crew', label: 'Gaffer', method: 'day', rate: 35000, days: { from: 'manual', value: 3 } }).production;
    p = addSite(p, { name: 'Port de Fécamp' }).production;
    const rec = toRecord({ id: 'p1', blocks: [], production: p });
    assert.deepEqual(toDoc(JSON.parse(JSON.stringify(rec))).production.budget, p.budget);
    assert.deepEqual(toDoc(rec).production.locations, p.locations);
    assert.deepEqual(createRevision({ blocks: [], meta: {}, production: p }, { label: 's' }).production.budget, p.budget);
  });

  it('undo puts back only what the step changed: later rates, notes, links and schedules stay', () => {
    const { p, a, b } = (() => {
      let x = need(base(), 's1', 'vehicles', 'Black SUV');
      x = need(x, 's2', 'vehicles', 'Black sedan');
      const ia = elId(x, 'Black SUV');
      const ib = elId(x, 'Black sedan');
      x = line(x, { source: { kind: 'element', id: ia }, rate: 20000 }).production;
      x = line(x, { source: { kind: 'element', id: ib }, rate: 30000 }).production;
      x = line(x, { section: 'crew', label: 'Gaffer', method: 'flat', rate: 100 }).production;
      return { p: x, a: ia, b: ib };
    })();
    const next = mergeElements(p, a, b).production;
    const parts = changedParts(p, next);
    assert.ok(parts.budget && parts.elementIds.includes(a));
    const before = sliceOf(p, parts);
    // Later, unrelated changes: another line's rate, a scene note, a new need, a schedule, a location.
    const gaffer = Object.values(next.budget.lines).find((l) => l.label === 'Gaffer').id;
    let later = line(next, { rate: 999 }, gaffer).production;
    later = { ...later, scenes: { ...later.scenes, s1: { ...later.scenes.s1, notes: 'Permit pending' } }, schedule: scheduleOf([['s1']]) };
    later = need(later, 's3', 'props', 'Rope');
    later = addSite(later, { name: 'Studio' }).production;
    const undone = applySlice(later, before);
    assert.deepEqual(undone.elements[a], p.elements[a], 'the merged element is back');
    assert.deepEqual(Object.values(undone.budget.lines).filter((l) => l.source).map((l) => [l.source.id, l.review]).sort(),
      [[a, undefined], [b, undefined]].sort(), 'both lines as they were');
    assert.equal(undone.budget.lines[gaffer].rate, 999, 'a later rate stays');
    assert.equal(undone.scenes.s1.notes, 'Permit pending');
    assert.ok(undone.schedule && Object.keys(undone.locations.sites).length === 1);
    assert.ok(undone.scenes.s3.links.props.length === 1, 'a later need stays');
    // Redo
    const redone = applySlice(undone, sliceOf(next, parts));
    assert.equal(Object.values(redone.budget.lines).filter((l) => l.review?.reason === 'merged').length, 2);
  });
});

describe('filming locations: physical places, apart from the script’s', () => {
  it('nothing is made from sluglines; many places map to one location; a scene can be assigned elsewhere', () => {
    let p = base();
    let m = model(p);
    assert.equal(m.sections.find((s) => s.id === 'locations').rows.length, 0, 'no location made from a slugline');
    assert.deepEqual(m.unassigned.map((u) => u.place), ['HARBOR', 'FERRY', 'CAFE', 'ROAD'].filter((x) => m.unassigned.some((u) => u.place === x)));
    const port = addSite(p, { name: 'Port de Fécamp', address: 'Quai 3' });
    p = port.production;
    p = mapPlace(p, 'Harbor', port.id).production;
    p = mapPlace(p, 'FERRY', port.id).production;
    const studio = addSite(p, { name: 'Studio B' });
    p = assignScene(studio.production, 's3', studio.id).production; // the night harbour scene, in the studio tank
    const rows = rowsOf(p);
    assert.equal(siteOfRow(p.locations, rows[0]), port.id);
    assert.equal(siteOfRow(p.locations, rows[2]), studio.id, 'the scene’s own assignment first');
    assert.equal(siteOfRow(p.locations, rows[3]), null);
    p = line(p, { source: { kind: 'site', id: port.id }, rate: 100000 }).production;
    m = model(p, [['s1'], ['s2', 's4'], ['s3'], ['s5']]);
    assert.equal(byName(m, 'Port de Fécamp').days, 2, 'Days 1 and 2 (not the studio day)');
    assert.equal(byName(m, 'Port de Fécamp').total, 200000);
    assert.deepEqual(m.unassigned.map((u) => u.place).sort(), ['CAFE', 'ROAD']);
    assert.equal(m.status, 'incomplete', 'locations priced while places are unassigned');
  });

  it('removing a priced location keeps its line in review, with its last amount', () => {
    const port = addSite(base(), { name: 'Port de Fécamp' });
    let p = mapPlace(port.production, 'HARBOR', port.id).production;
    p = line(p, { source: { kind: 'site', id: port.id }, rate: 100000 }).production;
    const d = deleteSite(p, port.id).production;
    assert.ok(!d.locations, 'its mappings go with it (nothing left: no registry stored)');
    const r = byName(model(d, [['s1'], ['s3']]), 'Port de Fécamp');
    assert.equal(r.review.reason, 'deleted');
    assert.equal(r.total, 200000);
    assert.ok(r.unresolved);
  });

  it('a newer build’s locations are never changed', () => {
    const newer = { version: 2, sites: { x: { label: 'New shape' } } };
    const p = normalizeProduction({ version: 1, scenes: {}, locations: newer });
    assert.equal(normalizeProduction({ version: 1, scenes: {}, budget: [1, 2] }).budget.length, 2, 'an unexpected shape: kept as it is');
    assert.deepEqual(p.locations, newer);
    assert.equal(addSite(p, { name: 'A' }).error, 'newer');
    assert.deepEqual(normalizeProduction(renameCast(p, 'A', 'B')).locations, newer);
  });
});

describe('the engine never writes', () => {
  it('works on a frozen production', () => {
    let p = need(base(), 's1', 'props', 'Rope', 2);
    p = line(p, { source: { kind: 'element', id: elId(p, 'Rope') }, rate: 100 }).production;
    const freeze = (o) => {
      if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(freeze); }
      return o;
    };
    const before = JSON.stringify(p);
    assert.doesNotThrow(() => model(freeze(p), [['s1']]));
    assert.equal(JSON.stringify(p), before);
  });
});
