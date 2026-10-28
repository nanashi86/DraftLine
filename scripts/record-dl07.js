// DL 07 · Write — Scene Board outlining (~36 s)
// The Last Ferry with an empty Scene Board (loaded off camera). Write → Board, Populate from Script
// makes one card per scene in its act, a card's synopsis is rewritten, and a scene card dragged from
// Act 1 into Act 2 moves its scene in the screenplay too. Back on the page, the scenes are renumbered
// in their new order.
//
// The Scene Board lives in Write (Page · Split · Board), not in Plan.
//
//   node scripts/record-dl07.js
//   → recordings/DL_07_Write_SceneBoardOutlining/DL_07_Write_SceneBoardOutlining.mp4 (+ .webm)
import { fixtureProject, main, record } from './lib/demoKit.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const fixture = fixtureProject({
  title: 'The Last Ferry',
  author: SAMPLE_SCRIPT.meta.author,
  blocks: SAMPLE_SCRIPT.blocks,
  beats: [], // an empty board, so Populate from Script builds it on camera
});

main(() => record({
  folder: 'DL_07_Write_SceneBoardOutlining',
  fixture,
  maxSeconds: 45,
  async run({ page, click, drag, glide, typeHuman, press, hold, say }) {
    await glide([960, 520]);
    await hold(2000);

    say('Write → Board');
    await click(page.getByRole('radio', { name: 'Board', exact: true }), 1500);
    await click(page.getByRole('radio', { name: '3 Acts' }), 1200);

    say('Populate from Script: one card per scene, placed by act');
    await click(page.getByRole('button', { name: /^Populate from Script/ }), 900);
    await click(page.getByRole('menuitem', { name: /^Auto-Distribute/ }), 2200);

    const column = (label) => page.locator('.col').filter({ has: page.locator('.col-act', { hasText: new RegExp(`^${label}$`) }) });
    await glide(column('Act 1').locator('.col-head'));
    await hold(1200);
    await glide(column('Act 3').locator('.col-head'));
    await hold(1500);

    say('Rewrite a card’s synopsis');
    const firstCard = page.locator('article.card').first();
    const synopsis = firstCard.getByRole('textbox', { name: 'Synopsis' });
    await click(synopsis, 300);
    await press('ControlOrMeta+a', 150);
    await typeHuman('Marie slips out before dawn with one suitcase. Theo catches her at the pier, barefoot and furious.');
    await hold(2200);
    await press('Escape', 200);
    await glide([960, 120]); // off the card so it settles
    await hold(600);

    say('Drag an Act 1 scene card into Act 2');
    const act1Cards = column('Act 1').locator('article.card');
    const moving = (await act1Cards.count()) > 1 ? act1Cards.last() : act1Cards.first();
    const target = column('Act 2').locator('article.card').last();
    await drag(moving.locator('.card-grip'), target, { dy: 40 });
    await hold(2600);

    say('Back to the page: the script follows the board');
    await click(page.getByRole('radio', { name: 'Page', exact: true }), 1200);
    await glide(page.locator('.nav-list'));
    await hold(3000);
    await glide([960, 520]);
    await hold(1500);
  },
}));
