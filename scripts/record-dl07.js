// DL 07 · Write — Scene Board outlining (~24 s)
// The Scene Board in 4 Acts and 3 Acts, a card dragged by its grip to a new place, and a colour tag.
//   node scripts/record-dl07.js  →  recordings/DL_07_Write_SceneBoardOutlining/video.webm
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_07_Write_SceneBoardOutlining',
  async run({ page, click, drag, glide, hold, say }) {
    await hold(800);

    say('Scene Board');
    await click(page.getByRole('radio', { name: 'Board', exact: true }), 2000);

    say('3 Acts and 4 Acts');
    await click(page.getByRole('radio', { name: '3 Acts' }), 2600);
    await click(page.getByRole('radio', { name: '4 Acts' }), 1800);

    say('Drag a card by its grip');
    const cards = page.locator('article.card');
    await drag(page.locator('.card-grip').first(), cards.nth(3), { dy: 30 }); // card 1 → below card 4
    await hold(1600);

    say('Colour tag');
    const card = cards.nth(1);
    await click(card.getByRole('button', { name: 'Theme', exact: true }), 1400);
    await click(card.getByRole('button', { name: 'Subplot', exact: true }), 1600);

    await glide([960, 980]);
    await hold(1200);
  },
}));
