import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHORTCUTS } from '../src/lib/shortcuts.js';
import { RENAME_CATEGORIES } from '../src/lib/renameCharacter.js';
import { BIBLE_TABS, DNA_VIEWS } from '../src/lib/bible.js';

// fileURLToPath, not .pathname: on Windows .pathname is "/C:/Users/…", which Windows reads as "C:\C:\Users\…".
const root = fileURLToPath(new URL('../src/', import.meta.url));
const files = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
// Everything the writer can see or hear: components, the app shell, menus, shortcut and rename labels.
const uiSources = files(root).filter((f) => /\.jsx$/.test(f) || /lib[\\/](shortcuts|renameCharacter)\.js$/.test(f));

describe('DNA tab views: Blueprint and Glossary', () => {
  it('the toggle reads [ Blueprint | Glossary ], in that order', () => {
    assert.deepEqual(DNA_VIEWS.map((v) => v.label), ['Blueprint', 'Glossary']);
    assert.deepEqual(DNA_VIEWS.map((v) => v.id), ['blueprint', 'dictionary']);
    assert.match(readFileSync(join(root, 'components/StoryDna.jsx'), 'utf8'), /DNA_VIEWS\.map/);
  });
  it('the DNA tab title and toolbar tooltip use the short names', () => {
    assert.equal(BIBLE_TABS.find((t) => t.id === 'dna').title, 'Blueprint & Glossary');
    assert.match(readFileSync(join(root, 'App.jsx'), 'utf8'), /DNA \(Blueprint & Glossary\)/);
  });
  it('no toggle, tab header, tooltip or aria-label says "Story Blueprint" or "Story Glossary"', () => {
    for (const f of uiSources) {
      const src = readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, ''); // code, not comments
      assert.ok(!/Story Blueprint/.test(src), `${f} still says "Story Blueprint"`);
      assert.ok(!/Story Glossary/.test(src), `${f} still says "Story Glossary"`);
    }
  });
});

describe('UI names: Story Bible, Characters and Dialogue', () => {
  it('no component, label, tooltip or aria-label says "Project Bible" or "Dialogue Tuner"', () => {
    for (const f of uiSources) {
      const src = readFileSync(f, 'utf8');
      assert.ok(!/Project Bible/.test(src), `${f} still says "Project Bible"`);
      assert.ok(!/Dialogue Tuner/.test(src), `${f} still says "Dialogue Tuner"`);
      assert.ok(!/['">`]\s*Tuner\b|\bTuner\s*['"<`]|\bthe Tuner\b|\bin the Tuner\b/.test(src), `${f} still shows "Tuner"`);
    }
  });
  it('the toolbar, panels and shortcuts use the new names', () => {
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');
    assert.match(app, />\s*Story Bible\s*</);
    assert.match(app, />\s*Characters\s*</);
    assert.match(readFileSync(join(root, 'components/ProjectBibleDrawer.jsx'), 'utf8'), /<h2>Story Bible<\/h2>/);
    const chars = readFileSync(join(root, 'components/CharactersDrawer.jsx'), 'utf8');
    assert.match(chars, /<h2>Characters<\/h2>/);
    assert.match(chars, /aria-label="Characters"/);
    assert.match(readFileSync(join(root, 'components/DialogueTuner.jsx'), 'utf8'), /aria-label="Dialogue"/);
    assert.match(SHORTCUTS['Alt+I'], /^Story Bible/);
    assert.match(SHORTCUTS['Alt+C'], /^Characters/);
    assert.match(SHORTCUTS['Alt+T'], /Dialogue/);
    assert.match(app, /title="Story Bible: [^"]*\(Alt\+I\)"/);
    assert.match(app, /title="Characters: [^"]*Alt\+C[^"]*Alt\+T[^"]*"/);
    assert.equal(RENAME_CATEGORIES.find((c) => c.id === 'notes').label, 'Scene Board & Story Bible');
  });
});

describe('toolbar: Export holds Print; panels stay visible on laptops', () => {
  const app = readFileSync(join(root, 'App.jsx'), 'utf8');
  const css = readFileSync(join(root, 'App.css'), 'utf8');
  const menu = app.slice(app.indexOf('const exportItems = ['), app.indexOf('];', app.indexOf('const exportItems = [')));

  it('the Export menu has Screenplay, Scene outline, Document and Project, in that order', () => {
    const headings = [...menu.matchAll(/heading: '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(headings, ['Screenplay', 'Scene outline', 'Document', 'Project']);
    const labels = [...menu.matchAll(/label: '([^']+)', hint: '([^']+)'/g)].map((m) => `${m[1]} ${m[2]}`);
    assert.deepEqual(labels, [
      'Fountain .fountain', 'Final Draft .fdx', 'Fountain outline .fountain', 'Markdown .md',
      'Print Script / PDF Ctrl+P', 'Backup Project .draftline',
    ]);
    assert.match(menu, /label: 'Print Script \/ PDF', hint: 'Ctrl\+P', onSelect: printScript/);
  });
  it('there is no standalone Print button any more', () => {
    const bar = app.slice(app.indexOf('<header className="bar">'), app.indexOf('</header>'));
    assert.ok(!/onClick=\{printScript\}/.test(bar));
    assert.ok(!/>\s*Print( \/ PDF)?\s*</.test(bar));
  });
  it('Ctrl+P still prints: the print view mounts on the browser’s beforeprint', () => {
    assert.match(app, /addEventListener\('beforeprint'/);
  });
  it('Story Bible tucks into ⋮ below 1440px; Characters only on narrow windows (under 1024px)', () => {
    const m = /@media \(max-width: ([\d.]+)px\) \{\s*\.bar-right > \.btn-bible \{ display: none; \}/.exec(css);
    assert.ok(m, 'a breakpoint hides .btn-bible');
    assert.equal(Number(m[1]), 1439.98);
    const c = /@media \(max-width: ([\d.]+)px\) \{\s*\.bar-right > \.btn-accent \{ display: none; \}/.exec(css);
    assert.equal(Number(c?.[1]), 1023.98);
  });
});

describe('Beat Board: Populate from Script menu', () => {
  const board = readFileSync(join(root, 'components/BeatBoard.jsx'), 'utf8');
  const modal = readFileSync(join(root, 'components/SceneRangeModal.jsx'), 'utf8');
  const menu = board.slice(board.indexOf('const populateItems = ['), board.indexOf('];', board.indexOf('const populateItems = [')));
  it('offers "Auto-Distribute (% Targets)" with the page ranges underneath, and "Manual Scene Ranges…"', () => {
    assert.match(menu, /label: 'Auto-Distribute \(% Targets\)', hint: formatPercentTargets\(actMode\), sub: targets/);
    assert.match(menu, /label: 'Manual Scene Ranges…'/);
    assert.match(board, /const targets = formatPageTargets\(actMode, pageCount\);/);
    assert.ok(!/Auto-Distribute by Page Targets|Assign by Scene Ranges/.test(board + modal));
    assert.match(modal, /<h2 id="sr-title">Manual Scene Ranges<\/h2>/);
  });
  it('menus can show a second line under an item', () => {
    const m = readFileSync(join(root, 'components/Menu.jsx'), 'utf8');
    assert.match(m, /<small className="menu-sub">\{it\.sub\}<\/small>/);
  });
});

describe('Character bio labels', () => {
  it('Bios read "Age / Timeline", "Physical Description", "Supporting" and "Minor / Cameo" — no older wording left on screen', async () => {
    const { CHARACTER_FIELDS, PRIMARY_ROLES, SECONDARY_ROLES } = await import('../src/lib/bible.js');
    const labels = CHARACTER_FIELDS.map((f) => f.label);
    assert.ok(labels.includes('Age / Timeline'));
    assert.ok(labels.includes('Physical Description'));
    assert.ok(PRIMARY_ROLES.some((r) => r.label === 'Minor / Cameo'));
    assert.ok(PRIMARY_ROLES.some((r) => r.label === 'Supporting'));
    assert.ok(SECONDARY_ROLES.some((r) => r.label === 'Catalyst'));
    for (const f of [...uiSources, join(root, 'lib', 'bible.js'), join(root, 'lib', 'structureDictionary.js')]) {
      const src = readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
      assert.ok(!/Timeline ages|'Minor Character \/ Cameo'|Catalyst \/ Instigator|'Supporting Character'/.test(src), f);
    }
  });
});

describe('User Guide: menu and modal', () => {
  it('"User Guide" (F1) sits directly above "About DraftLine" in ⋮', async () => {
    const { moreMenuItems } = await import('../src/lib/toolbar.js');
    const items = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, onGuide() {}, onAbout() {} }).filter((i) => i.label);
    const at = items.findIndex((i) => i.label === 'User Guide');
    assert.equal(items[at].hint, 'F1');
    assert.equal(items[at + 1].label, 'About DraftLine');
    assert.match(SHORTCUTS.F1, /^User Guide/);
  });
  it('the menu, F1 and Shift+? (when not typing) open it; it loads on first use', () => {
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');
    assert.match(app, /onGuide: \(\) => setGuideOpen\(true\),/);
    assert.match(app, /e\.key === 'F1' \|\| \(e\.key === '\?' && e\.shiftKey && !mod && !e\.altKey && !typing\)/);
    assert.match(app, /const UserGuideModal = lazy\(\(\) => import\('\.\/components\/UserGuideModal\.jsx'\)\);/);
    assert.match(app, /\{guideOpen && \(\s*<Suspense fallback=\{null\}>\s*<UserGuideModal onClose=\{\(\) => setGuideOpen\(false\)\} \/>/);
  });
  it('the modal: rendered from the Markdown file, with search, expand and Print / Save PDF', () => {
    const ui = readFileSync(join(root, 'components', 'UserGuideModal.jsx'), 'utf8');
    assert.match(ui, /import userGuideMarkdown from '\.\.\/content\/userGuide\.md\?raw';/);
    assert.match(ui, /const GUIDE = parseGuide\(userGuideMarkdown\);/);
    assert.match(ui, /className=\{`hm-modal ug-modal/, 'styled like the other help dialogs');
    assert.match(ui, /aria-label="Search the User Guide"/);
    assert.match(ui, /searchGuide\(GUIDE, query\)/);
    assert.match(ui, /<ExpandToggle expanded=\{expanded\}/);
    assert.match(ui, />\s*Print \/ Save PDF\s*</);
    assert.match(ui, /frame\.srcdoc = guideHtml\(GUIDE/, 'prints the guide alone, not the script');
    assert.ok(!/dangerouslySetInnerHTML/.test(ui), 'rendered as React elements, never raw HTML');
  });
});

