// DL 12 · General — Fountain and Final Draft import and export (~38 s)
// File → New starts a blank script; File → Import… takes pasted Fountain markup and shows it sorted into
// screenplay elements (scene headings, action, characters, dialogue…) before loading it. Then the
// File menu's export options: PDF (its scene-number choice is shown, then cancelled), Final Draft
// (.fdx) and Fountain. Nothing is downloaded.
//
//   node scripts/record-dl12.js
//   → recordings/DL_12_General_FountainAndFdxImportExport/DL_12_General_FountainAndFdxImportExport.mp4 (+ .webm)
import { main, record } from './lib/demoKit.js';

const FOUNTAIN = `Title: Night Crossing
Author: Eric Lemaire Jr.

EXT. HARBOR - NIGHT

Fog rolls off the black water. A single lamp swings above the ticket booth.

MARIE
(under her breath)
Last ferry. Last chance.

THEO (O.S.)
Marie! Wait!

She doesn't turn around.

CUT TO:

INT. FERRY - PASSENGER DECK - CONTINUOUS

Empty benches. A radio crackles in two languages.
`;

main(() => record({
  folder: 'DL_12_General_FountainAndFdxImportExport',
  maxSeconds: 46,
  async run({ page, click, glide, hold, say }) {
    await glide([960, 520]);
    await hold(1500);

    say('File → New: a blank script');
    await click(page.getByRole('button', { name: 'File' }), 700);
    await click(page.getByRole('menuitem', { name: /^New…/ }), 1800);

    say('File → Import…: paste Fountain');
    await click(page.getByRole('button', { name: 'File' }), 700);
    await click(page.getByRole('menuitem', { name: /^Import…/ }), 1000);
    const box = page.locator('textarea.im-text');
    await click(box, 400);
    await box.fill(FOUNTAIN); // a paste: all at once
    await hold(1200);

    say('Every element recognised before it loads');
    await glide(page.locator('.im-chips'));
    await hold(2200);
    await glide(page.locator('.im-list'));
    await hold(2500);
    await click(page.getByRole('button', { name: /^(Load into Editor|Load as New Script)$/ }), 1500);
    await glide([960, 480]);
    await hold(2500);

    say('Export: PDF, Final Draft, Fountain');
    await click(page.getByRole('button', { name: 'File' }), 900);
    for (const name of [/^PDF/, /^Final Draft/, /^Fountain\b/]) {
      await glide(page.getByRole('menuitem', { name }).first());
      await hold(1300);
    }
    await click(page.getByRole('menuitem', { name: /^PDF/ }).first(), 1200);
    await glide(page.locator('.xp-title'));
    await hold(2500);
    await click(page.getByRole('button', { name: 'Cancel' }), 800);
    await glide([960, 520]);
    await hold(1500);
  },
}));
