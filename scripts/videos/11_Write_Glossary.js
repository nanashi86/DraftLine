// 11 · Write — Glossary (38–50 s, intro card included)
//
// Story Bible → Glossary: every story term in three sections (character roles, craft, screenplay
// format). Open a term, put its definition in your own words (the badge turns to "yours", kept for
// every project), search to filter all three sections, then back to the script.
//
//   node scripts/videos/11_Write_Glossary.js
//   → videos/11_Write_Glossary/11_Write_Glossary.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '11_Write_Glossary',
  sample: true,
  async run({ page, click, glide, typeHuman, press, hold, say, wheel }) {
    say('Story Bible → Glossary');
    await glide([960, 500]);
    await hold(1200);
    await click(page.getByRole('button', { name: 'Story Bible', exact: true }), 1000);
    const bible = page.getByRole('complementary', { name: 'Story Bible' });
    await click(bible.getByRole('tab', { name: /^Glossary/ }), 1400);

    say('Every story term: character roles, craft, screenplay format');
    await glide(bible.locator('li.dict-entry').first());
    await hold(1500);
    await wheel(380, 4, 700);
    await hold(1600);
    await wheel(-380, 4, 300);
    await hold(800);

    say('Search filters all three sections: Midpoint');
    const search = bible.getByRole('searchbox', { name: 'Search the Glossary' });
    await click(search, 400);
    await typeHuman('Midpoint');
    await hold(1600);

    say('Open a term and put it in your own words');
    const entry = bible.locator('li.dict-entry', { has: page.locator('.dict-head b', { hasText: /^Midpoint$/ }) });
    await click(entry.getByRole('button', { name: 'Edit', exact: true }), 700);
    const definition = entry.locator('.dict-edit textarea').first();
    await click(definition, 300);
    await press('ControlOrMeta+a', 200);
    await typeHuman('The turn at the centre of Act 2: the story flips from chasing the goal to paying for it.', { fast: true });
    await hold(1100);
    await click(entry.getByRole('button', { name: 'Save', exact: true }), 1000);

    say('Now it’s yours, kept for all your projects');
    await glide(entry.locator('.dict-badge'));
    await hold(2000);

    say('Search the format terms too: Intercut');
    await click(search, 300);
    await press('ControlOrMeta+a', 150);
    await typeHuman('Intercut');
    await glide(bible.locator('li.dict-entry').first());
    await hold(2800);
    await press('ControlOrMeta+a', 150);
    await press('Backspace', 1200);

    say('Close, back to the script');
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 900);
    await glide([960, 500]);
    await hold(1800);
  },
}));
