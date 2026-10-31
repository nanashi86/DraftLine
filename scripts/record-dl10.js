// DL 10 · Write — Character Bios & Populate Bio (Video 2.0, ~55 s)
// Characters (Alt+C) → Bios starts empty. Populate Bio, in the drawer's header, reads how the Action
// introduces each character (MARIE (30s), coat buttoned…) and fills Age, Gender and Physical
// Description, adding a bio per introduced speaker. Then a role (Primary Role, Secondary Function),
// and the global Rename: its preview shows every cue, line and note it would change — cancelled here,
// so nothing is renamed.
//
//   node scripts/record-dl10.js
//   → recordings/DL_10_Write_CharacterBiosAndPopulateBio/DL_10_Write_CharacterBiosAndPopulateBio.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

main(() => record({
  folder: 'DL_10_Write_CharacterBiosAndPopulateBio',
  fixture,
  clean: true,
  maxSeconds: 70,
  async run({ page, click, glide, press, typeHuman, hold, say }) {
    await hold(2000); // pre-roll

    say('Characters: Alt+C');
    await glide([900, 420]);
    await hold(1200);
    await press('Alt+c', 900);
    const drawer = page.getByRole('complementary', { name: 'Characters' });
    await click(drawer.getByRole('tab', { name: /^Bios/ }), 900);
    await hold(1600); // no bios yet; the script's speakers wait as chips

    say('Populate Bio: fills bios from how the script introduces each character');
    const populate = drawer.getByRole('button', { name: /Populate Bio/ });
    await glide(populate);
    await hold(1400);
    await click(populate, 1200);
    await hold(2200); // the toast says what was filled; Undo reverses it

    say('Marie\'s bio: age and description from her introduction');
    await click(drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }), 900);
    await hold(2000);

    say('Her role in the story');
    const marie = drawer.locator('li.pb-char', { hasText: 'MARIE' });
    await click(marie.getByRole('combobox', { name: 'Primary Role' }), 800);
    await click(page.getByRole('option', { name: 'Protagonist', exact: true }), 900);
    await hold(1300);
    await click(marie.getByRole('combobox', { name: 'Secondary Function' }), 800);
    await click(page.getByRole('option', { name: 'Catalyst', exact: true }), 900);
    await hold(1800);

    say('Rename across the script: a preview first');
    await click(drawer.getByRole('button', { name: 'Rename MARIE' }), 900);
    const dialog = page.locator('dialog.rn-modal');
    await click(dialog.getByPlaceholder('New name'), 300);
    await typeHuman('MARISE');
    await hold(1200);
    await glide(dialog.locator('.rn-cats'));
    await hold(2500); // cues, dialogue, action, Scene Board & Story Bible, with counts and examples
    await glide(dialog.locator('.rn-total'));
    await hold(1400);
    await click(dialog.getByRole('button', { name: 'Cancel', exact: true }), 900);
    await hold(1200);

    say('Close, back to the script');
    await click(page.getByRole('button', { name: 'Close Characters' }), 700);
    await glide([900, 420]);
    await hold(2000);
  },
}));
