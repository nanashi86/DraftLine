// Stage 2, Phase 3A in a real browser: Rename Character with budget lines on that character
// (lib/budget.js budgetAfterCastRename, App.jsx renameCharacterEverywhere). There's no Budget interface
// yet, so the lines are written to the stored project the way a saved one would hold them, then the
// rename goes through the real Characters → Dialogue → Rename… flow.
//
// Run with: node --test tests/browser/budgetRename.browser.js  (skips when no Chromium is installed)
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './server.js';

const SCRIPT = fileURLToPath(new URL('./stripboard-fixture.fountain', import.meta.url));
let chromium, browser, server, url;
let skip = '';

before(async () => {
  try {
    ({ chromium } = await import('playwright'));
    browser = await chromium.launch(globalThis.process.env.DL_CHROMIUM ? { executablePath: globalThis.process.env.DL_CHROMIUM } : {});
  } catch (e) {
    skip = `No Chromium here (${e.message.split('\n')[0]})`;
    return;
  }
  ({ server, url } = await startTestServer(import.meta.url));
});
after(async () => {
  await browser?.close();
  await server?.close();
});

/** The open project's stored record, straight from IndexedDB. */
const stored = (page) => page.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open('draftline_db', 1);
  r.onsuccess = () => {
    const t = r.result.transaction(['projects', 'settings']);
    t.objectStore('settings').get('activeProjectId').onsuccess = (e) => {
      t.objectStore('projects').get(e.target.result.value).onsuccess = (g) => resolve(g.target.result);
    };
  };
}));
/** Give the stored project a budget (as a saved one would hold it). */
const plantBudget = (page, budget) => page.evaluate((b) => new Promise((resolve) => {
  const r = indexedDB.open('draftline_db', 1);
  r.onsuccess = () => {
    const t = r.result.transaction(['projects', 'settings'], 'readwrite');
    t.objectStore('settings').get('activeProjectId').onsuccess = (e) => {
      const store = t.objectStore('projects');
      store.get(e.target.result.value).onsuccess = (g) => {
        const rec = g.target.result;
        rec.production = { ...(rec.production || { version: 1, scenes: {} }), budget: b };
        store.put(rec);
      };
    };
    t.oncomplete = resolve;
  };
}), budget);

const BUDGET = {
  version: 1,
  currency: 'USD',
  futureSetting: { kept: true }, // a field this version doesn't know: kept exactly
  contingency: { bp: 1000 },
  lines: {
    marie: { id: 'marie', source: { kind: 'cast', name: 'MARIE' }, method: 'day', rate: 40000, holds: 'paid', note: 'Lead', futureField: [1, 2] },
    theo: { id: 'theo', source: { kind: 'cast', name: 'THEO' }, method: 'day', rate: 35000 },
    gaffer: { id: 'gaffer', section: 'crew', label: 'Gaffer', method: 'day', rate: 30000, days: { from: 'manual', value: 3 } },
  },
};
const speaks = (rec, name) => rec.script.some((b) => b.type === 'character' && b.text.trim().toUpperCase() === name);

describe('Rename Character with budget lines', () => {
  it('follows the rename, undoes and redoes with it, survives a reload, and touches nothing else', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    try {
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
      await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
      await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
      await page.waitForTimeout(1200);
      await plantBudget(page, BUDGET);
      await page.reload({ waitUntil: 'load' });
      await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
      await page.waitForTimeout(800);
      const start = await stored(page);
      assert.deepEqual(start.production.budget, BUDGET, 'opened without a change');

      // Characters → Dialogue → MARIE → Rename… → MARION
      await page.keyboard.press('Alt+c');
      await page.locator('.pb-tab[data-tab="dialogue"]').click();
      await page.locator('.tuner-cast-list [role=option]', { hasText: 'MARIE' }).click();
      await page.locator('.tuner-rename').click();
      const dialog = page.getByRole('dialog', { name: 'Rename character' });
      await dialog.getByPlaceholder('New name').fill('MARION');
      await dialog.locator('button[type=submit]').click();
      await dialog.waitFor({ state: 'detached' });
      await page.waitForTimeout(1200);

      const renamed = await stored(page);
      const b = renamed.production.budget;
      assert.ok(speaks(renamed, 'MARION') && !speaks(renamed, 'MARIE'), 'the script renamed');
      assert.deepEqual(b.lines.marie, { ...BUDGET.lines.marie, source: { kind: 'cast', name: 'MARION' }, origin: [{ kind: 'cast', name: 'MARIE' }] },
        'the line follows, its rate, note and unknown field as they were, its old name kept as provenance');
      assert.deepEqual(b.lines.theo, BUDGET.lines.theo, 'another character’s line untouched');
      assert.deepEqual(b.lines.gaffer, BUDGET.lines.gaffer, 'a line of its own untouched');
      assert.deepEqual(Object.keys(b.lines).sort(), ['gaffer', 'marie', 'theo'], 'nothing lost or duplicated');
      assert.deepEqual({ ...b, lines: undefined }, { ...BUDGET, lines: undefined }, 'settings and unknown fields untouched');
      assert.deepEqual(renamed.production.scenes, start.production.scenes, 'breakdowns untouched');
      assert.deepEqual(renamed.production.schedule, start.production.schedule);

      // Undo: script and budget back together, exactly; redo: both again.
      await page.evaluate(() => document.activeElement?.blur()); // the app's undo, not a field's
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(1200);
      const undone = await stored(page);
      assert.ok(speaks(undone, 'MARIE') && !speaks(undone, 'MARION'), 'the script back');
      assert.deepEqual(undone.production.budget, BUDGET, 'the budget back, exactly');
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Control+Shift+z');
      await page.waitForTimeout(1200);
      const redone = await stored(page);
      assert.ok(speaks(redone, 'MARION'));
      assert.deepEqual(redone.production.budget, b, 'redo: the same lines as the rename made');

      // Saved, and read back after a reload.
      await page.reload({ waitUntil: 'load' });
      await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
      await page.waitForTimeout(800);
      const reloaded = await stored(page);
      assert.deepEqual(reloaded.production.budget, b, 'associations and amounts as saved');
      assert.ok(speaks(reloaded, 'MARION'));
      assert.deepEqual(errors, []);
    } finally {
      await ctx.close();
    }
  });
});
