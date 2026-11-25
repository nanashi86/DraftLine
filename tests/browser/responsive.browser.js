// The shared header and the Stripboard on phones, tablets and desktops (Write and Plan): nothing in the
// header overlaps (the title's ▾ never runs under the Write | Plan switch), nothing scrolls sideways,
// + Shooting Day shortens to "+ Day" and then a calendar-plus (always "Add shooting day" to assistive
// tech, and 44px tall to a finger like every bar button), the Stripboard summary keeps to its
// essentials on phones, and the strips' columns keep apart. On desktops Write's bar shows each control only
// where it has room (Element ▾ · B I U S from 1366px, Story Bible from 1496px, Snapshot's label from 1552px):
// never clipped, the title's ▾ always its full distance from Write | Plan, formatting in exactly one place.
//
// Run with: node --test tests/browser/responsive.browser.js  (skips when no Chromium is installed)
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

/** What the header and the Stripboard look like right now. */
const layout = (page) => page.evaluate(() => {
  const shown = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  const header = document.querySelector('header.bar');
  const controls = [...header.querySelectorAll('button, input')].filter(shown).map((el) => ({ el, r: el.getBoundingClientRect() })).filter((c) => c.r.width);
  const overlaps = [];
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i].r; const b = controls[j].r;
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) {
        overlaps.push(`${controls[i].el.className} × ${controls[j].el.className}`);
      }
    }
  }
  const chevron = document.querySelector('.doc-switch-btn').getBoundingClientRect();
  const toggle = document.querySelector('.ws-switch').getBoundingClientRect();
  const day = document.querySelector('.btn-plan-day');
  const summary = document.querySelector('.plan-summary');
  const head = document.querySelector('.strip-head');
  const rows = [...document.querySelectorAll('.strip:not(.strip-head)')].slice(0, 8);
  const spills = rows.filter((row) => {
    const cells = [...row.children].filter(shown).map((c) => c.getBoundingClientRect());
    return cells.some((c, i) => i > 0 && c.left < cells[i - 1].right - 0.5);
  }).length;
  const visibleText = (el) => [...el.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : shown(n) ? n.textContent : '')).join('');
  return {
    overlaps,
    chevronGap: toggle.left - chevron.right,
    chevronShown: chevron.width > 0 && chevron.right <= innerWidth,
    sideways: document.documentElement.scrollWidth > innerWidth || header.scrollWidth > header.clientWidth + 1,
    day: day ? { name: day.getAttribute('aria-label'), label: shown(day.querySelector('.day-long')) ? 'Shooting Day' : shown(day.querySelector('.day-short')) ? 'Day' : shown(day.querySelector('.day-icon')) ? 'icon' : '?', box: day.getBoundingClientRect() } : null,
    summary: summary ? { text: visibleText(summary).trim(), sideways: summary.scrollWidth > summary.clientWidth + 1 } : null,
    headRows: head ? new Set([...head.children].filter(shown).map((c) => Math.round(c.getBoundingClientRect().top))).size : null,
    castHeading: head ? shown(head.querySelector('.strip-cast')) : null,
    castCells: rows.some((r) => shown(r.querySelector('.strip-cast'))),
    spills,
  };
});

async function openPlan(page) {
  await page.locator('.ws-switch [data-workspace="plan"]').click();
  await page.waitForTimeout(300);
  const seg = page.locator('.plan-seg [aria-label="Stripboard"]').first();
  if (await seg.isVisible()) await seg.click();
  else {
    await page.locator('.btn-kebab').click();
    await page.getByRole('menuitem', { name: /^Stripboard/ }).click();
  }
  await page.locator('.strip-head').first().waitFor();
}

const WIDTHS = [
  { w: 320, scheme: 'dark', day: 'icon', more: false },
  { w: 390, scheme: 'dark', day: 'Day', more: false },
  { w: 430, scheme: 'light', day: 'Day', more: false },
  { w: 1440, scheme: 'dark', day: 'Shooting Day', more: true },
];

describe('the header and the Stripboard at phone, tablet and desktop widths', () => {
  for (const { w, scheme, day, more } of WIDTHS) {
    it(`${w}px, ${scheme}: no overlap or sideways scroll, + ${day}, a tidy summary and strips`, async (t) => {
      if (skip) return t.skip(skip);
      const phone = w < 768;
      const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, colorScheme: scheme, isMobile: phone, hasTouch: phone });
      const errors = [];
      try {
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
        await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
        await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
        for (const title of ['Run!', 'What Happened to Haiti? The Long Way Home']) {
          await page.locator('.doc-title').fill(title);
          await page.evaluate(() => document.activeElement?.blur());
          const write = await layout(page);
          assert.deepEqual(write.overlaps, [], `Write, “${title}”`);
          assert.ok(write.chevronGap >= 2 && write.chevronShown, `Write: the ▾ clear of Write | Plan (${write.chevronGap}px)`);
          assert.equal(write.sideways, false, 'Write: nothing sideways');
        }
        await openPlan(page);
        for (const title of ['Run!', 'What Happened to Haiti? The Long Way Home']) {
          await page.locator('.doc-title').fill(title);
          await page.evaluate(() => document.activeElement?.blur());
          await page.waitForTimeout(100);
          const plan = await layout(page);
          assert.deepEqual(plan.overlaps, [], `Plan, “${title}”`);
          assert.ok(plan.chevronGap >= 2 && plan.chevronShown, `Plan: the ▾ clear of Write | Plan (${plan.chevronGap}px)`);
          assert.equal(plan.sideways, false, 'Plan: nothing sideways');
          if (phone && title.length > 20) {
            const tr = await page.locator('.doc-title').evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow);
            assert.equal(tr, 'ellipsis', 'a long title, cut short, ends in …');
          }
        }
        const plan = await layout(page);
        assert.equal(plan.day.name, 'Add shooting day');
        assert.equal(plan.day.label, day);
        if (phone) {
          assert.ok(plan.day.box.width >= 32 && plan.day.box.height >= 32, 'a finger-sized button');
          // …and on a touch screen a tap just above or below it still lands on it (the bar's 44px touch layer)
          const reach = await page.evaluate(() => {
            const b = document.querySelector('.btn-plan-day').getBoundingClientRect();
            const hit = (y) => document.elementFromPoint(b.left + b.width / 2, y)?.closest('.btn-plan-day') != null;
            return { above: hit(b.top - 5), below: hit(b.bottom + 5), tall: b.height + 10 };
          });
          assert.ok(reach.above && reach.below, `the tap area reaches past the icon (${reach.tall}px tall)`);
        }
        assert.equal(plan.summary.sideways, false, 'the summary never scrolls sideways');
        assert.match(plan.summary.text, /^\d+ scenes · [\d /]+ pages/);
        assert.equal(/come from the script/.test(plan.summary.text), more, more ? 'the explanation on wide screens' : 'phones: just scenes · pages');
        assert.equal(plan.headRows, 1, 'every column heading on one line');
        assert.equal(plan.castHeading, plan.castCells, 'the Cast heading shows exactly when its column does');
        assert.equal(plan.spills, 0, 'no strip cell runs into the next');
        if (phone) {
          await page.locator('.btn-plan-day').click(); // still works
          await page.locator('.strip-break').first().waitFor();
        }
        assert.deepEqual(errors, []);
      } finally {
        await ctx.close();
      }
    });
  }
});

describe('Write on desktops: each control on the bar only where it fits', () => {
  // 1200–1310px once put the title's ▾ under Write | Plan; 1440–1549px crushed the space between them.
  const SIZES = [
    { w: 1250, fmt: 'row' }, { w: 1310, fmt: 'row' }, { w: 1340, fmt: 'row' }, { w: 1365, fmt: 'row' },
    { w: 1366, fmt: 'bar' }, { w: 1440, fmt: 'bar' }, { w: 1460, fmt: 'bar' }, { w: 1505, fmt: 'bar' }, { w: 1520, fmt: 'bar' }, { w: 1600, fmt: 'bar' },
  ];
  for (const scheme of ['dark', 'light']) {
    it(`${scheme}: no overlap, nothing clipped, formatting in one place, the title’s ▾ clear`, async (t) => {
      if (skip) return t.skip(skip);
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 800 }, colorScheme: scheme });
      const errors = [];
      try {
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`${url}?dev=true`, { waitUntil: 'load' });
        await page.locator('input[type=file]').first().setInputFiles(SCRIPT);
        await page.locator('.sheet textarea', { hasText: 'Mist over the water' }).first().waitFor();
        for (const title of ['Run!', 'What Happened to Haiti? The Long Way Home']) {
          await page.locator('.doc-title').fill(title);
          await page.evaluate(() => document.activeElement?.blur());
          for (const { w, fmt } of SIZES) {
            await page.setViewportSize({ width: w, height: 800 });
            await page.waitForTimeout(60);
            const at = `${w}px, “${title.slice(0, 12)}”`;
            const l = await layout(page);
            assert.deepEqual(l.overlaps, [], at);
            assert.equal(l.sideways, false, at);
            assert.ok(l.chevronGap >= 24, `${at}: the ▾ its full distance from Write | Plan (${Math.round(l.chevronGap)}px)`);
            const f = await page.evaluate(() => {
              const shown = (el) => !!el && el.offsetParent !== null;
              const tools = document.querySelector('.zone-middle-tools').getBoundingClientRect();
              const right = document.querySelector('.zone-right').getBoundingClientRect();
              const inBar = shown(document.querySelector('.bar .g-format'));
              const row = document.querySelector('.write-tools');
              const parts = [...document.querySelectorAll('.bar .g-format button, .bar .g-format .type-select')].filter(shown).map((b) => b.getBoundingClientRect());
              return {
                where: inBar ? 'bar' : 'row',
                both: inBar && shown(row) && !!row.querySelector('.fmt-btn, .type-select'),
                clipped: parts.filter((r) => r.right > tools.right + 0.5 || r.right > right.left + 0.5).length,
                rowHeight: shown(row) ? Math.round(row.getBoundingClientRect().height) : 0,
                bold: [...document.querySelectorAll('[aria-label="Bold"], [title^="Bold"]')].filter(shown).length,
              };
            });
            assert.equal(f.where, fmt, `${at}: Element and B I U S on the ${fmt}`);
            assert.equal(f.both, false, `${at}: one copy only`);
            assert.equal(f.clipped, 0, `${at}: no formatting control clipped`);
            if (fmt === 'row') assert.ok(f.rowHeight > 0 && f.rowHeight <= 48, `${at}: one compact row (${f.rowHeight}px)`);
            assert.ok(f.bold >= 1, `${at}: Bold is reachable`);
          }
        }
        assert.deepEqual(errors, []);
      } finally {
        await ctx.close();
      }
    });
  }
});
