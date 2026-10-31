// DL 13 · Write — Value Shifts & Emotional Turns (Video 2.0, ~60 s)
// The Scene Board already holds a card per scene (made off camera with Import Scenes). Each card's
// +/− badge records how the scene's charge turns: + / − (setback), − / + (win), and the static
// + / + and − / −, which the board marks as a warning. Analyze Value Shifts reads every scene and
// suggests a turn for each card; you choose what to apply. Last, Export Outline's three formats.
//
//   node scripts/record-dl13.js
//   → recordings/DL_13_Write_ValueShiftsAndEmotionalTurns/DL_13_Write_ValueShiftsAndEmotionalTurns.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

/** Off camera: open the board and Import Scenes, so the video starts on scene cards. */
async function prepare(page) {
  await page.getByRole('radio', { name: 'Board' }).click();
  await page.getByRole('button', { name: /Import Scenes/ }).click();
  await page.getByRole('menuitem', { name: /Auto-Distribute/ }).click();
  await page.locator('.card').first().waitFor();
  await page.getByRole('radio', { name: 'Page' }).click();
}

main(() => record({
  folder: 'DL_13_Write_ValueShiftsAndEmotionalTurns',
  fixture,
  prepare,
  clean: true,
  maxSeconds: 75,
  async run({ page, click, glide, press, hold, say }) {
    await hold(2000); // pre-roll

    say('The Scene Board: a card per scene');
    await glide([960, 480]);
    await hold(1200);
    await click(page.getByRole('radio', { name: 'Board' }), 1200);
    const board = page.locator('.board').first();
    await hold(1600);

    say('A turn: positive to negative — a setback');
    const shift = (i) => board.locator('.card').nth(i).locator('.vs-btn');
    await click(shift(0), 900);
    await hold(1400); // the four turns, with what each means
    await click(page.getByRole('menuitemradio', { name: /Positive to Negative/ }), 1000);
    await hold(1500);

    say('A static scene: + / + is flagged');
    await click(shift(1), 900);
    await click(page.getByRole('menuitemradio', { name: /Positive to Positive/ }), 1000);
    await glide(shift(1));
    await hold(2200);

    say('Analyze Value Shifts: a suggestion for every scene');
    await click(board.getByRole('button', { name: /Analyze Value Shifts/ }), 1200);
    const modal = page.locator('.vsm-modal');
    await glide(modal.locator('.vsm-row').nth(2));
    await hold(2200);
    await glide(modal.locator('.vsm-row').nth(5));
    await hold(1800);
    await click(modal.locator('.vsm-foot .btn-primary'), 1200); // apply the ones checked
    await hold(1800);

    say('Export Outline: Fountain, Markdown or a spreadsheet');
    await click(board.getByRole('button', { name: /Export Outline/ }), 900);
    await glide(page.getByRole('menuitem', { name: /Spreadsheet/ }));
    await hold(2000);
    await press('Escape', 700);

    say('Back to the page');
    await click(page.getByRole('radio', { name: 'Page' }), 900);
    await glide([900, 480]);
    await hold(2000);
  },
}));
