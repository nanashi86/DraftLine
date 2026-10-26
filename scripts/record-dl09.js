// DL 09 · Plan — Stripboard and Reports (~22 s)
// Plan → Stripboard: one strip per scene, coloured by interior/exterior and day/night, with lengths in
// eighths and cast numbers. (DraftLine's Stripboard has no day-break strips yet, so the video shows the
// day/night colour coding instead.) Then Reports → Characters: speeches, lines and scenes per character.
//   node scripts/record-dl09.js  →  recordings/DL_09_Plan_ReportsAndStripboards/video.webm
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_09_Plan_ReportsAndStripboards',
  async run({ page, click, glide, hold, say }) {
    await hold(800);

    say('Plan → Stripboard');
    await click(page.getByRole('radio', { name: 'Plan', exact: true }), 1000);
    await click(page.getByRole('radio', { name: /^Stripboard/ }), 1200);
    const strips = page.locator('.strip[role="row"]:not(.strip-head)');
    for (let i = 0; i < 4; i++) { await glide(strips.nth(i)); await page.waitForTimeout(650); }
    await glide(page.locator('.plan-stripboard').getByText(/NIGHT/).first());
    await hold(1500);

    say('Reports → Characters: scene tallies');
    await click(page.getByRole('radio', { name: /^Reports/ }), 1200);
    await click(page.getByRole('tab', { name: 'Characters' }), 1200);
    const scenesCol = page.getByRole('columnheader', { name: /^Scenes/ });
    await glide(scenesCol);
    await hold(1600);
    await click(scenesCol.getByRole('button'), 1600); // sort by number of scenes

    say('Reports → Scenes');
    await click(page.getByRole('tab', { name: 'Scenes' }), 2000);
    await glide([960, 700]);
    await hold(1000);
  },
}));
