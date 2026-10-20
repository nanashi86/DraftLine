import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIBLE_TABS, CHARACTER_TABS } from '../src/lib/bible.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const EMOJI = /\p{Extended_Pictographic}/u;

describe('Story Bible & Characters tabs: monochrome stroke icons', () => {
  const icon = read('components/TabIcon.jsx');
  it('no tab uses an emoji any more', () => {
    for (const t of [...BIBLE_TABS, ...CHARACTER_TABS]) {
      assert.ok(!('icon' in t), `${t.id} has no emoji icon field`);
      assert.ok(!EMOJI.test(`${t.label}${t.title}`), t.id);
    }
    for (const f of ['components/CharactersDrawer.jsx', 'components/ProjectBibleDrawer.jsx']) {
      assert.ok(!/[👤💬📖📝]/u.test(read(f)), f);
      assert.match(read(f), /<TabIcon name=\{t\.id\} \/>\{t\.label\}/);
    }
  });
  it('each tab has its outline: Bios bust, Dialogue bubble, DNA book, Notes sheet', () => {
    for (const id of ['bios', 'dialogue', 'dna', 'notes']) assert.match(icon, new RegExp(`\\n  ${id}: \\(`), id);
    assert.match(icon, /bios: \(\s*<>\s*<circle/); // head + shoulders
    assert.match(icon, /notes:[\s\S]*M8\.2 1\.6v2\.6h2\.6/); // folded corner
  });
  it('14×14, stroke in currentColor at 1.75, no fill', () => {
    for (const a of ['width="14"', 'height="14"', 'viewBox="0 0 14 14"', 'fill="none"', 'stroke="currentColor"', 'strokeWidth="1.75"', 'className="tab-icon"']) {
      assert.ok(icon.includes(a), a);
    }
  });
  it('muted when inactive, white when active', () => {
    const css = read('components/ProjectBibleDrawer.css');
    assert.match(css, /\.tab-icon \{ display: inline-block; vertical-align: middle; margin-right: 6px; flex-shrink: 0; \}/);
    assert.match(css, /\.pb-tab \{[^}]*color: var\(--muted\);/);
    assert.match(css, /\.pb-tab\.is-on \{ color: #ffffff;/);
  });
});

describe('Story Bible → Notes toolbar', () => {
  const src = read('components/ProjectBibleDrawer.jsx');
  it('the static Markdown hint is gone', () => {
    assert.ok(!/Markdown: # heading/.test(src));
    assert.ok(!/pb-hint/.test(src));
  });
  it('Import from Notes sits alone at the right, above the notes', () => {
    assert.match(src, /<div className="pb-tools is-end">\s*<button type="button" className="btn" onClick=\{\(\) => setImporting/);
    assert.match(read('components/ProjectBibleDrawer.css'), /\.pb-tools\.is-end \{ justify-content: flex-end; \}/);
  });
});
