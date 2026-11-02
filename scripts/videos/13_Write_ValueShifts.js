// 13 · Write — Value Shifts (38–50 s, intro card included)
//
// Value shifts live on the Scene Board: each scene card's +/− badge records how its charge turns:
// + / − (a setback), − / + (a win), and the static + / + and − / −, which the board flags. Off camera,
// Import Scenes makes a card per scene. On camera: set a couple of turns by hand, then Analyze Value
// Shifts reads every scene and suggests a turn for each; apply them and back to the script.
//
//   node scripts/videos/13_Write_ValueShifts.js
//   → videos/13_Write_ValueShifts/13_Write_ValueShifts.mp4
import { main, record } from '../lib/demoKit.js';

/** Off camera: a card per scene, so the board opens on scene cards. */
async function prepare(page) {
  await page.getByRole('radio', { name: 'Board', exact: true }).click();
  await page.getByRole('button', { name: /Import Scenes/ }).click();
  await page.getByRole('menuitem', { name: /Auto-Distribute/ }).click();
  await page.locator('.card.is-linked').first().waitFor();
  await page.getByRole('radio', { name: 'Page', exact: true }).click();
}

main(() => record({
  folder: '13_Write_ValueShifts',
  sample: true,
  prepare,
  async run({ page, click, glide, hold, say }) {
    say('Value shifts live on the Scene Board');
    await glide([960, 500]);
    await hold(1200);
    await click(page.getByRole('radio', { name: 'Board', exact: true }), 1600);
    const board = page.locator('.board').first();
    const shift = (i) => board.locator('.card.is-linked').nth(i).locator('.vs-btn');

    say('A turn from positive to negative: a setback');
    await click(shift(0), 1500);
    await click(page.getByRole('menuitemradio', { name: /Positive to Negative/ }), 1400);

    say('Negative to positive: a win');
    await click(shift(1), 1000);
    await click(page.getByRole('menuitemradio', { name: /Negative to Positive/ }), 1400);

    say('A scene that doesn’t turn is flagged');
    await click(shift(2), 900);
    await click(page.getByRole('menuitemradio', { name: /Positive to Positive/ }), 900);
    await glide(shift(2));
    await hold(1900);

    say('Analyze Value Shifts: a suggested turn for every scene');
    await click(board.getByRole('button', { name: /Analyze Value Shifts/ }), 1400);
    const modal = page.locator('.vsm-modal');
    await glide(modal.locator('.vsm-row').nth(1));
    await hold(2000);
    await glide(modal.locator('.vsm-row').nth(4));
    await hold(2000);
    await glide(modal.locator('.vsm-row').last());
    await hold(1600);
    await click(modal.locator('.vsm-foot .btn-primary'), 1600);

    say('The turns, scene by scene');
    await glide(shift(3));
    await hold(1300);
    await glide(board.locator('.card.is-linked').last().locator('.vs-btn'));
    await hold(1500);

    say('Back to the script');
    await click(page.getByRole('radio', { name: 'Page', exact: true }), 1200);
    await glide([960, 500]);
    await hold(1800);
  },
}));
