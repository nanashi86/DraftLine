// 08 · Write — Story Bible: DNA and Notes (38–50 s, intro card included)
//
// The Last Ferry, settled on its first page. The Story Bible opens from the top bar on DNA: two genre
// pills (Thriller, Crime), the Protagonist question, and a Conflict type from the grouped list. Then
// Notes: the sample's Logline, a Pitch typed in, and the Synopsis & Treatment acts below. Close, back
// to the clean script.
//
//   node scripts/videos/08_Write_StoryBibleDnaAndNotes.js
//   → videos/08_Write_StoryBibleDnaAndNotes/08_Write_StoryBibleDnaAndNotes.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '08_Write_StoryBibleDnaAndNotes',
  sample: true,
  async run({ page, click, glide, typeHuman, hold, say, wheel }) {
    say('The Last Ferry: open the Story Bible from the top bar');
    await glide([960, 500]);
    await hold(900);
    await click(page.getByRole('button', { name: 'Story Bible', exact: true }), 1100);
    const bible = page.getByRole('complementary', { name: 'Story Bible' });

    say('DNA: pick every genre that applies');
    await click(bible.getByRole('button', { name: 'Thriller', exact: true }), 700);
    await click(bible.getByRole('button', { name: 'Crime', exact: true }), 1100);

    say('The eight story questions, starting with the protagonist');
    const protagonist = bible.getByRole('textbox', { name: /^Protagonist:/ });
    await click(protagonist, 400);
    if (!(await protagonist.inputValue()).trim()) await typeHuman('Marie, 30s: the one who leaves.');
    await hold(900);

    say('Conflict: pick its type from the grouped list');
    const conflict = bible.getByRole('combobox', { name: 'Type of conflict' });
    await conflict.scrollIntoViewIfNeeded();
    await click(conflict, 1400);
    await click(page.getByRole('option', { name: 'Individual vs. Nature' }), 1100);

    say('Notes: the logline');
    await click(bible.getByRole('tab', { name: /^Notes/ }), 1000);
    await glide(bible.locator('section.pb-section', { has: page.locator('input[value="Logline"]') }));
    await hold(1300);

    say('The pitch, in Markdown');
    const pitchSection = bible.locator('section.pb-section', { has: page.locator('input[value="Pitch"]') });
    const pitchToggle = pitchSection.getByRole('button', { name: /^(Edit|Done)$/ });
    await pitchSection.scrollIntoViewIfNeeded();
    if ((await pitchToggle.textContent()).trim() === 'Edit') await click(pitchToggle, 600);
    await click(bible.getByRole('textbox', { name: 'Pitch notes' }), 400);
    await typeHuman('**A two-hander at sea.** One storm, one *unsent* letter.');
    await hold(500);
    await click(pitchToggle, 1300);

    say('The synopsis in three acts, then down through it');
    const acts = bible.getByRole('radiogroup', { name: 'Acts in the Synopsis and Treatment' });
    await click(acts.getByRole('radio', { name: '3 Acts' }), 1100);
    await glide([1660, 600]);
    await wheel(320, 3, 400);
    await glide(bible.locator('.pb-synopsis').first(), { dy: -30 });
    await hold(1300);
    await wheel(300, 2, 500);
    await hold(1300);

    say('Close, back to the script');
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 900);
    await glide([960, 500]);
    await hold(1800);
  },
}));
