// 12 · Write — Dialogue Tuner (38–50 s, intro card included)
//
// Characters → Dialogue (Alt+T): every line one character speaks, with their totals: lines, words,
// scenes, average words a line, monologues and cadence. Marie first, then Theo, to compare their two
// voices; Cue context shows the line before each speech. Close, back to the editor.
//
//   node scripts/videos/12_Write_DialogueTuner.js
//   → videos/12_Write_DialogueTuner/12_Write_DialogueTuner.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '12_Write_DialogueTuner',
  sample: true,
  async run({ page, click, glide, press, hold, say, wheel }) {
    say('Characters → Dialogue');
    await glide([960, 500]);
    await hold(1200);
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 1000);
    const drawer = page.getByRole('complementary', { name: 'Characters' });
    await click(drawer.getByRole('tab', { name: /^Dialogue/ }), 1400);

    say('Marie: lines, words, scenes, words a line');
    await click(drawer.locator('.cast-chip', { hasText: 'MARIE' }), 1200);
    const stats = drawer.locator('.tuner-stats');
    await glide(stats, { dx: -80 });
    await hold(2000);

    say('Her cadence and monologues');
    await glide(stats, { dx: 90 });
    await hold(2600);

    say('Every line she speaks, in order');
    await glide(drawer.locator('.tuner').getByRole('textbox', { name: 'Dialogue' }).first());
    await hold(1000);
    await wheel(260, 3, 700);
    await hold(1600);
    await wheel(-260, 3, 300);

    say('Now Theo: compare the two voices');
    await click(drawer.locator('.cast-chip', { hasText: 'THEO' }), 1200);
    await glide(stats, { dx: -80 });
    await hold(2400);
    await glide(stats, { dx: 90 });
    await hold(2600);

    say('Cue context: hide or show the line before each speech');
    const cue = drawer.locator('label.tuner-toggle', { hasText: 'Cue context' });
    await click(cue, 2000);
    await click(cue, 2000);

    say('Close, then Esc clears the spotlight');
    await click(page.getByRole('button', { name: 'Close Characters' }), 900);
    await glide([960, 500]);
    await press('Escape', 900);
    await hold(2200);
  },
}));
