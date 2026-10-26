// DL 04 · Write — Characters and Dialogue Spotlight (~20 s)
// Characters → Dialogue → MARIE: her lines stay bright, everything else dims; scroll her pass.
//   node scripts/record-dl04.js  →  recordings/DL_04_Write_CharactersAndDialogueSpotlight/video.webm
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_04_Write_CharactersAndDialogueSpotlight',
  async run({ page, click, glide, wheel, hold, say }) {
    await hold(1000);

    say('Characters → Dialogue');
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 700);
    await click(page.getByRole('tab', { name: /^Dialogue/ }), 700);

    say('Spotlight MARIE');
    await click(page.locator('button', { hasText: /^MARIE/ }).first(), 1800);

    say('Scroll the isolated pass');
    await glide([860, 620]);
    await wheel(260, 9, 360);
    await hold(1500);
    await wheel(-260, 9, 140);
    await hold(600);

    await click(page.locator('button', { hasText: /^MARIE/ }).first(), 700); // spotlight off
    await click(page.getByRole('button', { name: 'Close Characters' }), 600);
    await glide([960, 540]);
    await hold(900);
  },
}));
