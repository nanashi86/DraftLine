// 05 · Write — Keyboard Flow and Elements (35–55 s, intro card included)
//
// A scene with no mouse: Enter moves on to the element that usually comes next, Tab branches or changes
// the type. Scene Heading → Action → Character → Dialogue → Parenthetical → Dialogue → Transition,
// then Tab cycling an empty line to a new Scene Heading and a name's extension to (V.O.), with the
// status bar showing what Enter and Tab will do at every step.
//
//   node scripts/videos/05_Write_KeyboardFlowAndElements.js
//   → videos/05_Write_KeyboardFlowAndElements/05_Write_KeyboardFlowAndElements.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '05_Write_KeyboardFlowAndElements',
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    say('The keyboard does the formatting: watch the status bar');
    await hold(1000);
    await click(page.locator('.el-scene .el-input').first(), 600);
    await glide(page.locator('.status-hints'));
    await hold(1300);
    await click(page.locator('.el-scene .el-input').first(), 500);

    say('Scene Heading: Tab adds the dash and the times of day');
    await typeHuman('INT. LIGHTHOUSE');
    await press('Tab', 700);
    await typeHuman('NIGHT');
    await press('Escape', 300);
    await hold(500);

    say('Enter: Action');
    await press('Enter', 500);
    await typeHuman('Rain hammers the glass.');
    await hold(600);

    say('Tab: a Character cue');
    await press('Tab', 500);
    await typeHuman('MARIE');
    await hold(500);

    say('Enter: Dialogue');
    await press('Enter', 500);
    await typeHuman('You came back.');
    await hold(600);

    say('Tab: a Parenthetical');
    await press('Tab', 500);
    await typeHuman('beat');
    await hold(500);

    say('Enter: back to Dialogue');
    await press('Enter', 500);
    await typeHuman('I always do.');
    await hold(600);

    say('Enter twice, then Tab: a Transition');
    await press('Enter', 500);
    await press('Tab', 500);
    await press('Tab', 500);
    await typeHuman('CUT TO:');
    await hold(1300);

    await press('Enter', 600);

    say('On an empty line, Tab cycles: Character, Transition, Scene Heading');
    await press('Tab', 650);
    await press('Tab', 650);
    await press('Tab', 800);
    await typeHuman('EXT. GALLERY - CONTINUOUS');
    await press('Enter', 600);
    await typeHuman('Theo watches from the rail.');
    await hold(800);

    say('On a name, Tab cycles its extension: (O.S.), then (V.O.)');
    await press('Tab', 600);
    await typeHuman('THEO');
    await hold(500);
    await press('Tab', 900);
    await press('Tab', 1000);
    await press('Enter', 500);
    await typeHuman('Marie. Come down.');
    await hold(1200);

    say('Every element, no mouse');
    await glide([960, 500]);
    await hold(2000);
  },
}));
