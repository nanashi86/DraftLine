// Shared kit for the DraftLine walkthrough recordings (scripts/videos/NN_*.js, and the older record-dlNN.js).
//
// Each walkthrough is 1920×1080 at 60 fps, in a clean browser profile, with a visible pointer and
// click ripples. The deliverable is one file per video:
//
//   videos/<folder>/<folder>.mp4   = the intro card (videos/_shared_assets/DraftLine_Intro_1080p.png),
//                                    a still frame for exactly 2.00 s, then the take
//
// The take starts on the app already settled: the page load, the first paint and any panel closing all
// happen before the cut point and are trimmed away, so there's no white flash and no UI opening or
// closing on camera. Anything a video needs to start from (a messy script for Format Doctor, character
// bios for the Story Bible…) is loaded off camera first, through DraftLine's own .draftline restore, and
// carried into the recorded browser, so every video opens straight on its subject.
//
// Nothing pops up mid-take: every feature tip and first-visit card (lib/hints.js), the feedback card
// (lib/feedbackPrompt.js) and the backup reminder are marked as seen before the app loads, and the
// browser's clock is set to midday so the late-night milestone can't fire.
//
// The run prints a timeline (seconds in the final video) of every step it calls out with say().
//
// Needs `npm run dev` running (DraftLine at http://localhost:5173/DraftLine/) and Playwright:
//   npm i -D playwright@1.64.1 && npx playwright install chromium ffmpeg
//
// Environment: DEMO_URL (default above) · DEMO_FPS (60) · DEMO_HEADED=1 (show the browser) ·
// CHROMIUM_PATH (a Chromium to use instead of Playwright's own).

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { serializeBackup } from '../../src/lib/backup.js';
import { HINT_IDS, HINTS_KEY, HINT_SESSION_KEY, ONBOARDING_KEY } from '../../src/lib/hints.js';
import { FEEDBACK_PROMPT_KEY, FEEDBACK_SEEDED_KEY } from '../../src/lib/feedbackPrompt.js';
import { BACKUP_TOAST_DISMISSED_KEY } from '../../src/lib/backupToast.js';
import { LIGHT_TIP_KEY } from '../../src/lib/lightThemeTip.js';
import { EXPORT_TIP, FORMAT_DOCTOR_TIP } from '../../src/lib/supportTips.js';
import { makeBlock } from '../../src/lib/screenplay.js';
import { createRevision } from '../../src/lib/revisions.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const URL_ = process.env.DEMO_URL || 'http://localhost:5173/DraftLine/';
const FPS = Number(process.env.DEMO_FPS) || 60;
const SIZE = { width: 1920, height: 1080 };
/** The title card every video opens on, and for how long. */
export const INTRO = join(ROOT, 'videos', '_shared_assets', 'DraftLine_Intro_1080p.png');
export const INTRO_SECONDS = 2;
/** Every finished video's length, intro included: [shortest, longest] in seconds. */
export const VIDEO_SECONDS = [35, 55];

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
    // inset first: it's a shorthand, and set after left / top it would reset them (the pointer at 0, 0).
    Object.assign(c.style, { inset: 'auto', position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none', transition: 'transform 60ms', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))',
      margin: '0', padding: '0', border: '0', background: 'transparent', overflow: 'visible', width: '26px', height: '26px' });
    document.documentElement.appendChild(c);
    // A modal dialog sits in the top layer, above any z-index: the pointer goes there too (as a popover),
    // and is raised again whenever a dialog opens after it, so it's never hidden behind About or Export.
    c.popover = 'manual';
    let dialogs = 0;
    const raise = () => {
      const n = document.querySelectorAll('dialog[open]').length;
      if (n === dialogs && c.matches(':popover-open')) return;
      dialogs = n;
      try { c.hidePopover(); } catch { /* not shown yet */ }
      try { c.showPopover(); } catch { /* no popover support: z-index only */ }
    };
    raise();
    const move = (e) => { raise(); c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px'; };
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
 * Every take, before the app loads: every tip and first-visit card (all of HINT_IDS, read from
 * lib/hints.js, so a tip added later is silenced too), the feedback card, the backup reminder and the
 * support lines on export toasts and Format Doctor reports and the light-theme tip are marked as seen, and the writer counts as returning (no onboarding). Fresh scripts stay clean
 * canvases: nothing can pop up while typing.
 */
const silence = (tips = []) => `
  try {
    localStorage.setItem(${JSON.stringify(HINTS_KEY)}, ${JSON.stringify(JSON.stringify(Object.fromEntries(HINT_IDS.filter((id) => !tips.includes(id)).map((id) => [id, 'done']))))});
    localStorage.setItem(${JSON.stringify(ONBOARDING_KEY)}, ${JSON.stringify(tips.some((id) => ['sample', 'focus'].includes(id)) ? 'new' : 'existing')});
    localStorage.setItem(${JSON.stringify(FEEDBACK_PROMPT_KEY)}, 'done');
    localStorage.setItem(${JSON.stringify(FEEDBACK_SEEDED_KEY)}, '1');
    localStorage.setItem(${JSON.stringify(BACKUP_TOAST_DISMISSED_KEY)}, 'true');
    ${tips.includes('lightTheme') ? '' : `localStorage.setItem(${JSON.stringify(LIGHT_TIP_KEY)}, 'true');`}
    // The Ko-fi / Patreon line on an export toast and under a clean Format Doctor report: just shown, so not again.
    localStorage.setItem(${JSON.stringify(EXPORT_TIP.lastKey)}, String(Date.now()));
    localStorage.setItem(${JSON.stringify(FORMAT_DOCTOR_TIP.lastKey)}, String(Date.now()));
    ${tips.length ? `sessionStorage.removeItem(${JSON.stringify(HINT_SESSION_KEY)});` : `sessionStorage.setItem(${JSON.stringify(HINT_SESSION_KEY)}, 'none');`}
  } catch { /* storage blocked: nothing to quiet */ }`;
const SILENCE = silence();

/** Narration pace for say(text, vo): words a second, and the breath after each line. */
export const VO_WORDS_PER_SECOND = 2.5;
export const VO_BREATH = 0.4;
/** How long a voiceover line takes to read aloud, in seconds. */
export const voSeconds = (vo) => (vo ? vo.trim().split(/\s+/).length / VO_WORDS_PER_SECOND + VO_BREATH : 0);

/** A browser time zone where it's about midday now (Etc/GMT-N is UTC+N), so the 2–5 AM milestone never fires. */
function middayTimezone(now = new Date()) {
  let offset = 12 - now.getUTCHours();
  if (offset > 14) offset -= 24;
  if (offset < -12) offset += 24;
  return offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
}

/** Video 2.0 baseline: close every right-dock drawer and the Scenes sidebar before the walkthrough starts. */
async function cleanBaseline(page) {
  for (const name of ['Close Characters', 'Close the Story Bible', 'Close Snapshots', 'Close Margin Notes']) {
    const b = page.getByRole('button', { name, exact: true });
    if (await b.isVisible()) await b.click();
  }
  const scenes = page.getByRole('button', { name: 'Toggle scene list' });
  if ((await scenes.getAttribute('aria-pressed')) === 'true') await scenes.click();
}

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
 *   storyDna: Story Bible → DNA, as lib/storyDna.js stores it (genres, theme, answers…; normalized on load)
 *   snapshots: [{ label, minutesAgo, blocks? }] — Snapshots, oldest first: of the project as given, or of an
 *              earlier draft when `blocks` is set (so Compare has real differences to show)
 */
export function fixtureProject({ title, author = 'Eric Lemaire Jr.', blocks, beats = [], characters = [], storyNotes, storyDna, snapshots = [] }) {
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
    ...(storyDna ? { storyDna } : {}),
    createdAt: t,
    updatedAt: t,
  };
  if (snapshots.length) {
    const doc = { meta: { title, author }, blocks: record.script, beats, characters: record.characters, storyNotes: record.storyNotes };
    record.revisions = snapshots.map(({ label, minutesAgo = 60, blocks: earlier }) => createRevision(
      earlier ? { ...doc, blocks: earlier.map(([type, text, extra]) => makeBlock(type, text, extra)) } : doc,
      { label, now: t - minutesAgo * 60_000 },
    ));
  }
  return { title, text: serializeBackup(record, { appVersion: 'demo' }) };
}

/**
 * Record one walkthrough, to videos/<folder>/<folder>.mp4 (intro card, then the take).
 *   folder   — the video's slug: its folder under videos/ and its file name (e.g. 01_General_GettingStarted)
 *   fixture  — fixtureProject(…) to open before recording starts (optional)
 *   sample   — open the sample script (File ▾ → Sample…) before recording starts, instead of a fixture:
 *              a fresh browser opens on a blank page, and the sample takes that page's place
 *   syncFolder — name for the stand-in synced folder (optional; enables the folder picker)
 *   prepare(page) — off camera, in a separate browser, after the fixture opens: state to save and carry over
 *   clean    — (default on) no drawer (Story Bible, Characters, Snapshots, Margin Notes) or Scenes sidebar
 *              open when the take starts
 *   setup(page, demo) — off camera, in the recorded browser, just before the take: trimmed from the video
 *   run(demo) — the walkthrough; demo has page, context, click, glide, drag, typeHuman, press, hold, wheel, reload, say
 *   seconds  — [min, max] for this video, intro included (default VIDEO_SECONDS)
 *   tips     — hint ids (lib/hints.js) left unsilenced, for a video that shows one on purpose
 *   brisk    — quicker pointer moves (about half the steps), for the fast-paced overview
 * say(text, vo): a step; with vo (the narration for it), the next step waits until the line has had
 * time to be read (VO_WORDS_PER_SECOND), and videos/<folder>/<folder>_voiceover.md is written: the
 * narration, timed to the finished video, with the actions under each line.
 * Returns { out, seconds, timeline }. Exits 4 (after saving) when the video is outside its range.
 */
export async function record({ folder, fixture = null, sample = false, prepare = null, syncFolder = null, clean = true, setup = null, seconds: range = VIDEO_SECONDS, tips = [], brisk = false, run }) {
  const dir = join(ROOT, 'videos', folder);
  const out = join(dir, `${folder}.mp4`);
  if (!existsSync(INTRO)) {
    console.error(`The intro card is missing: ${INTRO}`);
    process.exit(1);
  }
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

  // Off camera: open the fixture through File → Open (a .draftline restore), or the sample through
  // File → Sample…, and keep the library.
  let storageState;
  if (fixture || sample) {
    const prep = await browser.newContext({ viewport: SIZE, timezoneId: middayTimezone() });
    await prep.addInitScript(SILENCE);
    const p = await prep.newPage();
    await p.goto(URL_);
    await p.locator('.el-input').first().waitFor();
    if (fixture) {
      await p.locator('input[type="file"][accept*=".draftline"]').first().setInputFiles({
        name: `${fixture.title}.draftline`, mimeType: 'application/json', buffer: Buffer.from(fixture.text),
      });
    } else {
      await p.getByRole('button', { name: /^File/ }).first().click();
      await p.getByRole('menuitem', { name: /^Sample/ }).click();
    }
    const title = fixture ? fixture.title : 'The Last Ferry';
    await p.waitForFunction((t) => document.querySelector('input.doc-title')?.value === t, title, { timeout: 10_000 });
    if (prepare) {
      await prepare(p);
      await p.waitForTimeout(1500); // a real wait, even in DEMO_CHECK: the prepared state must be saved
    }
    await sleep(1200); // let the autosave settle
    storageState = await prep.storageState({ indexedDB: true });
    await prep.close();
  }

  const rawDir = join(dir, '.raw');
  rmSync(rawDir, { recursive: true, force: true });
  if (!CHECK) mkdirSync(rawDir, { recursive: true });
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    timezoneId: middayTimezone(),
    ...(storageState ? { storageState } : {}),
    ...(CHECK ? {} : { recordVideo: { dir: rawDir, size: SIZE, fps: FPS } }),
  });
  await context.addInitScript(CURSOR);
  await context.addInitScript(tips.length ? silence(tips) : SILENCE);
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
    // Smooth, and never a drift: even across the whole screen a move takes at most ~0.75 s.
    // brisk (the fast-paced overview): about half the steps, still eased, never a jump.
    const steps = brisk ? Math.min(24, Math.max(8, Math.round(dist / 30))) : Math.min(45, Math.max(10, Math.round(dist / 16)));
    await page.mouse.move(x, y, { steps });
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
    /** Reload the tab on camera (persistence, offline): the app back and settled, the pointer where it was. */
    async reload() {
      await page.reload();
      await page.locator('.el-input').first().waitFor();
      await page.mouse.move(mouse.x + 1, mouse.y);
      await page.mouse.move(mouse.x, mouse.y);
    },
    /** Mark a step: logged with its time in the finished video (intro included). */
    say(text, vo = null) {
      const mark = () => {
        const t = runStart ? INTRO_SECONDS + (Date.now() - runStart) / 1000 : INTRO_SECONDS;
        timeline.push(vo ? { t, text, vo } : { t, text });
        console.log(`  ${fmtTime(t)}  ${text}`);
      };
      // Without narration still being read, the step is marked at once (older scripts don't await say).
      if (!timeline[timeline.length - 1]?.vo) return mark();
      return waitForVo().then(mark);
    },
    context,
  };
  const timeline = [];
  // The narration line still being read: the next say() (or the end of the run) waits for it.
  const waitForVo = async () => {
    const last = timeline[timeline.length - 1];
    if (!last?.vo || !runStart) return;
    const due = last.t + voSeconds(last.vo) - at();
    if (due > 0.05) { last.pad = due; await sleep(due * 1000); }
  };
  const actions = []; // every step, timed in the finished video: the action log
  let runStart = 0;
  const at = () => (runStart ? INTRO_SECONDS + (Date.now() - runStart) / 1000 : INTRO_SECONDS);
  const what = (target) => (Array.isArray(target) ? `[${target.join(', ')}]` : String(target));
  for (const [name, describe] of [
    ['click', (l) => `Click ${what(l)}`],
    ['glide', (l) => `Move to ${what(l)}`],
    ['drag', (a, b) => `Drag ${what(a)} → ${what(b)}`],
    ['typeHuman', (text) => `Type "${text}"`],
    ['press', (key) => `Press ${key}`],
    ['wheel', (dy, times) => `Scroll ${dy > 0 ? 'down' : 'up'} ×${times}`],
    ['reload', () => 'Reload the tab'],
  ]) {
    const fn = demo[name];
    demo[name] = async (...args) => {
      const t = at();
      await fn(...args);
      if (runStart) actions.push({ t, end: at(), text: describe(...args) });
    };
  }

  console.log(`Recording ${folder}`);
  await page.goto(URL_);
  await page.locator('.el-input').first().waitFor();
  await page.mouse.move(mouse.x, mouse.y);
  // Off camera (trimmed away): every drawer closed, then whatever this video starts from, then a
  // moment for fonts, layout and the autosave to settle. The take starts after this.
  if (clean) await cleanBaseline(page);
  if (setup) await setup(page, demo);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.mouse.move(mouse.x, mouse.y);
  const trimStart = (Date.now() - started) / 1000;
  runStart = Date.now();

  await run(demo);
  await waitForVo();

  const runEnd = Date.now();
  const seconds = INTRO_SECONDS + (runEnd - runStart) / 1000;
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
  const webm = join(rawDir, 'take.webm');
  await video.saveAs(webm);
  await browser.close();
  const ok = exportVideo({ webm, out, trimStart, take: (runEnd - runStart) / 1000 });
  if (!ok) {
    console.warn(`  The raw take is kept at ${webm}`);
    process.exit(1);
  }
  rmSync(rawDir, { recursive: true, force: true });
  const final = probeSeconds(out) ?? seconds;
  console.log(`Saved ${out} (${SIZE.width}×${SIZE.height}, ${FPS} fps, ${final.toFixed(2)} s)`);
  if (final < range[0] || final > range[1]) {
    console.warn(`  Outside ${range[0]}–${range[1]} s: adjust the holds in the script.`);
    process.exitCode = 4;
  }
  const log = { folder, seconds: final, introSeconds: INTRO_SECONDS, steps: timeline, actions };
  if (timeline.some((s) => s.vo)) {
    const sheet = join(dir, `${folder}_voiceover.md`);
    writeFileSync(sheet, voiceoverSheet(log));
    console.log(`Voiceover: ${sheet}`);
  }
  if (process.env.DEMO_LOG) {
    mkdirSync(dirname(process.env.DEMO_LOG), { recursive: true });
    writeFileSync(process.env.DEMO_LOG, JSON.stringify(log, null, 2));
    console.log(`Action log: ${process.env.DEMO_LOG}`);
  }
  return { out, seconds: final, timeline, actions };
}

/** Plain names for the selectors the walkthroughs point at, for the action log. */
const PLAIN = {
  '.btn-kebab': 'the ⋮ menu', '.btn-focus': 'Focus', '.status-lock': 'the Editing / Viewing badge',
  '.status-save-label': 'the save status', '.status-counts': 'the scene and word counts',
  '.status-hints': 'the Enter / Tab hints', '.status-right': 'the right of the status bar',
  '.status-density': 'Density', '.type-select': 'the Element picker', '.fmt-seg': 'B / I / U / S',
  '.hint-card .hint-text': 'the tip', '.hint-card .hint-go': 'the tip’s button', '.hint-card .hint-dismiss': 'Got it',
  '.tp-cover-btn': 'View Full Cover', '.tp-specimen': 'the title specimen', 'input.doc-title': 'the script title',
  '.ws-btn[data-workspace="write"]': 'Write', '.ws-btn[data-workspace="plan"]': 'Plan',
  '.el-scene .el-input': 'the scene heading', '.el-action .el-input': 'an Action line', 'dialog[open]': 'the dialog',
  '.pb-synopsis': 'the Synopsis', '.tuner-stats': 'the dialogue totals', '.stepper': 'the status-bar stepper',
  '.strip-legend': 'the stripboard legend', '.plan-card-head': 'the scene’s breakdown header',
  '.plan-cast-list': 'the speaking cast', '.plan-card-body': 'the scene’s breakdown', 'input.plan-add-input': 'the new item',
  '.rp-csv': 'the .csv download', '.vs-btn': 'a Value Shift badge', '.card-grip': 'a card’s grip', '.card-title': 'a card',
  '.vsm-row': 'a suggested turn', '.vsm-foot .btn-primary': 'Apply', 'li.sn-item': 'a snapshot',
  'tr.rp-row': 'a report row', '.rp-scene': 'a scene', '.pb-char-toggle': 'a bio', '.cast-chip': 'a character',
  'label.tuner-toggle': 'Cue context', '.dict-badge': 'the badge', 'li.dict-entry': 'a Glossary term',
  '.eb-cancel': 'Cancel', '.eb-options': 'the sections to include', '.pf-clear': '✕ (clear the filter)',
  '.card': 'a card', 'article.card': 'a card', 'table': 'the report', '.plan-filter': 'the scene filter',
  '[aria-label="Stripboard, in script order"]': 'the strips', '.board': 'the Scene Board',
};

/** An action log line in plain words: "Click File", not the Playwright locator behind it. */
function plainAction(text) {
  const t = text.replace(/\s+/g, ' ');
  const [verb] = t.split(' ');
  if (/^(Type|Press|Scroll|Reload)/.test(verb)) return t;
  const target = (part) => {
    const last = (re) => [...part.matchAll(re)].pop();
    const latest = (...found) => found.filter(Boolean).sort((x, y) => y.index - x.index)[0];
    const named = latest(last(/name: '([^']+)'/g), last(/name: \/\^?((?:\\\/|[^/])+?)\$?\//g));
    const texted = latest(last(/hasText: '([^']+)'/g), last(/hasText: \/\^?((?:\\\/|[^/])+?)\$?\//g));
    // A regex name reads as words: \/ is a slash, (Edit|Done) is "Edit / Done".
    for (const m of [named, texted]) if (m) m[1] = m[1].replace(/\\\//g, '/').replace(/^\((.*)\)$/, '$1').replace(/\|/g, ' / ');
    const css = last(/locator\('([^']+)'\)/g);
    const sel = css && css[1].replace(/:visible$/, '');
    const coords = part.match(/\[(\d+), (\d+)\]/);
    // The innermost step decides: a name or text given after the last locator() is what's pointed at.
    if (named && (!css || named.index > css.index)) return `“${named[1]}”`;
    if (sel && PLAIN[sel]) return texted ? `${PLAIN[sel]} (“${texted[1]}”)` : PLAIN[sel];
    if (texted) return `“${texted[1]}”`;
    if (named) return `“${named[1]}”`;
    if (sel) return sel;
    if (coords) return `the page (${coords[1]}, ${coords[2]})`;
    return part;
  };
  if (verb === 'Drag') {
    const [from, to] = t.slice(5).split(' → ');
    return `Drag ${target(from)} onto ${target(to)}`.slice(0, 140);
  }
  const rest = t.slice(verb.length + 1).replace(/^to /, '');
  return `${verb === 'Move' ? 'Point at' : verb} ${target(rest)}`.slice(0, 140);
}

/** The narration, timed to the finished video, with the actions under each line (Markdown). */
export function voiceoverSheet({ folder, seconds, steps, actions }) {
  const ts = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const words = steps.reduce((n, s) => n + (s.vo ? s.vo.trim().split(/\s+/).length : 0), 0);
  const out = [
    `# ${folder}: voiceover and action log`,
    '',
    `Length ${ts(seconds)} (${seconds.toFixed(2)} s), intro card included · ${words} words of narration, ` +
      `paced at ${VO_WORDS_PER_SECOND} words a second (about ${Math.round(VO_WORDS_PER_SECOND * 60)} a minute).`,
    '',
    `**00:00–${ts(INTRO_SECONDS)}** · Title card (DraftLine_Intro_1080p.png). No narration.`,
    '',
  ];
  steps.forEach((s, i) => {
    const end = i + 1 < steps.length ? steps[i + 1].t : seconds;
    out.push(`**${ts(s.t)}–${ts(end)}** · ${s.text}`, '');
    if (s.vo) out.push(`> ${s.vo}`, '');
    const acts = actions.filter((a) => a.t >= s.t - 0.01 && a.t < end - 0.01);
    for (const a of acts) out.push(`- ${ts(a.t)} ${plainAction(a.text)}`);
    out.push('');
  });
  return `${out.join('\n').trim()}\n`;
}

const fmtTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/**
 * The deliverable: the intro card as a still for exactly INTRO_SECONDS, then the take from trimStart for
 * `take` seconds (the settled app on, so nothing loads or flashes on camera), as H.264 at FPS (yuv420p,
 * plays everywhere, +faststart for the web). Returns true on success.
 */
function exportVideo({ webm, out, trimStart, take }) {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const v = `scale=${SIZE.width}:${SIZE.height},setsar=1,fps=${FPS},format=yuv420p`;
  const r = spawnSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-framerate', String(FPS), '-t', String(INTRO_SECONDS), '-i', INTRO,
    '-ss', trimStart.toFixed(3), '-t', take.toFixed(3), '-i', webm,
    '-filter_complex', `[0:v]${v}[intro];[1:v]${v}[take];[intro][take]concat=n=2:v=1:a=0[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
  ], { stdio: 'inherit' });
  if (r.error || r.status !== 0 || !existsSync(out)) {
    console.warn(`  Couldn't make the mp4 (${r.error ? 'ffmpeg not found: install it or set FFMPEG_PATH' : `ffmpeg exited ${r.status}`}).`);
    return false;
  }
  return true;
}

/** The finished file's length in seconds (ffprobe), or null. */
function probeSeconds(file) {
  const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  const n = parseFloat(r.stdout);
  return Number.isFinite(n) ? n : null;
}

/** Run `fn` and exit non-zero on failure (each record-dlNN.js ends with this). */
export function main(fn) {
  fn().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
