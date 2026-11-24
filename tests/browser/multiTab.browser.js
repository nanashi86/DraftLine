// Phase 1.5 in a real browser: the same script open in two (or three) tabs never loses work.
//
// Every tab here is a page in ONE browser context, so they share IndexedDB, localStorage,
// BroadcastChannel and Web Locks exactly as two tabs of one Chrome profile do.
//
// `npm run test:browser` (DL_CHROMIUM=<path> to use another Chromium).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './server.js';

const SCRIPT = fileURLToPath(new URL('./stripboard-fixture.fountain', import.meta.url));
const LINE = 'We go now, before the tide turns.'; // a line of dialogue in the fixture

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

/** A fresh browser profile with the fixture as the open script in tab A. */
async function profile({ dark = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: dark ? 'dark' : 'light' });
  const errors = [];
  const a = await ctx.newPage();
  a.on('pageerror', (e) => errors.push(`A: ${e.message}`));
  await a.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await a.locator('input[type=file]').first().setInputFiles(SCRIPT);
  await line(a).waitFor();
  await a.waitForTimeout(1200); // saved, and the active script
  return { ctx, a, errors };
}
/** Another tab on the same profile (it opens the active script). */
async function tab(ctx, errors, name) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await line(p).waitFor();
  await p.waitForTimeout(400);
  return p;
}
const line = (page) => page.locator('.sheet textarea', { hasText: /We go now/ }).first();
const dialogue = (page) => page.evaluate(() => [...document.querySelectorAll('.sheet textarea')].find((t) => t.value.startsWith('We go now'))?.value);
/** Type at the end of the dialogue line (unsaved until the 0.5 s pause, or Ctrl+S). */
async function type(page, text) {
  await line(page).click();
  await page.keyboard.press('Control+End'); // the end of the text, even when the line wraps
  await page.keyboard.type(text);
}
const saveNow = (page) => page.keyboard.press('Control+s');
/** A has unsaved typing when B saves: both type at once, then B saves at once (before A's pause ends). */
async function bothTypeBSaves(a, aText, b, bText) {
  await Promise.all([line(a).click(), line(b).click()]);
  await Promise.all([a.keyboard.press('Control+End'), b.keyboard.press('Control+End')]);
  await Promise.all([a.keyboard.type(aText), b.keyboard.type(bText)]);
  await saveNow(b);
}
const dialog = (page) => page.locator('dialog.sc-modal');
/** The stored record of the open script, read straight from IndexedDB in `page`. */
const stored = (page) => page.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open('draftline_db', 1);
  r.onsuccess = () => {
    const db = r.result;
    const t = db.transaction(['projects', 'settings']);
    const g = t.objectStore('settings').get('activeProjectId');
    g.onsuccess = () => {
      const p = t.objectStore('projects').get(g.result.value);
      p.onsuccess = () => resolve(p.result || null);
    };
  };
}));
const dialogueIn = (rec) => (rec.script || []).find((b) => b.text?.startsWith('We go now'))?.text;
const snapshotTexts = (rec) => (rec.revisions || []).map((r) => (r.script || []).find((b) => b.text?.startsWith('We go now'))?.text);

describe('the same script in two tabs', () => {
  it('a tab with nothing unsaved takes the other tab’s save in place: no dialog, caret kept, one quiet note', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      await line(a).click(); // A: caret in the dialogue line, nothing typed
      await a.keyboard.press('Home');
      await type(b, ' B1');
      await saveNow(b);
      await type(b, ' B2');
      await saveNow(b);
      await a.waitForTimeout(800);
      assert.equal(await dialogue(a), `${LINE} B1 B2`, 'A shows B’s version');
      assert.equal(await dialog(a).count(), 0, 'no dialog');
      assert.equal(await a.locator('.toast', { hasText: 'Updated with changes from another tab' }).count(), 1);
      const caret = await a.evaluate(() => ({ inLine: document.activeElement?.value?.startsWith('We go now'), at: document.activeElement?.selectionStart }));
      assert.deepEqual(caret, { inLine: true, at: 0 }, 'caret where it was');
      await a.keyboard.press('Control+z');
      await a.waitForTimeout(200);
      assert.equal(await dialogue(a), `${LINE} B1 B2`, 'no undo step back into the older version');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('both have unsaved changes: Keep this version keeps it, the other tab’s is a snapshot; the other tab follows', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      await bothTypeBSaves(a, ' A-mine', b, ' B-theirs'); // unsaved in A when B saves
      await dialog(a).waitFor();
      assert.match(await dialog(a).textContent(), /changed in another tab/);
      await a.waitForTimeout(900);
      assert.equal(dialogueIn(await stored(a)), `${LINE} B-theirs`, 'A saved nothing while asking');
      await dialog(a).getByRole('button', { name: 'Keep this version' }).click();
      await a.locator('.toast', { hasText: 'Kept this version' }).waitFor();
      const rec = await stored(a);
      assert.equal(dialogueIn(rec), `${LINE} A-mine`);
      assert.ok(snapshotTexts(rec).includes(`${LINE} B-theirs`), 'B’s version is a snapshot');
      await b.waitForTimeout(700);
      assert.equal(await dialogue(b), `${LINE} A-mine`, 'B (nothing unsaved) follows');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('Use the other tab’s version: it opens here, this tab’s version is a snapshot (Plan and schedule too)', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile({ dark: true });
    try {
      const b = await tab(ctx, errors, 'B');
      // A: a shooting day (Plan) and a script edit, unsaved…
      await a.locator('.ws-switch [data-workspace="plan"]').click();
      await a.locator('.plan-seg [aria-label="Stripboard"]').click();
      await a.locator('.btn-plan-day').click();
      await a.locator('.ws-switch [data-workspace="write"]').click();
      await bothTypeBSaves(a, ' A-mine', b, ' B-theirs');
      await dialog(a).waitFor();
      await dialog(a).getByRole('button', { name: 'Use the other tab’s version' }).click();
      await a.locator('.toast', { hasText: 'Opened the other tab’s version' }).waitFor();
      assert.equal(await dialogue(a), `${LINE} B-theirs`);
      const rec = await stored(a);
      const mine = rec.revisions.find((r) => /This tab’s version/.test(r.label));
      assert.equal(mine.script.find((x) => x.text?.startsWith('We go now')).text, `${LINE} A-mine`);
      assert.equal(mine.production?.schedule?.days?.length, 1, 'the snapshot holds the schedule');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a third tab saving while the dialog is open: the dialog follows it, and the choice keeps every version', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      const c = await tab(ctx, errors, 'C');
      await bothTypeBSaves(a, ' A-mine', b, ' B-theirs');
      await dialog(a).waitFor();
      await c.waitForFunction((t) => [...document.querySelectorAll('.sheet textarea')].some((x) => x.value === t), `${LINE} B-theirs`); // C (clean) has taken B's version
      await type(c, ' C-later');
      await saveNow(c);
      await a.waitForTimeout(700);
      await dialog(a).getByRole('button', { name: 'Keep this version' }).click();
      await a.locator('.toast', { hasText: /Kept this version|changed again/ }).waitFor();
      if (await dialog(a).count()) await dialog(a).getByRole('button', { name: 'Keep this version' }).click(); // asked again
      await a.waitForTimeout(400);
      const rec = await stored(a);
      assert.equal(dialogueIn(rec), `${LINE} A-mine`);
      assert.ok(snapshotTexts(rec).includes(`${LINE} B-theirs C-later`), `C's version kept: ${JSON.stringify(snapshotTexts(rec))}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a word mid-composition, or a field being typed in, is never replaced: the newer version waits', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      await line(a).click();
      await a.evaluate(() => document.activeElement.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
      await type(b, ' B1');
      await saveNow(b);
      await a.waitForTimeout(900);
      assert.equal(await dialogue(a), LINE, 'not while composing');
      await a.evaluate(() => document.activeElement.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
      await a.waitForTimeout(900);
      assert.equal(await dialogue(a), `${LINE} B1`, 'taken once the word is done');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('both save in the same instant: one wins, the other asks, and both versions survive', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      await type(a, ' A-same');
      await type(b, ' B-same');
      await Promise.all([saveNow(a), saveNow(b)]);
      await a.waitForTimeout(900);
      const asking = [(await dialog(a).count()) ? a : null, (await dialog(b).count()) ? b : null].filter(Boolean);
      assert.equal(asking.length, 1, 'exactly one tab asks');
      await dialog(asking[0]).getByRole('button', { name: 'Keep this version' }).click();
      await asking[0].waitForTimeout(500);
      const rec = await stored(a);
      const all = [dialogueIn(rec), ...snapshotTexts(rec)];
      assert.ok(all.includes(`${LINE} A-same`) && all.includes(`${LINE} B-same`), JSON.stringify(all));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('a tab closed with unsaved changes after the other saved: they come back as a snapshot, once', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      await bothTypeBSaves(a, ' A-unsaved', b, ' B-saved'); // A asks (B saved), and saves nothing…
      await dialog(a).waitFor();
      await a.close({ runBeforeUnload: true }); // …then closes: its journal keeps the work
      await b.close();
      const c = await tab(ctx, errors, 'C');
      await c.locator('.toast', { hasText: 'kept as a snapshot' }).waitFor();
      const rec = await stored(c);
      assert.equal(dialogueIn(rec), `${LINE} B-saved`, 'the saved version stays');
      assert.equal(snapshotTexts(rec).filter((x) => x === `${LINE} A-unsaved`).length, 1);
      const d = await tab(ctx, errors, 'D');
      await d.waitForTimeout(500);
      assert.equal(snapshotTexts(await stored(d)).filter((x) => x === `${LINE} A-unsaved`).length, 1, 'not again');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('deleted in another tab: asked, never brought back on its own; Restore brings it back', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      await type(a, ' A-unsaved');
      // B deletes it (as the Projects drawer does), and says so
      await b.evaluate(() => new Promise((resolve) => {
        const r = indexedDB.open('draftline_db', 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['projects', 'settings'], 'readwrite');
          tx.objectStore('settings').get('activeProjectId').onsuccess = (e) => {
            const id = e.target.result.value;
            tx.objectStore('projects').delete(id);
            tx.oncomplete = () => { new BroadcastChannel('draftline-projects').postMessage({ type: 'deleted', id, from: 'B' }); resolve(); };
          };
        };
      }));
      await dialog(a).waitFor();
      assert.match(await dialog(a).textContent(), /was deleted in another tab/);
      assert.match(await dialog(a).textContent(), /Discard these changes/);
      await a.waitForTimeout(800);
      assert.equal(await stored(a), null, 'not brought back by an autosave');
      await dialog(a).getByRole('button', { name: 'Restore it' }).click();
      await a.locator('.toast', { hasText: 'Restored' }).waitFor();
      assert.equal(dialogueIn(await stored(a)), `${LINE} A-unsaved`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  it('an older DraftLine (or anything) writing behind this tab’s back: a stale save is refused, not written over it', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      // Locked by a write this tab hears nothing about (no message: as an older build would).
      await a.evaluate(() => new Promise((resolve) => {
        const r = indexedDB.open('draftline_db', 1);
        r.onsuccess = () => {
          const tx = r.result.transaction(['projects', 'settings'], 'readwrite');
          tx.objectStore('settings').get('activeProjectId').onsuccess = (e) => {
            const store = tx.objectStore('projects');
            store.get(e.target.result.value).onsuccess = (g) => {
              const rec = g.target.result;
              store.put({ ...rec, isLocked: true, updatedAt: rec.updatedAt + 5000 }); // writeId carried over, as an older build does
            };
          };
          tx.oncomplete = resolve;
        };
      }));
      await type(a, ' A-stale');
      await saveNow(a);
      await dialog(a).waitFor();
      const rec = await stored(a);
      assert.equal(rec.isLocked, true);
      assert.equal(dialogueIn(rec), LINE, 'not written over');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});

describe('different scripts in two tabs', () => {
  it('stay fully editable, with no dialog', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, a, errors } = await profile();
    try {
      const b = await tab(ctx, errors, 'B');
      await b.locator('input[type=file]').first().setInputFiles(SCRIPT); // B opens another script (a copy)
      await b.waitForTimeout(1200);
      await type(a, ' A-own');
      await type(b, ' B-own');
      await Promise.all([saveNow(a), saveNow(b)]);
      await a.waitForTimeout(1200);
      assert.equal(await dialog(a).count() + await dialog(b).count(), 0);
      assert.equal(await dialogue(a), `${LINE} A-own`);
      assert.equal(await dialogue(b), `${LINE} B-own`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
});
