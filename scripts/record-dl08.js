// DL 08 · Plan — Breakdowns and scene eighths (~22 s)
// Plan → Breakdowns: each scene's length in eighths of a page (worked out from the script), its
// speaking cast (filled in automatically), and production tags added by hand (a prop, extras).
//   node scripts/record-dl08.js  →  recordings/DL_08_Plan_BreakdownsAndSceneEighths/video.webm
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_08_Plan_BreakdownsAndSceneEighths',
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    await hold(800);

    say('Plan → Breakdowns');
    await click(page.getByRole('radio', { name: 'Plan', exact: true }), 1200);
    await click(page.getByRole('radio', { name: /^Breakdowns/ }), 900);

    say('Scene lengths in eighths');
    const lengths = page.locator('.plan-len');
    await glide(lengths.nth(0));
    await hold(1500);
    await glide(lengths.nth(1));
    await hold(1300);

    say('Speaking cast, from the script');
    await glide(page.getByText('Cast (speaking)', { exact: false }).first(), { dy: 22 });
    await hold(1300);

    say('Tags: a prop and extras');
    const first = page.locator('.plan-card').first();
    await click(first.getByRole('button', { name: 'Add to Props & Set Dressing' }), 300);
    await typeHuman('Suitcase with one bad wheel', { fast: true });
    await press('Enter', 900);
    await click(first.getByRole('button', { name: 'Add to Background / Extras' }), 300);
    await typeHuman('Dock workers (6)', { fast: true });
    await press('Enter', 900);
    await press('Escape', 300);
    await glide([1500, 600]);
    await hold(1800);
  },
}));
