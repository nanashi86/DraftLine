// DL 10 · Write — Split view (~34 s)
// Write → Split: the script and the Scene Board side by side, so the outline stays in view while you
// write. The board shows Act 1's setup cards for reference; the scene list jumps the page to scene 4
// (the wheelhouse, the climax) and a new action line is written there. Then back to Page.
//
// Split pairs the page with the Scene Board; it isn't two script panes, so "pin scene 1" is the
// board's Act 1 column staying in view while the page moves to scene 4.
//
//   node scripts/record-dl10.js
//   → recordings/DL_10_Write_DualPaneSplitView/DL_10_Write_DualPaneSplitView.mp4 (+ .webm)
import { fixtureProject, main, record } from './lib/demoKit.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';
import { sampleBeats } from '../src/lib/beats.js';

const fixture = fixtureProject({
  title: 'The Last Ferry',
  author: SAMPLE_SCRIPT.meta.author,
  blocks: SAMPLE_SCRIPT.blocks,
  beats: sampleBeats(),
});

main(() => record({
  folder: 'DL_10_Write_DualPaneSplitView',
  fixture,
  maxSeconds: 42,
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    await glide([960, 520]);
    await hold(2000);

    say('Split: page and Scene Board side by side');
    await click(page.getByRole('radio', { name: 'Split', exact: true }), 1800);

    say('Act 1 on the board: the setup, for reference');
    const act1 = page.locator('.col').filter({ has: page.locator('.col-act', { hasText: /^Act 1$/ }) });
    await glide(act1.locator('article.card').first());
    await hold(2500);

    say('Jump the page to scene 4');
    await click(page.locator('.nav-item').filter({ hasText: /WHEELHOUSE/ }).first(), 1500);

    say('Write an action line in scene 4');
    const action = page.locator('.el-input').filter({ hasText: /^Rain hammers the glass/ }).first();
    await click(action, 200);
    await action.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
    await press('Enter', 300);
    await typeHuman('Lightning. For one white second Marie sees the island, and the lamp still burning in Manman’s window.');
    await hold(1500);
    await glide(act1.locator('article.card').first());
    await hold(2200);

    say('Back to Page');
    await click(page.getByRole('radio', { name: 'Page', exact: true }), 1200);
    await glide([960, 520]);
    await hold(2000);
  },
}));
