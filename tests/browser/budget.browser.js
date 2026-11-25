// Stage 2, Phase 3B in a real browser: Plan → Budget (components/planning/BudgetView.jsx).
// A project's breakdowns and schedule are written the way a saved project holds them (built here with
// the app's own lib functions), then everything else goes through the interface: pricing, the first
// currency, all seven costing methods, zero versus unpriced, refused input, undo and reload, review,
// currency changes, contingency and fees, filming locations, + Cost, the element card's link, phones.
//
// Run with: node --test tests/browser/budget.browser.js  (skips when no Chromium is installed)
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './server.js';
import { addNeed, deleteElement, mergeElements, normalizeProduction, setNeed } from '../../src/lib/productionData.js';
import { setCurrency, setLine, BUDGET_VERSION } from '../../src/lib/budget.js';
import { addDay, moveScene } from '../../src/lib/schedule.js';

const SCRIPT = fileURLToPath(new URL('./stripboard-fixture.fountain', import.meta.url));
let server; let browser; let url; let skip = false;

before(async () => {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
    browser = await chromium.launch(globalThis.process.env.DL_CHROMIUM ? { executablePath: globalThis.process.env.DL_CHROMIUM } : {});
  } catch (e) {
    skip = `Chromium not available (${e.message.split('\n')[0]}) — run "npx playwright install chromium"`;
    return;
  }
  ({ server, url } = await startTestServer(import.meta.url));
});
after(async () => { await browser?.close(); await server?.close(); });

const STORE = (fn, arg) => `new Promise((resolve) => {
  const r = indexedDB.open('draftline_db', 1);
  r.onsuccess = () => {
    const t = r.result.transaction(['projects', 'settings'], 'readwrite');
    t.objectStore('settings').get('activeProjectId').onsuccess = (e) => {
      const store = t.objectStore('projects');
      store.get(e.target.result.value).onsuccess = (g) => { const rec = g.target.result; const out = (${fn})(rec, ${JSON.stringify(arg)}); if (out && out.put) store.put(out.put); resolve(out && out.put ? null : out); };
    };
  };
})`;
const stored = (page) => page.evaluate(STORE('(rec) => rec'));
const sceneIds = (page) => page.evaluate(STORE("(rec) => rec.script.filter((b) => b.type === 'scene' && b.text.trim()).map((b) => b.id)"));
const putProduction = (page, production) => page.evaluate(STORE('(rec, p) => { rec.production = p; return { put: rec }; }', production));

/** The film's needs: props, effects, extras and a vehicle across scenes, and a schedule for most of them. */
function buildProduction(ids, { schedule = true, budget = null } = {}) {
  let p = normalizeProduction({ version: 1, scenes: {} });
  const need = (i, cat, name, qty) => {
    const found = Object.values(p.elements || {}).find((e) => e.name === name);
    const r = addNeed(p, ids[i], cat, found ? { id: found.id } : { name });
    p = qty ? setNeed(r.production, ids[i], r.id, { qty }) : r.production;
    return r.id;
  };
  need(0, 'props', 'Wine bottle', 2); need(3, 'props', 'Wine bottle', 2);
  need(0, 'sfx', 'Breakaway bottle', 6); need(3, 'sfx', 'Breakaway bottle', 6);
  need(1, 'extras', 'Ferry passengers', 20); need(2, 'extras', 'Ferry passengers', 12); need(6, 'extras', 'Ferry passengers', 25);
  need(1, 'vehicles', 'Black SUV'); need(3, 'vehicles', 'Black SUV'); need(5, 'vehicles', 'Black SUV');
  need(0, 'props', 'Lantern');
  if (schedule) {
    let s = null;
    for (const day of [[0, 1, 2], [3], [4, 5, 6]]) {
      const d = addDay(s);
      s = d.schedule;
      for (const i of day) s = moveScene(s, ids[i], d.dayId);
    }
    p = { ...p, schedule: s };
  }
  if (budget) p = budget(p);
  return JSON.parse(JSON.stringify(p));
}
const elementId = (p, name) => Object.values(p.elements).find((e) => e.name === name).id;

async function open(ctx, { build, view = 'budget' } = {}) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
  await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
  await page.waitForTimeout(1000);
  let production = null;
  if (build) {
    production = build(await sceneIds(page));
    await putProduction(page, production);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
    await page.waitForTimeout(500);
  }
  await page.locator('.ws-switch [data-workspace="plan"]').click();
  await page.waitForTimeout(200);
  const tab = page.locator(`.plan-seg [aria-label="${view === 'budget' ? 'Budget' : 'Breakdowns'}"]`).first();
  if (await tab.isVisible()) await tab.click();
  else {
    await page.locator('.btn-kebab').click();
    await page.getByRole('menuitem', { name: new RegExp(`^${view === 'budget' ? 'Budget' : 'Breakdowns'}`) }).click();
  }
  if (view === 'budget') await page.locator('.bud').waitFor();
  return { page, errors, production };
}
const row = (page, name) => page.locator('.bud-row', { has: page.locator('.bud-name', { hasText: new RegExp(`^${name}$`) }) });
const total = async (page, name) => (await row(page, name).locator('.bud-total').textContent()).trim();
const rate = (page, name) => page.getByRole('textbox', { name: `Rate for ${name}`, exact: true });
const summary = async (page) => (await page.locator('.bud-summary .plan-summary').textContent()).replace(/\s+/g, ' ');
const pick = async (page, scope, label, option) => {
  await scope.getByRole('combobox', { name: label }).click();
  await page.locator('.dl-select-list [role=option]', { hasText: option }).first().click();
};
const settle = (page) => page.waitForTimeout(700);
const undoKey = async (page, combo) => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press(combo);
  await settle(page);
};

describe('Plan → Budget', () => {
  it('prices by typing; asks the currency once; zero is not unpriced; bad input never saved; undo and reload', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
    try {
      const { page, errors } = await open(ctx, { build: (ids) => buildProduction(ids) });
      await settle(page);
      assert.equal((await stored(page)).production.budget, undefined, 'opening the Budget writes nothing');
      assert.match(await summary(page), /^Partial total \$?0\.00/);
      assert.match(await summary(page), /without a rate/);
      assert.match(await summary(page), /not scheduled/, 'a partly scheduled script is never a full budget');

      // The first amount asks which currency (suggested, never set silently); Cancel saves nothing.
      await rate(page, 'Wine bottle').fill('15');
      await rate(page, 'Wine bottle').press('Enter');
      const ask = page.getByRole('dialog', { name: 'Choose the budget’s currency' });
      await ask.waitFor();
      assert.match(await ask.textContent(), /amounts are never converted/);
      await ask.getByRole('button', { name: 'Cancel' }).click();
      await settle(page);
      assert.equal((await stored(page)).production.budget, undefined, 'cancelled: nothing saved');
      assert.equal(await rate(page, 'Wine bottle').inputValue(), '', 'the field shows what’s saved');
      await rate(page, 'Wine bottle').fill('15');
      await rate(page, 'Wine bottle').press('Enter');
      await ask.getByRole('button', { name: 'Use USD' }).click();
      await settle(page);
      let b = (await stored(page)).production.budget;
      assert.equal(b.currency, 'USD');
      assert.deepEqual(Object.values(b.lines).map((l) => l.rate), [1500], 'currency and rate: one step');
      assert.equal(await total(page, 'Wine bottle'), '$30.00', 'reusable: 2, the most in one scene');
      // …and never asks again
      await rate(page, 'Breakaway bottle').fill('25');
      await rate(page, 'Breakaway bottle').press('Enter');
      assert.equal(await page.getByRole('dialog', { name: 'Choose the budget’s currency' }).count(), 0);

      // Refused input: kept to fix on Enter, the saved amount put back on leaving; never over a valid one.
      await rate(page, 'Wine bottle').fill('12.505');
      await rate(page, 'Wine bottle').press('Enter');
      assert.match(await row(page, 'Wine bottle').locator('.bud-error').textContent(), /up to 2 decimals/);
      await rate(page, 'Wine bottle').press('Escape');
      assert.equal(await rate(page, 'Wine bottle').inputValue(), '15.00', 'Esc: back to the saved amount');
      await rate(page, 'Wine bottle').fill('abc');
      await rate(page, 'Wine bottle').blur();
      await settle(page);
      assert.equal(await rate(page, 'Wine bottle').inputValue(), '15.00');
      assert.ok(await page.locator('.toast', { hasText: 'Rate not saved' }).isVisible());
      await rate(page, 'Wine bottle').fill('-5');
      await rate(page, 'Wine bottle').press('Enter');
      assert.match(await row(page, 'Wine bottle').locator('.bud-error').textContent(), /0 or more/);
      await rate(page, 'Wine bottle').press('Escape');
      await rate(page, 'Wine bottle').fill('');
      await rate(page, 'Wine bottle').blur();
      await settle(page);
      assert.equal(Object.values((await stored(page)).production.budget.lines).find((l) => l.rate === 1500)?.rate, 1500, 'emptied: unchanged');

      // Zero is a confirmed cost (free), not a missing rate.
      const before = (await summary(page)).match(/(\d+) items? without a rate/)[1];
      await rate(page, 'Lantern').fill('0');
      await rate(page, 'Lantern').press('Enter');
      await settle(page);
      assert.equal(await total(page, 'Lantern'), '$0.00');
      assert.equal(Number((await summary(page)).match(/(\d+) items? without a rate/)?.[1] || 0), Number(before) - 1);
      assert.doesNotMatch(await row(page, 'Lantern').textContent(), /without a rate/);

      // Undo and redo: one step each; then it's saved across a reload.
      await undoKey(page, 'Control+z');
      assert.equal(await rate(page, 'Lantern').inputValue(), '', 'undo: unpriced again');
      await undoKey(page, 'Control+Shift+z');
      assert.equal(await rate(page, 'Lantern').inputValue(), '0.00');
      await settle(page);
      await page.reload({ waitUntil: 'load' });
      await page.locator('.ws-switch [data-workspace="plan"]').waitFor();
      await page.locator('.ws-switch [data-workspace="plan"]').click();
      await page.locator('.plan-seg [aria-label="Budget"]').first().click();
      await page.locator('.bud').waitFor();
      assert.equal(await total(page, 'Wine bottle'), '$30.00');
      assert.equal(await total(page, 'Breakaway bottle'), '$150.00', 'reusable by default: 6, the most in one scene (12 only if used up)');
      assert.equal(await total(page, 'Lantern'), '$0.00');
      b = (await stored(page)).production.budget;
      assert.equal(Object.keys(b.lines).length, 3, 'only the rows given something are stored');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('all seven costing methods, quantities, days, reusable or used up, holds, weeks', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'en-US' });
    try {
      const { page, errors } = await open(ctx, {
        build: (ids) => buildProduction(ids, {
          budget: (p) => setLine(setCurrency(p, 'USD').production, null, { source: { kind: 'element', id: elementId(p, 'Black SUV') }, rate: 20000 }).production,
        }),
      });
      const pop = page.getByRole('dialog', { name: 'Costing: Black SUV' });
      const openPop = async () => { if (!(await pop.count())) { await row(page, 'Black SUV').locator('.bud-name').click(); await pop.waitFor(); } };
      // Black SUV: in 3 scenes, one on each of the 3 shooting days; $200.
      const expect = [
        ['Flat fee', '$200.00'], ['Per unit', '$200.00'], ['Per day', '$600.00'], ['Per unit per day', '$600.00'],
        ['Per week', '$120.00'], ['Per unit per week', '$120.00'], ['Per person-day', '$600.00'],
      ];
      for (const [method, amount] of expect) {
        await openPop();
        await pick(page, pop, 'Costed', method);
        await settle(page);
        assert.equal(await total(page, 'Black SUV'), amount, method);
      }
      // Per unit per day, two of them (entered), held from the first to the last day it's used.
      await openPop();
      await pick(page, pop, 'Costed', 'Per unit per day');
      await pop.getByRole('textbox', { name: 'Quantity' }).fill('2');
      await pop.getByRole('textbox', { name: 'Quantity' }).press('Enter');
      await settle(page);
      assert.equal(await total(page, 'Black SUV'), '$1,200.00', '2 × 3 days × $200');
      await pick(page, pop, 'Days', 'All shooting days');
      await settle(page);
      assert.equal(await total(page, 'Black SUV'), '$1,200.00', 'all 3 shooting days');
      // Weekly, rounded up, on a 7-day week: 3 days → 1 week.
      await pick(page, pop, 'Costed', 'Per unit per week');
      await pick(page, pop, 'Part weeks', 'Part weeks rounded up');
      await settle(page);
      assert.equal(await total(page, 'Black SUV'), '$400.00', '2 × 1 week × $200');
      await page.keyboard.press('Escape');

      // Used up vs reusable, from the breakdowns: Breakaway bottle 6 + 6.
      await rate(page, 'Breakaway bottle').fill('25');
      await rate(page, 'Breakaway bottle').press('Enter');
      await settle(page);
      assert.equal(await total(page, 'Breakaway bottle'), '$150.00', 'reusable: 6');
      await row(page, 'Breakaway bottle').locator('.bud-name').click();
      const bpop = page.getByRole('dialog', { name: 'Costing: Breakaway bottle' });
      await bpop.getByRole('radio', { name: /Used up/ }).click();
      await settle(page);
      assert.equal(await total(page, 'Breakaway bottle'), '$300.00', 'used up: 12');
      await page.keyboard.press('Escape');

      // Background: person-days from the schedule (20 on Day 1, 25 on Day 3), never × days again.
      await rate(page, 'Ferry passengers').fill('150');
      await rate(page, 'Ferry passengers').press('Enter');
      await settle(page);
      assert.equal(await total(page, 'Ferry passengers'), '$6,750.00');
      assert.equal(await row(page, 'Ferry passengers').locator('.bud-basis').textContent(), '45 person-days', 'short in the table');
      assert.match(await row(page, 'Ferry passengers').locator('.bud-basis').getAttribute('title'), /20 on Day 1 \+ 25 on Day 3 = 45 person-days \(the most needed in one day/, 'the whole account kept');
      assert.equal(await row(page, 'Breakaway bottle').locator('.bud-basis').textContent(), '12 units · used up');
      await row(page, 'Breakaway bottle').locator('.bud-name').click();
      assert.match(await page.getByRole('dialog', { name: 'Costing: Breakaway bottle' }).textContent(), /12 used up \(6 \+ 6 across scenes\)/, 'the popover keeps the detail');
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('review after a merge or a delete; currency changes never convert; contingency, fees, + Cost, locations', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
    try {
      const { page, errors } = await open(ctx, {
        build: (ids) => buildProduction(ids, {
          budget: (p) => {
            let q = setCurrency(p, 'USD').production;
            const extra = addNeed(q, ids[7], 'vehicles', { name: 'Black sedan' });
            q = extra.production;
            const suv = elementId(q, 'Black SUV');
            q = setLine(q, null, { source: { kind: 'element', id: suv }, method: 'day', rate: 20000 }).production;
            q = setLine(q, null, { source: { kind: 'element', id: extra.id }, method: 'day', rate: 15050 }).production;
            q = setLine(q, null, { source: { kind: 'element', id: elementId(q, 'Lantern') }, rate: 1250 }).production;
            q = mergeElements(q, extra.id, suv).production; // both priced: review
            q = deleteElement(q, elementId(q, 'Lantern')); // priced, deleted: review
            return q;
          },
        }),
      });
      assert.match(await summary(page), /2 costs to review|3 costs to review/);
      assert.match(await page.locator('.bud-totals').textContent(), /Waiting for review \(not included\)/);
      // Merged: keep both (two real costs) → both counted.
      await row(page, 'Black SUV').first().locator('.bud-name').click();
      const pop = page.getByRole('dialog', { name: 'Costing: Black SUV' });
      assert.match(await pop.textContent(), /was merged into/);
      await pop.getByRole('button', { name: 'Keep both' }).click();
      await settle(page);
      // Deleted: keep as my own cost.
      await row(page, 'Lantern').locator('.bud-name').click();
      const lp = page.getByRole('dialog', { name: 'Costing: Lantern' });
      assert.match(await lp.textContent(), /was deleted/);
      await lp.getByRole('button', { name: 'Keep as my own cost' }).click();
      await settle(page);
      assert.doesNotMatch(await summary(page), /to review/);
      assert.equal(await page.locator('.bud-totals', { hasText: 'Waiting for review' }).count(), 0);

      // Currency: a change asks, says nothing is converted, keeps every number; a precision loss is refused by name.
      await pick(page, page.locator('.bud-summary'), /Currency/, 'Euro (EUR)');
      const confirm = page.getByRole('group', { name: 'Change the currency' });
      assert.match(await confirm.textContent(), /keep their numbers.*Nothing is converted/);
      await confirm.getByRole('button', { name: 'Change currency' }).click();
      await settle(page);
      let b = (await stored(page)).production.budget;
      assert.equal(b.currency, 'EUR');
      assert.ok(Object.values(b.lines).some((l) => l.rate === 15050), '150.50 stays 150.50');
      await pick(page, page.locator('.bud-summary'), /Currency/, 'Japanese Yen (JPY)');
      await confirm.getByRole('button', { name: 'Change currency' }).click();
      assert.match(await confirm.textContent(), /can’t hold these amounts exactly, so nothing was changed: .*Black SUV/);
      await confirm.getByRole('button', { name: 'OK' }).click();
      assert.equal((await stored(page)).production.budget.currency, 'EUR');

      // Contingency and a fee, on stated bases; totals are the model's.
      await page.getByRole('button', { name: 'Contingency' }).click();
      await page.getByRole('textbox', { name: 'Contingency percentage' }).fill('10');
      await page.getByRole('textbox', { name: 'Contingency percentage' }).press('Enter');
      await page.getByRole('button', { name: 'Fee or tax' }).click();
      const fee = page.getByRole('dialog', { name: 'New fee or tax' });
      await fee.getByRole('textbox', { name: 'Name' }).fill('Sales tax');
      await fee.getByRole('textbox', { name: 'Percentage' }).fill('5');
      await fee.getByRole('button', { name: 'Add' }).click();
      await settle(page);
      const totals = await page.locator('.bud-totals').textContent();
      assert.match(totals, /Contingency.*of the subtotal/);
      assert.match(totals, /Sales tax · 5% of the subtotal/);

      // + Cost (header): a section, a name and a rate.
      await page.getByRole('button', { name: 'Add cost' }).click();
      await page.getByRole('dialog', { name: 'Add a cost to…' }).getByRole('button', { name: 'Crew' }).click();
      await page.getByRole('textbox', { name: 'Name of the new cost in Crew' }).fill('Gaffer');
      await page.getByRole('textbox', { name: 'Rate of the new cost' }).fill('350');
      await page.getByRole('textbox', { name: 'Rate of the new cost' }).press('Enter');
      await settle(page);
      assert.equal(await total(page, 'Gaffer'), '€350.00');

      // A filming location: added for a scripted place, never made from a slugline.
      // The scripted places without one: a count, folded until asked for; each opens its own chooser.
      const toggle = page.locator('.bud-unassigned-toggle');
      assert.match(await toggle.textContent(), /^\d+ scripted places? without a filming location$/);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.bud-place').count(), 0, 'folded by default');
      const unassigned = Number((await toggle.textContent()).match(/^\d+/)[0]);
      await toggle.press('Enter'); // keyboard
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('.bud-place').count(), unassigned);
      assert.match(await page.locator('.bud-unassigned-list li').first().textContent(), /\d+ scenes?$/, 'scene counts kept');
      const place = page.locator('.bud-place').first();
      const placeName = (await place.textContent()).trim();
      await place.click();
      await page.getByRole('textbox', { name: 'Name of a new filming location' }).fill('Port de Fécamp');
      await page.getByRole('textbox', { name: 'Name of a new filming location' }).press('Enter');
      await settle(page);
      assert.ok(await row(page, 'Port de Fécamp').count());
      assert.equal(await page.locator('.bud-place').count(), unassigned - 1, 'still open, one fewer');

      // In Locations, + Cost (an ordinary cost) and + Filming location (an assignable one) are told apart.
      const locSection = page.locator('.bud-section', { hasText: 'Locations' });
      await locSection.getByRole('button', { name: 'Add a cost to Locations' }).click();
      assert.ok(await page.getByRole('textbox', { name: 'Name of the new cost in Locations' }).isVisible());
      await page.getByRole('textbox', { name: 'Name of the new cost in Locations' }).press('Escape');
      assert.equal((await locSection.getByRole('button', { name: 'Add a filming location' }).textContent()).trim(), 'Filming location');

      // Name fields in the popovers: one line, like every other field (a flex-basis once made them 150px).
      await row(page, 'Port de Fécamp').locator('.bud-name').click();
      const nameBox = await page.getByRole('dialog', { name: 'Costing: Port de Fécamp' }).getByRole('textbox', { name: 'Location name' }).boundingBox();
      assert.ok(nameBox.height <= 32, `location name: one line (${nameBox.height}px)`);
      await page.keyboard.press('Escape');
      await row(page, 'Gaffer').locator('.bud-name').click();
      const costBox = await page.getByRole('dialog', { name: 'Costing: Gaffer' }).getByRole('textbox', { name: 'Name', exact: true }).boundingBox();
      assert.ok(costBox.height <= 32, `cost name: one line (${costBox.height}px)`);
      await page.keyboard.press('Escape');
      const loc = (await stored(page)).production.locations;
      assert.equal(Object.values(loc.places)[0], Object.keys(loc.sites)[0]);
      assert.ok(Object.keys(loc.places).includes(placeName));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('the element card shows its Budget line and opens its row; no schedule: planned days; a newer budget is read-only', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'en-US' });
    try {
      const { page, errors } = await open(ctx, {
        view: 'breakdowns',
        build: (ids) => buildProduction(ids, {
          schedule: false,
          budget: (p) => setLine(setCurrency(p, 'USD').production, null, { source: { kind: 'element', id: elementId(p, 'Wine bottle') }, rate: 1500 }).production,
        }),
      });
      await page.locator('.plan-card').first().waitFor();
      const card = page.locator('.plan-card').first(); // scene 1: the wine bottle (tags show once a card is open)
      if (!(await card.evaluate((el) => el.classList.contains('is-open')))) await card.locator('.plan-toggle').click();
      await card.locator('.plan-tag-name', { hasText: 'Wine bottle' }).click();
      const line = page.locator('.el-pop-budget');
      assert.equal((await line.textContent()).replace(/\s+/g, ' ').trim(), 'Budget: $30.00 · Open');
      await line.getByRole('button', { name: 'Open' }).click();
      await page.locator('.bud').waitFor();
      await page.waitForTimeout(300);
      assert.ok(await rate(page, 'Wine bottle').evaluate((el) => el === document.activeElement), 'lands on its rate');

      // No schedule: days wait for one, or use the planned number (an estimate, said so).
      assert.match(await page.locator('.bud-planned').textContent(), /No shooting schedule yet/);
      await page.getByRole('textbox', { name: 'Planned shooting days' }).fill('12');
      await page.getByRole('textbox', { name: 'Planned shooting days' }).press('Enter');
      await settle(page);
      assert.equal((await stored(page)).production.budget.plannedDays, 12);

      // A budget from a newer DraftLine: shown as such, never changed.
      const rec = await stored(page);
      await putProduction(page, { ...rec.production, budget: { version: BUDGET_VERSION + 1, lines: { x: { future: true } } } });
      await page.reload({ waitUntil: 'load' });
      await page.locator('.ws-switch [data-workspace="plan"]').click();
      await page.locator('.plan-seg [aria-label="Budget"]').first().click();
      assert.match(await page.locator('.plan-empty').textContent(), /newer version of DraftLine/);
      assert.equal(await page.getByRole('button', { name: 'Add cost' }).count(), 0);
      assert.equal((await stored(page)).production.budget.version, BUDGET_VERSION + 1);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('the header with + Cost, at every width from 320 to 1920: nothing overlaps or scrolls sideways', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
    try {
      const { page, errors } = await open(ctx, { build: (ids) => buildProduction(ids) });
      await page.locator('.doc-title').fill('What Happened to Haiti? The Long Way Home');
      await page.evaluate(() => document.activeElement?.blur());
      for (const w of [320, 360, 375, 390, 414, 600, 768, 820, 1024, 1180, 1280, 1366, 1440, 1600, 1920]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(80);
        const r = await page.evaluate(() => {
          const shown = (el) => el.offsetParent !== null && getComputedStyle(el).display !== 'none';
          const header = document.querySelector('header.bar');
          const c = [...header.querySelectorAll('button, input')].filter(shown).map((el) => ({ el, r: el.getBoundingClientRect() })).filter((x) => x.r.width);
          const overlaps = [];
          for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
            const a = c[i].r; const b = c[j].r;
            if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps.push(`${c[i].el.className} × ${c[j].el.className}`);
          }
          const cost = document.querySelector('.btn-plan-cost');
          return {
            overlaps,
            sideways: document.documentElement.scrollWidth > innerWidth || header.scrollWidth > header.clientWidth + 1,
            cost: cost && shown(cost) ? { w: cost.getBoundingClientRect().width, label: shown(cost.querySelector('.cost-label')) } : null,
          };
        });
        assert.deepEqual(r.overlaps, [], `${w}px`);
        assert.equal(r.sideways, false, `${w}px: nothing sideways`);
        assert.ok(r.cost, `${w}px: + Cost shown`);
        assert.equal(r.cost.label, w >= 375, `${w}px: “Cost” spelled out from 375px, the icon below`);
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('on a phone (light and dark): no sideways scroll, finger-sized fields, the popover on screen', async (t) => {
    if (skip) return t.skip(skip);
    for (const colorScheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme, locale: 'en-US' });
      try {
        const { page, errors } = await open(ctx, {
          build: (ids) => buildProduction(ids, { budget: (p) => setLine(setCurrency(p, 'USD').production, null, { source: { kind: 'element', id: elementId(p, 'Wine bottle') }, rate: 1500 }).production }),
        });
        const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(wide, false, `${colorScheme}: nothing sideways`);
        await rate(page, 'Breakaway bottle').fill('12345.67');
        await rate(page, 'Breakaway bottle').press('Enter');
        await settle(page);
        assert.equal(await rate(page, 'Breakaway bottle').inputValue(), '12,345.67');
        assert.ok(await rate(page, 'Breakaway bottle').evaluate((el) => el.scrollWidth <= el.clientWidth), `${colorScheme}: a five-figure rate shown whole`);
        const box = await rate(page, 'Breakaway bottle').boundingBox();
        assert.ok(box.height >= 32, `${colorScheme}: a finger-sized rate field (${box.height}px)`);
        await row(page, 'Wine bottle').locator('.bud-name').click();
        const pop = await page.getByRole('dialog', { name: 'Costing: Wine bottle' }).boundingBox();
        assert.ok(pop.x >= 0 && pop.x + pop.width <= 390, `${colorScheme}: the popover inside the screen`);
        const add = await page.getByRole('button', { name: 'Add cost' }).boundingBox();
        assert.ok(add.height >= 32, '+ Cost: finger-sized');
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    }
  });
});
