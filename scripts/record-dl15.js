// DL 15 · Plan — Production Reports & Deliverables (Video 2.0, ~55 s)
// Plan → Reports: Scenes, Characters and Locations, worked out from the script each time, each one
// downloadable as a .csv. Then the deliverable: File ▾ → PDF opens Export PDF, whose one question is
// Include Scene Numbers (Production Draft); the PDF is built in DraftLine with Courier Prime embedded.
//
//   node scripts/record-dl15.js
//   → recordings/DL_15_Plan_ReportsAndDeliverables/DL_15_Plan_ReportsAndDeliverables.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

main(() => record({
  folder: 'DL_15_Plan_ReportsAndDeliverables',
  fixture,
  clean: true,
  maxSeconds: 70,
  async run({ page, click, glide, hold, say }) {
    await hold(2000); // pre-roll

    say('Plan → Reports');
    await glide([900, 480]);
    await hold(1200);
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 1200);
    await click(page.getByRole('radio', { name: 'Reports' }), 1200);
    const reports = page.locator('.plan-reports');
    await hold(1600);

    for (const tab of ['Scenes', 'Characters', 'Locations']) {
      say(`${tab}`);
      await click(reports.getByRole('tab', { name: tab }), 1000);
      await glide(reports.locator('table, .rp-table').first(), { dy: -60 });
      await hold(2000);
    }

    say('Each report downloads as a .csv');
    await glide(reports.locator('.rp-csv'));
    await hold(1200);
    await click(reports.locator('.rp-csv'), 1400);

    say('The deliverable: File → PDF');
    await click(page.getByRole('button', { name: /^File/ }).first(), 900);
    await click(page.getByRole('menuitem', { name: /^PDF/ }), 1200);
    const dialog = page.locator('dialog.xp-modal[open]');
    await hold(1400);

    say('Include Scene Numbers (Production Draft): off for a spec script, on for production');
    const numbers = dialog.getByRole('checkbox', { name: /Include Scene Numbers/ });
    await click(numbers, 1200);
    await hold(1800);
    await click(dialog.getByRole('button', { name: /Download|Export/ }).last(), 1500);
    await hold(2000);

    say('Back to Write');
    await click(page.locator('.ws-btn[data-workspace="write"]'), 1000);
    await glide([900, 480]);
    await hold(2000);
  },
}));
