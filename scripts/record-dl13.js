// DL 13 · Write — Character bio cards and Dialogue spotlight (~34 s)
// The Last Ferry with bios for MARIE, THEO and AUGUSTIN (loaded off camera). Hovering a character cue
// in the script brings up that character's bio card: role, age, traits and backstory. Then
// Characters → Dialogue: the speaking count per character, and MARIE's spotlight, which keeps her
// speeches bright and dims the rest of the page.
//
// DraftLine calls the "heatmap" the Dialogue spotlight; the speech counts are on the Dialogue tab's
// character pills rather than in the bio card.
//
//   node scripts/record-dl13.js
//   → recordings/DL_13_Write_CharacterMarginHoverAndHeatmap/DL_13_Write_CharacterMarginHoverAndHeatmap.mp4 (+ .webm)
import { fixtureProject, main, record } from './lib/demoKit.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const fixture = fixtureProject({
  title: 'The Last Ferry',
  author: SAMPLE_SCRIPT.meta.author,
  blocks: SAMPLE_SCRIPT.blocks,
  characters: [
    {
      name: 'MARIE', primaryRole: 'protagonist', age: '30s',
      description: 'Leaves the island before sunrise with one suitcase and a letter she never sent.',
      traits: 'Stubborn, precise, funny when cornered',
      backstory: 'Raised by Manman after their father drowned off the north coast. Has not been home in nine years.',
    },
    {
      name: 'THEO', primaryRole: 'deuteragonist', age: '20s',
      description: 'Her younger brother: barefoot, late, impossible to stay angry at.',
      traits: 'Charming, restless, loyal to a fault',
      backstory: 'Stayed behind. Knows what the letter says.',
    },
    {
      name: 'AUGUSTIN', primaryRole: 'antagonist', age: '60s',
      description: 'Captain of the SAINTE-ROSE. Will not cross in a storm. Will not say why.',
      traits: 'Weathered, superstitious, kind underneath',
      backstory: 'Owed their father money he could never repay.',
    },
  ],
});

main(() => record({
  folder: 'DL_13_Write_CharacterMarginHoverAndHeatmap',
  fixture,
  maxSeconds: 42,
  async run({ page, click, glide, wheel, hold, say }) {
    await glide([960, 520]);
    await hold(2000);

    // A cue is a Character element; hover its text (not the margin) and wait for the card.
    const cue = (name) => page.locator('.el-character .el-input').filter({ hasText: new RegExp(`^${name}\\b`) }).first();

    say('Hover a cue: THEO’s bio card');
    await glide(cue('THEO'), { dx: -10 });
    await page.locator('.cue-card').first().waitFor({ timeout: 5000 }).catch(() => say('  (the bio card didn’t appear)'));
    await hold(3000);

    say('…and MARIE’s');
    await glide([1500, 300]); // off the cue: the card closes
    await hold(700);
    await glide(cue('MARIE'), { dx: -10 });
    await hold(3200);
    await glide([1500, 300]);
    await hold(800);

    say('Characters → Dialogue: who speaks, and how much');
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 800);
    await click(page.getByRole('tab', { name: /^Dialogue/ }), 1000);
    await glide(page.locator('button', { hasText: /^MARIE/ }).first());
    await hold(1800);

    say('Spotlight MARIE across the script');
    await click(page.locator('button', { hasText: /^MARIE/ }).first(), 1800);
    await glide([860, 620]);
    await wheel(260, 6, 450);
    await hold(2000);
    await wheel(-260, 6, 150);

    say('Spotlight off');
    await click(page.locator('button', { hasText: /^MARIE/ }).first(), 700);
    await click(page.getByRole('button', { name: 'Close Characters' }), 700);
    await glide([960, 520]);
    await hold(1500);
  },
}));
