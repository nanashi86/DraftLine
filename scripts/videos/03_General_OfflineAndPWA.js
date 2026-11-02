// 03 · General — Offline and PWA (35–55 s, intro card included)
//
// DraftLine is a Progressive Web App: once it has loaded, its service worker keeps a copy of the whole
// app, so it opens and saves with no connection at all. This take goes offline, checks About, then
// reloads the tab with no connection and DraftLine opens anyway. Then the file basics: Import a
// Fountain file (preview, then Load), and Export to Fountain and Final Draft.
//
// Needs a production build, where the service worker runs (it's off in `npm run dev`):
//   npm run build && npm run preview
//   set DEMO_URL=http://localhost:4173/DraftLine/   (PowerShell: $env:DEMO_URL="http://localhost:4173/DraftLine/")
//   node scripts/videos/03_General_OfflineAndPWA.js
//   → videos/03_General_OfflineAndPWA/03_General_OfflineAndPWA.mp4
import { main, record } from '../lib/demoKit.js';
import { Buffer } from 'node:buffer';

const IMPORT = `Title: Night Crossing
Author: Alex Rivera

EXT. HARBOR - NIGHT

Fog rolls in over black water. A ferry horn, far off.

MARIE
(quietly)
Last boat. We're on it.

THEO
Then let's not miss it.

CUT TO:
`;

main(() => record({
  folder: '03_General_OfflineAndPWA',
  sample: true,
  // Off camera: wait until the service worker controls the page (the first load installs it).
  async setup(page) {
    const ok = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return false;
      await navigator.serviceWorker.ready;
      return !!navigator.serviceWorker.controller;
    });
    if (!ok) {
      await page.reload();
      await page.locator('.el-input').first().waitFor();
    }
    const controlled = await page.evaluate(() => !!navigator.serviceWorker?.controller);
    if (!controlled) throw new Error('No service worker: run this against a production build (npm run build && npm run preview).');
  },
  async run({ page, context, click, glide, hold, press, say, reload }) {
    say('Saved in this browser, on this computer');
    await hold(900);
    await glide(page.locator('.status-save'));
    await hold(1200);

    say('Go offline: About shows it, and nothing else changes');
    await context.setOffline(true);
    await click(page.getByRole('button', { name: 'More' }), 600);
    await click(page.getByRole('menuitem', { name: /^About DraftLine/ }), 1000);
    await glide(page.locator('dialog[open]').getByText(/^Offline –/));
    await hold(1800);
    await press('Escape', 800);

    say('Reload with no connection: the app opens from its own offline copy');
    await reload();
    await hold(400);
    await glide([960, 470]);
    await hold(1600);
    await context.setOffline(false);

    say('Import: a Fountain file, previewed before anything changes');
    await click(page.getByRole('button', { name: /^File/ }).first(), 600);
    await click(page.getByRole('menuitem', { name: /^Import/ }), 900);
    await page.locator('dialog[open] input[type="file"]').setInputFiles({ name: 'Night Crossing.fountain', mimeType: 'text/plain', buffer: Buffer.from(IMPORT) });
    await hold(500);
    await glide(page.locator('dialog[open] .im-chips'));
    await hold(1600);
    await click(page.getByRole('button', { name: /^Load (into Editor|as New Script)/ }), 1300);
    await glide([960, 500]);
    await hold(1000);

    say('Export: Fountain, Final Draft, PDF, all from File');
    await click(page.getByRole('button', { name: /^File/ }).first(), 700);
    await glide(page.getByRole('menuitem', { name: /^Final Draft/ }));
    await hold(700);
    await click(page.getByRole('menuitem', { name: /^Fountain/ }).first(), 1200);
    await click(page.getByRole('button', { name: /^File/ }).first(), 600);
    await click(page.getByRole('menuitem', { name: /^Final Draft/ }), 900);
    const fdx = page.locator('dialog[open]');
    if (await fdx.count()) {
      await hold(600);
      await click(fdx.getByRole('button', { name: /Export|Download|Save/ }).last(), 1200);
    }
    await hold(1000);
  },
}));
