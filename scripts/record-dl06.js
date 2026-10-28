// DL 06 · Write — Focus mode and Snapshots (~34 s)
// Starts on The Last Ferry (the sample script) with one earlier Snapshot, "First Draft", loaded off
// camera as the baseline. Writes a new speech in Focus mode, leaves Focus, takes a Snapshot
// ("Alternate Night Scene"), then compares the baseline with the current draft side by side.
//
// Compare always measures a snapshot against the current draft, so the baseline is what shows the
// new MARIE lines as added; a snapshot taken just now would compare as "No changes".
//
//   node scripts/record-dl06.js
//   → recordings/DL_06_Write_FocusModeAndSnapshots/DL_06_Write_FocusModeAndSnapshots.mp4
//     (plus the .webm; the mp4 needs ffmpeg on PATH or FFMPEG_PATH)
import { fixtureProject, main, record } from './lib/demoKit.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const BASELINE = 'First Draft';

const fixture = fixtureProject({
  title: 'The Last Ferry',
  author: SAMPLE_SCRIPT.meta.author,
  blocks: SAMPLE_SCRIPT.blocks,
  snapshots: [{ label: BASELINE, minutesAgo: 60 * 26 }],
});

main(() => record({
  folder: 'DL_06_Write_FocusModeAndSnapshots',
  fixture,
  maxSeconds: 42,
  mp4: true,
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    await glide([960, 520]);
    await hold(1500);

    // 2. Focus mode.
    say('Focus mode');
    await click(page.getByRole('button', { name: 'Focus', exact: true }), 1200);

    // 3. A new speech after the last action line: caret at its end, Tab starts a character cue,
    // Enter moves on to the dialogue.
    say('Writing in Focus');
    const lastAction = page.locator('.el-input').filter({ hasText: 'Theo looks at her a long moment' }).last();
    await lastAction.scrollIntoViewIfNeeded();
    await hold(600);
    await click(lastAction, 200);
    await lastAction.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
    await press('Tab', 350);
    await typeHuman('MARIE');
    await hold(350);
    await press('Enter', 400);
    await typeHuman("We can't stay here until morning.");
    await hold(1800);

    // 4. Back to the workspace.
    say('Exit Focus');
    await click(page.getByRole('button', { name: /^Exit focus/ }), 1200);

    // 5. Snapshots drawer → a new snapshot.
    say('Snapshot: Alternate Night Scene');
    await click(page.getByRole('button', { name: 'More' }), 400);
    await click(page.getByRole('menuitem', { name: /^View Snapshots/ }), 1000);
    const drawer = page.getByRole('complementary', { name: 'Snapshots' });
    await click(drawer.getByRole('button', { name: /Snapshot this draft/ }), 600);
    const label = page.getByRole('textbox', { name: 'Snapshot label' });
    await click(label, 150);
    await press('ControlOrMeta+a', 100);
    await typeHuman('Alternate Night Scene', { fast: true });
    await hold(600);
    await click(page.getByRole('button', { name: 'Save Snapshot' }), 1400);

    // 6. Compare the baseline with the current draft, side by side.
    say(`Compare "${BASELINE}" → current draft`);
    await click(drawer.getByRole('button', { name: `Compare ${BASELINE} with the current draft` }), 900);
    await click(page.getByRole('button', { name: 'Side by Side' }), 600);
    await page.locator('.df-chip').first().waitFor({ timeout: 10_000 }).catch(() => {});
    const added = page.locator('.sn-compare .df-row[data-kind="add"]').first();
    if (await added.count()) {
      await added.scrollIntoViewIfNeeded();
      await glide(added);
    } else await glide([960, 600]);

    // 7. Hold on the diff, close, finish on the script.
    await hold(4000);
    say('Close');
    await click(page.getByRole('button', { name: 'Close Comparison' }), 700);
    await click(page.getByRole('button', { name: 'Close Snapshots' }), 600);
    await glide([960, 520]);
    await hold(1500);
  },
}));
