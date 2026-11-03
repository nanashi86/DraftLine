// 17 · Basics — The Pure Screenwriter's Canvas (2–4 min, intro card included)
//
// The long-form tour for writers who just want to open the page and write. A first visit on a blank
// page: the File menu (new, open, import, export, backup), the title page, then a scene typed with the
// keyboard alone (Tab and Enter pick every element), the Element picker and B / I / U. DraftLine's one
// tip for a new writer (Focus) appears at the first quiet moment and opens Focus. Then Viewing mode,
// the Midnight page, the status bar (counts, pages, Density, Format Doctor) and ⋮: About (with the
// Tips line), the User Guide and Send Feedback. It ends on the finished page.
//
// Every step carries its narration: say(step, vo). The voiceover sheet, timed to the finished video,
// is written beside it: videos/00b_Basics/00b_Basics_voiceover.md.
//
//   node scripts/videos/00b_Basics.js   →   videos/00b_Basics/00b_Basics.mp4
import { main, record } from '../lib/demoKit.js';

main(() => record({
  folder: '00b_Basics',
  seconds: [120, 240],
  tips: ['focus'], // the first-visit Focus tip is part of the tour: every other tip stays quiet
  // A tip waits for 3 s without a key. Until the tour reaches it, a keydown every second (no key reaches
  // the page: it's dispatched on window, where only the tip clock listens) keeps it for its own step.
  async setup(page) {
    await page.evaluate(() => {
      window.__holdTip = setInterval(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })), 1000);
    });
  },
  async run({ page, click, glide, typeHuman, press, hold, say }) {
    const dialog = page.locator('dialog[open]');
    const menuItem = (name) => page.getByRole('menuitem', { name });

    // 1 · Opening ------------------------------------------------------------------------------
    await say('Opening: a blank page, nothing in the way',
      'DraftLine is a fast, distraction-free screenwriting app designed to get completely out of your way. '
      + 'But it’s much more than just a clean typewriter, and while you’ll see its full power in our Advanced '
      + 'walkthrough, today we’re focusing on the essentials for writers who just want to open the page and write.');
    await hold(1500);
    await glide([960, 330]);
    await hold(1800);
    await glide(page.locator('input.doc-title'));
    await hold(2000);
    await glide(page.locator('.ws-btn[data-workspace="write"]'));
    await hold(2000);
    await glide(page.getByRole('radio', { name: 'Page', exact: true }));
    await hold(1800);
    await glide(page.locator('.btn-focus').first());
    await hold(1800);
    await glide([960, 560]);
    await hold(1500);

    await say('It runs in the browser and saves as you type',
      'It opens in your browser instantly and saves every keystroke on your own machine. '
      + 'No account, no upload, no waiting on a server.');
    await glide(page.locator('.status-save-label'));
    await hold(3200);
    await glide([960, 470]);
    await hold(600);

    // 2 · Files -------------------------------------------------------------------------------
    await say('File: new scripts, opening and importing',
      'Everything to do with files lives under File. Start a new script, open one from your disk, '
      + 'or import from Final Draft, Fountain, Word, or a PDF.');
    await click(page.getByRole('button', { name: /^File/ }).first(), 900);
    for (const item of [/^New…/, /^Open…/, /^Import…/]) {
      await glide(menuItem(item));
      await hold(1900);
    }

    await say('Export: PDF, Final Draft, Fountain; and backups',
      'When you’re ready to share, export a PDF, a Final Draft file, or Fountain. '
      + 'And Backup Project saves the whole thing as one file you keep.');
    for (const item of [/^PDF/, /^Final Draft/, /^Fountain/]) {
      await glide(menuItem(item).first());
      await hold(1700);
    }
    await glide(menuItem(/^Backup Project/));
    await hold(2400);

    // 3 · Title page --------------------------------------------------------------------------
    await say('Edit Title: title, author and contact',
      'Edit Title sets up the title page: the title, your name, and a contact block, '
      + 'with a live preview of the lettering as you go.');
    await click(menuItem(/^Edit Title/), 1100);
    const field = (label) => dialog.locator('label.tp-field', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('input, textarea');
    await click(field('Title'), 300);
    await press('ControlOrMeta+a', 150);
    await typeHuman('Last Call');
    await hold(300);
    await click(field('Author'), 300);
    await typeHuman('Alex Rivera');
    await hold(400);
    await click(field('Contact / Copyright'), 300);
    await typeHuman('alex@example.com');
    await hold(400);
    await glide(dialog.locator('.tp-specimen'));
    await hold(1100);

    await say('Save, and the title page sits above page one',
      'Save, and it’s there at full size, above page one, on the same clean, standard page as the script.');
    await click(dialog.locator('.tp-cover-btn'), 1200);
    await glide([960, 470]);
    await hold(1500);

    // 4 · Typing --------------------------------------------------------------------------------
    await say('Scene Heading: typed in lower case, set in capitals',
      'Now the writing. Type a scene heading any way you like. DraftLine sets it in capitals, '
      + 'on the right margins, and Tab offers the time of day.');
    await click(page.locator('.el-scene .el-input').first(), 700);
    await typeHuman('int. diner');
    await press('Tab', 900);
    await typeHuman('night');
    await press('Escape', 300);
    await glide(page.locator('.el-scene .el-input').first(), { dy: -14 });
    await hold(2400);
    await glide([960, 470]);
    await hold(800);

    await say('Enter: straight into Action',
      'Press Enter and you’re in Action, ready to describe the scene.');
    await press('Enter', 600);
    await typeHuman('Rain streaks the window. JUNE (50s) refills a coffee nobody ordered.');
    await hold(1000);

    await say('Tab: a Character; Enter: Dialogue',
      'Tab starts a character cue. Enter drops you into their dialogue.');
    await press('Tab', 600);
    await typeHuman('June');
    await hold(400);
    await press('Enter', 600);
    await typeHuman('You’ve been here since close.');
    await hold(900);

    await say('Tab: a Parenthetical, then back to Dialogue',
      'Tab again inside dialogue adds a parenthetical, and Enter takes you right back to the line.');
    await press('Tab', 600);
    await typeHuman('beat');
    await press('Enter', 600);
    await typeHuman('Lock the door behind you.');
    await hold(1000);

    await say('Out to a Transition, never touching the mouse',
      'Enter, then Tab twice, and it’s a transition. Your hands never leave the keyboard.');
    await press('Enter', 600);
    await press('Tab', 600);
    await press('Tab', 600);
    await typeHuman('CUT TO:');
    await hold(1000);

    // 5 · The one tip, then Focus ----------------------------------------------------------------
    await say('A tip, once, at a quiet moment',
      'Here’s DraftLine being helpful without getting in the way. When you pause, it points out a tool once, '
      + 'right when it’s useful. Use it, or click Got it, and it never comes back.');
    await page.evaluate(() => clearInterval(window.__holdTip));
    await page.locator('.hint-card').waitFor({ timeout: 20_000 });
    await hold(900);
    await glide(page.locator('.hint-card .hint-text'));
    await hold(3600);
    await glide(page.locator('.hint-card .hint-dismiss'));
    await hold(1800);
    await glide(page.locator('.hint-card .hint-go'));
    await hold(1200);

    await say('Focus: only the words',
      'This one’s Focus. The toolbar, the panels and the status bar all step away, and it’s just you and the page.');
    await click(page.locator('.hint-card .hint-go'), 1600);
    await glide([960, 540]);
    await hold(1200);
    const last = page.locator('.el-action .el-input').last();
    await click(last, 400);
    await press('ControlOrMeta+End', 200);
    await press('Enter', 400);
    await typeHuman('The neon sign buzzes, flickers, dies.');
    await hold(1200);

    await say('Esc brings everything back',
      'Press Escape, and everything comes back exactly where you left it.');
    await press('Escape', 1300);
    await glide([960, 470]);
    await hold(1400);

    await say('The status bar says what Enter and Tab do next',
      'And if you ever forget, the status bar always shows what Enter and Tab will do next.');
    await glide(page.locator('.status-hints'));
    await hold(2600);

    // 6 · Element picker and formatting --------------------------------------------------------
    await say('The Element picker and B / I / U',
      'Prefer the mouse? The Element picker sets any line by hand, and bold, italic and underline sit right beside it.');
    const action = page.locator('.el-action .el-input').first();
    await click(action, 300);
    await press('ControlOrMeta+End', 200);
    await press('Shift+ControlOrMeta+ArrowLeft', 200);
    await press('Shift+ControlOrMeta+ArrowLeft', 200);
    await press('Shift+ControlOrMeta+ArrowLeft', 400);
    await click(page.getByRole('button', { name: 'Underline' }), 1200);
    await click(page.locator('.type-select:visible').first(), 1600);
    await press('Escape', 600);
    await press('ControlOrMeta+End', 300);

    // 7 · Viewing mode and the page colour --------------------------------------------------------
    await say('Viewing: lock the draft against stray edits',
      'Reading a finished draft? Switch to Viewing. You can scroll, select and copy, '
      + 'but nothing can be typed or deleted by accident. One click, and you’re editing again.');
    const lock = page.locator('.status-lock').first();
    await click(lock, 1500);
    await glide(page.locator('.fmt-seg:visible').first());
    await hold(1800);
    await click(lock, 1300);

    await say('Midnight: a dark page for a dark room',
      'Late night? Switch the page to Midnight for light text on a dark page, easier on the eyes. '
      + 'Printing always stays black on white.');
    const colour = page.getByRole('button', { name: /^Page colour/ });
    await click(colour, 1200);
    await glide([960, 470]);
    await hold(2600);
    await click(colour, 1300);

    // 8 · Status bar and Format Doctor -------------------------------------------------------------
    await say('The status bar: scenes, words, pages, Density',
      'Down in the status bar: your scene and word counts, the page count, and Density, '
      + 'which quietly flags any action paragraph that turns into a wall of text.');
    await glide(page.locator('.status-counts'));
    await hold(2600);
    await glide(page.locator('.status-right'), { dx: -120 });
    await hold(1600);
    await glide(page.locator('.status-density').or(page.locator('.stepper', { hasText: 'Density' })).first());
    await hold(2600);

    await say('Format Doctor checks the pages',
      'Format Doctor checks your pages against spec-script conventions and fixes what it finds, one at a time or all at once. Here’s its report for this short scene.');
    await click(page.locator('.btn-kebab').first(), 800);
    await click(menuItem(/^Format Doctor/), 1300);
    await glide(dialog);
    await hold(1600);
    await press('Escape', 900);

    // 9 · ⋮: About, User Guide, Feedback -----------------------------------------------------------
    await say('⋮ → About: and the Tips line',
      'The three-dot menu holds the rest. About shows how many tips you’ve seen, and Show tips again brings them all back. Each tip shows only once, then stays out of your way.');
    await click(page.locator('.btn-kebab').first(), 800);
    await click(menuItem(/^About DraftLine/), 1300);
    const tips = dialog.locator('dt', { hasText: 'Tips' });
    await tips.scrollIntoViewIfNeeded();
    await glide(tips);
    await hold(2200);
    await press('Escape', 900);

    await say('The User Guide, and Send Feedback',
      'The User Guide covers every feature in plain language. Search it for anything, say, Focus, '
      + 'and jump straight to the answer. And Send Feedback reaches us directly, and anonymously.');
    await click(page.locator('.btn-kebab').first(), 800);
    await click(menuItem(/^User Guide/), 1000);
    await click(dialog.getByRole('searchbox', { name: 'Search the User Guide' }), 300);
    await typeHuman('Focus');
    await glide([960, 520]);
    await hold(1800);
    await press('Escape', 600);
    if (await dialog.count()) await press('Escape', 700); // the first Esc may only clear the search
    await click(page.locator('.btn-kebab').first(), 800);
    await glide(menuItem(/^Send Feedback/));
    await hold(1100);
    await press('Escape', 500);

    // 10 · Finish ------------------------------------------------------------------------------
    await say('The finished page',
      'That’s the canvas: open the page, write, and let DraftLine handle the rest.');
    await glide([960, 470]);
    await hold(3000);
  },
}));
