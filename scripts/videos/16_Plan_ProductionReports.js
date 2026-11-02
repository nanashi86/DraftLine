// 16 · Plan — Production Reports (38–48 s, intro card included)
//
// Plan → Reports, worked out from the script each time: Characters (speeches, words, scenes and their
// share of the dialogue), Scenes (INT/EXT, time of day, page, eighths, who speaks), Locations (click one
// for its scenes) and Script in numbers. Each downloads as a .csv. Back to Write.
//
//   node scripts/videos/16_Plan_ProductionReports.js
//   → videos/16_Plan_ProductionReports/16_Plan_ProductionReports.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '16_Plan_ProductionReports',
  sample: true,
  seconds: [38, 48],
  async run({ page, click, glide, hold, say }) {
    say('Plan → Reports');
    await glide([960, 500]);
    await hold(1100);
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 1300);
    await click(page.getByRole('radio', { name: 'Reports' }), 1300);
    const reports = page.locator('.plan-reports');
    const table = () => reports.locator('table').first();

    say('Characters: the speaking roles, their words and share of the dialogue');
    await click(reports.getByRole('tab', { name: 'Characters' }), 1000);
    await glide(table(), { dy: -40 });
    await hold(3000);

    say('Scenes: INT/EXT, day or night, page, eighths and who speaks');
    await click(reports.getByRole('tab', { name: 'Scenes' }), 1000);
    await glide(table(), { dy: -30 });
    await hold(3000);

    say('Locations: click one for its scenes');
    await click(reports.getByRole('tab', { name: 'Locations' }), 1000);
    await click(reports.locator('tr.rp-row').first(), 2800);
    await glide(reports.locator('.rp-scene').first());
    await hold(1400);

    say('Script: the whole draft in numbers');
    await click(reports.getByRole('tab', { name: 'Script' }), 1000);
    await glide([700, 470]);
    await hold(3000);

    say('Every report downloads as a .csv');
    await glide(reports.locator('.rp-csv'));
    await hold(1600);

    say('Back to Write');
    await click(page.locator('.ws-btn[data-workspace="write"]'), 1100);
    await glide([960, 500]);
    await hold(2000);
  },
}));
