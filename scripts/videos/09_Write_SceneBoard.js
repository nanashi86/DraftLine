// 09 · Write — Scene Board (38–50 s, intro card included)
//
// The Last Ferry's eight story cards, laid out in act columns. Drag a card to a new place, click into a
// card to read and rework its summary, light up the cards by tag, then back to the page.
//
//   node scripts/videos/09_Write_SceneBoard.js
//   → videos/09_Write_SceneBoard/09_Write_SceneBoard.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '09_Write_SceneBoard',
  sample: true,
  async run({ page, click, drag, glide, typeHuman, press, hold, say }) {
    say('The script; Board opens the Scene Board');
    await glide([960, 500]);
    await hold(1200);
    await click(page.getByRole('radio', { name: 'Board', exact: true }), 1600);

    say('A card per story beat, in act columns');
    const column = (label) => page.locator('.col').filter({ has: page.locator('.col-act', { hasText: new RegExp(`^${label}$`) }) });
    await glide(column('Act 1').locator('.col-head'));
    await hold(1500);
    await glide(page.locator('article.card').first());
    await hold(1500);
    await glide(page.locator('article.card').nth(3));
    await hold(1300);
    await glide(column('Act 3').locator('.col-head'));
    await hold(1800);

    say('Drag a card to reorder the story');
    const act2 = page.locator('article.card', { hasText: 'Father at the bow' });
    const target = page.locator('article.card', { hasText: 'The pier slides away' });
    await drag(act2.locator('.card-grip'), target, { dy: 40 });
    await hold(1600);
    await glide(act2.locator('.card-title'));
    await hold(1800);

    say('Click into a card: its headline and summary');
    const card = page.locator('article.card', { hasText: 'The letter' });
    await glide(card.locator('.card-title'));
    await hold(900);
    const syn = card.getByRole('textbox', { name: 'Synopsis' });
    await click(syn, 400);
    await press('ControlOrMeta+End', 200);
    await typeHuman(' She hid it in the tackle box.');
    await hold(2200);
    await press('Escape', 300);
    await glide([960, 160]);
    await hold(600);

    say('Light up the cards by tag');
    await click(page.locator('.legend-item').filter({ hasText: 'Character' }), 2200);
    await click(page.locator('.legend-item').filter({ hasText: /^Plot$/ }), 2200);
    await click(page.locator('.legend-item').filter({ hasText: /^Plot$/ }), 1000);

    say('Back to the manuscript');
    await click(page.getByRole('radio', { name: 'Page', exact: true }), 1200);
    await glide([960, 500]);
    await hold(2000);
  },
}));
