// Stage 2, Phase 2A in a real browser: a project from before shared elements, opened in two tabs.
//
//   - Opening it migrates it in memory only: nothing is written, no tab asks about another's save.
//   - Breakdowns looks and works as before (the four lists); an item added and undone leaves no element
//     behind, and the same name in another scene is the same element.
//
// `npm run test:browser` (DL_CHROMIUM=<path> to use another Chromium).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './server.js';

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
/** Make the open project look like one saved before Phase 2: four lists, no links, no registry. */
const makeLegacy = (page) => page.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open('draftline_db', 1);
  r.onsuccess = () => {
    const t = r.result.transaction(['projects', 'settings'], 'readwrite');
    t.objectStore('settings').get('activeProjectId').onsuccess = (e) => {
      const store = t.objectStore('projects');
      store.get(e.target.result.value).onsuccess = (g) => {
        const rec = g.target.result;
        const ids = rec.script.filter((b) => b.type === 'scene' && b.text.trim()).map((b) => b.id);
        rec.production = {
          version: 1,
          scenes: {
            [ids[0]]: { extras: ['Dock workers (4)'], props: ['Life jacket, orange'], wardrobe: ['Rain-soaked coat'], vehicles: ['Black SUV'], notes: 'Permit' },
            [ids[1]]: { vehicles: ['black suv'], wardrobe: [], extras: [], props: [], notes: '' },
          },
        };
        store.put(rec);
      };
    };
    t.oncomplete = resolve;
  };
}));

describe('a project from before shared elements', () => {
  it('opens in two tabs without a write or a question, and reads exactly as before', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    try {
      const a = await ctx.newPage();
      a.on('pageerror', (e) => errors.push(e.message));
      await a.goto(`${url}?dev=true`, { waitUntil: 'load' });
      await a.locator('input[type=file]').first().setInputFiles(SCRIPT);
      await a.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
      await a.waitForTimeout(1200);
      await makeLegacy(a);
      const before = await stored(a);
      await a.reload();
      const b = await ctx.newPage();
      b.on('pageerror', (e) => errors.push(e.message));
      await b.goto(`${url}?dev=true`, { waitUntil: 'load' });
      for (const p of [a, b]) await p.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
      await a.waitForTimeout(2000);
      const after = await stored(a);
      assert.equal(after.updatedAt, before.updatedAt, 'nothing written by opening');
      assert.equal(after.production.elements, undefined, 'still the old format on disk until a real edit');
      assert.equal(await a.locator('dialog.sc-modal').count() + await b.locator('dialog.sc-modal').count(), 0);

      // Breakdowns, unchanged: the four lists as they were (the shared SUV shown by one spelling)
      await a.locator('.ws-switch [data-workspace="plan"]').click();
      await a.locator('.plan-seg [aria-label="Breakdowns"]').click();
      const card = (n) => a.locator('.plan-card').nth(n - 1);
      for (const n of [1, 2]) if (!(await card(n).evaluate((el) => el.classList.contains('is-open')))) await card(n).locator('.plan-toggle').click();
      const tags = (n, label) => card(n).locator('.plan-bucket', { hasText: label }).locator('.plan-tag').allTextContents();
      assert.deepEqual(await tags(1, 'Props & Set Dressing'), ['Life jacket, orange']);
      assert.deepEqual(await tags(1, 'Vehicles & Stunts'), ['Black SUV']);
      assert.deepEqual(await tags(2, 'Vehicles & Stunts'), ['Black SUV']);

      // An edit: now it's saved, with the registry; undo takes the new element back
      await card(2).getByRole('button', { name: 'Add to Props & Set Dressing' }).click();
      await card(2).locator('.plan-add-input').fill('Flare gun');
      await card(2).locator('.plan-add-input').press('Enter');
      await a.locator('.plan-summary').click();
      await a.waitForTimeout(1200);
      const saved = await stored(a);
      const names = Object.values(saved.production.elements).map((e) => e.name).sort();
      assert.deepEqual(names, ['Black SUV', 'Dock workers (4)', 'Flare gun', 'Life jacket, orange', 'Rain-soaked coat']);
      await a.keyboard.press('Control+z');
      await a.waitForTimeout(1200);
      const undone = await stored(a);
      assert.ok(!Object.values(undone.production.elements).some((e) => e.name === 'Flare gun'), 'no element left behind');
      await b.waitForTimeout(800);
      assert.equal(await b.locator('dialog.sc-modal').count(), 0, 'the other tab just follows');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
