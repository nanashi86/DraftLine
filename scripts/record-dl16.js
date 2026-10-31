// DL 16 · General — Revisions, Snapshots & Visual Diff (Video 2.0, ~60 s)
// The project already has one snapshot of an earlier draft (no galley scene, a softer ending). The
// Snapshot button (camera) saves the current draft as a labelled checkpoint; File ▾ → View Snapshots
// lists both. Compare shows the earlier draft against today's — Inline (struck and highlighted text)
// and Side by Side — from a Myers diff run off the main thread. Last, Restore's preview: what comes
// back, and the option to snapshot the current draft first. It's cancelled, so nothing changes.
//
//   node scripts/record-dl16.js
//   → recordings/DL_16_General_RevisionsSnapshotsAndVisualDiff/DL_16_General_RevisionsSnapshotsAndVisualDiff.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, EARLIER_DRAFT, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({
  title: TITLE,
  author: AUTHOR,
  blocks: BLOCKS,
  storyNotes: STORY_NOTES,
  snapshots: [{ label: 'First draft', minutesAgo: 60 * 24 * 3, blocks: EARLIER_DRAFT }],
});

main(() => record({
  folder: 'DL_16_General_RevisionsSnapshotsAndVisualDiff',
  fixture,
  clean: true,
  maxSeconds: 75,
  async run({ page, click, glide, typeHuman, hold, say }) {
    await hold(2000); // pre-roll

    say('Snapshot: a labelled checkpoint of the whole project');
    await glide([900, 480]);
    await hold(1200);
    await click(page.getByRole('button', { name: 'Snapshot', exact: true }), 1000);
    await page.getByRole('textbox', { name: 'Snapshot label' }).waitFor(); // focused when the dialog opens
    await typeHuman('Galley scene added');
    await hold(1200);
    await click(page.getByRole('button', { name: 'Save Snapshot' }), 1400);
    await hold(1200);

    say('File → View Snapshots');
    await click(page.getByRole('button', { name: /^File/ }).first(), 900);
    await click(page.getByRole('menuitem', { name: /View Snapshots/ }), 1200);
    const drawer = page.getByRole('complementary', { name: 'Snapshots' });
    await glide(drawer.locator('li').first());
    await hold(2000);

    say('Compare the first draft with today\'s');
    await click(drawer.getByRole('button', { name: 'Compare First draft' }), 1800);
    await hold(2200); // Inline: struck-through red, added green
    const view = page.getByRole('radiogroup', { name: 'Comparison view' }).or(page.getByRole('group', { name: 'Comparison view' })).first();
    await click(view.getByRole('radio', { name: 'Side by Side' }).or(view.getByRole('button', { name: 'Side by Side' })).first(), 1600);
    await hold(2400);
    await click(view.getByRole('radio', { name: 'Inline' }).or(view.getByRole('button', { name: 'Inline' })).first(), 1400);
    await hold(1800);
    await click(page.getByRole('button', { name: 'Close Comparison' }), 1200);

    say('Restore: a preview first, with a safety snapshot');
    await click(drawer.getByRole('button', { name: 'Restore First draft' }), 1200);
    await glide(page.getByText('Snapshot the current draft first'));
    await hold(2400);
    await click(page.locator('dialog[open]').getByRole('button', { name: 'Cancel', exact: true }), 1000);
    await hold(1200);

    say('Close, back to the script');
    await click(page.getByRole('button', { name: 'Close Snapshots' }), 800);
    await glide([900, 480]);
    await hold(2000);
  },
}));
