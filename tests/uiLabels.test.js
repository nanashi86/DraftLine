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

describe('UI names: Story Bible and Dialogue', () => {
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
    assert.match(app, />\s*Dialogue\s*</);
    assert.match(readFileSync(join(root, 'components/ProjectBibleDrawer.jsx'), 'utf8'), /<h2>Story Bible<\/h2>/);
    assert.match(readFileSync(join(root, 'components/DialogueTuner.jsx'), 'utf8'), /<h2>Dialogue<\/h2>/);
    assert.match(SHORTCUTS['Alt+I'], /^Story Bible/);
    assert.match(SHORTCUTS['Alt+T'], /^Dialogue/);
    assert.equal(RENAME_CATEGORIES.find((c) => c.id === 'notes').label, 'Beat Board & Story Bible');
  });
});
