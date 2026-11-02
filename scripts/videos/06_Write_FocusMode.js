// 06 · Write — Focus Mode (35–55 s, intro card included)
//
// Focus hides everything but the page: the toolbar, the panels and the status bar. Keep writing; switch
// the page to Midnight for a dark room and back; then Esc (or Exit focus) brings everything back, right
// where you left it.
//
//   node scripts/videos/06_Write_FocusMode.js
//   → videos/06_Write_FocusMode/06_Write_FocusMode.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '06_Write_FocusMode',
  sample: true,
  async setup(page) {
    // Off camera: the caret at the end of the last scene, so the take starts writing where it stopped.
    const last = page.locator('.el-action .el-input').last();
    await last.scrollIntoViewIfNeeded();
  },
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    say('The full workspace: toolbar, Scenes, status bar');
    await hold(1100);
    await glide(page.locator('.btn-focus').first());
    await hold(900);

    say('Focus: everything but the page steps away');
    await click(page.locator('.btn-focus').first(), 1400);
    await glide([960, 540]);
    await hold(1100);
    await glide([960, 30]);
    await hold(1300);

    say('Keep writing, nothing in the way');
    const last = page.locator('.el-action .el-input').last();
    await click(last, 400);
    await press('ControlOrMeta+End', 200); // the end of the line itself, not of its first wrapped row
    await press('Enter', 400);
    await typeHuman('The ferry turns for home. Nobody on deck says a word.');
    await hold(900);
    await press('Enter', 400);
    await typeHuman('Somewhere below, the engine finds its rhythm again.');
    await hold(1300);

    say('Midnight: a dark page for a dark room');
    await click(page.locator('.focus-controls .focus-exit').first(), 1600);
    await glide([960, 540]);
    await hold(2200);
    await click(page.locator('.focus-controls .focus-exit').first(), 1200);

    say('Esc: everything comes back, right where you left it');
    await glide(page.getByRole('button', { name: /^Exit focus/ }));
    await hold(900);
    await press('Escape', 1300);
    await glide([960, 540]);
    await hold(1200);
    await glide(page.locator('.btn-focus').first());
    await hold(1600);
  },
}));
