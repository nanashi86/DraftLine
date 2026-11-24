// Stage 2, Phase 0A: the Stripboard as it is before Scheduling, locked down so Scheduling can be
// built around it without changing it. A project with no shooting days must keep showing exactly this.
//
// For each case (Editorial Light and Espresso Noir · desktop and phone · unfiltered and filtered) the
// test opens tests/browser/stripboard-fixture.fountain (MOVING, FLASHBACK, DREAM, CONTINUOUS,
// MOMENTS LATER, LATER, INT./EXT., EXT./INT., I/E, EST., a forced heading without INT./EXT., a heading
// without a time of day, (V.O.) / (O.S.) / (CONT'D) cues), goes to Plan → Stripboard and records:
//   - the summary line, the colour legend, the column headers;
//   - every strip: its classes, role, title, and each cell's class, text and title;
//   - each strip colour's computed background, text colour and fonts;
//   - on desktop, the column positions and widths (the grid is fixed, so they don't depend on fonts).
// It compares them with the JSON baselines in tests/browser/baselines/stripboard/ (the same on every
// computer), and the screenshots with baselines/stripboard/<platform>/ (pixels differ between
// operating systems, so each records its own the first time). A click on a strip must still open that
// scene in Write.
//
// Not part of `npm test` (it needs a browser): `npm run test:browser`. Missing baselines are recorded;
// DL_UPDATE_BASELINE=1 re-records them all (only after a change has been reviewed and approved).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { startTestServer } from './server.js';
import { diffPixels, judgePixels } from './pixels.js';

const SCRIPT = fileURLToPath(new URL('./stripboard-fixture.fountain', import.meta.url));
const BASE = fileURLToPath(new URL('./baselines/stripboard/', import.meta.url));
const PIXELS = join(BASE, globalThis.process.platform);
const UPDATE = globalThis.process.env.DL_UPDATE_BASELINE === '1';

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

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

/** The fixture open in Plan → Stripboard, in `theme` on `device`. */
async function openStripboard(theme, device) {
  const ctx = await browser.newContext({
    ...(device === 'desktop' ? DESKTOP : devices[device]),
    colorScheme: theme === 'light' ? 'light' : 'dark', // the theme setting is System Default on a fresh browser
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
  await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
  await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
  await page.waitForTimeout(1200); // pagination settles (page lengths come from it)
  await page.locator('.ws-switch [data-workspace="plan"]').click();
  const tab = page.locator('.plan-seg [aria-label="Stripboard"]');
  if (await tab.isVisible()) {
    await tab.click();
  } else { // narrow windows and phones: the Plan views are in ⋮
    await page.locator('.btn-kebab').click();
    await page.getByRole('menuitem', { name: /^Stripboard/ }).click();
  }
  await page.locator('.plan-stripboard .strip:not(.strip-head)').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

/** Narrow the Stripboard: "FERRY" and Night only (whichever filter is showing: header or workspace). */
async function filter(page) {
  const box = page.locator('.plan-filter:visible').first();
  await box.locator('input[type=search]').fill('FERRY');
  await box.locator('.pf-btn', { hasText: /^night$/i }).click();
  await page.waitForTimeout(300);
}

/**
 * Before a screenshot: nothing left mid-change. The pointer leaves the page and focus leaves the
 * control last clicked, every CSS transition (the filter buttons' 120ms background, for one) has
 * finished, and two frames have been painted since. Without this, the NIGHT button just clicked was
 * still under the pointer, so Chromium could repaint it during the capture, and on Windows its
 * neighbour's rounded corners were then anti-aliased one or two colour steps differently from run to
 * run (5 pixels, x604–605 at the top and bottom of DAY | NIGHT). How the board looks is unchanged:
 * the button's hover look is covered by its selected look.
 */
async function settle(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    document.activeElement?.blur?.();
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/** Everything the Stripboard shows, as plain data. */
function capture(page, withGeometry) {
  return page.evaluate((geo) => {
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const board = document.querySelector('.plan-stripboard');
    const strips = [...board.querySelectorAll('.strips > .strip')];
    const style = (el) => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color, font: `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, minHeight: s.minHeight, radius: s.borderRadius };
    };
    const colors = {};
    for (const s of strips) {
      const key = [...s.classList].find((c) => c.startsWith('strip-') && c !== 'strip-head') || 'strip-head';
      if (colors[key]) continue;
      const num = s.querySelector('.strip-num');
      const loc = s.querySelector('.strip-loc');
      const mod = s.querySelector('.strip-mod');
      colors[key] = {
        strip: style(s),
        num: num ? getComputedStyle(num).font : null,
        loc: loc ? getComputedStyle(loc).font : null,
        mod: mod ? { font: getComputedStyle(mod).font, border: getComputedStyle(mod).borderTopStyle, opacity: getComputedStyle(mod).opacity } : null,
      };
    }
    const out = {
      summary: txt(document.querySelector('.plan-summary')),
      legend: [...board.querySelectorAll('.strip-legend .strip-key')].map((k) => ({ text: txt(k), swatch: k.querySelector('.strip-swatch')?.className })),
      table: { role: board.querySelector('.strips')?.getAttribute('role'), label: board.querySelector('.strips')?.getAttribute('aria-label') },
      strips: strips.map((s) => ({
        tag: s.tagName.toLowerCase(),
        className: s.className,
        role: s.getAttribute('role'),
        title: s.getAttribute('title'),
        cells: [...s.children].map((c) => ({ className: c.className, role: c.getAttribute('role'), text: txt(c), title: c.getAttribute('title'), html: c.innerHTML.replace(/\s+/g, ' ') })),
      })),
      colors,
    };
    if (geo) {
      const first = strips.find((s) => !s.classList.contains('strip-head'));
      const r0 = first.getBoundingClientRect();
      out.geometry = {
        board: Math.round(board.getBoundingClientRect().width),
        strip: { width: Math.round(r0.width), height: Math.round(r0.height) },
        columns: [...first.children].map((c) => {
          const r = c.getBoundingClientRect();
          return { x: Math.round(r.left - r0.left), width: Math.round(r.width) };
        }),
        gap: Math.round(strips[2].getBoundingClientRect().top - strips[1].getBoundingClientRect().bottom),
      };
    }
    return out;
  }, withGeometry);
}

function compareJson(name, actual) {
  const file = join(BASE, `${name}.json`);
  if (UPDATE || !existsSync(file)) {
    mkdirSync(BASE, { recursive: true });
    writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    return 'recorded';
  }
  assert.deepEqual(actual, JSON.parse(readFileSync(file, 'utf8')), `${name}: the Stripboard changed (DOM, text, classes or styles)`);
  return 'matched';
}

async function comparePixels(page, name, png) {
  const file = join(PIXELS, `${name}.png`);
  if (UPDATE || !existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, png);
    return 'recorded';
  }
  const expected = readFileSync(file);
  if (Buffer.compare(png, expected) === 0) return 'matched';
  // Not byte-identical: within the anti-aliasing limits (tests/browser/pixels.js), or a real change.
  const facts = await diffPixels(page, png, expected);
  const verdict = judgePixels(facts);
  if (verdict.ok) return `matched within tolerance: ${verdict.why}`;
  const saved = saveDiff(name, png, expected, facts);
  assert.fail(`${name}: the Stripboard's pixels changed (see ${file}): ${verdict.why}\n${saved}`);
}

/**
 * A failure's evidence, for diagnosis: tests/browser/.debug/<name>-actual.png, -expected.png,
 * -diff.png (changed pixels in magenta over a faded copy of the actual) and -diff.json (sizes, how many
 * pixels changed, where and by how much).
 */
function saveDiff(name, actual, expected, facts) {
  const dir = fileURLToPath(new URL('./.debug/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}-actual.png`), actual);
  writeFileSync(join(dir, `${name}-expected.png`), expected);
  writeFileSync(join(dir, `${name}-diff.png`), Buffer.from(facts.diff, 'base64'));
  const info = { ...facts };
  delete info.diff;
  writeFileSync(join(dir, `${name}-diff.json`), `${JSON.stringify(info, null, 2)}\n`);
  return `Saved in tests/browser/.debug/: ${name}-actual.png, -expected.png, -diff.png. ${JSON.stringify(info)}`;
}

// Toasts ("Opened … as a new project") float over the board for a few seconds: not part of it.
const shoot = (board) => board.screenshot({ animations: 'disabled', caret: 'hide', style: '.toast, [role="status"].toast { visibility: hidden !important; }' });

const CASES = [];
for (const theme of ['light', 'dark']) {
  for (const device of ['desktop', 'Pixel 7']) {
    for (const filtered of [false, true]) CASES.push({ theme, device, filtered });
  }
}
const caseName = ({ theme, device, filtered }) => `${theme}-${device === 'desktop' ? 'desktop' : 'phone'}-${filtered ? 'filtered' : 'all'}`;

describe('Stripboard baseline (before Scheduling): nothing about it may change', () => {
  for (const c of CASES) {
    it(`${caseName(c)}: same DOM, text, classes, styles${c.device === 'desktop' ? ', column geometry' : ''} and pixels`, async (t) => {
      if (skip) return t.skip(skip);
      const { ctx, page, errors } = await openStripboard(c.theme, c.device);
      try {
        if (c.filtered) await filter(page);
        const data = await capture(page, c.device === 'desktop');
        assert.ok(data.strips.length > 1, 'strips are showing');
        const json = compareJson(caseName(c), data);
        await settle(page);
        const board = page.locator('.plan');
        const png = await shoot(board);
        const pixels = await comparePixels(page, caseName(c), png);
        assert.deepEqual(errors, [], 'no page errors');
        t.diagnostic(`json ${json} · pixels ${pixels}`);
      } finally { await ctx.close(); }
    });
  }

  it('the fixture covers what the Stripboard has to show', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, page } = await openStripboard('dark', 'desktop');
    try {
      const data = await capture(page, false);
      const rows = data.strips.filter((s) => !s.className.includes('strip-head'));
      const all = JSON.stringify(rows);
      for (const want of ['MOVING', 'FLASHBACK', 'DREAM', 'INT/EXT', 'EXT/INT', 'strip-unknown', 'strip-int-day', 'strip-ext-day', 'strip-int-night', 'strip-ext-night']) {
        assert.ok(all.includes(want), `fixture shows ${want}`);
      }
      assert.equal(rows.length, 14, 'one strip per scene');
      assert.deepEqual(rows.map((r) => r.cells[0].text), Array.from({ length: 14 }, (_, i) => String(i + 1)), 'script order, numbered 1–14');
      assert.ok(rows.some((r) => /^\d+( \d\/8)?$/.test(r.cells[4].text)), 'a scene a page or longer (whole pages in the length)');
      assert.ok(rows.some((r) => r.cells[5].text.includes(',')), 'a scene with several cast numbers');
      assert.match(data.summary, /^14 scenes · .* · cast, sluglines and lengths come from the script$/);
    } finally { await ctx.close(); }
  });

  it('a click on a strip still opens that scene in Write (scrolled into view and highlighted)', async (t) => {
    if (skip) return t.skip(skip);
    const { ctx, page } = await openStripboard('dark', 'desktop');
    try {
      await page.locator('.plan-stripboard .strip:not(.strip-head)').nth(4).click();
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.ws-switch [data-workspace="write"]').getAttribute('aria-checked'), 'true');
      const seen = await page.evaluate(() => {
        const ta = [...document.querySelectorAll('.sheet textarea')].find((x) => /CHILDHOOD HOME - KITCHEN/i.test(x.value));
        const el = ta?.closest('.el');
        const r = el?.getBoundingClientRect();
        return { found: !!el, inView: !!r && r.top >= 0 && r.bottom <= window.innerHeight, classes: el?.className || '' };
      });
      assert.ok(seen.found && seen.inView, 'the scene heading is on screen');
    } finally { await ctx.close(); }
  });
  // The tolerance (tests/browser/pixels.js) lets through anti-aliasing noise only. Real changes, made
  // on purpose here to the light desktop board, must still fail against its baseline: a strip colour
  // 3/255 off, a border colour on one small control, a one-pixel shift, a word of text, and a faint
  // change over a wide area. Nothing is saved; the baselines are only read.
  it('the pixel tolerance still catches real changes', async (t) => {
    if (skip) return t.skip(skip);
    const file = join(PIXELS, 'light-desktop-all.png');
    if (!existsSync(file)) return t.skip('no light-desktop-all baseline on this computer yet');
    const expected = readFileSync(file);
    const CHANGES = [
      ['a strip colour 3/255 off', (p) => p.evaluate(() => {
        const el = document.querySelector('.plan-stripboard .strip-ext-day');
        const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number);
        const style = document.createElement('style');
        style.textContent = `.plan-stripboard .strip-ext-day { background-color: rgb(${r > 3 ? r - 3 : r + 3}, ${g}, ${b}) !important; }`;
        document.head.append(style);
      })],
      ['one control’s border colour', (p) => p.addStyleTag({ content: '.pf-seg { border-color: #c4c4c4 !important; }' })],
      ['scene numbers one pixel to the right', (p) => p.addStyleTag({ content: '.strip-num { position: relative; left: 1px; }' })],
      ['one word of a slugline', (p) => p.evaluate(() => { document.querySelector('.strip-loc').textContent = 'HARBOUR'; })],
      ['a faint change over the whole board', (p) => p.addStyleTag({ content: '.plan-stripboard { opacity: 0.99; }' })],
    ];
    for (const [what, change] of CHANGES) {
      const { ctx, page } = await openStripboard('light', 'desktop');
      try {
        await change(page);
        await settle(page);
        const png = await shoot(page.locator('.plan'));
        const facts = await diffPixels(page, png, expected);
        const verdict = judgePixels(facts);
        assert.equal(verdict.ok, false, `${what} must fail, but passed: ${verdict.why}`);
        t.diagnostic(`${what}: fails (${verdict.why})`);
      } finally { await ctx.close(); }
    }
  });
});
