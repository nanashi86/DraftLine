// Shared kit for the DraftLine walkthrough recordings (scripts/record-dl01.js … record-dl09.js).
//
// Each walkthrough is 1920×1080 at 60 fps, in a clean browser profile, with a visible pointer and
// click ripples, saved to recordings/<folder>/<folder>.webm (and <folder>.mp4). Anything a video needs to start from (a
// messy script for Format Doctor, character bios for the Story Bible…) is loaded off camera first,
// through DraftLine's own .draftline restore, and carried into the recorded browser, so every video
// opens straight on its subject.
//
// Needs `npm run dev` running (DraftLine at http://localhost:5173/DraftLine/) and Playwright:
//   npm i -D playwright@1.64.1 && npx playwright install chromium ffmpeg
//
// Environment: DEMO_URL (default above) · DEMO_FPS (60) · DEMO_HEADED=1 (show the browser) ·
// CHROMIUM_PATH (a Chromium to use instead of Playwright's own).

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { serializeBackup } from '../../src/lib/backup.js';
import { makeBlock } from '../../src/lib/screenplay.js';
import { createRevision } from '../../src/lib/revisions.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const URL_ = process.env.DEMO_URL || 'http://localhost:5173/DraftLine/';
const FPS = Number(process.env.DEMO_FPS) || 60;
const SIZE = { width: 1920, height: 1080 };

// DEMO_CHECK=1: a quick rehearsal — every step runs against the app, but nothing is recorded and the
// pauses are cut to a twentieth, so a broken selector shows up in seconds rather than after a take.
const CHECK = process.env.DEMO_CHECK === '1';
/** Exit code for a walkthrough that isn't ready to record (record-dl-all.js reports it as skipped). */
export const SKIPPED_EXIT = 3;

export const sleep = (ms) => new Promise((r) => setTimeout(r, CHECK ? ms / 20 : ms));
export const jitter = (min, max) => min + Math.random() * (max - min);

/** The visible pointer (the recorder doesn't capture the OS cursor) and a ripple on every click. */
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none', transition: 'transform 60ms', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' });
    document.documentElement.appendChild(c);
    const move = (e) => { c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px'; };
    addEventListener('mousemove', move, true);
    addEventListener('dragover', move, true); // a native drag (Scene Board cards) sends dragover, not mousemove
    addEventListener('mousedown', (e) => {
      c.style.transform = 'scale(.86)';
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 18 + 'px', top: e.clientY - 18 + 'px', width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #e8836b', zIndex: 2147483646, pointerEvents: 'none', opacity: '1', transition: 'transform 420ms ease-out, opacity 420ms ease-out' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.9)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 450);
    }, true);
    const up = () => { c.style.transform = ''; };
    addEventListener('mouseup', up, true);
    addEventListener('dragend', up, true);
  });`;

/**
 * A stand-in for the operating system's folder picker: an in-memory folder (tests/helpers/fakeDirectory.js).
 * Playwright can't drive the real picker; DraftLine syncs to this exactly as to a real folder, and
 * nothing is written to your disk.
 */
function fakeFolderScript(name) {
  const fake = readFileSync(join(ROOT, 'tests/helpers/fakeDirectory.js'), 'utf8').replace(/^export function/m, 'function');
  return `${fake}\nwindow.showDirectoryPicker = async () => (window.__demoDir ||= createFakeDirectory(${JSON.stringify(name)}));`;
}

/**
 * A project to start a video from, as .draftline text.
 *   blocks: [[type, text, extra?], …]   characters: Story Bible bios
 *   storyNotes: { sections: [{ title, body }], synopsis?: { act1, act2, act2b, act3 } }
 *   snapshots: [{ label, minutesAgo }] — Snapshots of the project exactly as given, oldest first
 */
export function fixtureProject({ title, author = 'Eric Lemaire Jr.', blocks, beats = [], characters = [], storyNotes, snapshots = [] }) {
  const t = Date.now();
  let n = 0;
  const id = (p) => `${p}${(n += 1)}${t.toString(36)}`;
  const record = {
    id: id('demo'),
    title,
    author,
    script: blocks.map(([type, text, extra]) => makeBlock(type, text, extra)),
    beats,
    characters: characters.map((c) => ({ id: id('ch'), secondaryRole: 'none', relationship: '', age: '', description: '', traits: '', backstory: '', ...c })),
    ...(storyNotes ? { storyNotes: { version: 4, ...storyNotes, sections: (storyNotes.sections || []).map((s) => ({ id: id('sn'), ...s })) } } : {}),
    createdAt: t,
    updatedAt: t,
  };
  if (snapshots.length) {
    const doc = { meta: { title, author }, blocks: record.script, beats, characters: record.characters, storyNotes: record.storyNotes };
    record.revisions = snapshots.map(({ label, minutesAgo = 60 }) => createRevision(doc, { label, now: t - minutesAgo * 60_000 }));
  }
  return { title, text: serializeBackup(record, { appVersion: 'demo' }) };
}

/**
 * Record one walkthrough.
 *   folder   — subfolder of recordings/; the files inside are named after it: <folder>.webm, <folder>.mp4
 *   fixture  — fixtureProject(…) to open before recording starts (optional)
 *   syncFolder — name for the stand-in synced folder (optional; enables the folder picker)
 *   mp4      — also save <folder>.mp4 (H.264) next to it, via ffmpeg on PATH or FFMPEG_PATH (default on)
 *   run(demo) — the walkthrough; demo has page, click, glide, drag, typeHuman, press, hold, wheel, say
 */
export async function record({ folder, fixture = null, syncFolder = null, maxSeconds = 35, mp4 = true, run }) {
  const out = join(ROOT, 'recordings', folder, `${folder}.webm`);
  try {
    const res = await fetch(URL_);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`DraftLine isn't reachable at ${URL_} (${err.message}). Start it with "npm run dev", or set DEMO_URL.`);
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: process.env.DEMO_HEADED !== '1',
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });

  // Off camera: open the fixture through File → Open (a .draftline restore) and keep the library.
  let storageState;
  if (fixture) {
    const prep = await browser.newContext({ viewport: SIZE });
    const p = await prep.newPage();
    await p.goto(URL_);
    await p.locator('.el-input').first().waitFor();
    await p.locator('input[type="file"][accept*=".draftline"]').first().setInputFiles({
      name: `${fixture.title}.draftline`, mimeType: 'application/json', buffer: Buffer.from(fixture.text),
    });
    await p.waitForFunction((t) => document.querySelector('input.doc-title')?.value === t, fixture.title, { timeout: 10_000 });
    await sleep(1200); // let the autosave settle
    storageState = await prep.storageState({ indexedDB: true });
    await prep.close();
  }

  const rawDir = join(ROOT, 'recordings', folder, '.raw');
  rmSync(rawDir, { recursive: true, force: true });
  if (!CHECK) mkdirSync(rawDir, { recursive: true });
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    ...(storageState ? { storageState } : {}),
    ...(CHECK ? {} : { recordVideo: { dir: rawDir, size: SIZE, fps: FPS } }),
  });
  await context.addInitScript(CURSOR);
  if (syncFolder) await context.addInitScript(fakeFolderScript(syncFolder));
  const page = await context.newPage();
  const started = Date.now();

  const mouse = { x: SIZE.width / 2, y: SIZE.height / 2 };
  const glide = async (target, { dx = 0, dy = 0 } = {}) => {
    let x; let y;
    if (Array.isArray(target)) [x, y] = target;
    else {
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      x = box.x + box.width / 2 + dx; y = box.y + box.height / 2 + dy;
    }
    const dist = Math.hypot(x - mouse.x, y - mouse.y);
    await page.mouse.move(x, y, { steps: Math.max(10, Math.round(dist / 16)) });
    mouse.x = x; mouse.y = y;
  };
  const demo = {
    page,
    glide,
    async click(locator, pause = 300) {
      await glide(locator);
      await sleep(jitter(110, 200));
      await page.mouse.down(); await sleep(60); await page.mouse.up();
      await sleep(pause);
    },
    /** Press on `from`, carry it to `to` (a locator or [x, y]), let go: native drag and drop included. */
    async drag(from, to, { dx = 0, dy = 0 } = {}) {
      await glide(from);
      await page.mouse.down();
      await sleep(150);
      await glide(to, { dx, dy });
      await sleep(200);
      await page.mouse.up();
      await sleep(400);
    },
    async typeHuman(text, { fast = false } = {}) {
      for (const ch of text) {
        await page.keyboard.type(ch);
        await sleep(/[.,?!:;]/.test(ch) ? jitter(70, 140) : ch === ' ' ? jitter(25, 55) : fast ? jitter(10, 26) : jitter(15, 40));
      }
    },
    async press(key, pause = 220) { await page.keyboard.press(key); await sleep(pause); },
    async wheel(dy, times, gap = 300) { for (let i = 0; i < times; i++) { await page.mouse.wheel(0, dy); await sleep(gap); } },
    hold: sleep,
    say: (text) => console.log(`  ${text}`),
  };

  console.log(`Recording ${folder}`);
  await page.goto(URL_);
  await page.locator('.el-input').first().waitFor();
  await page.mouse.move(mouse.x, mouse.y);
  // The Characters panel opens by default on a first visit: start every video on a clean page.
  const closeChars = page.getByRole('button', { name: 'Close Characters' });
  if (await closeChars.isVisible()) await closeChars.click();
  await sleep(700);

  await run(demo);

  const seconds = (Date.now() - started) / 1000;
  if (CHECK) {
    if (process.env.DEMO_CHECK_SHOT) await page.screenshot({ path: process.env.DEMO_CHECK_SHOT });
    await context.close();
    await browser.close();
    rmSync(rawDir, { recursive: true, force: true });
    console.log(`Check passed: ${folder} (nothing recorded)`);
    return;
  }
  const video = page.video();
  await context.close();
  await video.saveAs(out);
  await browser.close();
  rmSync(rawDir, { recursive: true, force: true });
  console.log(`Saved ${out} (${SIZE.width}×${SIZE.height}, ${FPS} fps, ~${seconds.toFixed(1)} s)`);
  if (seconds > maxSeconds) console.warn(`  Note: longer than ${maxSeconds} s — shorten a hold in the script if you need it under.`);
  if (mp4) toMp4(out, join(ROOT, 'recordings', folder, `${folder}.mp4`));
}

/** webm → H.264 mp4 (yuv420p plays everywhere). Keeps the webm; if ffmpeg isn't found, says so and stops there. */
function toMp4(webm, mp4) {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (r.error || r.status !== 0 || !existsSync(mp4)) {
    console.warn(`  Couldn't make the mp4 (${r.error ? 'ffmpeg not found' : `ffmpeg exited ${r.status}`}). Install ffmpeg or set FFMPEG_PATH, then:`);
    console.warn(`    ffmpeg -i "${webm}" -c:v libx264 -pix_fmt yuv420p -crf 18 "${mp4}"`);
    return;
  }
  console.log(`Saved ${mp4}`);
}

/** Run `fn` and exit non-zero on failure (each record-dlNN.js ends with this). */
export function main(fn) {
  fn().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
