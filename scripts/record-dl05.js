// DL 05 · Write — Story Bible and worldbuilding (~24 s)
// Starts on The Last Ferry with character bios and a Locations note (loaded off camera): the bios
// (Characters → Bios), the Story Bible's Notes, then back to the script.
//   node scripts/record-dl05.js  →  recordings/DL_05_Write_StoryBibleAndWorldbuilding/video.webm
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
  storyNotes: {
    sections: [
      { title: 'Logline', body: 'Two siblings take the last ferry before a storm, and the letter one of them left behind comes with them.' },
      { title: 'Locations', body: 'HARBOR — black water, rusted pier, the ticket booth nobody staffs.\nFERRY SAINTE-ROSE — bolted benches, a radio in two languages, a wheelhouse that leaks.\nTHE BOW — wind, spray, nowhere left to hide.' },
      { title: 'Tone', body: 'Quiet, salt-worn, funny in the gaps.' },
    ],
  },
});

main(() => record({
  folder: 'DL_05_Write_StoryBibleAndWorldbuilding',
  fixture,
  async run({ page, click, glide, wheel, hold, say }) {
    await hold(1000);

    say('Character dossiers: Characters → Bios');
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 600);
    await click(page.getByRole('tab', { name: /^Bios/ }), 1200);
    await glide(page.getByText('MARIE', { exact: true }).last());
    await hold(1500);
    await glide([1680, 640]);
    await wheel(220, 3, 420);
    await hold(900);

    say('Story Bible → Notes: locations and tone');
    await click(page.getByRole('button', { name: 'Story Bible', exact: true }), 700);
    await click(page.getByRole('tab', { name: /^Notes/ }), 1000);
    // The Locations section: its title field, then its text just below.
    const locations = page.locator('input[aria-label="Section title"][value="Locations"]');
    await glide((await locations.count()) ? locations.first() : page.getByText('Locations').first(), { dy: 40 });
    await hold(2600);

    say('Back to the script');
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 500);
    const closeChars = page.getByRole('button', { name: 'Close Characters' });
    if (await closeChars.isVisible()) await click(closeChars, 500);
    await glide([960, 540]);
    await hold(1500);
  },
}));
