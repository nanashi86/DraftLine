// DL 11 · Write — Dialogue Tuner & Spotlight (Video 2.0, ~55 s)
// Characters → Dialogue (Alt+T): pick MARIE and every line she speaks lists in order, with lines,
// words, scenes, monologues and cadence. The monologues count is a filter: on, then off. A line is
// edited right in the tab (it writes straight to the script). Picking her also spotlights her in the
// script, and the status-bar stepper (MARIE · 1 of N) steps through her speeches with Alt+Down.
//
//   node scripts/record-dl11.js
//   → recordings/DL_11_Write_DialogueTunerAndSpotlight/DL_11_Write_DialogueTunerAndSpotlight.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

main(() => record({
  folder: 'DL_11_Write_DialogueTunerAndSpotlight',
  fixture,
  clean: true,
  maxSeconds: 70,
  async run({ page, click, glide, press, hold, say }) {
    await hold(2000); // pre-roll

    say('Characters → Dialogue: Alt+T');
    await glide([900, 420]);
    await hold(1200);
    await press('Alt+t', 1000);
    const tuner = page.getByRole('region', { name: 'Dialogue' }).or(page.locator('.tuner'));
    await hold(1500);

    say('Pick Marie: every line she speaks, in order');
    await click(page.locator('.tuner-cast-list .cast-chip', { hasText: 'MARIE' }), 1000);
    await glide(page.locator('.tuner-stats'));
    await hold(2200); // lines · words · scenes · monologues · cadence

    say('Monologues: a filter');
    const mono = page.locator('.tuner-mono');
    await click(mono, 1000);
    await hold(2200);
    await click(mono, 900); // every speech again
    await hold(1200);

    say('Edit a line in place: it writes straight to the script');
    const line = tuner.getByRole('textbox', { name: 'Dialogue' }).filter({ hasText: 'I left a letter.' }).first();
    await line.scrollIntoViewIfNeeded();
    await click(line, 400);
    await press('End', 200);
    await press('Backspace', 200);
    await page.keyboard.type(' for Manman.', { delay: 45 });
    await hold(1800);

    say('The spotlight: Alt+Down steps through her speeches in the script');
    await glide(page.locator('.stepper', { hasText: 'MARIE' }).first());
    await hold(1400);
    for (let i = 0; i < 3; i++) await press('Alt+ArrowDown', 1400);
    await hold(1200);

    say('Esc clears the spotlight; close the drawer');
    await press('Escape', 900);
    await click(page.getByRole('button', { name: 'Close Characters' }), 700);
    await glide([900, 420]);
    await hold(2000);
  },
}));
