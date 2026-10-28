// DL 03 · Write — Format Doctor and Density (~22 s)
// Starts on a script with everyday slips (loaded off camera): a scene heading typed as Action, a line of
// dialogue with no character, a cue with no dialogue, THE END left-aligned, and one wall-of-text Action
// paragraph. Format Doctor lists them, Fix All repairs them; then the Density panel finds the skim risk.
//   node scripts/record-dl03.js  →  recordings/DL_03_Write_FormatDoctorAndDensity/DL_03_Write_FormatDoctorAndDensity.webm (+ .mp4)
import { fixtureProject, main, record } from './lib/demoKit.js';

const fixture = fixtureProject({
  title: 'The Crossing (Draft)',
  blocks: [
    ['scene', 'EXT. HARBOR - DAWN'],
    ['action', 'Mist over black water. A rusted ferry, the SAINTE-ROSE, idles against the pier while gulls argue over nothing, and MARIE (30s), coat buttoned to the throat, drags a suitcase with one bad wheel down the planks, past crates of mangoes, past a dog asleep in a coil of rope, past the ticket booth where no one has sold a ticket in years.'],
    ['character', 'MARIE'],
    ['dialogue', 'Last crossing before the storm.'],
    ['action', 'int. ferry - passenger deck - continuous'], // heading typed as Action
    ['action', 'Rows of bolted benches. A radio crackles.'],
    ['dialogue', 'You said six. It’s not even five-thirty.'], // dialogue with no character
    ['character', 'THEO'], // cue with no dialogue
    ['action', 'He drops beside her, too close.'],
    ['action', 'THE END'], // should be centered
  ],
});

main(() => record({
  folder: 'DL_03_Write_FormatDoctorAndDensity',
  fixture,
  async run({ page, click, glide, press, hold, say }) {
    await hold(1500);

    say('Format Doctor');
    await click(page.getByRole('button', { name: 'More' }), 400);
    await click(page.getByRole('menuitem', { name: /^Format Doctor/ }), 800);
    const fixAll = page.getByRole('button', { name: /^Fix All/ });
    await glide(fixAll, { dx: -300, dy: 100 }); // read down the findings
    await hold(3000);
    await click(fixAll, 2200);
    await press('Escape', 700);
    await glide([1650, 560]);
    await hold(1500);

    say('Density: the skim risk');
    const density = page.getByRole('group', { name: 'Density: skim risks' });
    await click(density.locator('.stepper-main'), 1600); // the list of risks, by scene and page
    await press('Escape', 300);
    await click(density.getByRole('button', { name: 'Next skim risk' }), 2400); // highlight and jump to it
    await glide([1650, 560]);
    await hold(1500);
  },
}));
