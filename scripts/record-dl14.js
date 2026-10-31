// DL 14 · Plan — Workspace & Production Suite (Video 2.0, ~60 s)
// Write | Plan → Plan. Breakdowns: a card per scene with its INT/EXT, DAY/NIGHT, length in eighths and
// speaking cast worked out from the script; a prop is added to a scene's list. Stripboard: one strip
// per scene in the standard four colours (INT DAY white, EXT DAY yellow, INT NIGHT blue, EXT NIGHT
// green). The scene filter: INT, then NIGHT, then a search; it only hides scenes.
//
//   node scripts/record-dl14.js
//   → recordings/DL_14_Plan_WorkspaceAndProductionSuite/DL_14_Plan_WorkspaceAndProductionSuite.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

main(() => record({
  folder: 'DL_14_Plan_WorkspaceAndProductionSuite',
  fixture,
  clean: true,
  maxSeconds: 75,
  async run({ page, click, glide, press, typeHuman, hold, say, wheel }) {
    await hold(2000); // pre-roll

    say('Write | Plan: the production view of the same script');
    await glide([900, 480]);
    await hold(1200);
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 1400);
    await hold(1500);

    say('Breakdowns: cast, INT/EXT, DAY/NIGHT and eighths, from the script');
    // Scripts over 10 scenes open folded: a list of scenes to pick from.
    const firstCard = page.locator('.plan-breakdowns article.plan-card').first();
    await glide(page.locator('.plan-breakdowns'), { dy: -200 });
    await hold(1500);
    const expand = firstCard.getByRole('button', { name: 'Expand' });
    if (await expand.count()) await click(expand, 1000);
    await glide(firstCard.locator('.plan-cast-list'));
    await hold(2200);

    say('Add a prop to the scene');
    await click(firstCard.getByRole('button', { name: 'Add to Props & Set Dressing' }), 500);
    await click(firstCard.locator('input.plan-add-input'), 300);
    await typeHuman('Marie\'s suitcase (bad wheel)');
    await press('Enter', 900);
    await hold(1600);

    say('Stripboard: one colour-coded strip per scene');
    await click(page.getByRole('radio', { name: 'Stripboard' }), 1200);
    await glide(page.locator('[aria-label="Stripboard, in script order"]'));
    await hold(1600);
    await wheel(200, 2, 500);
    await hold(1400);

    say('The scene filter: interiors, then nights, then a search');
    const filter = page.locator('.plan-filter:visible').first();
    await click(filter.getByRole('button', { name: 'INT', exact: true }), 1200);
    await hold(1400);
    await click(filter.getByRole('button', { name: 'NIGHT', exact: true }), 1200);
    await hold(1600);
    await click(filter.getByRole('searchbox', { name: /Find scenes/ }), 400);
    await typeHuman('engine');
    await hold(1800);
    await click(page.locator('.pf-clear:visible').first(), 1000);
    await hold(1500);

    say('Back to Write');
    await click(page.locator('.ws-btn[data-workspace="write"]'), 1000);
    await glide([900, 480]);
    await hold(2000);
  },
}));
