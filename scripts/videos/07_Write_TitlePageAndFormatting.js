// 07 · Write — Title Page and Formatting (35–55 s, intro card included)
//
// File → Edit Title…: the title, author and contact; the title's typography (Courier Prime by default,
// its size and bold) with a live specimen; then View Title Page shows it at full size as Page 0, on the
// same Courier Prime, standard-margin page as the script.
//
//   node scripts/videos/07_Write_TitlePageAndFormatting.js
//   → videos/07_Write_TitlePageAndFormatting/07_Write_TitlePageAndFormatting.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '07_Write_TitlePageAndFormatting',
  async setup(page) {
    // Off camera: a first scene, so the title page sits above a real Page 1.
    await page.locator('.el-scene .el-input').first().click();
    await page.keyboard.type('EXT. HARBOR - NIGHT');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Fog rolls in over black water.');
    await page.locator('.scroller').evaluate((el) => { el.scrollTop = 0; });
  },
  async run({ page, click, glide, typeHuman, press, hold, say, wheel }) {
    say('File → Edit Title…');
    await hold(900);
    await click(page.getByRole('button', { name: /^File/ }).first(), 600);
    await click(page.getByRole('menuitem', { name: /^Edit Title/ }), 1100);
    const dlg = page.locator('dialog[open]');

    say('Title, author and contact');
    const field = (label) => dlg.locator('label.tp-field', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('input, textarea');
    await click(field('Title'), 300);
    await press('ControlOrMeta+a', 150);
    await typeHuman('Night Crossing');
    await hold(500);
    await click(field('Author'), 300);
    await typeHuman('Alex Rivera');
    await hold(400);
    await click(field('Contact / Copyright'), 300);
    await typeHuman('alex.rivera@example.com');
    await hold(900);

    say('The title in Courier Prime, its size and bold, with a live specimen');
    await glide(dlg.locator('#tp-font-select'));
    await hold(1000);
    await click(dlg.locator('#tp-size-select'), 600);
    await click(page.locator('.dl-select-list [role="option"]', { hasText: '40' }).first(), 700);
    await glide(dlg.locator('.tp-specimen'));
    await hold(1000);
    await click(dlg.getByRole('button', { name: 'Bold title' }), 900);
    await click(dlg.getByRole('button', { name: 'Bold title' }), 900);

    say('View it at full size: Page 0, above the script');
    await click(dlg.locator('.tp-cover-btn'), 1600);
    await glide([960, 520]);
    await hold(2400);

    say('Same page, same margins as the script below');
    await wheel(700, 1, 300);
    await hold(1600);
    await glide([960, 600]);
    await hold(1000);
  },
}));
