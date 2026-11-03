// 19 · Update — Visual Overhaul (45–70 s, intro card included)
//
// What's new: Settings (⋮ → Settings…) and the Editorial Light theme. The Last Ferry opens in Espresso
// Noir; Settings switches it to Editorial Light; the page colour is its own choice (a light shell
// with a Midnight page, then back to Paper); the save status opens Settings on Storage & Backup, where
// a folder is linked; then the new look carries through the Story Bible, Characters and Plan.
//
// Off camera: The Last Ferry is in Projects with bios (Populate Bio), so Characters has something to show.
// Every step carries its narration (say(step, vo)); the voiceover sheet is written beside the video.
//
//   node scripts/videos/19_Update_VisualOverhaul.js
//   → videos/19_Update_VisualOverhaul/19_Update_VisualOverhaul.mp4 (+ _voiceover.md)
import { main, record } from '../lib/demoKit.js';

async function prepare(page) {
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  const drawer = page.getByRole('complementary', { name: 'Characters' });
  await drawer.getByRole('tab', { name: /^Bios/ }).click();
  await drawer.getByRole('button', { name: /Populate Bio/ }).click();
  await page.getByRole('button', { name: 'Close Characters' }).click();
}

main(() => record({
  folder: '19_Update_VisualOverhaul',
  sample: true,
  prepare,
  syncFolder: 'DraftLine Scripts', // stand-in folder: Playwright can't drive the OS folder picker
  seconds: [45, 75],
  async run({ page, click, glide, hold, say }) {
    const dialog = page.locator('dialog.st-modal[open]');
    const kebab = page.locator('.btn-kebab').first();

    // 1 · What's new --------------------------------------------------------------------------------
    await say('The Last Ferry, in Espresso Noir',
      'DraftLine just got a fresh new look, and a proper home for your settings.');
    await glide([960, 470]);
    await hold(600);

    // 2 · Settings ----------------------------------------------------------------------------------
    await say('⋮ → Settings…: one place for how DraftLine looks and saves',
      'Open the menu, and everything that shapes how DraftLine looks and saves now lives in one place: Settings.');
    await click(kebab, 500);
    await glide(page.getByRole('menuitem', { name: /^Settings/ }));
    await hold(400);
    await click(page.getByRole('menuitem', { name: /^Settings/ }), 900);

    await say('Editorial Light: warm linen and ink',
      'Switch to Editorial Light for warm linen and crisp ink, made for writing in daylight. Espresso Noir is always one click away.');
    await click(dialog.locator('label.st-choice', { hasText: 'Editorial Light' }), 1200);
    await click(dialog.getByRole('button', { name: 'Done' }), 600);
    await glide([960, 470]);
    await hold(700);

    // 3 · The page is its own choice ------------------------------------------------------------------
    await say('A light workspace with a Midnight page, then back to Paper',
      'The page keeps its own setting, so you can pair a light workspace with a Midnight page, or mix and match however you like.');
    const colour = page.getByRole('button', { name: /^Page colour/ });
    await click(colour, 900);
    await glide([960, 470]);
    await hold(900);
    await click(colour, 600);

    // 4 · Storage & Backup ---------------------------------------------------------------------------
    await say('The save status opens Settings → Storage & Backup; link a folder',
      'Your save options moved here too. Click the save status anytime, and choose to keep scripts in the app, or link a folder for real files on your drive.');
    await click(page.locator('.status-save'), 900);
    await click(dialog.getByRole('button', { name: 'Link Folder…' }), 1100);
    await click(dialog.getByRole('button', { name: 'Done' }), 400);
    await glide(page.locator('.status-save'));
    await hold(600);

    // 5 · The look, everywhere -----------------------------------------------------------------------
    await say('Story Bible, Characters and the Stripboard in Editorial Light',
      'And the new look carries through everything: the Story Bible, your characters, and every strip of your production plan.');
    await click(page.getByRole('button', { name: 'Story Bible', exact: true }), 900);
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 300);
    const drawer = page.getByRole('complementary', { name: 'Characters' });
    await click(drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }), 800);
    await click(page.getByRole('button', { name: 'Close Characters' }), 200);
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 400);
    await click(page.getByRole('radio', { name: 'Stripboard' }), 1100);
    await click(page.locator('.ws-btn[data-workspace="write"]'), 200);

    // 6 · Finish ---------------------------------------------------------------------------------------
    await say('Back on the page',
      'A fresh look, the same focus. Open Settings, and make DraftLine yours.');
    await glide([960, 470]);
    await hold(1800);
  },
}));
