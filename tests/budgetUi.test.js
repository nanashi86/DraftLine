// Stage 2, Phase 3B: what the Budget's interface relies on (lib/budgetUi.js), the engine helpers it uses
// (lib/budget.js budgetRowsFor, rowVariants), and how it's wired (BudgetView.jsx, App.jsx). The figures
// themselves are tested in tests/budget.test.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  METHOD_CHOICES, amountField, basisDetail, basisShort, currencyChoices, parsePercent, parseQuantity, parseRate, perLabel, suggestCurrency,
} from '../src/lib/budgetUi.js';
import { METHODS, budgetModel, budgetRowsFor, rowVariants, setCurrency, setLine } from '../src/lib/budget.js';
import { addNeed, deleteElement, normalizeProduction, setNeed } from '../src/lib/productionData.js';
import { sceneNeeds } from '../src/lib/elements.js';
import { addDay, moveScene, scheduleModel } from '../src/lib/schedule.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const read = (f) => readFileSync(join(root, f), 'utf8');

describe('typing amounts and quantities', () => {
  it('the seven costing methods, each in plain words, with what the rate is per', () => {
    assert.deepEqual(METHOD_CHOICES.map((m) => m.id).sort(), Object.keys(METHODS).sort(), 'all seven, none extra');
    assert.deepEqual(METHOD_CHOICES.map((m) => m.label), ['Flat fee', 'Per unit', 'Per day', 'Per unit per day', 'Per week', 'Per unit per week', 'Per person-day']);
    assert.equal(perLabel('unitWeek'), 'unit/week');
    assert.equal(perLabel('flat'), '');
  });
  it('a rate: the browser’s format, a sign or not; never rounded; empty is not zero', () => {
    assert.deepEqual(parseRate('$1,250.50', 'USD', 'en-US'), { value: 125050 });
    assert.deepEqual(parseRate('1 250,5 €', 'EUR', 'fr-FR'), { value: 125050 });
    assert.deepEqual(parseRate('0', 'USD', 'en-US'), { value: 0 }, 'a confirmed zero');
    assert.deepEqual(parseRate('   ', 'USD', 'en-US'), { empty: true }, 'empty: no change, never zero');
    assert.equal(parseRate('12.505', 'USD', 'en-US').error, 'precision');
    assert.equal(parseRate('12.5', 'JPY', 'en-US').error, 'precision');
    assert.equal(parseRate('1.2345', 'KWD', 'en-US').error, 'precision');
    assert.deepEqual(parseRate('1.234', 'KWD', 'en-US'), { value: 1234 });
    for (const bad of ['abc', '-5', '1e5', '12..5']) assert.equal(parseRate(bad, 'USD', 'en-US').error, 'invalid', bad);
    assert.equal(amountField(125050, 'USD', 'en-US'), '1,250.50');
    assert.equal(amountField(1250, 'JPY', 'ja-JP'), '1,250');
  });
  it('quantities, days and percentages', () => {
    assert.deepEqual(parseQuantity('1,5', 'fr-FR'), { value: 1.5 });
    assert.deepEqual(parseQuantity('12', 'en-US'), { value: 12 });
    assert.equal(parseQuantity('0', 'en-US').error, 'invalid');
    assert.equal(parseQuantity('2.555', 'en-US').error, 'precision');
    assert.deepEqual(parsePercent('7.5', 'en-US'), { value: 750 });
    assert.deepEqual(parsePercent('10%', 'en-US'), { value: 1000 });
    assert.equal(parsePercent('ten', 'en-US').error, 'invalid');
  });
  it('a currency is only ever suggested (from the browser’s region), with the suggestion first in the list', () => {
    assert.equal(suggestCurrency('en-US'), 'USD');
    assert.equal(suggestCurrency('fr-RW'), 'RWF');
    assert.equal(suggestCurrency('fr-FR'), 'EUR');
    assert.equal(suggestCurrency('ht'), 'HTG');
    const list = currencyChoices('en-US', 'RWF');
    assert.equal(list[0].value, 'RWF');
    assert.ok(list.length > 100 && new Set(list.map((c) => c.value)).size === list.length, 'every currency, once');
  });
});

describe('the engine helpers the interface uses: the same calculation as the table', () => {
  const N = (p) => normalizeProduction(p);
  let p = setCurrency(N({ version: 1, scenes: {} }), 'USD').production;
  let r = addNeed(p, 's1', 'vehicles', { name: 'Black SUV' });
  p = addNeed(r.production, 's2', 'vehicles', { id: r.id }).production;
  const suv = r.id;
  p = setNeed(p, 's2', suv, { qty: 2 });
  p = setLine(p, null, { source: { kind: 'element', id: suv }, method: 'day', rate: 20000 }).production;
  const rows = ['s1', 's2', 's3'].map((id, i) => ({ id, number: i + 1, heading: 'EXT. ROAD - DAY', location: 'ROAD', eighths: 8, cast: [], needs: sceneNeeds(p.scenes[id], p.elements) }));
  let s = addDay(null);
  let sched = moveScene(s.schedule, 's1', s.dayId);
  s = addDay(sched);
  sched = moveScene(moveScene(s.schedule, 's3', s.dayId), 's2', s.dayId);
  const model = scheduleModel(rows, sched);

  it('budgetRowsFor: one element’s rows, exactly as budgetModel has them', () => {
    const full = budgetModel(p, rows, model).sections.flatMap((x) => x.rows).filter((x) => x.source?.id === suv);
    assert.deepEqual(budgetRowsFor(p, rows, model, { kind: 'element', id: suv }), full);
    assert.equal(full[0].total, 40000);
    assert.deepEqual(budgetRowsFor(p, rows, model, { kind: 'element', id: 'nope' }), []);
  });
  it('rowVariants: what a choice would come to, by the same rules', () => {
    const lineId = Object.keys(p.budget.lines)[0];
    const [use, span, shoot] = rowVariants(p, rows, model, { lineId }, [{ days: { from: 'use' } }, { days: { from: 'span' } }, { days: { from: 'shoot' } }]);
    assert.deepEqual([use.days, span.days, shoot.days], [2, 2, 2]);
    const [unit] = rowVariants(p, rows, model, { lineId }, [{ method: 'unit', usage: 'consume' }]);
    assert.equal(unit.qty, 3, '1 + 2, used up');
    assert.equal(unit.total, 60000);
    assert.equal(JSON.stringify(p.budget.lines[lineId].method), '"day"', 'nothing written');
  });
});

describe('the Basis column: short in the table, the whole account in the popover', () => {
  // Cast: MARIE in s1, s2 (both scheduled); THEO in s1 and s3 (s3 not scheduled); GRANDMÈRE only in s3.
  let p = setCurrency(normalizeProduction({ version: 1, scenes: {} }), 'USD').production;
  let r = addNeed(p, 's1', 'props', { name: 'Lantern' }); p = r.production; const lantern = r.id; // quantity not set
  r = addNeed(p, 's1', 'sfx', { name: 'Breakaway bottle' }); p = setNeed(r.production, 's1', r.id, { qty: 6 }); const bottle = r.id;
  p = setNeed(addNeed(p, 's2', 'sfx', { id: bottle }).production, 's2', bottle, { qty: 6 });
  r = addNeed(p, 's1', 'extras', { name: 'Passengers' }); p = setNeed(r.production, 's1', r.id, { qty: 20 }); const extras = r.id;
  p = setNeed(addNeed(p, 's2', 'extras', { id: extras }).production, 's2', extras, { qty: 25 });
  r = addNeed(p, 's1', 'vehicles', { name: 'Black SUV' }); p = addNeed(r.production, 's2', 'vehicles', { id: r.id }).production; const suv = r.id;
  p = setLine(p, null, { source: { kind: 'element', id: bottle }, usage: 'consume', rate: 2500 }).production;
  p = setLine(p, null, { source: { kind: 'element', id: suv }, method: 'unitWeek', week: { days: 7, rounding: 'up' }, rate: 60000 }).production;
  p = setLine(p, null, { source: { kind: 'element', id: lantern }, rate: 4000 }).production;
  p = setLine(p, null, { section: 'crew', label: 'Gaffer', method: 'flat', rate: 50000 }).production;
  const rows = [
    { id: 's1', number: 1, heading: 'EXT. HARBOR - DAY', location: 'HARBOR', eighths: 8, cast: ['MARIE', 'THEO'] },
    { id: 's2', number: 2, heading: 'INT. FERRY - DAY', location: 'FERRY', eighths: 8, cast: ['MARIE'] },
    { id: 's3', number: 3, heading: 'INT. HOME - DAY', location: 'HOME', eighths: 8, cast: ['THEO', 'GRANDMÈRE'] },
  ].map((x) => ({ ...x, cast: x.cast.map((name) => ({ name, number: ['MARIE', 'THEO', 'GRANDMÈRE'].indexOf(name) + 1 })), needs: sceneNeeds(p.scenes[x.id], p.elements) }));
  let s = addDay(null); let sched = moveScene(s.schedule, 's1', s.dayId);
  s = addDay(sched); sched = moveScene(s.schedule, 's2', s.dayId);
  const short = (q, name) => {
    const row = budgetModel(q, rows, scheduleModel(rows, sched)).sections.flatMap((x) => x.rows).find((x) => x.name === name);
    return { row, text: basisShort(row, row.lineId ? q.budget.lines[row.lineId] : null) };
  };
  it('cast: Not scheduled, partly scheduled, or just the days', () => {
    assert.equal(short(p, 'GRANDMÈRE').text, 'Not scheduled', 'never “0 work days · some scenes not scheduled”');
    assert.equal(short(p, 'THEO').text, '1 work day · partly scheduled');
    assert.equal(short(p, 'MARIE').text, '2 work days');
    assert.match(basisDetail(short(p, 'GRANDMÈRE').row), /^0 work days · some scenes not scheduled$/, 'the popover keeps it all');
  });
  it('elements and extras: a few words, every warning kept', () => {
    assert.equal(short(p, 'Lantern').text, '1 unit · reusable · quantity assumed');
    assert.equal(basisDetail(short(p, 'Lantern').row), '1 (most in one scene, reused) · a scene’s quantity not set (counted as 1)');
    assert.equal(short(p, 'Breakaway bottle').text, '12 units · used up');
    assert.equal(short(p, 'Passengers').text, '45 person-days');
    assert.match(basisDetail(short(p, 'Passengers').row), /20 on Day 1 \+ 25 on Day 2 = 45 person-days/);
    assert.equal(short(p, 'Black SUV').text, '1 unit · reusable · 2 days → 1 week · quantity assumed');
    assert.equal(short(p, 'Gaffer').text, 'flat fee');
    const gone = short(deleteElement(p, lantern), 'Lantern');
    assert.match(gone.text, /^deleted: review · /, 'a review leads');
    assert.equal(gone.row.total, short(p, 'Lantern').row.total, 'the same figures: only the words are shorter');
  });
});

describe('how the Budget is wired', () => {
  const view = read('components/planning/BudgetView.jsx');
  const pop = read('components/planning/BudgetRowPopover.jsx');
  const app = read('App.jsx');
  it('no money is worked out in the interface: every figure is the model’s', () => {
    for (const src of [view, pop]) {
      assert.doesNotMatch(src, /amountOf|applyBasisPoints|sumAmounts|roundDiv|BigInt/, 'no arithmetic of its own');
      assert.doesNotMatch(src, /\.total\s*[+*-]/, 'no totals added up here');
    }
    assert.match(view, /const m = useMemo\(\(\) => budgetModel\(production, rows, sched\), \[production, rows, sched\]\);/);
  });
  it('every change is one undo step through App’s budgetStep → productionStep; opening writes nothing', () => {
    assert.match(app, /const budgetStep = \(label, change\) => \{\s*const r = change\(latest\.current\.production\);\s*if \(!r \|\| r\.error \|\| r\.needsConfirm \|\| !r\.production\) return r \|\| \{\};\s*productionStep\(r\.production, label\);/);
    assert.doesNotMatch(view + pop, /setProduction|localStorage|indexedDB/, 'no other way to write');
    assert.doesNotMatch(view, /useEffect\([^)]*step\(/, 'nothing is saved by just showing the Budget');
  });
  it('a first amount asks for the currency (suggested, never set silently); a change asks and never converts', () => {
    assert.match(view, /setCurrencyAsk\(\{ anchor, text, label, apply, onCancel, after: onCancel \}\)/);
    assert.match(view, /const c = setCurrency\(p, code\);\s*return c\.error \? c : currencyAsk\.apply\(c\.production, r\.value\);/, 'currency and amount: one step');
    assert.match(view, /Nothing is converted\./);
    assert.match(view, /can’t hold these amounts exactly, so nothing was changed/);
  });
  it('the element card’s Budget line is worked out only for that element, only while the card is open', () => {
    const ws = read('components/planning/PlanningWorkspace.jsx');
    assert.match(ws, /budget=\{budgetOf \? budgetOf\(need\.id\) : null\}/);
    assert.match(ws, /budgetRowsFor\(production, allRows, schedule \? scheduleModel\(allRows, schedule\) : null, \{ kind: 'element', id \}\)/);
  });
});
