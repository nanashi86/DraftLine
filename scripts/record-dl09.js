// DL 09 · Plan — Stripboard and Reports (~36 s)
// Plan → Stripboard: one strip per scene, coloured by interior/exterior and day/night, with lengths in
// eighths and cast numbers. Then Reports: Locations (scenes grouped by place) and Scenes, held as the
// production report, with its .csv export.
//
// DraftLine's Stripboard is in script order: strips can't be dragged into a shooting order yet, there
// are no day-break strips, and the reports export as .csv rather than through a print dialog. The video
// shows what's there: the colour coding, the strips, and the reports.
//
//   node scripts/record-dl09.js
//   → recordings/DL_09_Plan_ReportsAndStripboards/DL_09_Plan_ReportsAndStripboards.mp4 (+ .webm)
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_09_Plan_ReportsAndStripboards',
  maxSeconds: 42,
  async run({ page, click, glide, hold, say }) {
    await glide([960, 520]);
    await hold(2000);

    say('Plan → Stripboard');
    await click(page.getByRole('radio', { name: 'Plan', exact: true }), 1200);
    await click(page.getByRole('radio', { name: /^Stripboard/ }), 1500);

    say('Day / night colour coding');
    await glide(page.locator('.strip-legend'));
    await hold(2500);
    const strips = page.locator('.strip[role="row"]:not(.strip-head)');
    for (let i = 0; i < Math.min(4, await strips.count()); i++) {
      await glide(strips.nth(i));
      await hold(1100);
    }
    await glide(page.locator('.plan-stripboard').getByText(/NIGHT/).first());
    await hold(2000);

    say('Reports → Locations');
    await click(page.getByRole('radio', { name: /^Reports/ }), 1200);
    await click(page.getByRole('tab', { name: 'Locations' }), 2500);

    say('Reports → Scenes: the production report');
    await click(page.getByRole('tab', { name: 'Scenes' }), 1200);
    await glide(page.locator('.rp-csv'));
    await hold(3000);
    await glide([960, 560]);
    await hold(1500);
  },
}));
