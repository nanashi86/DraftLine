// Stage 2 in a real browser. Phase 2A: a project from before shared elements, opened in two tabs.
// Phase 2B: the eight categories, suggestions, the element card, shooting-day needs and the CSV.
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

      // Breakdowns: every item where it was (the old mixed lists' items in Wardrobe / Vehicles; the shared SUV by one spelling)
      await a.locator('.ws-switch [data-workspace="plan"]').click();
      await a.locator('.plan-seg [aria-label="Breakdowns"]').click();
      const card = (n) => a.locator('.plan-card').nth(n - 1);
      for (const n of [1, 2]) if (!(await card(n).evaluate((el) => el.classList.contains('is-open')))) await card(n).locator('.plan-toggle').click();
      const tags = (n, label) => card(n).locator('.plan-bucket', { hasText: label }).locator('.plan-tag').allTextContents();
      assert.deepEqual(await tags(1, 'Props & Set Dressing'), ['Life jacket, orange']);
      assert.deepEqual(await tags(1, 'Vehicles'), ['Black SUV']);
      assert.deepEqual(await tags(2, 'Vehicles'), ['Black SUV']);

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

// ---- Phase 2B ----------------------------------------------------------------------------------

async function openBreakdowns(ctx) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
  await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
  await page.waitForTimeout(800);
  await page.locator('.ws-switch [data-workspace="plan"]').click();
  const tab = page.locator('.plan-seg [aria-label="Breakdowns"]');
  if (await tab.isVisible()) await tab.click();
  else {
    await page.locator('.btn-kebab').click();
    await page.getByRole('menuitem', { name: /^Breakdowns/ }).click();
  }
  const card = (n) => page.locator('.plan-card').nth(n - 1);
  for (const n of [1, 2]) if (!(await card(n).evaluate((el) => el.classList.contains('is-open')))) await card(n).locator('.plan-toggle').click();
  return { page, errors, card };
}
const bucket = (card, label) => card.locator('.plan-bucket').filter({ has: card.page().locator('.plan-label', { hasText: new RegExp(`^${label}$`) }) });
const tagsIn = (card, label) => bucket(card, label).locator('.plan-tag-name').allTextContents();
/** Type into a category's + Add; `pick` chooses a suggestion by its text (or Enter adds what was typed). */
async function add(card, label, text, pick) {
  const page = card.page();
  await card.getByRole('button', { name: `Add to ${label}`, exact: true }).click();
  const input = card.getByRole('combobox', { name: `Add to ${label}`, exact: true });
  await input.fill(text);
  if (pick) await page.getByRole('option').filter({ hasText: pick }).first().click();
  else await input.press('Enter');
  await input.press('Escape');
}
const openEl = async (card, name) => {
  await card.locator('.plan-tag-name', { hasText: name }).first().click();
  await card.page().locator('.el-pop').waitFor();
  return card.page().locator('.el-pop');
};
const closeEl = async (page) => {
  await page.keyboard.press('Escape');
  await page.locator('.el-pop').waitFor({ state: 'detached' });
};
const named = (rec, name) => Object.values(rec.production.elements).filter((e) => e.name === name);
const key = async (page, combo) => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press(combo);
  await page.waitForTimeout(200);
};

describe('shared elements in Breakdowns (Phase 2B)', () => {
  it('suggests, reuses, renames, moves, separates, merges, deletes and undoes; days and the CSV follow', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    try {
      const { page, errors, card } = await openBreakdowns(ctx);
      const labels = await card(1).locator('.plan-bucket .plan-label').allTextContents();
      assert.deepEqual(labels, ['Background / Extras', 'Props & Set Dressing', 'Wardrobe', 'Hair & Makeup', 'Vehicles', 'Stunts', 'Special Effects', 'Visual Effects']);
      const tops = await card(1).locator('.plan-bucket').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))]);
      assert.equal(tops.length, 2, 'four columns, two rows on a desktop');

      // a suggestion reuses the element; "+ New" keeps one apart on purpose
      await add(card(1), 'Vehicles', 'Black SUV');
      await card(2).getByRole('button', { name: 'Add to Vehicles', exact: true }).click();
      await card(2).getByRole('combobox', { name: 'Add to Vehicles' }).fill('bla');
      assert.deepEqual(await page.locator('.plan-suggest [role=option]').allTextContents(), ['Black SUVsc 1', '+ New “bla”']);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await add(card(1), 'Props & Set Dressing', 'Radio');
      await add(card(2), 'Props & Set Dressing', 'Radio', '+ New');
      await add(card(2), 'Props & Set Dressing', 'Radio', 'sc 1'); // and the scene-1 one too: two Radios here
      await page.waitForTimeout(1000);
      let rec = await stored(page);
      assert.equal(named(rec, 'Black SUV').length, 1, 'reused, not duplicated');
      assert.equal(named(rec, 'Radio').length, 2, 'kept apart when asked');

      // rename everywhere
      let pop = await openEl(card(1), 'Black SUV');
      assert.match(await pop.locator('.el-pop-uses').textContent(), /Sc 1Sc 2/);
      await pop.locator('.el-pop-name').fill('Black sedan');
      await pop.locator('.el-pop-name').press('Enter');
      assert.deepEqual(await tagsIn(card(2), 'Vehicles'), ['Black sedan']);

      // a shared element changes category only after "Move everywhere"
      await pop.getByRole('combobox', { name: 'Category (for every scene)' }).click();
      await page.getByRole('option', { name: 'Stunts' }).click();
      await pop.getByRole('button', { name: 'Move everywhere' }).click();
      assert.deepEqual(await tagsIn(card(2), 'Stunts'), ['Black sedan']);
      assert.deepEqual(await tagsIn(card(1), 'Vehicles'), []);
      await closeEl(page);

      // separate here, undo, redo
      pop = await openEl(card(2), 'Black sedan');
      await pop.getByRole('button', { name: 'Separate here' }).click();
      await page.waitForTimeout(1000);
      assert.equal(named(await stored(page), 'Black sedan').length, 2);
      await key(page, 'Control+z');
      await page.waitForTimeout(1000);
      assert.equal(named(await stored(page), 'Black sedan').length, 1, 'undo joins them again');
      await key(page, 'Control+Shift+z');
      await page.waitForTimeout(1000);
      assert.equal(named(await stored(page), 'Black sedan').length, 2, 'redo');

      // quantity and note belong to the scene
      await add(card(1), 'Background / Extras', 'Ferry passengers');
      pop = await openEl(card(1), 'Ferry passengers');
      await pop.getByLabel('Quantity in this scene').fill('20');
      await pop.getByLabel('Quantity in this scene').press('Enter');
      await pop.getByLabel('Note for this scene').fill('wet');
      await pop.getByLabel('Note for this scene').press('Enter');
      await closeEl(page);
      assert.deepEqual(await tagsIn(card(1), 'Background / Extras'), ['Ferry passengers ×20']);

      // merge: scene 2 has both Radios with different quantities, and nothing is merged until that's chosen
      const radios = card(2).locator('.plan-tag-name', { hasText: 'Radio' });
      await radios.nth(0).click();
      await page.getByLabel('Quantity in this scene').fill('2');
      await page.getByLabel('Quantity in this scene').press('Enter');
      await closeEl(page);
      await radios.nth(1).click();
      await page.getByLabel('Quantity in this scene').fill('3');
      await page.getByLabel('Quantity in this scene').press('Enter');
      pop = page.locator('.el-pop');
      await pop.getByRole('combobox', { name: 'Merge into another element' }).click();
      await page.getByRole('option').filter({ hasText: 'Radio' }).click();
      const pick = pop.getByRole('radiogroup', { name: 'Quantity in scene 2' });
      await pick.waitFor();
      assert.ok(await pop.getByRole('button', { name: 'Merge', exact: true }).isDisabled());
      await pick.getByLabel('×3').check();
      await pop.getByRole('button', { name: 'Merge', exact: true }).click();
      await page.locator('.el-pop').waitFor({ state: 'detached' });
      await page.waitForTimeout(1000);
      rec = await stored(page);
      assert.equal(named(rec, 'Radio').length, 1);
      assert.deepEqual(await card(2).locator('.plan-tag-name', { hasText: 'Radio' }).allTextContents(), ['Radio ×3']);
      assert.deepEqual(await tagsIn(card(1), 'Props & Set Dressing'), ['Radio']);

      // delete everywhere
      await add(card(1), 'Visual Effects', 'Storm sky');
      pop = await openEl(card(1), 'Storm sky');
      await pop.getByRole('button', { name: 'Delete everywhere…' }).click();
      await pop.getByRole('group', { name: 'Delete everywhere' }).getByRole('button', { name: 'Delete everywhere' }).click();
      await page.waitForTimeout(1000);
      assert.equal(named(await stored(page), 'Storm sky').length, 0);

      // a shooting day lists each element once, with each scene's own quantity and note
      await page.locator('.plan-seg [aria-label="Stripboard"]').click();
      await page.locator('.btn-plan-day').click();
      for (const n of [1, 2]) {
        await page.locator(`.strip-handle[aria-label="Move scene ${n}"]`).click();
        await page.getByRole('menuitem', { name: /^Day 1/ }).click();
      }
      await page.locator('.strip-break-btn').first().click();
      const needs = await page.locator('.day-pop .day-pop-needs li').allTextContents();
      assert.ok(needs.includes('Ferry passengers · sc 1 ×20 (wet)'), needs.join(' | '));
      assert.ok(needs.includes('Radio · sc 2 ×3'), 'quantities side by side, never added up');
      assert.equal(needs.filter((n) => n === 'Black sedan').length, 2, 'two separate elements, listed apart');
      await page.keyboard.press('Escape');

      // the CSV, from File
      await page.getByRole('button', { name: /^File/ }).click();
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^Scene Breakdown/ }).click()]);
      const csv = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
      assert.match(csv.split('\r\n')[0], /Speaking Cast,Background \/ Extras,Props & Set Dressing,Wardrobe,Hair & Makeup,Vehicles,Stunts,Special Effects,Visual Effects,Production Notes/);
      assert.match(csv, /Ferry passengers ×20 \(wet\)/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('on a phone, in dark: one column, suggestions by touch, the card on screen', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, colorScheme: 'dark', hasTouch: true, isMobile: true });
    try {
      const { page, errors, card } = await openBreakdowns(ctx);
      const lefts = await card(1).locator('.plan-bucket').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
      assert.equal(lefts, 1, 'one column');
      await add(card(1), 'Hair & Makeup', 'Bruised cheek');
      await card(2).getByRole('button', { name: 'Add to Hair & Makeup', exact: true }).tap();
      await card(2).getByRole('combobox', { name: 'Add to Hair & Makeup' }).fill('bru');
      const opt = page.locator('.plan-suggest [role=option]').first();
      assert.ok((await opt.boundingBox()).height >= 36, 'a finger-sized row');
      await opt.tap();
      await card(2).getByRole('combobox', { name: 'Add to Hair & Makeup' }).press('Escape');
      await card(2).locator('.plan-tag-name', { hasText: 'Bruised cheek' }).tap();
      const box = await page.locator('.el-pop').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 412, 'inside the screen');
      assert.match(await page.locator('.el-pop-uses').textContent(), /Sc 1Sc 2/);
      const bg = await page.locator('.el-pop').evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.notEqual(bg, 'rgb(255, 255, 255)', 'dark theme');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('only Enter or a pick adds; unused ones can be deleted from the list; Enter renames; Esc cancels', async (t) => {
    if (skip) return t.skip(skip);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const { page, errors, card } = await openBreakdowns(ctx);
      const field = (n, label) => card(n).getByRole('combobox', { name: `Add to ${label}`, exact: true });
      const open = async (n, label) => card(n).getByRole('button', { name: `Add to ${label}`, exact: true }).click();
      await add(card(1), 'Props & Set Dressing', 'Suitcase');

      // unfinished text is never added: clicking away, or Esc
      await open(2, 'Props & Set Dressing');
      await field(2, 'Props & Set Dressing').fill('suitc');
      await page.locator('.plan-summary').click();
      await open(2, 'Props & Set Dressing');
      await field(2, 'Props & Set Dressing').fill('suitc');
      await field(2, 'Props & Set Dressing').press('Escape');
      assert.deepEqual(await tagsIn(card(2), 'Props & Set Dressing'), []);
      await page.waitForTimeout(900);
      assert.equal(named(await stored(page), 'suitc').length, 0, 'nothing made');
      // Enter still adds, commas still add several
      await add(card(2), 'Props & Set Dressing', 'Hat, Cane');
      assert.deepEqual(await tagsIn(card(2), 'Props & Set Dressing'), ['Hat', 'Cane']);

      // a typo, now unused: its row has a trash can; deleting it never picks or adds it, and Ctrl+Z (still here) undoes
      await add(card(1), 'Props & Set Dressing', 'Suitcse');
      await card(1).getByRole('button', { name: 'Remove Suitcse' }).click();
      await open(2, 'Props & Set Dressing');
      await field(2, 'Props & Set Dressing').fill('suit');
      const rows = page.locator('.plan-suggest [role=option]');
      assert.deepEqual(await rows.locator('.plan-suggest-name').allTextContents(), ['Suitcase', 'Suitcse', '+ New “suit”']);
      assert.equal(await rows.nth(0).locator('.plan-suggest-del').count(), 0, 'used: no trash can');
      await rows.nth(1).hover();
      await rows.nth(1).getByRole('button', { name: 'Delete “Suitcse” from the project' }).click();
      await page.waitForTimeout(900);
      assert.equal(named(await stored(page), 'Suitcse').length, 0, 'deleted');
      assert.deepEqual(await tagsIn(card(2), 'Props & Set Dressing'), ['Hat', 'Cane'], 'not added');
      assert.ok(await field(2, 'Props & Set Dressing').evaluate((el) => el === document.activeElement), 'still typing');
      assert.ok(await page.locator('.toast', { hasText: 'deleted from the project' }).isVisible());
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(900);
      assert.equal(named(await stored(page), 'Suitcse').length, 1, 'Ctrl+Z brings it back');
      await field(2, 'Props & Set Dressing').press('Escape');

      // rename: a hint while unconfirmed; Esc keeps nothing; clicking outside says it wasn't renamed
      let pop = await openEl(card(1), 'Suitcase');
      assert.equal(await pop.locator('.el-pop-pending').count(), 0, 'no hint until the name changes');
      assert.equal(await pop.getByLabel('Note for this scene').getAttribute('placeholder'), 'Scene-specific note…');
      await pop.locator('.el-pop-name').fill('Trunk');
      assert.match(await pop.locator('.el-pop-pending').textContent(), /^Press Enter to rename/);
      await pop.getByLabel('Quantity in this scene').fill('3'); // leaving the name doesn't rename either
      await page.keyboard.press('Escape');
      await page.locator('.el-pop').waitFor({ state: 'detached' });
      await page.waitForTimeout(900);
      let rec = await stored(page);
      assert.equal(named(rec, 'Trunk').length, 0, 'Esc: not renamed');
      assert.deepEqual(await tagsIn(card(1), 'Props & Set Dressing'), ['Suitcase'], 'Esc: quantity not kept either');
      pop = await openEl(card(1), 'Suitcase');
      await pop.locator('.el-pop-name').fill('Trunk');
      await pop.getByLabel('Quantity in this scene').fill('2');
      await page.locator('.plan-summary').click();
      await page.locator('.el-pop').waitFor({ state: 'detached' });
      assert.ok(await page.locator('.toast', { hasText: 'wasn’t renamed' }).isVisible());
      assert.deepEqual(await tagsIn(card(1), 'Props & Set Dressing'), ['Suitcase ×2'], 'outside: the quantity is kept, as leaving the field');
      pop = await openEl(card(1), 'Suitcase');
      await pop.locator('.el-pop-name').fill('Trunk');
      await pop.locator('.el-pop-name').press('Enter');
      assert.equal(await pop.locator('.el-pop-pending').count(), 0);
      await closeEl(page);
      assert.deepEqual(await tagsIn(card(1), 'Props & Set Dressing'), ['Trunk ×2'], 'confirmed changes stay after Esc');

      // Esc closes an open dropdown first, then the card; the dropdowns are drawn like the fields
      pop = await openEl(card(1), 'Trunk');
      const cat = pop.getByRole('combobox', { name: 'Category' });
      await cat.click();
      await page.locator('.dl-select-list').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.dl-select-list').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.el-pop').count(), 1, 'the first Esc closes only the list');
      const look = (loc) => loc.evaluate((el) => { const c = getComputedStyle(el); return [c.borderTopWidth, c.borderTopStyle, c.borderRadius, c.backgroundColor, c.height, c.fontSize]; });
      assert.deepEqual(await look(cat), await look(pop.locator('.el-pop-name')));
      const ink = (name) => pop.getByRole('button', { name, exact: true }).evaluate((el) => getComputedStyle(el).color);
      assert.notEqual(await ink('Delete everywhere…'), await ink('Remove from scene'), 'delete is the strongest');
      await page.keyboard.press('Escape');
      await page.locator('.el-pop').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.plan-card').count() > 0, true, 'the second Esc closed the card, nothing else');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
