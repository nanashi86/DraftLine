// DL 01 · General — Projects and workspaces (~22 s)
// Projects drawer, linking a synced folder and its "Synced" badge, then Write ⇄ Plan.
//   node scripts/record-dl01.js  →  recordings/DL_01_General_ProjectsAndWorkspaces/video.webm
import { main, record } from './lib/demoKit.js';

main(() => record({
  folder: 'DL_01_General_ProjectsAndWorkspaces',
  syncFolder: 'DraftLine Scripts', // stand-in folder: Playwright can't drive the OS folder picker
  async run({ page, click, glide, hold, say }) {
    await hold(1200);

    say('Projects drawer');
    await click(page.getByRole('button', { name: 'Switch Project' }), 900);
    await glide(page.locator('.pd-card').first());
    await hold(1200);

    say('Link a folder: scripts are saved as .draftline files there too');
    await glide(page.locator('.sd'));
    await hold(900);
    await click(page.getByRole('button', { name: 'Link Folder…' }), 1600);
    await click(page.getByRole('button', { name: 'Close projects' }), 600);

    say('The status bar: Synced');
    await glide(page.locator('.status-save'));
    await hold(2200);

    say('Write and Plan');
    await click(page.getByRole('radio', { name: 'Plan', exact: true }), 2400);
    await click(page.getByRole('radio', { name: /^Stripboard/ }), 1800);
    await click(page.getByRole('radio', { name: /^Reports/ }), 1800);
    await click(page.getByRole('radio', { name: 'Write', exact: true }), 2000);
    await glide([960, 540]);
    await hold(800);
  },
}));
