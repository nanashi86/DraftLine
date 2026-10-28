// DL 08 · Plan — Breakdowns and scene eighths (~34 s)
// In Write, the word "suitcase" in scene 1 is picked out; then Plan → Breakdowns: scene lengths in
// eighths of a page (worked out from the script), and the suitcase added to scene 1's Props.
//
// Breakdown tags are added on the scene's card in Plan → Breakdowns; there's no tagging straight
// from a selection in the script yet, so the video selects the word in Write, then tags it in Plan.
//
//   node scripts/record-dl08.js
//   → recordings/DL_08_Plan_BreakdownsAndSceneEighths/DL_08_Plan_BreakdownsAndSceneEighths.mp4 (+ .webm)
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_08_Plan_BreakdownsAndSceneEighths',
  maxSeconds: 42,
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    await glide([960, 520]);
    await hold(2000);

    say('Scene 1: the suitcase');
    const line = page.locator('.el-input').filter({ hasText: /suitcase/i }).first();
    await line.scrollIntoViewIfNeeded();
    await click(line, 300);
    await line.evaluate((el) => {
      const i = el.value.toLowerCase().indexOf('suitcase');
      el.focus();
      el.setSelectionRange(i, i + 'suitcase'.length);
    });
    await hold(2500);

    say('Plan → Breakdowns');
    await click(page.getByRole('radio', { name: 'Plan', exact: true }), 1200);
    await click(page.getByRole('radio', { name: /^Breakdowns/ }), 1500);

    say('Each scene’s length in eighths of a page');
    const lengths = page.locator('.plan-len');
    for (let i = 0; i < Math.min(3, await lengths.count()); i++) {
      await glide(lengths.nth(i));
      await hold(1400);
    }

    say('Tag the suitcase as a prop in scene 1');
    const first = page.locator('.plan-card').first();
    await first.scrollIntoViewIfNeeded();
    await click(first.getByRole('button', { name: 'Add to Props & Set Dressing' }), 400);
    await typeHuman('Suitcase (one bad wheel)');
    await press('Enter', 600);
    await press('Escape', 300);
    await glide(first.getByText('Suitcase (one bad wheel)'));
    await hold(2200);
    await glide(lengths.first());
    await hold(2500);
  },
}));
