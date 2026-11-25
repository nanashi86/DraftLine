// Stage 2, Phase 3C in a real browser: File ▾ → Export Planning & Production → Budget (.pdf / .csv).
// The budget is written the way a saved project holds it (with the app's own lib functions); then the
// exports go through the interface and are compared with what Plan → Budget shows: the CSV's amounts,
// the report's total, page by page on A4 and Letter; offline; and the project is untouched.
//
// Run with: node --test tests/browser/budgetExport.browser.js  (skips when no Chromium is installed)
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './server.js';
import { addNeed, addSite, deleteElement, mapPlace, normalizeProduction, setNeed } from '../../src/lib/productionData.js';
import { BUDGET_VERSION, setBudgetSettings, setCurrency, setFee, setLine } from '../../src/lib/budget.js';
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

/** A budget with every kind of row: methods, a free item, an unpriced one, a review, one location for two places, fees. */
function film(ids, { extraCrew = 0 } = {}) {
  let p = setCurrency(normalizeProduction({ version: 1, scenes: {} }), 'EUR').production;
  const el = {};
  const need = (i, cat, name, qty) => {
    const r = addNeed(p, ids[i], cat, el[name] ? { id: el[name] } : { name });
    el[name] = r.id;
    p = qty ? setNeed(r.production, ids[i], r.id, { qty }) : r.production;
  };
  need(0, 'props', 'Wine bottle', 2); need(3, 'props', 'Wine bottle', 2);
  need(0, 'sfx', 'Breakaway bottle', 6); need(3, 'sfx', 'Breakaway bottle', 6);
  need(1, 'extras', 'Ferry passengers', 20); need(6, 'extras', 'Ferry passengers', 25);
  need(1, 'vehicles', 'Black SUV'); need(3, 'vehicles', 'Black SUV');
  need(4, 'props', 'Family photo'); need(4, 'props', 'Lantern');
  let s = null;
  for (const day of [[0, 1, 2], [3, 9], [5, 6]]) { const d = addDay(s); s = d.schedule; for (const i of day) s = moveScene(s, ids[i], d.dayId); }
  p = { ...p, schedule: s };
  const a = addSite(p, { name: 'Port de Fécamp' });
  p = mapPlace(mapPlace(a.production, 'HARBOR', a.id).production, 'PIER', a.id).production;
  const L = (f) => { p = setLine(p, null, f).production; };
  L({ source: { kind: 'cast', name: 'MARIE' }, method: 'day', rate: 45000, days: { from: 'span' } });
  L({ source: { kind: 'cast', name: 'AUGUSTIN' }, method: 'week', rate: 120000 });
  L({ source: { kind: 'element', id: el['Wine bottle'] }, rate: 1500 });
  L({ source: { kind: 'element', id: el['Breakaway bottle'] }, rate: 2500, usage: 'consume' });
  L({ source: { kind: 'element', id: el['Ferry passengers'] }, rate: 15000 });
  L({ source: { kind: 'element', id: el['Black SUV'] }, method: 'unitWeek', rate: 60000, week: { days: 7, rounding: 'up' } });
  L({ source: { kind: 'element', id: el['Family photo'] }, rate: 0 });
  L({ source: { kind: 'element', id: el.Lantern }, rate: 4000 });
  L({ source: { kind: 'site', id: a.id }, method: 'day', rate: 80000, note: 'Permit from the port authority' });
  L({ section: 'crew', label: '=Gaffer "night" <b>rate</b>', method: 'day', rate: 38000 });
  L({ section: 'equipment', label: 'Camera package', method: 'unitDay', rate: 42000, qty: { from: 'manual', value: 2 } });
  for (let i = 0; i < extraCrew; i++) L({ section: 'crew', label: `Crew member ${i + 1} with a fairly long job title to wrap`, method: 'day', rate: 20000 + i, note: i % 5 ? undefined : 'Note: overtime after 10 hours, meals provided, own kit' });
  p = deleteElement(p, el.Lantern);
  p = setBudgetSettings(p, { contingency: 1000 }).production;
  p = setFee(p, null, { label: 'Production insurance', amount: 120000 }).production;
  p = setFee(p, null, { label: 'VAT', bp: 2000, base: 'withContingency' }).production;
  return JSON.parse(JSON.stringify(p));
}

async function open(ctx, build) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
  await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
  await page.waitForTimeout(1000);
  if (build) {
    await putProduction(page, build(await sceneIds(page)));
    await page.reload({ waitUntil: 'load' });
    await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
    await page.waitForTimeout(500);
  }
  return { page, errors };
}
async function budgetOnScreen(page) {
  await page.locator('.ws-switch [data-workspace="plan"]').click();
  const tab = page.locator('.plan-seg [aria-label="Budget"]').first();
  if (await tab.isVisible()) await tab.click();
  else { await page.locator('.btn-kebab').click(); await page.getByRole('menuitem', { name: /^Budget/ }).click(); }
  await page.locator('.bud').waitFor();
  return page.evaluate(() => ({
    summary: document.querySelector('.bud-summary .plan-summary').textContent.replace(/\s+/g, ' ').trim(),
    rows: [...document.querySelectorAll('.bud-row:not(.bud-head)')].filter((r) => r.querySelector('.bud-name') && !r.classList.contains('is-review'))
      .map((r) => [r.querySelector('.bud-name').textContent.trim(), r.querySelector('.bud-total').textContent.trim()]),
  }));
}
const menuItem = async (page, re) => {
  await page.getByRole('button', { name: /^File/ }).click();
  return page.getByRole('menuitem', { name: re });
};
function parseCsv(text) {
  const s = text.replace(/^\uFEFF/, '');
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; } else if (c === '\r' && s[i + 1] === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; } else f += c;
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const cents = (t) => (t ? BigInt(t.replace('.', '')) : 0n);
const euros = (text) => BigInt(text.replace(/[^\d]/g, '')); // "€27,758.40" → 2775840n
async function csvExport(page) {
  const item = await menuItem(page, /^Budget\s*\.csv/);
  const [download] = await Promise.all([page.waitForEvent('download'), item.click()]);
  return { name: download.suggestedFilename(), text: await readFile(await download.path(), 'utf8') };
}
/**
 * Export PDF and return the report the app printed. The app writes the report into its own window,
 * prints it and closes that window on afterprint (lib/printTitle.js printInNewWindow). Where print()
 * returns at once (headless Chromium on Windows) the window closes before it could be read, so the
 * report is recorded as the app writes it, from the app's side of window.open, and print() is
 * recorded too, then passed straight through: nothing about printing is changed.
 */
async function pdfExport(page, kind) {
  await (await menuItem(page, /^Budget\s*\.pdf/)).click();
  const dlg = page.getByRole('dialog', { name: 'Export Budget (PDF)' });
  await dlg.waitFor();
  await dlg.getByRole('radio', { name: new RegExp(`^${kind}`) }).check();
  await page.evaluate(() => {
    window.__report = null;
    window.__reportPrinted = false;
    if (window.__reportWatch) return;
    window.__reportWatch = true;
    const open = window.open;
    window.open = function (...args) {
      const w = open.apply(this, args);
      if (w?.document) {
        const write = w.document.write;
        w.document.write = function (html) { window.__report = String(html); return write.call(this, html); };
        const print = w.print;
        w.print = function () { window.__reportPrinted = true; return print.call(this); };
      }
      return w;
    };
  });
  const [popup] = await Promise.all([page.waitForEvent('popup'), dlg.getByRole('button', { name: 'Export PDF' }).click()]);
  const html = await (await page.waitForFunction(() => window.__report)).jsonValue();
  await page.waitForFunction(() => window.__reportPrinted); // the app sent it to print
  if (!popup.isClosed()) await popup.close(); // where print() doesn't return at once, the window is still open
  const title = html.match(/<title>([^<]*)<\/title>/)[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return { title, html };
}
/** The report printed to a real PDF on `format` paper: its pages, and what overflows in print layout. */
async function printed(html, format) {
  const p = await browser.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  const pdf = await p.pdf({ format });
  await p.emulateMedia({ media: 'print' });
  await p.setViewportSize(format === 'A4' ? { width: 794 - 144, height: 1000 } : { width: 816 - 144, height: 1000 });
  const clipped = await p.evaluate(() => [...document.querySelectorAll('td, th, .rh span:last-child')]
    .filter((c) => c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).textOverflow !== 'ellipsis').map((c) => c.textContent.slice(0, 40)));
  // In print: each category's last item and subtotal are one unsplittable block; small categories too.
  const unsplit = await p.evaluate(() => [...document.querySelectorAll('tbody.end, section.cat.keep')].every((el) => getComputedStyle(el).breakInside === 'avoid'));
  const ends = await p.evaluate(() => document.querySelectorAll('tbody.end').length);
  await p.close();
  return { pages: (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, clipped, unsplit, ends };
}

describe('File ▾ → Budget (.pdf / .csv)', () => {
  it('the CSV and both reports match Plan → Budget; A4 and Letter; the project is untouched', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US', acceptDownloads: true });
    try {
      const { page, errors } = await open(ctx, (ids) => film(ids, { extraCrew: 60 }));
      const screen = await budgetOnScreen(page);
      const total = screen.summary.match(/^(Total|Estimated total|Partial total) (€[\d,.]+)/);
      assert.ok(total, screen.summary);
      const before = await stored(page);
      const undoBefore = await page.locator('button[title="Undo script edit (Ctrl+Z)"]').isDisabled();

      // CSV: SUM(Amount) is the Budget's total; each item's amount is its row's; the status in the Budget's words.
      const csv = await csvExport(page);
      assert.equal(csv.name, 'Untitled_Budget.csv'.replace('Untitled', (before.title || 'Untitled').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_')));
      const rows = parseCsv(csv.text);
      assert.equal(rows.reduce((s, r) => s + cents(r.Amount), 0n), euros(total[2]), 'SUM(Amount) = the on-screen total');
      assert.ok(rows.every((r) => r['Budget Status'] === total[1]));
      for (const [name, shown] of screen.rows) {
        const r = rows.find((x) => x.Item === name || x.Item === `'${name}`);
        assert.ok(r, name);
        assert.equal(r.Amount ? cents(r.Amount) : null, shown === '—' ? null : euros(shown), `${name}: ${shown}`);
      }
      assert.equal(rows.find((r) => r.Item === 'Lantern')['Excluded Amount'], '40.00');
      assert.equal(rows.find((r) => r.Item === 'Lantern').Amount, '');
      assert.equal(rows.find((r) => r.Item === 'Family photo').Amount, '0.00');
      assert.ok(rows.some((r) => r.Item === '\'=Gaffer "night" <b>rate</b>'), 'a formula can’t run');

      // PDF: the dialog shows the same total; Summary and Detailed name their files and print the same figures.
      await (await menuItem(page, /^Budget\s*\.pdf/)).click();
      const dlg = page.getByRole('dialog', { name: 'Export Budget (PDF)' });
      assert.match(await dlg.textContent(), new RegExp(`${total[1]} ${total[2].replace(/[.$]/g, '\\$&')}`));
      await dlg.getByRole('button', { name: 'Cancel' }).click();
      const summary = await pdfExport(page, 'Summary');
      const detailed = await pdfExport(page, 'Detailed');
      const title = (before.title || 'Untitled').trim();
      assert.equal(summary.title, `${title} - Budget Summary`);
      assert.equal(detailed.title, `${title} - Budget`);
      for (const r of [summary, detailed]) {
        assert.ok(r.html.includes(`${total[1]} ${total[2]}</b>`), 'the report’s total is the Budget’s');
        assert.ok(!r.html.includes('<b>rate</b>'), 'escaped');
      }
      for (const [name, shown] of screen.rows) {
        if (shown !== '—') assert.ok(detailed.html.includes(`>${shown.replace('€', '')}<`), `${name}: ${shown}`);
      }
      assert.match(detailed.html, /Scripted places: HARBOR, PIER/);
      assert.match(detailed.html, /Waiting for review — not included in any total/);
      for (const format of ['Letter', 'A4']) {
        const s = await printed(summary.html, format);
        const d = await printed(detailed.html, format);
        assert.equal(s.pages, 1, `${format}: the Summary on one page`);
        assert.ok(d.pages >= 3, `${format}: the Detailed report runs to several pages (${d.pages})`);
        assert.deepEqual(s.clipped, [], `${format}: nothing clipped`);
        assert.deepEqual(d.clipped, [], `${format}: nothing clipped`);
        assert.ok(d.ends > 0 && d.unsplit, `${format}: no subtotal left alone on a page`);
      }

      // Nothing written: the stored project, its save time and the undo history are as they were.
      await page.waitForTimeout(800);
      const after = await stored(page);
      assert.equal(JSON.stringify(after.production), JSON.stringify(before.production));
      assert.equal(after.updatedAt, before.updatedAt, 'no save');
      assert.equal(await page.locator('button[title="Undo script edit (Ctrl+Z)"]').isDisabled(), undoBefore, 'no undo step');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('offline: both exports work with no network', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US', acceptDownloads: true });
    try {
      const { page, errors } = await open(ctx, (ids) => film(ids));
      // The test server has no service worker (the built app's precaches every file: tests/swPrecache.test.js),
      // so first load what a visit to Plan and the dialog loads, as an installed app has it; then cut the network.
      await budgetOnScreen(page);
      await (await menuItem(page, /^Budget\s*\.pdf/)).click();
      await page.getByRole('dialog', { name: 'Export Budget (PDF)' }).getByRole('button', { name: 'Cancel' }).click();
      await ctx.setOffline(true);
      assert.equal(await page.evaluate(() => navigator.onLine), false);
      const csv = await csvExport(page);
      assert.ok(parseCsv(csv.text).length > 5);
      const r = await pdfExport(page, 'Detailed');
      assert.match(r.html, /Detailed budget/);
      assert.doesNotMatch(r.html, /https?:\/\//, 'nothing to fetch: the report is self-contained');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('available unpriced; greyed out with nothing to budget or a newer DraftLine’s budget', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US', acceptDownloads: true });
    try {
      // The script's cast and places, no rates and no currency: a costing worksheet.
      const { page, errors } = await open(ctx, null);
      const csv = await csvExport(page);
      const rows = parseCsv(csv.text);
      assert.ok(rows.length >= 4, 'cast and filming places to price');
      assert.ok(rows.every((r) => r.Amount === '' && r.Currency === '' && r.Status === 'No rate' && r['Budget Status'] === 'Partial total'));
      assert.equal((await stored(page)).production?.budget, undefined, 'still no budget stored');
      // A newer DraftLine's budget: shown greyed out, with why.
      const rec = await stored(page);
      await putProduction(page, { ...(rec.production || {}), budget: { version: BUDGET_VERSION + 1, lines: {} } });
      await page.reload({ waitUntil: 'load' });
      await page.locator('.sheet textarea').first().waitFor();
      let item = await menuItem(page, /^Budget\s*\.pdf/);
      assert.equal(await item.getAttribute('aria-disabled') ?? String(await item.isDisabled()), 'true');
      assert.match(await item.getAttribute('title'), /newer version of DraftLine/);
      await page.keyboard.press('Escape');
      // Nothing to budget: a new, empty script.
      await page.keyboard.press('Control+Alt+n');
      await page.waitForTimeout(800);
      item = await menuItem(page, /^Budget\s*\.csv/);
      assert.equal(await item.getAttribute('aria-disabled') ?? String(await item.isDisabled()), 'true');
      assert.match(await item.getAttribute('title'), /Nothing to budget yet/);
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('the dialog: both themes, and on a phone it fits the screen', async (t) => {
    if (skip) return t.skip(skip);
    for (const [colorScheme, size, mobile] of [['light', { width: 1280, height: 860 }, false], ['dark', { width: 390, height: 844 }, true]]) {
      const ctx = await browser.newContext({ viewport: size, colorScheme, locale: 'en-US', ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
      try {
        const { page, errors } = await open(ctx, (ids) => film(ids));
        await (await menuItem(page, /^Budget\s*\.pdf/)).click();
        const dlg = page.getByRole('dialog', { name: 'Export Budget (PDF)' });
        await dlg.waitFor();
        const box = await dlg.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= size.width, `${colorScheme}: inside the screen`);
        assert.equal(await dlg.getByRole('radio', { name: /^Detailed/ }).isChecked(), true, 'Detailed to start');
        await dlg.getByRole('radio', { name: /^Summary/ }).focus();
        await page.keyboard.press('Escape');
        await dlg.waitFor({ state: 'hidden' });
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    }
  });
});
