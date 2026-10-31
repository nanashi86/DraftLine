// DL 12 · Write — Scene Board & Pacing (Video 2.0, ~60 s)
// Alt+B opens Split: the script beside the Scene Board. Import Scenes → Auto-Distribute (% Targets)
// makes a card per scene and places each in its act by the page it starts on; the menu shows the
// actual page ranges. Each act's header gets a pacing badge (pages · share). A scene card is dragged
// to a new place, which moves that scene in the script too. Then 4 Acts ↔ 3 Acts: no card moves,
// the Midpoint divider shows where 2A ends.
//
//   node scripts/record-dl12.js
//   → recordings/DL_12_Write_SceneBoardAndPacing/DL_12_Write_SceneBoardAndPacing.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

main(() => record({
  folder: 'DL_12_Write_SceneBoardAndPacing',
  fixture,
  clean: true,
  maxSeconds: 75,
  async run({ page, click, glide, drag, press, hold, say }) {
    await hold(2000); // pre-roll

    say('Alt+B: Split view, the script beside the Scene Board');
    await glide([700, 480]);
    await hold(1200);
    await press('Alt+b', 1200);
    const board = page.getByRole('region', { name: 'Scene Board' }).or(page.locator('.board')).first();
    await board.waitFor();
    await hold(1600);

    say('Import Scenes → Auto-Distribute (% Targets)');
    await click(board.getByRole('button', { name: /Import Scenes/ }), 900);
    await glide(page.getByRole('menuitem', { name: /Auto-Distribute/ }));
    await hold(2200); // the targets and this script's actual page ranges
    await click(page.getByRole('menuitem', { name: /Auto-Distribute/ }), 1400);
    await hold(1600);

    say('Pacing: pages and share for each act');
    const badges = board.locator('.col-pace');
    for (let i = 0; i < 4; i++) {
      if (await badges.nth(i).isVisible()) {
        await glide(badges.nth(i));
        await hold(1200);
      }
    }

    say('Drag a scene card: the scene moves in the script too');
    const grip = board.locator('.card-grip').nth(1);
    const target = board.locator('.board-col, .col').nth(1).locator('.col-list');
    await glide(grip);
    await hold(1200);
    await drag(grip, target, { dy: 40 });
    await hold(2200);

    say('3 Acts or 4 Acts: no card moves');
    const structure = board.getByRole('radiogroup', { name: 'Act structure' }).or(board.getByRole('group', { name: 'Act structure' })).first();
    await click(structure.getByRole('radio', { name: '3 Acts' }).or(structure.getByRole('button', { name: '3 Acts' })).first(), 1200);
    await glide(board.locator('.midpoint').first());
    await hold(2400); // Act 2: 2A cards, the Midpoint divider, 2B cards
    await click(structure.getByRole('radio', { name: '4 Acts' }).or(structure.getByRole('button', { name: '4 Acts' })).first(), 1200);
    await hold(2000);

    say('Back to the page');
    await click(page.getByRole('radio', { name: 'Page' }), 900);
    await glide([900, 480]);
    await hold(2000);
  },
}));
