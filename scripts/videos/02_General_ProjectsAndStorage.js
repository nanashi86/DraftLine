// 02 · General — Projects and Storage (35–55 s, intro card included)
//
// The Projects drawer: make a new script, name it, write in it; rename it from its card; reload the
// tab and everything is still there (it's saved in the browser as you type); then switch between
// scripts from the drawer.
//
//   node scripts/videos/02_General_ProjectsAndStorage.js
//   → videos/02_General_ProjectsAndStorage/02_General_ProjectsAndStorage.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '02_General_ProjectsAndStorage',
  sample: true, // the library starts with one script, The Last Ferry
  async run({ page, click, glide, typeHuman, press, hold, say, reload }) {
    say('The Last Ferry, open; every script lives in Projects');
    await hold(1000);
    await click(page.getByRole('button', { name: 'Projects', exact: true }), 1000);
    await glide(page.locator('.pd-card').first());
    await hold(1000);

    say('New Script: give it a title');
    await click(page.getByRole('button', { name: /New Script/ }), 500);
    await typeHuman('Night Shift');
    await hold(500);
    await click(page.getByRole('button', { name: 'Create', exact: true }), 1100);

    say('A blank page of its own; write the first line');
    await click(page.locator('.el-scene .el-input').first(), 400);
    await typeHuman('INT. DINER - NIGHT');
    await press('Enter', 300);
    await typeHuman('Neon hums over an empty counter.');
    await hold(1000);

    say('Rename it from its card');
    await click(page.getByRole('button', { name: 'Projects', exact: true }), 900);
    await click(page.locator('.pd-card', { hasText: 'Night Shift' }).getByRole('button', { name: 'Actions for Night Shift' }).first(), 600);
    await click(page.getByRole('menuitem', { name: 'Rename' }), 500);
    await typeHuman('The Night Shift');
    await press('Enter', 1100);
    await click(page.getByRole('button', { name: 'Close projects' }), 800);

    say('Saved in this browser as you type: reload, and it is all still here');
    await glide(page.locator('.status-save'));
    await hold(1100);
    await reload();
    await hold(400);
    await glide(page.locator('.el-action .el-input').first());
    await hold(1600);

    say('Switch scripts from Projects');
    await click(page.getByRole('button', { name: 'Projects', exact: true }), 900);
    await click(page.locator('.pd-card', { hasText: 'The Last Ferry' }), 1300);
    await glide([960, 520]);
    await hold(1400);
    await click(page.getByRole('button', { name: 'Projects', exact: true }), 900);
    await click(page.locator('.pd-card', { hasText: 'The Night Shift' }), 1200);
    await glide([960, 470]);
    await hold(1200);
  },
}));
