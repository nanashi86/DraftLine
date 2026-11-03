// 01 · General — Getting Started (35–55 s, intro card included)
//
// A first visit, start to finish: DraftLine opens on a blank, untitled page with nothing in the way.
// Name the script, write its first lines, see Write | Plan, open Projects (where everything is kept in
// this browser), link a folder for files on disk (the save status opens Settings → Storage & Backup), then go offline and keep writing: About shows the
// network is gone, and the script still saves.
//
//   npm run dev          (DraftLine at http://localhost:5173/DraftLine/, or set DEMO_URL)
//   node scripts/videos/01_General_GettingStarted.js
//   → videos/01_General_GettingStarted/01_General_GettingStarted.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '01_General_GettingStarted',
  syncFolder: 'DraftLine Scripts', // stand-in folder: Playwright can't drive the OS folder picker
  async run({ page, context, click, glide, typeHuman, press, hold, say }) {
    say('A first visit: a blank page, ready to type');
    await hold(1000);
    await glide([960, 470]);
    await hold(900);

    say('Name the script');
    const title = page.locator('input.doc-title');
    await click(title, 300);
    await press('ControlOrMeta+a', 150);
    await typeHuman('Night Crossing');
    await press('Enter', 900);

    say('Write the first lines: Tab and Enter pick the element');
    await click(page.locator('.el-scene .el-input').first(), 500);
    await typeHuman('EXT. HARBOR - NIGHT');
    await press('Enter', 400);
    await typeHuman('Fog rolls in over black water.');
    await hold(1100);

    say('Write | Plan: the same script, as a production plan');
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 1000);
    await glide([960, 420]);
    await hold(1300);
    await click(page.locator('.ws-btn[data-workspace="write"]'), 1000);

    say('Projects: every script, saved in this browser');
    await click(page.getByRole('button', { name: 'Projects', exact: true }), 1000);
    await glide(page.locator('.pd-card').first());
    await hold(1100);
    await glide(page.locator('.pd-foot'));
    await hold(1400);

    say('Link a folder: real .draftline files on your drive, too');
    await click(page.getByRole('button', { name: 'Close projects' }), 600);
    await click(page.locator('.status-save'), 1000); // Settings opens on Storage & Backup
    await click(page.getByRole('button', { name: 'Link Folder…' }), 1300);
    await click(page.getByRole('button', { name: 'Done' }), 800);
    await glide(page.locator('.status-save'));
    await hold(1500);

    say('Offline: no connection, nothing changes');
    await context.setOffline(true);
    await click(page.getByRole('button', { name: 'More' }), 600);
    await click(page.getByRole('menuitem', { name: /^About DraftLine/ }), 1000);
    await glide(page.locator('dialog[open]').getByText(/^Offline –/));
    await hold(1900);
    await press('Escape', 900);

    say('Keep writing offline; it still saves');
    await click(page.locator('.el-action .el-input').last(), 400);
    await press('End', 150);
    await press('Enter', 300);
    await typeHuman('MARIE (30s) waits at the rail.');
    await hold(800);
    await glide(page.locator('.status-save'));
    await hold(1500);
  },
}));
