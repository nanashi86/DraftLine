// 15 · Plan — Breakdown and Stripboard (40–50 s, intro card included)
//
// Write | Plan → Plan. Breakdowns: a card per scene with its INT/EXT, DAY/NIGHT, length in eighths and
// speaking cast, all read from the script (Marie is already there, cast number 1). A prop is tagged on
// scene 1: Marie's suitcase. Stripboard: one strip per scene in the standard colours, with the legend's
// counts; the scene filter narrows it to exteriors, then nights. Strips stay in script order.
//
//   node scripts/videos/15_Plan_BreakdownAndStripboard.js
//   → videos/15_Plan_BreakdownAndStripboard/15_Plan_BreakdownAndStripboard.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '15_Plan_BreakdownAndStripboard',
  sample: true,
  seconds: [40, 50],
  async run({ page, click, glide, press, typeHuman, hold, say }) {
    say('Write | Plan: the production side of the same script');
    await glide([960, 500]);
    await hold(1100);
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 1500);

    say('Breakdowns: a card per scene, read from the script');
    const card = page.locator('.plan-breakdowns article.plan-card').first();
    const expand = card.getByRole('button', { name: 'Expand' });
    if (await expand.count()) await click(expand, 900);
    await glide(card.locator('.plan-card-head'));
    await hold(2400);

    say('Cast: everyone who speaks, Marie first');
    await glide(card.locator('.plan-cast-list'));
    await hold(2800);

    say('Tag a prop: Marie’s suitcase');
    await click(card.getByRole('button', { name: 'Add to Props & Set Dressing' }), 500);
    await click(card.locator('input.plan-add-input'), 300);
    await typeHuman('Suitcase (one bad wheel)');
    await press('Enter', 1000);
    await glide(card.locator('.plan-card-body'), { dy: 40 });
    await hold(2600);

    say('Stripboard: one colour-coded strip per scene');
    await click(page.getByRole('radio', { name: 'Stripboard' }), 1300);
    await glide(page.locator('.strip-legend'));
    await hold(2400);
    await glide(page.locator('[aria-label="Stripboard, in script order"]'));
    await hold(2600);

    say('Narrow it: exteriors, then nights');
    const filter = page.locator('.plan-filter:visible').first();
    await click(filter.getByRole('button', { name: 'EXT', exact: true }), 2300);
    await click(filter.getByRole('button', { name: 'NIGHT', exact: true }), 2300);
    await click(page.locator('.pf-clear:visible').first(), 1600);

    say('Back to Write');
    await click(page.locator('.ws-btn[data-workspace="write"]'), 1100);
    await glide([960, 500]);
    await hold(2000);
  },
}));
