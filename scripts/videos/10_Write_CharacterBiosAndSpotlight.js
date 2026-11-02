// 10 · Write — Character Bios and the Dialogue Spotlight (38–50 s, intro card included)
//
// Off camera, Populate Bio fills the bios from how The Last Ferry introduces each character, and
// Marie's roles, traits and backstory are filled in. On camera: Characters from the top bar, Marie's
// bio, then the Dialogue tab: picking her spotlights every speech she has in the script, with the
// status-bar stepper (Alt+Down steps through them). Esc clears it; close the panel.
//
//   node scripts/videos/10_Write_CharacterBiosAndSpotlight.js
//   → videos/10_Write_CharacterBiosAndSpotlight/10_Write_CharacterBiosAndSpotlight.mp4
import { main, record } from '../lib/demoKit.js';

const fieldIn = (scope, page, label) => scope
  .locator('label.pb-field', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) })
  .locator('textarea, input').first();

/** Off camera: bios from the script, plus Marie's roles, traits and arc. */
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
}

main(() => record({
  folder: '10_Write_CharacterBiosAndSpotlight',
  sample: true,
  prepare,
  async run({ page, click, glide, press, hold, say, wheel }) {
    say('Characters, from the top bar');
    await glide([960, 500]);
    await hold(1200);
    await click(page.getByRole('button', { name: 'Characters', exact: true }), 1000);
    const drawer = page.getByRole('complementary', { name: 'Characters' });
    await click(drawer.getByRole('tab', { name: /^Bios/ }), 1300);

    say('Marie: role, age and look, from her introduction');
    await click(drawer.locator('.pb-char-toggle', { hasText: 'MARIE' }), 1300);
    const marie = drawer.locator('li.pb-char', { hasText: 'MARIE' });
    await glide(marie.getByRole('combobox', { name: 'Primary Role' }));
    await hold(1300);
    await glide(fieldIn(marie, page, 'Physical Description'));
    await hold(1500);

    say('Her traits and her arc');
    await glide(fieldIn(marie, page, 'Traits'));
    await hold(1700);
    await glide(fieldIn(marie, page, 'Backstory / Motivation'));
    await hold(2400);

    say('Dialogue: pick Marie to spotlight her lines in the script');
    await click(drawer.getByRole('tab', { name: /^Dialogue/ }), 1300);
    await click(drawer.locator('.cast-chip', { hasText: 'MARIE' }), 1500);
    await glide([700, 520]);
    await hold(2600);

    say('The stepper: Alt+Down moves through every speech she has');
    await glide(page.locator('.stepper', { hasText: 'MARIE' }).first());
    await hold(1300);
    for (let i = 0; i < 3; i++) await press('Alt+ArrowDown', 1300);
    await hold(800);

    say('Esc clears the spotlight; close the panel');
    await press('Escape', 1200);
    await click(page.getByRole('button', { name: 'Close Characters' }), 900);
    await glide([960, 500]);
    await wheel(-700, 4, 250);
    await hold(2200);
  },
}));
