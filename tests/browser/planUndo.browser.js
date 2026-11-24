// Stage 2, Phase 0B in a real browser: one undo history across Write and Plan, and unattached
// breakdowns attached and removed on purpose.
//
//   1. Edit a line of dialogue in Write.
//   2. In Plan → Breakdowns, add a prop to scene 1, then one to scene 2.
//   3. Type Production Notes on scene 2 (the browser's own text editing, not an undo step).
//   4. Ctrl+Z three times: scene 2's prop, then scene 1's, then the dialogue edit — in that order,
//      the notes untouched. Ctrl+Shift+Z three times brings all three back.
//   Ctrl+Z inside Production Notes undoes the typing there, never the script.
//
// Then: scene 2's heading turned into Action leaves its breakdown unattached; Plan says so quietly,
// Review attaches it to scene 3; Ctrl+Z takes the attach back.
//
// `npm run test:browser` (DL_CHROMIUM=<path> to use another Chromium).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
const toPlan = async (page) => {
  await page.locator('.ws-switch [data-workspace="plan"]').click();
  const tab = page.locator('.plan-seg [aria-label="Breakdowns"]');
  if (await tab.isVisible()) {
    await tab.click();
  } else { // narrow windows: the Plan views are in ⋮
    await page.locator('.btn-kebab').click();
    await page.getByRole('menuitem', { name: /^Breakdowns/ }).click();
  }
  try {
    await page.locator('.plan-card').first().waitFor({ timeout: 15000 });
  } catch (e) {
    // What was on screen instead: saved for diagnosis (tests/browser/.debug/, not committed).
    const dir = fileURLToPath(new URL('./.debug/', import.meta.url));
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, 'plan-undo-failure.png') }).catch(() => {});
    const state = await page.evaluate(() => ({
      url: location.href,
      workspace: document.querySelector('.ws-switch [aria-checked="true"]')?.dataset.workspace,
      planTabs: [...document.querySelectorAll('.plan-seg button')].map((b) => `${b.getAttribute('aria-label')}:${b.getAttribute('aria-pressed') ?? b.getAttribute('aria-checked')}:${b.offsetParent ? 'shown' : 'hidden'}`),
      plan: document.querySelector('.plan')?.className || null,
      planText: (document.querySelector('.plan')?.innerText || '').slice(0, 400),
      dialogs: [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')].map((d) => `${d.className}: ${(d.innerText || '').slice(0, 120)}`),
      viewport: `${innerWidth}x${innerHeight}`,
      fonts: getComputedStyle(document.body).fontFamily,
    })).catch((err) => ({ error: String(err) }));
    writeFileSync(join(dir, 'plan-undo-failure.json'), `${JSON.stringify(state, null, 2)}\n`);
    throw new Error(`Plan's Breakdowns cards didn't appear. Details: tests/browser/.debug/plan-undo-failure.json and .png\n${JSON.stringify(state, null, 2)}`, { cause: e });
  }
};
const toWrite = (page) => page.locator('.ws-switch [data-workspace="write"]').click();
const card = (page, n) => page.locator('.plan-card').nth(n - 1);
const props = (page, n) => card(page, n).locator('.plan-bucket', { hasText: 'Props & Set Dressing' }).locator('.plan-tag').allTextContents();
const addProp = async (page, n, text) => {
  const c = card(page, n);
  if (!(await c.evaluate((el) => el.classList.contains('is-open')))) await c.locator('.plan-toggle').click();
  await c.getByRole('button', { name: 'Add to Props & Set Dressing' }).click();
  await c.locator('.plan-add-input').fill(text);
  await c.locator('.plan-add-input').press('Enter');
  await page.locator('.plan-summary').click(); // leave the field (its blur adds nothing more)
};
const dialogue = (page) => page.evaluate(() => [...document.querySelectorAll('.sheet textarea')].find((t) => t.value.startsWith('We go now'))?.value);
const key = async (page, combo) => {
  await page.locator('.plan-summary, .sheet').first().evaluate((el) => el.closest('body').focus());
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press(combo);
  await page.waitForTimeout(150);
};

describe('one undo history across Write and Plan', () => {
  it('Ctrl+Z takes back Plan and script edits in the order made, each only its own change', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, page, errors } = await open();
    try {
      const line = page.locator('.sheet textarea', { hasText: 'We go now' }).first();
      await line.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' Quickly.');
      await page.waitForTimeout(1500); // past the typing pause, so it's a step of its own
      assert.equal(await dialogue(page), 'We go now, before the tide turns. Quickly.');

      await toPlan(page);
      await addProp(page, 1, 'Thermos');
      await addProp(page, 2, 'Radio');
      const notes = card(page, 2).locator('.plan-notes textarea');
      await notes.fill('Tune the radio badly');
      assert.deepEqual(await props(page, 1), ['Thermos']);
      assert.deepEqual(await props(page, 2), ['Radio']);

      // Ctrl+Z inside Production Notes: the browser's own text undo, never the script or a tag
      await notes.focus();
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(150);
      assert.deepEqual(await props(page, 2), ['Radio'], 'Ctrl+Z in notes left the tags alone');
      await notes.fill('Tune the radio badly');

      await key(page, 'Control+z');
      assert.deepEqual(await props(page, 2), [], '1st Ctrl+Z: scene 2’s prop');
      assert.deepEqual(await props(page, 1), ['Thermos']);
      assert.equal(await notes.inputValue(), 'Tune the radio badly', 'notes typed since are kept');
      assert.match(await page.locator('.toast').textContent(), /Undone: “Radio” removed|Undone: “Radio” added/);

      await key(page, 'Control+z');
      assert.deepEqual(await props(page, 1), [], '2nd Ctrl+Z: scene 1’s prop');

      await key(page, 'Control+z');
      await toWrite(page);
      await page.waitForTimeout(300);
      assert.equal(await dialogue(page), 'We go now, before the tide turns.', '3rd Ctrl+Z: the dialogue edit');

      await toPlan(page);
      await key(page, 'Control+Shift+z');
      await key(page, 'Control+Shift+z');
      await key(page, 'Control+Shift+z');
      assert.deepEqual(await props(page, 1), ['Thermos'], 'redo all three');
      assert.deepEqual(await props(page, 2), ['Radio']);
      assert.equal(await card(page, 2).locator('.plan-notes textarea').inputValue(), 'Tune the radio badly');
      await toWrite(page);
      await page.waitForTimeout(300);
      assert.equal(await dialogue(page), 'We go now, before the tide turns. Quickly.');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('unattached breakdowns in the app', () => {
  it('a heading turned into Action: Plan says so, Review attaches it, Ctrl+Z takes it back', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, page, errors } = await open();
    try {
      await toPlan(page);
      await addProp(page, 2, 'Radio');
      assert.doesNotMatch(await page.locator('.plan-summary').textContent(), /no longer attached/);

      await toWrite(page);
      const heading = page.locator('.sheet textarea', { hasText: 'INT. FERRY - PASSENGER DECK - DAY' }).first();
      await heading.click();
      await page.keyboard.press('Alt+3'); // Scene Heading → Action
      await page.waitForTimeout(400);

      await toPlan(page);
      const summary = page.locator('.plan-summary');
      assert.match(await summary.textContent(), /1 scene’s breakdown is no longer attached · Review/);
      await summary.getByRole('button', { name: 'Review' }).click();
      const dialog = page.locator('dialog.un-modal');
      await dialog.waitFor();
      assert.match(await dialog.textContent(), /Radio/);
      await dialog.locator('.un-select').click();
      await page.getByRole('option', { name: /INT\. FERRY - PASSENGER DECK - CONTINUOUS/ }).click();
      await dialog.getByRole('button', { name: 'Attach' }).click();
      await page.waitForTimeout(300);
      assert.equal(await dialog.count(), 0, 'the dialog closes when nothing is left');
      assert.doesNotMatch(await summary.textContent(), /no longer attached/);
      const scene2 = page.locator('.plan-card', { hasText: 'PASSENGER DECK - CONTINUOUS' });
      if (!(await scene2.evaluate((el) => el.classList.contains('is-open')))) await scene2.locator('.plan-toggle').click();
      assert.match(await scene2.textContent(), /Radio/);

      await key(page, 'Control+z');
      assert.match(await summary.textContent(), /no longer attached/, 'undo: unattached again');
      assert.doesNotMatch(await scene2.textContent(), /Radio/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
