// DL 14 · General — Offline PWA and storage check (~40 s)
// Links a synced folder (a stand-in: Playwright can't drive the OS folder picker), then About DraftLine:
// Storage "Synced folder · Dual-saved locally", Protected, Network "Online". The network is cut, a line
// is written offline, About now says "Offline", and the page is reloaded while still offline: the script
// comes straight back with the new line, with no server involved. Back online at the end.
//
// The reload offline needs the service worker to be in control (it is, on a production build: `npm run
// build && npm run preview`). On the dev server there's no service worker, so the script reconnects
// before reloading and says so.
//
//   node scripts/record-dl14.js
//   → recordings/DL_14_General_OfflinePwaAndStorageVerification/DL_14_General_OfflinePwaAndStorageVerification.mp4 (+ .webm)
import { main, record } from './lib/demoKit.js';

const OFFLINE_LINE = 'Somewhere past the breakwater, the phones lose signal. Nobody notices.';

main(() => record({
  folder: 'DL_14_General_OfflinePwaAndStorageVerification',
  syncFolder: 'DraftLine Scripts',
  maxSeconds: 48,
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    const context = page.context();
    const openAbout = async () => {
      await click(page.getByRole('button', { name: 'More' }), 500);
      await click(page.getByRole('menuitem', { name: 'About DraftLine' }), 1000);
      const facts = page.locator('.hm-facts');
      await facts.scrollIntoViewIfNeeded();
      return facts;
    };
    const closeAbout = () => press('Escape', 800);

    await glide([960, 520]);
    await hold(1500);

    say('Link a folder: every save goes to the folder and to this browser');
    await click(page.getByRole('button', { name: 'Switch Project' }), 900);
    await click(page.getByRole('button', { name: 'Link Folder…' }), 1500);
    await click(page.getByRole('button', { name: 'Close projects' }), 800);

    say('About → storage: dual-saved, protected, online');
    let facts = await openAbout();
    for (const term of ['Storage', 'Protected', 'Network']) {
      const row = facts.locator('div').filter({ has: page.locator('dt', { hasText: term }) });
      if (await row.count()) { await glide(row.first()); await hold(1700); }
    }
    await closeAbout();

    say('Offline: keep writing');
    const swReady = await page.evaluate(() => !!navigator.serviceWorker?.controller);
    await context.setOffline(true);
    await hold(800);
    const lastAction = page.locator('.el-action .el-input, .el-input').filter({ hasText: /^Theo looks at her a long moment/ }).first();
    await lastAction.scrollIntoViewIfNeeded();
    await click(lastAction, 200);
    await lastAction.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
    await press('Enter', 300);
    await typeHuman(OFFLINE_LINE);
    await hold(1500);

    facts = await openAbout();
    await glide(facts.locator('div').filter({ has: page.locator('dt', { hasText: 'Network' }) }).first());
    await hold(2500);
    await closeAbout();

    say(swReady ? 'Reload while offline' : 'No service worker (dev server): reconnecting before the reload');
    if (!swReady) await context.setOffline(false);
    await hold(1200); // let the autosave land
    await page.reload();
    await page.locator('.el-input').first().waitFor();
    await hold(1200);

    say('Everything is still there');
    const kept = page.locator('.el-input').filter({ hasText: OFFLINE_LINE.slice(0, 30) }).first();
    await kept.scrollIntoViewIfNeeded();
    await glide(kept);
    await hold(3000);

    await context.setOffline(false);
    await glide([960, 520]);
    await hold(1500);
  },
}));
