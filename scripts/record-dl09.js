// DL 09 · Write — Interactive Glossary (Video 2.0, ~55 s)
// Story Bible → Glossary: search "Midpoint", Edit its definition in your own words and Save (the
// badge turns from "starter" to "yours", kept for every project), then Reset it to DraftLine's
// starter text. Last, the inline ⓘ: from a DNA question, its definition pops up on hover, and a
// click opens that term in the Glossary.
//
//   node scripts/record-dl09.js
//   → recordings/DL_09_Write_InteractiveGlossary/DL_09_Write_InteractiveGlossary.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

main(() => record({
  folder: 'DL_09_Write_InteractiveGlossary',
  fixture,
  clean: true,
  maxSeconds: 70,
  async run({ page, click, glide, press, typeHuman, hold, say }) {
    await hold(2000); // pre-roll

    say('Story Bible → Glossary');
    await glide([900, 480]);
    await hold(1200);
    await press('Alt+i', 900);
    const bible = page.getByRole('complementary', { name: 'Story Bible' });
    await click(bible.getByRole('tab', { name: /^Glossary/ }), 900);
    await hold(1800); // three sections: Character Roles · Craft · Screenplay Format

    say('Search: Midpoint');
    await click(bible.getByRole('searchbox', { name: 'Search the Glossary' }), 400);
    await typeHuman('Midpoint');
    await hold(2000);

    say('Edit it in your own words');
    const entry = bible.locator('li.dict-entry', { has: page.locator('.dict-head b', { hasText: /^Midpoint$/ }) });
    await click(entry.getByRole('button', { name: 'Edit', exact: true }), 700);
    const definition = entry.locator('.dict-edit textarea').first();
    await click(definition, 300);
    await press('Control+a', 200);
    await typeHuman('The turn at the centre of Act 2: the story flips from chasing the goal to paying for it.', { fast: true });
    await hold(1500);
    await click(entry.getByRole('button', { name: 'Save', exact: true }), 900);

    say('Now it\'s yours — kept for all your projects');
    await glide(entry.locator('.dict-badge'));
    await hold(2200);

    say('Reset brings back DraftLine\'s starter text');
    await click(entry.getByRole('button', { name: 'Edit', exact: true }), 700);
    await glide(entry.getByRole('button', { name: 'Reset to starter text' }));
    await hold(1400);
    await click(entry.getByRole('button', { name: 'Reset to starter text' }), 900);
    await glide(entry.locator('.dict-badge'));
    await hold(1800);

    say('The inline ⓘ: hover for the definition, click to open the term');
    await click(bible.getByRole('tab', { name: /^DNA/ }), 900);
    const info = bible.getByRole('button', { name: 'Inciting Incident: definition' });
    await info.scrollIntoViewIfNeeded();
    await glide(info);
    await hold(2400); // the definition card pops up beside it
    await click(info, 1000);
    await hold(2200); // Glossary, open at Inciting Incident

    say('Close, back to the script');
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 700);
    await glide([900, 480]);
    await hold(2000);
  },
}));
