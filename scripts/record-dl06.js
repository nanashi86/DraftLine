// DL 06 · Write — Focus mode and Snapshots (~22 s)
// Focus hides everything but the page (Esc brings it back); then a Snapshot saved as a milestone
// draft, and the Snapshots list.
//   node scripts/record-dl06.js  →  recordings/DL_06_Write_FocusModeAndSnapshots/video.webm
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_06_Write_FocusModeAndSnapshots',
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    await hold(1000);

    say('Focus mode');
    await click(page.getByRole('button', { name: 'Focus', exact: true }), 600);
    await glide([1700, 900]); // out of the way
    await hold(3200);
    await press('Escape', 1200);

    say('Snapshot: a milestone draft');
    await click(page.getByRole('button', { name: 'Snapshot', exact: true }), 600);
    const label = page.getByRole('textbox', { name: 'Snapshot label' });
    await click(label, 150);
    await press('ControlOrMeta+a', 100);
    await typeHuman('Milestone — First Draft', { fast: true });
    await hold(500);
    await click(page.getByRole('button', { name: 'Save Snapshot' }), 1200);

    say('Snapshots list');
    await click(page.getByRole('button', { name: 'More' }), 400);
    await click(page.getByRole('menuitem', { name: /^View Snapshots/ }), 2600);
    await click(page.getByRole('button', { name: 'Close Snapshots' }), 600);
    await glide([960, 540]);
    await hold(900);
  },
}));
