import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SHORTCUTS } from '../src/lib/shortcuts.js';
import { RENAME_CATEGORIES } from '../src/lib/renameCharacter.js';

const root = new URL('../src/', import.meta.url).pathname;
const files = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
// Everything the writer can see or hear: components, the app shell, menus, shortcut and rename labels.
const uiSources = files(root).filter((f) => /\.jsx$/.test(f) || /lib\/(shortcuts|renameCharacter)\.js$/.test(f));

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
    assert.equal(RENAME_CATEGORIES.find((c) => c.id === 'notes').label, 'Beat Board & Story Bible');
  });
});

describe('toolbar: Export holds Print; panels stay visible on laptops', () => {
  const app = readFileSync(join(root, 'App.jsx'), 'utf8');
  const css = readFileSync(join(root, 'App.css'), 'utf8');
  const menu = app.slice(app.indexOf('const exportItems = ['), app.indexOf('];', app.indexOf('const exportItems = [')));

  it('the Export menu has Screenplay, Beat outline, Document and Project, in that order', () => {
    const headings = [...menu.matchAll(/heading: '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(headings, ['Screenplay', 'Beat outline', 'Document', 'Project']);
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
  it('Story Bible tucks into ⋮ only below 1380px (≈ laptop width); Characters never does', () => {
    const m = /@media \(max-width: (\d+)px\) \{\s*\.btn-bible \{ display: none; \}/.exec(css);
    assert.ok(m, 'a breakpoint hides .btn-bible');
    assert.equal(Number(m[1]), 1379);
    assert.ok(!/\.btn-accent[^}]*display:\s*none/.test(css), 'Characters is never hidden');
  });
});
