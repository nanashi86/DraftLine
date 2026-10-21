// The User Guide (src/content/userGuide.md) is the single source of truth for in-app help. These
// checks fail the build when a key feature has no section in it — so a feature can't ship
// undocumented — and when the guide names things the app no longer calls that.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideHtml, highlight, inlineTokens, parseGuide, searchGuide, slug } from '../src/lib/userGuide.js';
import { NOIR_COMBO } from '../src/lib/noir.js';
import { SHORTCUTS } from '../src/lib/shortcuts.js';
import { PRIMARY_ROLES, SECONDARY_ROLES, CHARACTER_FIELDS, TREATMENT } from '../src/lib/bible.js';
import { DNA_QUESTIONS } from '../src/lib/storyDna.js';

import { GUIDE_VALUES } from '../src/config/features.js';
import { fillGuide } from '../src/lib/userGuide.js';

// The guide as the app shows it: its {{placeholders}} filled from the feature config.
const source = readFileSync(new URL('../src/content/userGuide.md', import.meta.url), 'utf8');
const md = fillGuide(source, GUIDE_VALUES, { shortcuts: SHORTCUTS }).text;
const guide = parseGuide(md);
const headings = guide.chapters.flatMap((c) => [c.title, ...c.topics.map((t) => t.title)]);
const hasHeading = (re) => headings.some((h) => re.test(h));

describe('User Guide covers the app', () => {
  it('has the seven chapters, the curiosities last', () => {
    assert.equal(guide.title, 'DraftLine User Guide');
    assert.deepEqual(guide.chapters.map((c) => c.title), [
      'Workspace & Storage', 'Screenplay Editor', 'Story Bible', 'Characters', 'Scene Board & Pacing', 'Export & Deliverables',
      'Editor Curiosities & Secrets',
    ]);
  });
  for (const [feature, re] of [
    ['Folder Sync', /^Folder Sync\b/],
    ['Snapshots', /^Snapshots$/],
    ['Backups', /^Backups$/],
    ['Treatment', /Treatment/],
    ['Story Bible', /^Story Bible$/],
    ['Scene Board (formerly Beat Board)', /^Scene Board\b/],
    ['Characters', /^Characters$/],
    ['Bios', /^Bios$/],
    ['Dialogue', /^Dialogue$/],
    ['View Only lock', /View Only/],
    ['Tab & Enter flow', /Tab & Enter/],
    ['Pacing', /Pacing/],
    ['Printing and PDF', /PDF/],
  ]) {
    it(`has a section for ${feature}`, () => assert.ok(hasHeading(re), `no heading for ${feature}`));
  }
  it('the Treatment is documented where Notes are (and under its own name)', () => {
    const notes = guide.chapters.find((c) => c.title === 'Story Bible').topics.find((t) => t.title === 'Synopsis & Treatment');
    assert.ok(notes.blocks.some((b) => JSON.stringify(b).includes(`**${TREATMENT.label}**`)));
  });
});

describe('User Guide matches the app’s own names', () => {
  const text = md.replace(/\s+/g, ' ');
  it('every Primary Role, Secondary Function and bio field is named', () => {
    for (const r of [...PRIMARY_ROLES, ...SECONDARY_ROLES.filter((x) => x.id !== 'none')]) assert.ok(text.includes(r.label), r.label);
    for (const f of CHARACTER_FIELDS) assert.ok(text.includes(f.label), f.label);
  });
  it('the eight Blueprint questions', () => {
    for (const q of DNA_QUESTIONS) assert.ok(text.includes(`**${q.label}**: ${q.question.replace(/’/g, "'")}`), q.label);
  });
  it('every shortcut the guide quotes really exists', () => {
    const quoted = [...md.matchAll(/`((?:Ctrl|Alt|Shift)\+[^`]+|F1)`/g)].map((m) => m[1]);
    assert.ok(quoted.length > 15);
    for (const k of quoted) {
      if (/^Shift\+(Tab|Enter)$|^Ctrl\+\/$|^F1$/.test(k) || k === NOIR_COMBO) continue; // Noir: a secret, not in the shortcut list
      assert.ok(SHORTCUTS[k], `the guide mentions ${k}, which isn't a shortcut`);
    }
  });
  it('no old names: Beat Board only as "formerly", no "Supporting Character", "Minor Character / Cameo", "Catalyst / Instigator"', () => {
    assert.equal((md.match(/Beat Board/g) || []).length, 1);
    assert.match(md, /formerly the Beat Board/);
    assert.ok(!/Supporting Character|Minor Character \/ Cameo|Catalyst \/ Instigator|Timeline ages/.test(md));
  });
});

describe('User Guide: rendering, search and print', () => {
  it('inline: `keys`, **bold**, *italic*; a lone * is just text', () => {
    assert.deepEqual(inlineTokens('Press `F1` for **help**, *now* · 2 * 3'), [
      { t: 'text', v: 'Press ' }, { t: 'code', v: 'F1' }, { t: 'text', v: ' for ' }, { t: 'b', v: 'help' },
      { t: 'text', v: ', ' }, { t: 'i', v: 'now' }, { t: 'text', v: ' · 2 * 3' },
    ]);
  });
  it('lists and numbered lists become blocks; topics get unique ids', () => {
    const g = parseGuide('# T\n\n## A\n\n- one\n- two\n\n1. first\n2. second\n\n### A\n\nText.');
    assert.deepEqual(g.chapters[0].blocks.map((b) => b.type), ['ul', 'ol']);
    assert.deepEqual([g.chapters[0].id, g.chapters[0].topics[0].id], ['a', 'a-2']);
    assert.equal(slug('Folder Sync (Google Drive / Local Disk)'), 'folder-sync-google-drive-local-disk');
  });
  it('search filters topics across headings and text, accent- and case-insensitive', () => {
    const r = searchGuide(guide, 'GOOGLE drive');
    assert.ok(r.count >= 1);
    assert.ok(r.chapters.flatMap((c) => c.topics.map((t) => t.title)).some((t) => /Folder Sync/.test(t)));
    assert.equal(searchGuide(guide, 'treatment').chapters[0].title, 'Story Bible');
    assert.deepEqual(searchGuide(guide, 'zzqx'), { chapters: [], count: 0 });
    assert.equal(searchGuide(guide, '  ').count, null);
    assert.deepEqual(highlight('Café sync', 'CAFE'), [{ v: 'Café', hit: true }, { v: ' sync', hit: false }]);
  });
  it('the printable copy has every chapter and escapes everything', () => {
    const html = guideHtml(guide, { version: '1.0.0' });
    for (const c of guide.chapters) assert.ok(html.includes(`<h2>${c.title.replace(/&/g, '&amp;')}</h2>`), c.title);
    assert.match(html, /DraftLine 1\.0\.0/);
    const evil = guideHtml(parseGuide('# <img src=x onerror=alert(1)>\n\n## A\n\n<script>bad()</script> **<b>x</b>**'));
    assert.ok(!/<script>|<img|<b>/.test(evil));
  });
});
