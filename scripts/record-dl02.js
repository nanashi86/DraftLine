// DL 02 · Write — Fast drafting and shortcuts (~24 s)
// A short scene typed with only Tab and Enter: Scene Heading → Action → Character → Parenthetical → Dialogue.
//   node scripts/record-dl02.js  →  recordings/DL_02_Write_FastDraftingAndShortcuts/DL_02_Write_FastDraftingAndShortcuts.webm (+ .mp4)
import { main, record, jitter } from './lib/demoKit.js';

// [keys before the line, text]. Enter follows DraftLine's flow (Scene → Action, Character → Dialogue,
// Dialogue → Action); Tab on an empty Action line starts a Character cue; Enter then Tab after a cue
// gives a Parenthetical (Tab straight after a cue would cycle its extension instead).
const SCENE = [
  [[], 'EXT. LIGHTHOUSE - NIGHT'],
  [['Enter'], 'Wind screams through the broken lamp. MARIE climbs the last stairs.'],
  [['Enter', 'Tab'], 'MARIE'],
  [['Enter', 'Tab'], 'out of breath'],
  [['Enter'], 'Theo? Are you up here?'],
  [['Enter', 'Tab'], 'THEO'],
  [['Enter'], 'Close the door. Please.'],
];

main(() => record({
  folder: 'DL_02_Write_FastDraftingAndShortcuts',
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    say('A new script');
    await click(page.getByRole('button', { name: /^File/ }), 400);
    await click(page.getByRole('menuitem', { name: /^New/ }), 700);
    await click(page.locator('input.doc-title'), 150);
    await press('ControlOrMeta+a', 100);
    await typeHuman('Night Crossing', { fast: true });
    await press('Enter', 250);
    await click(page.locator('.el-scene .el-input').first(), 300);

    say('Typing with Tab and Enter only (watch the hints in the status bar)');
    for (const [keys, text] of SCENE) {
      for (const k of keys) await press(k, jitter(240, 340));
      await typeHuman(text, { fast: true });
      await hold(jitter(260, 380));
    }
    await glide([1650, 560]);
    await hold(2500);
  },
}));
