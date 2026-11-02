// 04 · Write — A Clean Page and Typing (35–55 s, intro card included)
//
// A blank page, Courier Prime 12 pt on the standard margins. Type a scene heading and DraftLine formats
// it as you go; Enter moves on to Action, which sits on the same left margin; the page numbers and the
// one-inch margins stay where a reader expects them.
//
//   node scripts/videos/04_Write_CleanPageAndTyping.js
//   → videos/04_Write_CleanPageAndTyping/04_Write_CleanPageAndTyping.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '04_Write_CleanPageAndTyping',
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    say('A blank page: nothing on it but the cursor');
    await hold(1200);
    await glide([960, 500]);
    await hold(900);

    say('A scene heading, formatted as you type');
    await click(page.locator('.el-scene .el-input').first(), 600);
    await typeHuman('int. lighthouse - night');
    await hold(900);

    say('Enter: straight on to Action');
    await press('Enter', 700);
    await typeHuman('Wind screams through the broken lamp. Glass crunches underfoot.');
    await hold(800);
    await press('Enter', 400);
    await typeHuman('MARIE (30s), soaked to the skin, climbs the last stairs.');
    await hold(1000);

    say('Character and dialogue: indented to the standard, automatically');
    await press('Enter', 400);
    await press('Tab', 600);
    await typeHuman('MARIE');
    await press('Enter', 500);
    await typeHuman('Anyone up here?');
    await hold(1200);

    say('Standard margins: heading and action share the left margin');
    const heading = page.locator('.el-scene .el-input').first();
    const hBox = await heading.boundingBox();
    await glide([hBox.x + 4, hBox.y + hBox.height / 2]);
    await hold(1000);
    const action = page.locator('.el-action .el-input').last();
    const aBox = await action.boundingBox();
    await glide([aBox.x + 4, aBox.y + aBox.height / 2]);
    await hold(1000);
    await glide([aBox.x + aBox.width - 6, aBox.y + aBox.height / 2]);
    await hold(1000);
    const line = page.locator('.el-dialogue .el-input').last();
    const dBox = await line.boundingBox();
    await glide([dBox.x + 4, dBox.y + dBox.height / 2]);
    await hold(1200);

    say('The page number, top right; one page so far');
    const sheet = await page.locator('.sheet').first().boundingBox();
    await glide([sheet.x + sheet.width - 70, sheet.y + 60]);
    await hold(1600);

    say('The status bar shows the element, and what Enter and Tab do next');
    await click(action, 400);
    await press('End', 200);
    await glide(page.locator('.status-hints'));
    await hold(2000);
    await glide([960, 500]);
    await hold(900);
  },
}));
