// DL 05 · Write — Story Bible and worldbuilding (~32 s, unhurried)
// Starts on The Last Ferry (loaded off camera) with a logline, tone, synopsis and an empty Locations
// card in the Story Bible. Opens the Story Bible on its overview (Notes: Logline, Tone, Synopsis),
// writes the first location into the Locations card, shows the Glossary's categories (DNA tab),
// then closes back to the script.
//
// The Story Bible has two tabs, DNA and Notes; there are no separate Locations, Props or World tabs.
// Locations is a Notes card here, and the categories shown are the Glossary's sections in DNA.
//
//   node scripts/record-dl05.js
//   → recordings/DL_05_Write_StoryBibleAndWorldbuilding/DL_05_Write_StoryBibleAndWorldbuilding.mp4
//     (plus the .webm; the mp4 needs ffmpeg on PATH or FFMPEG_PATH)
import { fixtureProject, main, record } from './lib/demoKit.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const FIRST_LOCATION = 'A rusting passenger ferry cutting through dense harbor fog.';

const fixture = fixtureProject({
  title: 'The Last Ferry',
  author: SAMPLE_SCRIPT.meta.author,
  blocks: SAMPLE_SCRIPT.blocks,
  storyNotes: {
    sections: [
      { title: 'Logline', body: 'Two siblings take the last ferry before a storm, and the letter one of them left behind comes with them.' },
      { title: 'Tone', body: 'Quiet, salt-worn, funny in the gaps.' },
      // Empty, so it opens ready to type into.
      { title: 'Locations', body: '' },
    ],
    synopsis: {
      act1: 'Marie leaves the island before sunrise with one suitcase and a letter she never sent. Theo turns up late, barefoot, and buys a ticket anyway.',
      act2: 'The storm closes in. Captain Augustin refuses to turn back, and refuses to say why.',
      act3: 'At the bow, with nowhere left to hide, Theo reads the letter aloud.',
    },
  },
});

main(() => record({
  folder: 'DL_05_Write_StoryBibleAndWorldbuilding',
  fixture,
  maxSeconds: 40,
  mp4: true,
  async run({ page, click, glide, wheel, typeHuman, hold, say }) {
    // 1–2. The script, then the Story Bible.
    say('The script');
    await glide([960, 520]);
    await hold(2000);

    say('Story Bible');
    await click(page.getByRole('button', { name: 'Story Bible', exact: true }), 600);
    const bible = page.getByRole('complementary', { name: 'Story Bible' });

    // 3. Overview: Notes opens on the Logline, Tone and Synopsis.
    say('Overview: logline, tone, synopsis');
    await click(bible.getByRole('tab', { name: /^Notes/ }), 700);
    await glide(bible.locator('.pb-synopsis').first(), { dy: -20 });
    await hold(3000);

    // 4. Locations: scroll down to its card and let it settle.
    say('Locations');
    const locationsTitle = bible.locator('input[aria-label="Section title"][value="Locations"]');
    await locationsTitle.scrollIntoViewIfNeeded();
    await hold(700);
    await glide(locationsTitle);
    await hold(1000);

    // 5. The first location entry.
    say('First location');
    const body = bible.getByRole('textbox', { name: 'Locations notes' });
    await click(body, 500);
    await typeHuman(FIRST_LOCATION);
    await hold(1500);

    // 6. World categories: DNA → Glossary, its sections down the panel.
    say('Worldbuilding: the Glossary categories');
    await click(bible.getByRole('tab', { name: /^DNA/ }), 700);
    const glossary = bible.getByRole('radio', { name: 'Glossary' });
    if (await glossary.isVisible()) await click(glossary, 900);
    await glide(bible.locator('.dict-section-head').first(), { dy: 10 });
    await wheel(160, 3, 450);
    await hold(3000);

    // 7. Close it cleanly and stay on the script.
    say('Back to the script');
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 600);
    await glide([960, 520]);
    await hold(2000);
  },
}));
