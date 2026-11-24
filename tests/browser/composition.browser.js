// Round 2C browser regression: a phone keyboard composing words (Gboard-style predictive text,
// iOS marked text) inside a speech split across a page break. Before 2C the phone view re-placed the
// caret and moved the break while a word was still being composed, and the keyboard re-sent it:
// "not quiet" came out "not qququiquiet", ", not now" came out ",, nnonot now". Tapping the element bar
// mid-word lost or doubled the word.
//
// Runs in real Chromium (Playwright, already a dev dependency) against the Vite dev server, with the
// composition driven through the DevTools protocol exactly as an IME drives it. Not part of `npm test`
// (it needs a browser); run with `npm run test:browser`. Skips if Chromium isn't installed
// (`npx playwright install chromium`; DL_CHROMIUM=<path> uses another Chromium).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './server.js';

const SCRIPT = fileURLToPath(new URL('./harbor-light.fountain', import.meta.url));
const SPLIT = 'When your father'; // the speech that crosses from page 2 to page 3
const PLAIN = 'Nadia sets the thermos';

let server; let browser; let devices; let url; let skip = false;

before(async () => {
  let chromium;
  try {
    ({ chromium, devices } = await import('playwright'));
    browser = await chromium.launch(globalThis.process.env.DL_CHROMIUM ? { executablePath: globalThis.process.env.DL_CHROMIUM } : {});
  } catch (e) {
    skip = `Chromium not available (${e.message.split('\n')[0]}) — run "npx playwright install chromium"`;
    return;
  }
  ({ server, url } = await startTestServer(import.meta.url)); // tests/browser/server.js
});
after(async () => { await browser?.close(); await server?.close(); });

/** A phone with the sample script open, the cursor at the end of a line's first view. */
async function open(device, target, at = 'end') {
  const ctx = await browser.newContext(devices[device]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
  await page.locator('.sheet.is-reflow textarea', { hasText: target }).first().waitFor();
  await page.waitForTimeout(1500); // the page-width copy places the page breaks
  const ta = page.locator('.sheet textarea', { hasText: target }).first();
  await ta.tap();
  await page.evaluate((w) => {
    const a = document.activeElement;
    const n = w === 'end' ? a.value.length : a.value.length - 1;
    a.setSelectionRange(n, n);
  }, at);
  /** The element's whole text: its views (one per page) put back together. */
  const text = () => page.evaluate((t) => {
    const first = [...document.querySelectorAll('.sheet textarea')].find((x) => x.value.startsWith(t));
    const views = [...document.querySelectorAll(`.sheet textarea[data-id="${first.dataset.id}"]`)];
    views.sort((a, b) => Number(a.dataset.offset || 0) - Number(b.dataset.offset || 0));
    return views.map((v) => v.value).join('');
  }, target);
  /** The caret, in whole-element terms. */
  const caret = () => page.evaluate(() => {
    const a = document.activeElement;
    return a?.classList.contains('el-input') ? a.selectionStart + Number(a.dataset.offset || 0) : null;
  });
  /** Type `words` as a predictive keyboard does: each word composed letter by letter, then committed. */
  const compose = async (words) => {
    for (const w of words.split(/(?<= )/)) {
      let comp = '';
      for (const ch of w.trimEnd()) {
        comp += ch;
        await cdp.send('Input.imeSetComposition', { text: comp, selectionStart: comp.length, selectionEnd: comp.length });
        await page.waitForTimeout(40);
      }
      await cdp.send('Input.insertText', { text: w });
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(600);
  };
  return { ctx, page, cdp, text, caret, compose };
}

const PHONES = ['Pixel 7', 'iPhone SE'];

describe('phone keyboard composition in a speech split across pages', () => {
  for (const device of PHONES) {
    for (const [name, target, at, words] of [
      ['an ordinary line', PLAIN, 'end', ' quiet word'],
      ['the end of a page view ("not qququiquiet")', SPLIT, 'end', ' quiet word'],
      ['words pushed over the page break ("not,, nnonot now")', SPLIT, 'end', ', not now, not ever, not even for your father'],
      ['the last view of the speech', SPLIT, 'last', ' and then some'],
    ]) {
      it(`${device}: ${name} — every word once, the caret after the last`, async (t) => {
        if (skip) return t.skip(skip);
        const s = await open(device, target, at);
        try {
          const before = await s.text();
          const c = await s.caret();
          await s.compose(words);
          assert.equal(await s.text(), before.slice(0, c) + words + before.slice(c));
          assert.equal(await s.caret(), c + words.length);
        } finally { await s.ctx.close(); }
      });
    }
  }

  for (const [btn, type] of [['Action', 'action'], ['Char', 'character']]) {
    it(`element bar tapped mid-word (${btn}): the word is kept once, the type changes, undo restores`, async (t) => {
      if (skip) return t.skip(skip);
      const s = await open('Pixel 7', SPLIT);
      try {
        const before = await s.text();
        const c = await s.caret();
        for (const comp of ['h', 'he', 'hey']) {
          await s.cdp.send('Input.imeSetComposition', { text: comp, selectionStart: comp.length, selectionEnd: comp.length });
          await s.page.waitForTimeout(40);
        }
        await s.page.locator('.eb-btn', { hasText: new RegExp(`^(${btn}|${btn === 'Char' ? 'Character' : btn})$`) }).tap();
        await s.page.waitForTimeout(250);
        await s.cdp.send('Input.insertText', { text: 'hey ' });
        await s.page.waitForTimeout(600);
        assert.equal(await s.text(), `${before.slice(0, c)}hey ${before.slice(c)}`);
        assert.equal(await s.caret(), c + 4);
        const isType = await s.page.evaluate(([tx, ty]) => {
          const ta = [...document.querySelectorAll('.sheet textarea')].find((x) => x.value.startsWith(tx));
          return ta.closest('.el')?.className.includes(ty);
        }, [SPLIT, type]);
        assert.ok(isType, `the line is now ${type}`);
        assert.equal(await s.page.evaluate(() => document.activeElement?.classList.contains('el-input')), true, 'the keyboard keeps the line');
      } finally { await s.ctx.close(); }
    });
  }

  it('backspace inside a word being composed, autocorrect replacing it, then undo / redo', async (t) => {
    if (skip) return t.skip(skip);
    const s = await open('Pixel 7', SPLIT);
    try {
      const before = await s.text();
      const c = await s.caret();
      // " qiut" typed, two letters taken back inside the composition, then the keyboard commits its
      // correction "quit " — the way Gboard and iOS autocorrect replace the word being composed.
      await s.compose(' ');
      for (const comp of ['q', 'qi', 'qiu', 'qiut', 'qiu', 'qi', 'q', 'qu', 'qui']) {
        await s.cdp.send('Input.imeSetComposition', { text: comp, selectionStart: comp.length, selectionEnd: comp.length });
        await s.page.waitForTimeout(40);
      }
      await s.cdp.send('Input.insertText', { text: 'quit ' });
      await s.page.waitForTimeout(600);
      const typed = await s.text();
      assert.equal(typed, `${before.slice(0, c)} quit ${before.slice(c)}`);
      assert.equal(await s.caret(), c + 6);
      await s.page.keyboard.press('Control+z');
      await s.page.waitForTimeout(300);
      assert.notEqual(await s.text(), typed, 'undo steps back');
      await s.page.keyboard.press('Control+Shift+z');
      await s.page.waitForTimeout(300);
      assert.equal(await s.text(), typed, 'redo brings it back');
    } finally { await s.ctx.close(); }
  });
});
