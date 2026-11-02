// 00 · Master — the DraftLine overview (60–80 s, intro card included)
//
// The flagship, at pace. A blank page: a scene typed with the keyboard alone, and a punch into Focus.
// Then Projects → The Last Ferry, a script in progress: the Story Bible (DNA, the three-act outline),
// Characters (Marie's bio and the dialogue spotlight), the Scene Board's value shifts; Plan (a breakdown
// with Marie and her suitcase, night strips, Reports and .csv); back in Write, a snapshot and Compare,
// File's exports, and it settles on the first page of The Last Ferry.
//
// Off camera: The Last Ferry is in Projects with bios (Populate Bio), a card per scene with value shifts
// set, and the suitcase tagged on scene 1; then File → New… leaves a blank page open for the take.
// Every step carries its narration (say(step, vo)); the voiceover sheet is written beside the video.
//
//   node scripts/videos/00_Master_DraftLineDemo.js
//   → videos/00_Master_DraftLineDemo/00_Master_DraftLineDemo.mp4 (+ _voiceover.md)
import { main, record } from '../lib/demoKit.js';

async function prepare(page) {
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  const drawer = page.getByRole('complementary', { name: 'Characters' });
  await drawer.getByRole('tab', { name: /^Bios/ }).click();
  await drawer.getByRole('button', { name: /Populate Bio/ }).click();
  const marie = drawer.locator('li.pb-char', { hasText: 'MARIE' });
  await drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }).click();
  await marie.getByRole('combobox', { name: 'Primary Role' }).click();
  await page.getByRole('option', { name: 'Protagonist', exact: true }).click();
  await drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }).click();
  await page.getByRole('button', { name: 'Close Characters' }).click();
  // A card per scene, each with its turn.
  await page.getByRole('radio', { name: 'Board', exact: true }).click();
  await page.getByRole('button', { name: /Import Scenes/ }).click();
  await page.getByRole('menuitem', { name: /Auto-Distribute/ }).click();
  await page.locator('.card.is-linked').first().waitFor();
  await page.getByRole('button', { name: /Analyze Value Shifts/ }).click();
  await page.locator('.vsm-foot .btn-primary').click();
  await page.getByRole('radio', { name: 'Page', exact: true }).click();
  // The suitcase, on scene 1's breakdown.
  await page.locator('.ws-btn[data-workspace="plan"]').click();
  const card = page.locator('.plan-breakdowns article.plan-card').first();
  const expand = card.getByRole('button', { name: 'Expand' });
  if (await expand.count()) await expand.click();
  await card.getByRole('button', { name: 'Add to Props & Set Dressing' }).click();
  await card.locator('input.plan-add-input').fill('Suitcase');
  await card.locator('input.plan-add-input').press('Enter');
  await page.locator('.ws-btn[data-workspace="write"]').click();
}

main(() => record({
  folder: '00_Master_DraftLineDemo',
  sample: true,
  prepare,
  seconds: [60, 80],
  brisk: true,
  // Off camera, in the recorded browser: a new, blank script (The Last Ferry waits in Projects).
  async setup(page) {
    await page.getByRole('button', { name: /^File/ }).first().click();
    await page.getByRole('menuitem', { name: /^New…/ }).click();
    await page.waitForFunction(() => document.querySelector('input.doc-title')?.value === 'Untitled');
    await page.locator('.toast').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});
    await page.locator('.scroller').evaluate((el) => { el.scrollTop = 0; });
  },
  async run({ page, click, glide, typeHuman, press, hold, say, wheel }) {
    const menuItem = (name) => page.getByRole('menuitem', { name });

    // 1 · The canvas -------------------------------------------------------------------------------
    await say('A blank page: the keyboard picks every element',
      'This is DraftLine. Open the page and write: headings snap into place, and Enter and Tab pick every element for you.');
    await click(page.locator('.el-scene .el-input').first(), 400);
    await typeHuman('int. lighthouse');
    await press('Tab', 500);
    await typeHuman('night');
    await press('Escape', 200);
    await press('Enter', 300);
    await typeHuman('Fog swallows the lamp.');
    await press('Tab', 300);
    await typeHuman('theo');
    await press('Enter', 300);
    await typeHuman('Someone’s still out there.');
    await hold(300);

    await say('Focus: only the words',
      'Focus clears everything but the words.');
    await click(page.locator('.btn-focus').first(), 1300);
    await press('Escape', 600);

    // 2 · The creative drawers ------------------------------------------------------------------------
    await say('Projects → The Last Ferry, a script in progress',
      'Now open a script in progress, and the tools come out.');
    await click(page.getByRole('button', { name: 'Projects', exact: true }), 700);
    await click(page.locator('.pd-card', { hasText: 'The Last Ferry' }).first(), 900);

    await say('Story Bible: DNA and the three-act outline',
      'The Story Bible holds the story’s DNA: its genres and core questions, and the whole outline, act by act.');
    await click(page.getByRole('button', { name: 'Story Bible', exact: true }), 600);
    const bible = page.getByRole('complementary', { name: 'Story Bible' });
    await click(bible.getByRole('button', { name: 'Thriller', exact: true }), 300);
    await click(bible.getByRole('button', { name: 'Crime', exact: true }), 500);
    await click(bible.getByRole('tab', { name: /^Notes/ }), 400);
    await glide(bible.locator('.pb-synopsis').first(), { dy: -40 });
    await hold(700);
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 300);

    await say('Characters: Marie’s bio, then her lines in the spotlight',
      'Characters keeps a bio for everyone in the script, and the spotlight lights up every line Marie speaks, across the whole draft.');
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 500);
    const drawer = page.getByRole('complementary', { name: 'Characters' });
    await click(drawer.getByRole('tab', { name: /^Bios/ }), 300);
    await click(drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }), 800);
    await click(drawer.getByRole('tab', { name: /^Dialogue/ }), 300);
    await click(drawer.locator('.cast-chip', { hasText: 'MARIE' }), 1100);
    await click(page.getByRole('button', { name: 'Close Characters' }), 300);
    await glide([1340, 500]);
    await press('Escape', 300);

    await say('Scene Board: every scene, and how it turns',
      'The Scene Board lays out every scene, and how each one turns.');
    await click(page.getByRole('radio', { name: 'Board', exact: true }), 700);
    await glide(page.locator('.board .card.is-linked .vs-btn').first());
    await hold(1100);
    await click(page.getByRole('radio', { name: 'Page', exact: true }), 200);

    // 3 · Plan ----------------------------------------------------------------------------------------
    await say('Plan: the breakdown, cast and props',
      'Switch to Plan, and every scene is broken down: cast, props, and all.');
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 700);
    const card = page.locator('.plan-breakdowns article.plan-card').first();
    await glide(card.locator('.plan-cast-list'));
    await hold(700);
    await glide(card.locator('.plan-tag', { hasText: 'Suitcase' }));
    await hold(700);

    await say('Stripboard: colour-coded strips, the night shoot',
      'Colour-coded strips, filtered to the night shoot.');
    await click(page.getByRole('radio', { name: 'Stripboard' }), 500);
    await click(page.locator('.plan-filter:visible').first().getByRole('button', { name: 'NIGHT', exact: true }), 1000);
    await click(page.locator('.pf-clear:visible').first(), 300);

    await say('Reports: the cast, ready as a spreadsheet',
      'And reports for the cast and every scene, ready as a spreadsheet.');
    await click(page.getByRole('radio', { name: 'Reports' }), 400);
    const reports = page.locator('.plan-reports');
    await click(reports.getByRole('tab', { name: 'Characters' }), 700);
    await glide(reports.locator('.rp-csv'));
    await hold(600);

    // 4 · Snapshot and export ---------------------------------------------------------------------------
    await say('Write: a snapshot, compared with the first pass',
      'Back in Write, snapshot the draft at any point, then compare it with an earlier pass: cuts in red, additions in green.');
    await click(page.locator('.ws-btn[data-workspace="write"]'), 300);
    await click(page.getByRole('button', { name: 'Snapshot', exact: true }), 400);
    await page.getByRole('textbox', { name: 'Snapshot label' }).waitFor();
    await typeHuman('Polish pass', { fast: true });
    await click(page.getByRole('button', { name: 'Save Snapshot' }), 500);
    await click(page.locator('.btn-kebab').first(), 300);
    await click(menuItem(/^View Snapshots/), 500);
    const snaps = page.getByRole('complementary', { name: 'Snapshots' });
    await click(snaps.getByRole('button', { name: 'Compare First pass with the current draft' }), 600);
    await glide([760, 560]);
    await hold(1100);
    await press('Escape', 400);
    await click(page.getByRole('button', { name: 'Close Snapshots' }), 300);

    await say('File: export to PDF, Final Draft or Fountain',
      'Then export to PDF, Final Draft, or Fountain.');
    await click(page.getByRole('button', { name: /^File/ }).first(), 300);
    await glide(menuItem(/^PDF/).first());
    await hold(400);
    await glide(menuItem(/^Fountain/).first());
    await hold(500);
    await press('Escape', 300);

    await say('The Last Ferry, page one',
      'DraftLine. Write it, build it, plan it, all in one place.');
    await glide([1340, 500]);
    await wheel(-900, 8, 80);
    await hold(2000);
  },
}));
