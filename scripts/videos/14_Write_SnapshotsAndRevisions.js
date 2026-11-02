// 14 · Write — Snapshots and Revisions (38–48 s, intro card included)
//
// The Last Ferry already holds one snapshot, "First pass", an earlier draft. Snapshot (top bar) saves
// today's draft as "Pre-Polish Draft"; ⋮ → View Snapshots lists both. Compare shows what changed since
// the first pass: Inline (struck-through red, added green, element changes tagged) and Side by Side.
// Close, back to the manuscript.
//
//   node scripts/videos/14_Write_SnapshotsAndRevisions.js
//   → videos/14_Write_SnapshotsAndRevisions/14_Write_SnapshotsAndRevisions.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '14_Write_SnapshotsAndRevisions',
  sample: true,
  seconds: [38, 48],
  async run({ page, click, glide, typeHuman, hold, say }) {
    say('Snapshot: a labelled checkpoint of the whole project');
    await glide([960, 500]);
    await hold(1100);
    await click(page.getByRole('button', { name: 'Snapshot', exact: true }), 900);
    const label = page.getByRole('textbox', { name: 'Snapshot label' });
    await label.waitFor();
    await typeHuman('Pre-Polish Draft');
    await hold(900);
    await click(page.getByRole('button', { name: 'Save Snapshot' }), 1400);

    say('⋮ → View Snapshots: newest first');
    await click(page.locator('.btn-kebab').first(), 800);
    await click(page.getByRole('menuitem', { name: /View Snapshots/ }), 1200);
    const drawer = page.getByRole('complementary', { name: 'Snapshots' });
    await glide(drawer.locator('li.sn-item').first());
    await hold(1600);
    await glide(drawer.locator('li.sn-item').nth(1));
    await hold(1300);

    say('Compare the first pass with today’s draft');
    await click(drawer.getByRole('button', { name: 'Compare First pass with the current draft' }), 1600);
    const view = page.getByRole('group', { name: 'Comparison view' });
    await glide([760, 560]);
    await hold(2600); // Inline: struck-through red, added green

    say('Side by Side: the snapshot left, today’s draft right');
    await click(view.getByRole('button', { name: 'Side by Side' }), 1200);
    await glide([960, 600]);
    await hold(2800);

    say('Close, back to the manuscript');
    await click(page.getByRole('button', { name: 'Close Comparison' }), 1100);
    await click(page.getByRole('button', { name: 'Close Snapshots' }), 900);
    await glide([960, 500]);
    await hold(2000);
  },
}));
