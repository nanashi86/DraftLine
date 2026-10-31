// DL 08 · Write — Story Bible: DNA & Notes (Video 2.0, ~55 s)
// The Story Bible from the keyboard (Alt+I): Genre pills, an answer to the first of the eight DNA
// questions, the Conflict / Obstacle picker with its six conflict types grouped under McKee's three
// levels, then Notes: a Markdown Pitch, and the Synopsis switching between 3 and 4 acts (the same
// switch as the Scene Board's, so the two stay in step).
//
//   node scripts/record-dl08.js
//   → recordings/DL_08_Write_StoryBibleDnaAndNotes/DL_08_Write_StoryBibleDnaAndNotes.mp4
import { fixtureProject, main, record } from './lib/demoKit.js';
import { AUTHOR, BLOCKS, STORY_NOTES, TITLE } from './lib/videoFixtures.js';

const fixture = fixtureProject({ title: TITLE, author: AUTHOR, blocks: BLOCKS, storyNotes: STORY_NOTES });

main(() => record({
  folder: 'DL_08_Write_StoryBibleDnaAndNotes',
  fixture,
  clean: true,
  maxSeconds: 70,
  async run({ page, click, glide, press, typeHuman, hold, say, wheel }) {
    await hold(2000); // pre-roll

    say('The script, then Alt+I opens the Story Bible');
    await glide([900, 480]);
    await hold(1400);
    await press('Alt+i', 900);
    const bible = page.getByRole('complementary', { name: 'Story Bible' });
    await bible.waitFor();
    await hold(1500);

    say('DNA: genre pills — pick all that apply');
    await click(bible.getByRole('button', { name: 'Drama', exact: true }), 700);
    await hold(1200);
    await click(bible.getByRole('button', { name: 'Thriller', exact: true }), 700);
    await hold(1600);

    say('The eight questions, starting with the protagonist');
    const protagonist = bible.getByRole('textbox', { name: /^Protagonist:/ });
    await click(protagonist, 500);
    await typeHuman('Marie, 30s — the daughter who finally leaves.');
    await hold(1800);

    say('Conflict / Obstacle: six conflict types, under McKee\'s three levels');
    const conflict = bible.getByRole('combobox', { name: 'Type of conflict' });
    await conflict.scrollIntoViewIfNeeded();
    await hold(1200);
    await click(conflict, 900);
    await hold(2000); // Inner · Personal · Wider World groups on screen
    await click(page.getByRole('option', { name: 'Individual vs. Nature' }), 700);
    await hold(1800);

    say('Notes: Markdown sections');
    await click(bible.getByRole('tab', { name: /^Notes/ }), 900);
    await hold(1500);
    const pitchToggle = bible.locator('section.pb-section', { has: page.locator('input[value="Pitch"]') }).getByRole('button', { name: /^(Edit|Done)$/ });
    if ((await pitchToggle.textContent()).trim() === 'Edit') await click(pitchToggle, 600); // an empty section opens ready to type
    const pitch = bible.getByRole('textbox', { name: 'Pitch notes' });
    await click(pitch, 400);
    await typeHuman('**A two-hander at sea.** One crossing, one storm, one *unsent* letter.');
    await hold(1200);
    await click(pitchToggle, 900); // Done: the Markdown renders
    await hold(2000);

    say('Synopsis and Treatment in 3 or 4 acts — the Scene Board\'s switch');
    const acts = bible.getByRole('radiogroup', { name: 'Acts in the Synopsis and Treatment' });
    await acts.scrollIntoViewIfNeeded();
    await glide(bible.locator('.pb-synopsis').first(), { dy: -40 });
    await hold(1600);
    await click(acts.getByRole('radio', { name: '3 Acts' }), 1000);
    await hold(2200);
    await click(acts.getByRole('radio', { name: '4 Acts' }), 1000);
    await hold(2200);

    say('Close, back to the script');
    await wheel(-200, 2, 300);
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 700);
    await glide([900, 480]);
    await hold(2000);
  },
}));
