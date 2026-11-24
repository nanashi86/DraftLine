// Stage 2, Phase 1 in a real browser: Scheduling on the Stripboard.
//
//   1. No shooting day: the Stripboard as it always was (no Script | Schedule), + Shooting Day in the header.
//   2. The first day switches to Schedule; scenes move with the handle's Move to Day… and Alt+↑/↓.
//   3. Ctrl+Z takes back one move at a time; Ctrl+Shift+Z brings it back.
//   4. Script view: script order, a quiet D1 / D2 in the slugline cell; the choice is remembered.
//   5. Filtered: dragging is off, the handle still moves a scene.
//   6. A new scene written in Write starts in Unscheduled; the script itself is never changed by any of it.
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
  ({ server, url } = await startTestServer(import.meta.url)); // tests/browser/server.js
});
after(async () => { await browser?.close(); await server?.close(); });

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
  await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const script = (page) => page.evaluate(() => [...document.querySelectorAll('.sheet textarea')].map((t) => t.value).join('\n'));
const toStripboard = async (page) => {
  await page.locator('.ws-switch [data-workspace="plan"]').click();
  const tab = page.locator('.plan-seg [aria-label="Stripboard"]');
  if (await tab.isVisible()) await tab.click();
  else {
    await page.locator('.btn-kebab').click();
    await page.getByRole('menuitem', { name: /^Stripboard/ }).click();
  }
  await page.locator('.plan-stripboard').waitFor();
};
const toWrite = (page) => page.locator('.ws-switch [data-workspace="write"]').click();
/** Scene numbers per day, then Unscheduled: [[2, 3], [4], ['U', 1, 5, …]] */
const layout = (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.is-schedule .strip-break, .is-schedule .strip-slot:not(.is-head)')) {
    if (el.classList.contains('strip-break')) out.push(/UNSCHEDULED/i.test(el.textContent) ? ['U'] : []);
    else out.at(-1).push(Number(el.querySelector('.strip-num').textContent));
  }
  return out;
});
const moveTo = async (page, n, day) => {
  await page.locator(`.strip-handle[aria-label="Move scene ${n}"]`).click();
  await page.getByRole('menuitem', { name: day === 'U' ? 'Unscheduled' : new RegExp(`^Day ${day}`) }).click();
  await page.waitForTimeout(120);
};
const key = async (page, combo) => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press(combo);
  await page.waitForTimeout(150);
};

describe('Scheduling on the Stripboard', () => {
  it('days, moves by menu and keyboard, undo, Script view with day numbers, the remembered choice', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, page, errors } = await open();
    try {
      const original = await script(page);
      await toStripboard(page);
      assert.equal(await page.locator('.strip-view').count(), 0, 'no day yet: no Script | Schedule');
      assert.equal(await page.locator('.strip-handle').count(), 0, 'no day yet: no handles');
      await page.locator('.btn-kebab').click();
      assert.equal(await page.getByRole('menuitem', { name: 'Renumber Cast…' }).count(), 0, 'no fixed numbers yet: no Renumber Cast…');
      await page.keyboard.press('Escape');
      const add = page.locator('.btn-plan-day');
      assert.ok(await add.isVisible(), '+ Shooting Day in the header');

      await add.click();
      assert.equal(await page.locator('.strip-view [aria-checked="true"]').textContent(), 'Schedule', 'the first day shows Schedule');
      assert.match(await page.locator('.strip-empty').textContent(), /No scenes yet/);
      await add.click();

      await moveTo(page, 2, 1);
      await moveTo(page, 3, 1);
      await moveTo(page, 4, 2);
      assert.deepEqual((await layout(page)).slice(0, 2), [[2, 3], [4]]);

      // Alt+↓ on the handle of scene 3 (last on day 1): to the top of day 2
      await page.locator('.strip-handle[aria-label="Move scene 3"]').focus();
      await page.keyboard.press('Alt+ArrowDown');
      await page.waitForTimeout(150);
      assert.deepEqual((await layout(page)).slice(0, 2), [[2], [3, 4]]);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Move scene 3', 'focus follows the scene');
      await page.keyboard.press('Alt+ArrowUp');
      await page.waitForTimeout(150);
      assert.deepEqual((await layout(page)).slice(0, 2), [[2, 3], [4]]);

      // one step at a time
      await key(page, 'Control+z');
      assert.deepEqual((await layout(page)).slice(0, 2), [[2], [3, 4]]);
      assert.match(await page.locator('.toast').textContent(), /Undone: scene 3 moved/);
      await key(page, 'Control+z');
      assert.deepEqual((await layout(page)).slice(0, 2), [[2, 3], [4]]);
      await key(page, 'Control+Shift+z');
      assert.deepEqual((await layout(page)).slice(0, 2), [[2], [3, 4]]);
      await key(page, 'Control+Shift+z');
      assert.deepEqual((await layout(page)).slice(0, 2), [[2, 3], [4]]);

      // a day's details: a cast code explains itself when tapped
      await page.locator('.strip-break-btn').first().click();
      const pop = page.locator('.day-pop');
      await pop.waitFor();
      await pop.locator('.day-pop-code').first().click();
      assert.match(await pop.locator('.day-pop-explain').textContent(), /^\S+ · (SW|W|WF|SWF): /);
      await page.keyboard.press('Escape');

      // Renumber Cast…: in ⋮ once numbers are fixed; asks first; nothing to change on an unchanged script
      await page.locator('.btn-kebab').click();
      await page.getByRole('menuitem', { name: 'Renumber Cast…' }).click();
      await page.locator('dialog.rc-modal').getByRole('button', { name: 'Renumber' }).click();
      assert.match(await page.locator('.toast').textContent(), /nothing to change/, 'numbers were fixed from the script as it was');

      // the strip itself still opens Write
      await page.locator('.is-schedule .strip-slot .strip', { hasText: 'HARBOR' }).click();
      await page.locator('.sheet').first().waitFor();
      assert.equal(await page.locator('.ws-switch [data-workspace="write"]').getAttribute('aria-checked'), 'true');
      await toStripboard(page);

      // Script view: script order, D-numbers in the slugline cell
      await page.locator('.strip-view [role="radio"]', { hasText: 'Script' }).click();
      const strips = page.locator('.plan-stripboard:not(.is-schedule) .strip:not(.strip-head)');
      assert.equal(await strips.count(), 14);
      assert.deepEqual(await page.locator('.strip-day').allTextContents(), ['D1', 'D1', 'D2']);
      assert.equal(await strips.nth(1).locator('.strip-slug .strip-day').textContent(), 'D1');
      assert.equal(await strips.nth(0).locator('.strip-day').count(), 0, 'scene 1 is on no day');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('draftline:stripView:v1') || '{}'));
      assert.deepEqual(Object.values(saved), ['script'], 'the choice is kept for this project');
      await toWrite(page);
      await toStripboard(page);
      assert.equal(await page.locator('.strip-view [aria-checked="true"]').textContent(), 'Script', 'and comes back');

      await toWrite(page);
      assert.equal(await script(page), original, 'the screenplay is untouched');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('filtered: dragging is off and the handle still moves a scene; a new scene starts Unscheduled', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, page, errors } = await open();
    try {
      await toStripboard(page);
      await page.locator('.btn-plan-day').click();
      assert.equal(await page.locator('.is-schedule .strip-slot:not(.is-head)').first().getAttribute('draggable'), 'true');

      await page.locator('.plan-filter:visible input[type=search]').first().fill('FERRY');
      await page.waitForTimeout(200);
      assert.match(await page.locator('.plan-summary-row').textContent(), /drag is off/);
      assert.equal(await page.locator('.is-schedule [draggable="true"]').count(), 0, 'no dragging while filtered');
      await moveTo(page, 6, 1);
      await page.locator('.plan-filter:visible input[type=search]').first().fill('');
      await page.waitForTimeout(200);
      assert.deepEqual((await layout(page))[0], [6]);

      // a new scene, written in Write
      await toWrite(page);
      const last = page.locator('.sheet textarea').last();
      await last.click();
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Alt+1'); // Scene Heading
      await page.keyboard.type('EXT. ROOFTOP - NIGHT');
      await page.waitForTimeout(600);
      await toStripboard(page);
      const unscheduled = (await layout(page)).find((g) => g[0] === 'U');
      assert.equal(unscheduled.at(-1), 15, 'the new scene is at the end of Unscheduled');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
