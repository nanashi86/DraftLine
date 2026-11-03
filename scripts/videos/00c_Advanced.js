// 18 · Advanced — World-Building, Planning and Production (2–4 min, intro card included)
//
// The long-form tour of everything under the canvas, on The Last Ferry. Story Bible: DNA (genres, the
// protagonist, the conflict type, a term's definition from the Glossary on hover), Notes (logline, a
// pitch, the synopsis in three acts) and the Story Bible PDF; the Glossary. Characters: Marie's bio,
// the Dialogue tab (her totals and cadence, then Theo's) and the spotlight. Split: the Scene Board
// beside the script, a card moved, Value Shifts set and analysed. Plan: Breakdowns, the Stripboard
// and Reports. Back in Write, a snapshot and Compare. It ends on the script.
//
// Off camera: bios filled from the script (Populate Bio) with Marie's role, traits and arc, and a
// card per scene on the Scene Board (Import Scenes), so the tour opens on a project in progress.
// Every step carries its narration: say(step, vo); the voiceover sheet is written beside the video.
//
//   node scripts/videos/00c_Advanced.js   →   videos/00c_Advanced/00c_Advanced.mp4
import { main, record } from '../lib/demoKit.js';

const fieldIn = (scope, page, label) => scope
  .locator('label.pb-field', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) })
  .locator('textarea, input').first();

async function prepare(page) {
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  const drawer = page.getByRole('complementary', { name: 'Characters' });
  await drawer.getByRole('tab', { name: /^Bios/ }).click();
  await drawer.getByRole('button', { name: /Populate Bio/ }).click();
  await drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }).click();
  const marie = drawer.locator('li.pb-char', { hasText: 'MARIE' });
  await marie.getByRole('combobox', { name: 'Primary Role' }).click();
  await page.getByRole('option', { name: 'Protagonist', exact: true }).click();
  await fieldIn(marie, page, 'Relationship').fill('Theo\'s older sister; Manman\'s daughter');
  await fieldIn(marie, page, 'Traits').fill('Guarded, dry, decisive. Packs light, says less.');
  await fieldIn(marie, page, 'Backstory / Motivation').fill('Grew up on the island in her father\'s shadow. Arc: from leaving to choosing to go back.');
  await drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }).click();
  await page.getByRole('button', { name: 'Close Characters' }).click();
  await page.getByRole('radio', { name: 'Board', exact: true }).click();
  await page.getByRole('button', { name: /Import Scenes/ }).click();
  await page.getByRole('menuitem', { name: /Auto-Distribute/ }).click();
  await page.locator('.card.is-linked').first().waitFor();
  await page.getByRole('radio', { name: 'Page', exact: true }).click();
}

main(() => record({
  folder: '00c_Advanced',
  sample: true,
  prepare,
  seconds: [120, 240],
  async run({ page, click, drag, glide, typeHuman, press, hold, say, wheel }) {
    const menuItem = (name) => page.getByRole('menuitem', { name });

    // 1 · Opening --------------------------------------------------------------------------------
    await say('Opening: The Last Ferry, a project in progress',
      'Now that you’ve got the basics down, let’s dive into some of the cool stuff that makes DraftLine truly special. '
      + 'While the writing canvas is built for pure focus, underneath lies a robust suite of world-building, '
      + 'planning, and pre-production tools, all in one place.');
    await hold(1500);
    await glide([1340, 420]); // beside the page: a cue under the pointer would open its bio card
    await hold(2200);
    await glide(page.getByRole('button', { name: 'Story Bible', exact: true }));
    await hold(1800);
    await glide(page.getByRole('button', { name: 'Characters', exact: true }));
    await hold(1800);
    await glide(page.getByRole('radio', { name: 'Split', exact: true }));
    await hold(1600);
    await glide(page.locator('.ws-btn[data-workspace="plan"]'));
    await hold(1800);
    await glide([1340, 500]);
    await hold(1200);

    // 2 · Story Bible: DNA ----------------------------------------------------------------------------
    await say('Story Bible → DNA: genres',
      'It starts with the Story Bible. The DNA tab defines what kind of story this is: pick every genre that fits.');
    await click(page.getByRole('button', { name: 'Story Bible', exact: true }), 1200);
    const bible = page.getByRole('complementary', { name: 'Story Bible' });
    await click(bible.getByRole('button', { name: 'Thriller', exact: true }), 900);
    await click(bible.getByRole('button', { name: 'Crime', exact: true }), 1200);

    await say('The protagonist, and the conflict type',
      'Then eight questions that hold the story together, starting with the protagonist and their arc, '
      + 'and the kind of conflict they’re up against.');
    const protagonist = bible.getByRole('textbox', { name: /^Protagonist:/ });
    await click(protagonist, 400);
    if (!(await protagonist.inputValue()).trim()) await typeHuman('Marie: from leaving home to choosing it.');
    await hold(800);
    const conflict = bible.getByRole('combobox', { name: 'Type of conflict' });
    await conflict.scrollIntoViewIfNeeded();
    await click(conflict, 1500);
    await click(page.getByRole('option', { name: 'Individual vs. Nature' }), 1200);

    await say('Hover any ⓘ for the Glossary’s definition',
      'Not sure what a term means? Hover the little info mark, and the Glossary’s definition appears right there.');
    const info = bible.getByRole('button', { name: 'Inciting Incident: definition' });
    await info.scrollIntoViewIfNeeded();
    await glide(info);
    await hold(3400);
    await glide([1660, 300]);
    await hold(600);

    // 3 · Notes ----------------------------------------------------------------------------------------
    await say('Notes: the logline and the pitch',
      'The Notes tab holds the prose: the logline, the tone, and a pitch, written in simple Markdown that formats itself when you click Done.');
    await click(bible.getByRole('tab', { name: /^Notes/ }), 1000);
    await glide(bible.locator('section.pb-section', { has: page.locator('input[value="Logline"]') }));
    await hold(1500);
    const pitchSection = bible.locator('section.pb-section', { has: page.locator('input[value="Pitch"]') });
    const pitchToggle = pitchSection.getByRole('button', { name: /^(Edit|Done)$/ });
    await pitchSection.scrollIntoViewIfNeeded();
    if ((await pitchToggle.textContent()).trim() === 'Edit') await click(pitchToggle, 500);
    await click(bible.getByRole('textbox', { name: 'Pitch notes' }), 400);
    await typeHuman('**A two-hander at sea.** One *unsent* letter.');
    await hold(300);
    await click(pitchToggle, 1100);

    await say('The synopsis, act by act',
      'Below it, the synopsis and treatment, in three or four acts, matched to the Scene Board.');
    const acts = bible.getByRole('radiogroup', { name: 'Acts in the Synopsis and Treatment' });
    await click(acts.getByRole('radio', { name: '3 Acts' }), 1000);
    await glide([1660, 600]);
    await wheel(320, 3, 400);
    await glide(bible.locator('.pb-synopsis').first(), { dy: -30 });
    await hold(2000);

    await say('Export: a formatted Story Bible PDF',
      'And when it’s time to share, DraftLine turns all of it into a clean, formatted Story Bible: '
      + 'DNA, notes, synopsis, treatment, and character bios, each section on its own pages.');
    await click(page.getByRole('button', { name: /^File/ }).first(), 800);
    await click(menuItem(/^Story Bible/), 1300);
    const eb = page.locator('dialog.eb-modal');
    await glide(eb.locator('.eb-options'));
    await hold(2600);
    await click(eb.locator('.eb-cancel'), 900);

    // 4 · Glossary --------------------------------------------------------------------------------------
    await say('The Glossary: every story term, searchable',
      'The Glossary defines every story term, from character roles to craft to screenplay format. '
      + 'Search it, and rewrite any definition in your own words.');
    await click(bible.getByRole('tab', { name: /^Glossary/ }), 1100);
    const search = bible.getByRole('searchbox', { name: 'Search the Glossary' });
    await click(search, 300);
    await typeHuman('Midpoint');
    await glide(bible.locator('li.dict-entry').first());
    await hold(2600);
    await click(page.getByRole('button', { name: 'Close the Story Bible' }), 900);

    // 5 · Characters ----------------------------------------------------------------------------------
    await say('Characters → Bios: Marie’s role, traits and arc',
      'Characters keeps a bio for everyone in the script: their role in the story, their look, '
      + 'their traits, and their arc. Populate Bio even fills them in from the script.');
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 1000);
    const drawer = page.getByRole('complementary', { name: 'Characters' });
    await click(drawer.getByRole('tab', { name: /^Bios/ }), 900);
    await click(drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }), 1100);
    const marie = drawer.locator('li.pb-char', { hasText: 'MARIE' });
    await glide(marie.getByRole('combobox', { name: 'Primary Role' }));
    await hold(1300);
    await glide(fieldIn(marie, page, 'Traits'));
    await hold(1600);
    await glide(fieldIn(marie, page, 'Backstory / Motivation'));
    await hold(1800);

    await say('Dialogue: Marie’s totals and cadence',
      'The Dialogue tab tunes each voice. Marie’s lines, words, scenes, average words per line, and her cadence.');
    await click(drawer.getByRole('tab', { name: /^Dialogue/ }), 1000);
    await click(drawer.locator('.cast-chip', { hasText: 'MARIE' }), 1100);
    const stats = drawer.locator('.tuner-stats');
    await glide(stats, { dx: -80 });
    await hold(1800);
    await glide(stats, { dx: 90 });
    await hold(1600);

    await say('Theo, to compare the two voices',
      'Switch to Theo to compare the two voices, number for number.');
    await click(drawer.locator('.cast-chip', { hasText: 'THEO' }), 1100);
    await glide(stats, { dx: -80 });
    await hold(1500);
    await glide(stats, { dx: 90 });
    await hold(1500);

    await say('The spotlight: every speech of hers in the script',
      'Picking a character also spotlights their dialogue across the whole script. '
      + 'Step through every speech from the status bar, and Escape clears it.');
    await click(drawer.locator('.cast-chip', { hasText: 'MARIE' }), 1000);
    await glide(page.locator('.stepper', { hasText: 'MARIE' }).first());
    await hold(900);
    for (let i = 0; i < 2; i++) await press('Alt+ArrowDown', 1200);
    await click(page.getByRole('button', { name: 'Close Characters' }), 700);
    await glide([1340, 500]);
    await press('Escape', 1000);

    // 6 · Split: the Scene Board and Value Shifts ----------------------------------------------------
    await say('Split: the Scene Board beside the script',
      'Split puts the Scene Board beside the script: a card for every scene, laid out by act.');
    await click(page.getByRole('radio', { name: 'Split', exact: true }), 1600);
    const board = page.locator('.board').first();
    await glide(board.locator('.card').first());
    await hold(1500);

    await say('Drag a card to restructure',
      'Drag a card to restructure the story; a scene card moves its scene in the script too.');
    const story = board.locator('article.card', { hasText: 'Father at the bow' });
    const target = board.locator('article.card', { hasText: 'The pier slides away' });
    await drag(story.locator('.card-grip'), target, { dy: 40 });
    await hold(1600);

    await say('Value Shifts: how each scene turns',
      'Each scene card records its value shift: whether the scene turns from positive to negative, a setback, or back the other way.');
    const shift = (i) => board.locator('.card.is-linked').nth(i).locator('.vs-btn');
    await click(shift(0), 1300);
    await click(page.getByRole('menuitemradio', { name: /Positive to Negative/ }), 1100);
    await click(shift(1), 900);
    await click(page.getByRole('menuitemradio', { name: /Negative to Positive/ }), 1100);

    await say('Analyze Value Shifts: a suggestion for every scene',
      'Analyze Value Shifts reads every scene and suggests a turn for each one. You choose what to keep, '
      + 'and the whole board shows the shape of your story at a glance.');
    await click(board.getByRole('button', { name: /Analyze Value Shifts/ }), 1300);
    const modal = page.locator('.vsm-modal');
    await glide(modal.locator('.vsm-row').nth(2));
    await hold(1600);
    await click(modal.locator('.vsm-foot .btn-primary'), 1300);
    await click(page.getByRole('radio', { name: 'Page', exact: true }), 900);

    // 7 · Plan ---------------------------------------------------------------------------------------------
    await say('Plan: Breakdowns, read from the script',
      'Switch to Plan, and the same script becomes a production breakdown: '
      + 'every scene’s setting, time of day, length in eighths, and speaking cast, worked out for you.');
    await click(page.locator('.ws-btn[data-workspace="plan"]'), 1400);
    const card = page.locator('.plan-breakdowns article.plan-card').first();
    const expand = card.getByRole('button', { name: 'Expand' });
    if (await expand.count()) await click(expand, 800);
    await glide(card.locator('.plan-card-head'));
    await hold(1800);
    await glide(card.locator('.plan-cast-list'));
    await hold(1800);

    await say('Tag props, wardrobe, vehicles and extras',
      'Add what each scene needs: props, wardrobe, vehicles, extras, and production notes.');
    await click(card.getByRole('button', { name: 'Add to Props & Set Dressing' }), 500);
    await click(card.locator('input.plan-add-input'), 300);
    await typeHuman('Suitcase (one bad wheel)');
    await press('Enter', 800);
    await press('Escape', 600);
    await glide(card.locator('.plan-card-body'), { dy: 40 });
    await hold(1200);

    await say('The Stripboard, colour-coded by scene',
      'The Stripboard shows every scene as a colour-coded strip: interior or exterior, day or night, '
      + 'with its length and cast numbers. Filter it, say, to just the night scenes.');
    await click(page.getByRole('radio', { name: 'Stripboard' }), 1200);
    await glide(page.locator('.strip-legend'));
    await hold(1600);
    await glide(page.locator('[aria-label="Stripboard, in script order"]'));
    await hold(1500);
    const filter = page.locator('.plan-filter:visible').first();
    await click(filter.getByRole('button', { name: 'NIGHT', exact: true }), 1800);
    await click(page.locator('.pf-clear:visible').first(), 1000);

    await say('Reports: cast, scenes and locations',
      'And Reports turns it into numbers: the cast list with each character’s share of the dialogue, '
      + 'a scene summary, and every location, each ready to export as a spreadsheet.');
    await click(page.getByRole('radio', { name: 'Reports' }), 1100);
    const reports = page.locator('.plan-reports');
    await click(reports.getByRole('tab', { name: 'Characters' }), 800);
    await glide(reports.locator('table').first(), { dy: -40 });
    await hold(1200);
    await click(reports.getByRole('tab', { name: 'Scenes' }), 800);
    await glide(reports.locator('table').first(), { dy: -30 });
    await hold(1100);
    await click(reports.getByRole('tab', { name: 'Locations' }), 800);
    await click(reports.locator('tr.rp-row').first(), 1000);
    await glide(reports.locator('.rp-csv'));
    await hold(300);

    // 8 · Snapshots ---------------------------------------------------------------------------------------
    await say('Back to Write: a milestone snapshot',
      'Back in Write, take a snapshot at every milestone. It saves the script, title page, Scene Board and Story Bible together.');
    await click(page.locator('.ws-btn[data-workspace="write"]'), 1100);
    await click(page.getByRole('button', { name: 'Snapshot', exact: true }), 900);
    await page.getByRole('textbox', { name: 'Snapshot label' }).waitFor();
    await typeHuman('Production Draft');
    await hold(300);
    await click(page.getByRole('button', { name: 'Save Snapshot' }), 1300);

    await say('Compare: what changed since the first pass',
      'Then compare any snapshot with today’s draft: what you cut is struck through in red, what you added is in green.');
    await click(page.locator('.btn-kebab').first(), 700);
    await click(menuItem(/^View Snapshots/), 1100);
    const snaps = page.getByRole('complementary', { name: 'Snapshots' });
    await click(snaps.getByRole('button', { name: 'Compare First pass with the current draft' }), 1400);
    await glide([760, 560]);
    await hold(1200);
    await press('Escape', 700); // Close Comparison
    await click(page.getByRole('button', { name: 'Close Snapshots' }), 700);

    // 9 · Finish --------------------------------------------------------------------------------------------
    await say('The finished script: The Last Ferry',
      'Story, characters, structure, and the shoot, all in one place, and the script is still right here, ready for the next draft.');
    await glide([1340, 500]);
    await wheel(-900, 9, 100);
    await hold(1600);
    await wheel(250, 2, 700);
    await hold(1800);
  },
}));
