// Records a 1080p product showcase of DraftLine with Playwright (Chromium).
//
//   npm run dev                      # in one terminal: DraftLine at http://localhost:5173/DraftLine/
//   node scripts/record-demo.js      # in another: writes recordings/draftline-demo.webm
//
// The tour, in a clean browser profile (no saved scripts, nothing from your own browser):
//   1. A new script typed at human speed with the Tab / Enter flow: clean Courier Prime pages.
//   2. Format Doctor: two everyday slips (a scene heading typed as Action, THE END left-aligned),
//      the issue list, then Fix All.
//   3. Dialogue spotlight on the sample script: pick MARIE, everything else dims, scroll her pass.
//   4. The Scene Board (Write → Board) in 4 Acts and 3 Acts, then Plan → Breakdowns and Stripboard,
//      where every scene's length is worked out in eighths of a page.
//   5. Back to the page, link a folder, and the status bar's "Synced: <folder>" badge.
//
// Folder sync uses a stand-in folder held in memory (tests/helpers/fakeDirectory.js): Playwright can't
// drive the operating system's folder picker. DraftLine does exactly what it does with a real folder;
// nothing is written to your disk. DEMO_FOLDER=0 skips that step.
//
// Options (environment variables):
//   DEMO_URL       where DraftLine is running   (default http://localhost:5173/DraftLine/)
//   DEMO_OUT       the video file               (default recordings/draftline-demo.webm)
//   DEMO_FPS       frames per second            (default 60)
//   DEMO_HEADED=1  show the browser while it records
//   DEMO_FOLDER=0  leave out the folder-sync step
//   CHROMIUM_PATH  a Chromium to use instead of Playwright's own

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL_ = process.env.DEMO_URL || 'http://localhost:5173/DraftLine/';
const OUT = resolve(ROOT, process.env.DEMO_OUT || 'recordings/draftline-demo.webm');
const FPS = Number(process.env.DEMO_FPS) || 60;
const SIZE = { width: 1920, height: 1080 };
const WITH_FOLDER = process.env.DEMO_FOLDER !== '0';

// ---- the scene that gets typed ----------------------------------------------------------------
// [how to start the element, text]. 'enter' follows DraftLine's own flow (Scene → Action, Character →
// Dialogue, Dialogue → Action); 'tab' on an empty Action line starts a Character cue; 'enter-tab' after
// a cue goes to Dialogue and then turns that empty line into a Parenthetical. (Tab straight after a cue
// would cycle its extension: (O.S.), (V.O.)…) The two lines marked "slip" are typed as Action on
// purpose, for Format Doctor.
const SCENE = [
  ['start', 'EXT. LIGHTHOUSE - NIGHT'],
  ['enter', 'Wind screams through the broken lamp. MARIE (30s) climbs the last stairs.'],
  ['tab', 'MARIE'],
  ['enter', 'Theo? Are you up here?'],
  ['enter', 'Above her, THEO (20s) sits in the dark.'],
  ['tab', 'THEO'],
  ['enter-tab', 'from the dark'],
  ['enter', 'Close the door. Please.'],
  ['enter', 'int. lamp room - continuous'], // slip: a scene heading typed as Action
  ['enter', 'The door slams. Glass everywhere. Then: quiet.'],
  ['enter', 'THE END'], // slip: should be centered
];

// ---- helpers ----------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => min + Math.random() * (max - min);

/** A visible pointer for the video (Playwright's recorder doesn't capture the OS cursor), with a ripple on click. */
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__demo-cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none', transition: 'transform 60ms', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' });
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      c.style.transform = 'scale(.86)';
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 18 + 'px', top: e.clientY - 18 + 'px', width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #e8836b', zIndex: 2147483646, pointerEvents: 'none', opacity: '1', transition: 'transform 420ms ease-out, opacity 420ms ease-out' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.9)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 450);
    }, true);
    addEventListener('mouseup', () => { c.style.transform = ''; }, true);
  });`;

async function main() {
  // Is DraftLine running?
  try {
    const res = await fetch(URL_);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`DraftLine isn't reachable at ${URL_} (${err.message}). Start it with "npm run dev", or set DEMO_URL.`);
    process.exit(1);
  }

  const videoDir = join(dirname(OUT), '.raw');
  rmSync(videoDir, { recursive: true, force: true });
  mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.DEMO_HEADED !== '1',
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  // A fresh context is a clean profile: no saved scripts or settings from any earlier run.
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: SIZE, fps: FPS },
  });
  await context.addInitScript(CURSOR);
  if (WITH_FOLDER) {
    // The in-memory folder from the test helpers, answering the browser's folder picker.
    const fake = readFileSync(join(ROOT, 'tests/helpers/fakeDirectory.js'), 'utf8').replace(/^export function/m, 'function');
    await context.addInitScript(`${fake}\nwindow.showDirectoryPicker = async () => (window.__demoDir ||= createFakeDirectory('DraftLine Scripts'));`);
  }

  const page = await context.newPage();
  const mouse = { x: SIZE.width / 2, y: SIZE.height / 2 };

  /** Glide the pointer to an element (or a point) like a hand would. */
  const glide = async (target, { dx = 0, dy = 0 } = {}) => {
    let x; let y;
    if (Array.isArray(target)) [x, y] = target;
    else {
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      x = box.x + box.width / 2 + dx; y = box.y + box.height / 2 + dy;
    }
    const dist = Math.hypot(x - mouse.x, y - mouse.y);
    await page.mouse.move(x, y, { steps: Math.max(12, Math.round(dist / 14)) });
    mouse.x = x; mouse.y = y;
  };
  const click = async (locator, pause = 350) => {
    await glide(locator);
    await sleep(jitter(140, 260));
    await page.mouse.down(); await sleep(70); await page.mouse.up();
    await sleep(pause);
  };
  /** Type like a person: uneven key timing, a breath after punctuation. */
  const typeHuman = async (text) => {
    for (const ch of text) {
      await page.keyboard.type(ch);
      await sleep(/[.,?!:;]/.test(ch) ? jitter(90, 170) : ch === ' ' ? jitter(30, 70) : jitter(15, 40));
    }
  };
  const press = async (key, pause = 260) => { await page.keyboard.press(key); await sleep(pause); };
  const hold = (ms) => sleep(ms);
  const caption = (text) => console.log(`  ${text}`);

  // ---- 0. Open DraftLine ----------------------------------------------------------------------
  caption('Opening DraftLine (clean profile)');
  await page.goto(URL_);
  await page.locator('.el-input').first().waitFor();
  await page.mouse.move(mouse.x, mouse.y);
  await hold(2200);
  const closeChars = page.getByRole('button', { name: 'Close Characters' });
  if (await closeChars.isVisible()) await click(closeChars, 700);

  // ---- 1. A new script, typed -----------------------------------------------------------------
  caption('Typing a new scene');
  await click(page.getByRole('button', { name: /^File/ }), 500);
  await click(page.getByRole('menuitem', { name: /^New/ }), 900);
  // Title it first, then back into the first Scene Heading.
  const title = page.locator('input.doc-title');
  await click(title, 200);
  await press('ControlOrMeta+a', 120);
  await typeHuman('Night Crossing');
  await press('Enter', 300);
  await click(page.locator('.el-scene .el-input').first(), 400);
  for (const [how, text] of SCENE) {
    if (how === 'enter' || how === 'enter-tab') await press('Enter', jitter(220, 340));
    if (how === 'tab' || how === 'enter-tab') await press('Tab', jitter(220, 320));
    await typeHuman(text);
    await sleep(jitter(180, 300));
  }
  await glide([1660, 540]); // out of the way of the page
  await hold(2200);

  // ---- 2. Format Doctor -----------------------------------------------------------------------
  caption('Format Doctor: the findings, then Fix All');
  await click(page.getByRole('button', { name: 'More' }), 450);
  await click(page.getByRole('menuitem', { name: /^Format Doctor/ }), 900);
  const fixAll = page.getByRole('button', { name: /^Fix All/ });
  await glide(fixAll, { dx: -260, dy: 90 }); // look over the list first
  await hold(3200);
  await click(fixAll, 2600);
  await press('Escape', 900);
  await glide([1660, 540]);
  await hold(2200);

  // ---- 3. Dialogue spotlight on the sample script ---------------------------------------------
  caption('Dialogue spotlight: MARIE');
  await click(page.getByRole('button', { name: 'Switch Project' }), 700);
  await click(page.locator('.pd-card', { hasText: 'The Last Ferry' }), 1200);
  await click(page.getByRole('button', { name: 'Characters', exact: true }), 600);
  await click(page.getByRole('tab', { name: /^Dialogue/ }).or(page.getByRole('button', { name: /^Dialogue/ })).first(), 600);
  await click(page.locator('button', { hasText: /^MARIE/ }).first(), 1600);
  // Scroll the isolated pass: her lines stay bright, everything else dims.
  await glide([870, 620]);
  for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, 260); await sleep(380); }
  await hold(1500);
  for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, -260); await sleep(160); }
  await click(page.locator('button', { hasText: /^MARIE/ }).first(), 500); // spotlight off
  await click(page.getByRole('button', { name: 'Close Characters' }), 800);

  // ---- 4. Scene Board, then Plan --------------------------------------------------------------
  caption('Scene Board: 4 Acts and 3 Acts');
  await click(page.getByRole('radio', { name: 'Board', exact: true }), 2200);
  await click(page.getByRole('radio', { name: '3 Acts' }), 2600);
  await click(page.getByRole('radio', { name: '4 Acts' }), 2200);

  caption('Plan: Breakdowns and Stripboard (lengths in eighths of a page)');
  await click(page.getByRole('radio', { name: 'Plan', exact: true }), 1400);
  const eighths = page.getByText(/^\d+\/8 pgs?$/).first();
  if (await eighths.count()) { await glide(eighths); await hold(1800); }
  await glide([960, 640]);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 240); await sleep(420); }
  await hold(900);
  await click(page.getByRole('radio', { name: /^Stripboard/ }).or(page.getByRole('button', { name: /^Stripboard/ })).first(), 1200);
  const lengths = page.getByText(/^\d+\/8$/).first();
  if (await lengths.count()) { await glide(lengths); await hold(2400); }

  // ---- 5. Back to the page; folder sync -------------------------------------------------------
  await click(page.getByRole('radio', { name: 'Write', exact: true }), 600);
  await click(page.getByRole('radio', { name: 'Page', exact: true }), 1200);
  if (WITH_FOLDER) {
    caption('Local-first: link a folder, then the Synced badge');
    await click(page.getByRole('button', { name: 'Switch Project' }), 900);
    await glide(page.locator('.sd'));
    await hold(1600);
    await click(page.getByRole('button', { name: 'Link Folder…' }), 1800);
    await click(page.getByRole('button', { name: 'Close projects' }), 900);
  }
  const badge = page.locator('.status-save');
  await glide(badge);
  await hold(3500);
  await glide([960, 520]);
  await hold(1500);

  // ---- save the video -------------------------------------------------------------------------
  const video = page.video();
  await context.close(); // finishes the recording
  mkdirSync(dirname(OUT), { recursive: true });
  await video.saveAs(OUT);
  await browser.close();
  rmSync(videoDir, { recursive: true, force: true });
  console.log(`\nSaved ${OUT} (${SIZE.width}×${SIZE.height}, ${FPS} fps)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
