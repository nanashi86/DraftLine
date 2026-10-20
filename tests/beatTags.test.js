import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TAGS, beatTags, beatsToFountain, beatsToMarkdown, beatsWithTag, newBeat, normalizeBeat, normalizeBeats, sampleBeats,
  tagAccent, toggleTag,
} from '../src/lib/beats.js';
import { toDoc } from '../src/lib/projectStorage.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';

const HEX = { plot: '#c8553d', subplot: '#3d7cc8', character: '#3f9a6b', theme: '#8a5cc8' };
const hex = (id) => HEX[id];
const card = (id, extra = {}) => ({ id, act: 0, title: id, synopsis: '', ...extra });

describe('Beat card tags: card.tags is a list', () => {
  it('new cards and sample cards store tags: string[] (no single tag)', () => {
    const b = newBeat(1);
    assert.deepEqual(b.tags, ['plot']);
    assert.ok(!('tag' in b));
    for (const s of sampleBeats()) {
      assert.ok(Array.isArray(s.tags) && s.tags.length === 1, s.title);
      assert.ok(!('tag' in s));
    }
  });

  it('each tag toggles on and off on its own, others untouched', () => {
    let b = card('a', { tags: ['plot'] });
    b = toggleTag(b, 'theme');
    assert.deepEqual(b.tags, ['plot', 'theme']);
    b = toggleTag(b, 'subplot');
    assert.deepEqual(b.tags, ['plot', 'subplot', 'theme'], 'kept in legend order');
    b = toggleTag(b, 'plot');
    assert.deepEqual(b.tags, ['subplot', 'theme']);
    b = toggleTag(toggleTag(b, 'subplot'), 'theme');
    assert.deepEqual(b.tags, []);
    b = toggleTag(b, 'character');
    assert.deepEqual(b.tags, ['character']);
    for (const t of TAGS) b = toggleTag(b, t.id);
    assert.deepEqual(b.tags, ['plot', 'subplot', 'theme'], 'all four toggled → character off, the rest on');
    assert.equal(toggleTag(b, 'nonsense'), b, 'unknown tag ids are ignored');
  });

  it('toggling never mutates the original card and keeps its other fields', () => {
    const before = card('a', { tags: ['plot'], sceneId: 's1', synopsis: 'x' });
    const after = toggleTag(before, 'subplot');
    assert.deepEqual(before.tags, ['plot']);
    assert.equal(after.sceneId, 's1');
    assert.equal(after.synopsis, 'x');
  });
});

describe('Beat card tags: older single-tag cards migrate', () => {
  it('a single tag string becomes a one-item list; null or missing becomes []', () => {
    assert.deepEqual(beatTags(card('a', { tag: 'subplot' })), ['subplot']);
    assert.deepEqual(beatTags(card('a', { tag: null })), []);
    assert.deepEqual(beatTags(card('a')), []);
    assert.deepEqual(beatTags(card('a', { tag: 'bogus' })), []);
    const n = normalizeBeat(card('a', { tag: 'theme', sceneId: 's9' }));
    assert.deepEqual(n.tags, ['theme']);
    assert.ok(!('tag' in n));
    assert.equal(n.sceneId, 's9');
  });

  it('tags win over a stray legacy tag; duplicates and unknown ids drop', () => {
    assert.deepEqual(beatTags(card('a', { tag: 'plot', tags: ['theme'] })), ['theme']);
    assert.deepEqual(beatTags(card('a', { tags: ['theme', 'plot', 'theme', 'x'] })), ['plot', 'theme']);
  });

  it('toggling a legacy card writes the new shape', () => {
    const b = toggleTag(card('a', { tag: 'plot' }), 'character');
    assert.deepEqual(b.tags, ['plot', 'character']);
    assert.ok(!('tag' in b));
  });

  it('normalizeBeats leaves current cards as they are and converts old ones', () => {
    const cur = card('new', { tags: ['plot'] });
    const out = normalizeBeats([cur, card('old', { tag: 'subplot' }), card('none', { tag: null })]);
    assert.equal(out[0], cur);
    assert.deepEqual(out.map((b) => b.tags), [['plot'], ['subplot'], []]);
  });

  it('opening a saved project or a backup migrates its cards', () => {
    const rec = {
      id: 'p1', title: 'Old', script: [{ id: 'x', type: 'action', text: 'Hi.' }],
      beats: [card('b1', { tag: 'plot' }), card('b2', { tag: 'theme' }), card('b3', { tag: null })],
    };
    assert.deepEqual(toDoc(rec).beats.map((b) => [b.id, b.tags, 'tag' in b]), [['b1', ['plot'], false], ['b2', ['theme'], false], ['b3', [], false]]);
    const { record } = parseBackup(serializeBackup(rec));
    assert.deepEqual(toDoc(record).beats.map((b) => b.tags), [['plot'], ['theme'], []]);
  });
});

describe('Beat card accent bar', () => {
  it('0 tags: no accent (neutral card border)', () => {
    assert.equal(tagAccent([]), null);
    assert.equal(tagAccent(undefined), null);
  });
  it('1 tag: the solid tag colour — Plot red, Subplot blue, Character green, Theme purple', () => {
    assert.equal(tagAccent(['plot'], hex), '#c8553d');
    assert.equal(tagAccent(['subplot'], hex), '#3d7cc8');
    assert.equal(tagAccent(['character'], hex), '#3f9a6b');
    assert.equal(tagAccent(['theme'], hex), '#8a5cc8');
    assert.equal(tagAccent(['plot']), 'var(--tag-plot)', 'by default, the board’s colour variables');
  });
  it('2 tags: 50 % / 50 % hard stops', () => {
    assert.equal(tagAccent(['plot', 'theme'], hex), 'linear-gradient(to right, #c8553d 0% 50%, #8a5cc8 50% 100%)');
  });
  it('3 tags: three equal thirds', () => {
    assert.equal(
      tagAccent(['plot', 'subplot', 'character'], hex),
      'linear-gradient(to right, #c8553d 0% 33.333%, #3d7cc8 33.333% 66.667%, #3f9a6b 66.667% 100%)',
    );
  });
  it('4 tags: 25 % each, in legend order whatever order they were added', () => {
    assert.equal(
      tagAccent(['theme', 'character', 'subplot', 'plot'], hex),
      'linear-gradient(to right, #c8553d 0% 25%, #3d7cc8 25% 50%, #3f9a6b 50% 75%, #8a5cc8 75% 100%)',
    );
  });
  it('every band is the same width and each starts where the last ended (hard stops)', () => {
    for (let n = 2; n <= 4; n++) {
      const g = tagAccent(TAGS.slice(0, n).map((t) => t.id), hex);
      const stops = [...g.matchAll(/#\w{6} ([\d.]+)% ([\d.]+)%/g)].map((m) => [Number(m[1]), Number(m[2])]);
      assert.equal(stops.length, n);
      assert.equal(stops[0][0], 0);
      assert.equal(stops[n - 1][1], 100);
      for (let i = 1; i < n; i++) assert.equal(stops[i][0], stops[i - 1][1]);
      for (const [a, b] of stops) assert.ok(Math.abs(b - a - 100 / n) < 0.01);
    }
  });
  it('the card draws the accent from --card-accent', () => {
    const css = readFileSync(new URL('../src/components/BeatBoard.css', import.meta.url), 'utf8');
    assert.match(css, /\.card\.has-tags::before\s*\{[^}]*background:\s*var\(--card-accent\)/);
    const jsx = readFileSync(new URL('../src/components/BeatBoard.jsx', import.meta.url), 'utf8');
    assert.match(jsx, /'--card-accent': accent/);
  });
});

describe('Beat Board legend filter', () => {
  const beats = [
    card('a', { tags: ['plot'] }),
    card('b', { tags: ['plot', 'theme'] }),
    card('c', { tags: ['subplot', 'character', 'theme'] }),
    card('d', { tags: [] }),
    card('e', { tag: 'theme' }), // not yet migrated
  ];
  it('highlights every card carrying the tag, even alongside other tags', () => {
    assert.deepEqual([...beatsWithTag(beats, 'theme')], ['b', 'c', 'e']);
    assert.deepEqual([...beatsWithTag(beats, 'plot')], ['a', 'b']);
    assert.deepEqual([...beatsWithTag(beats, 'character')], ['c']);
    assert.deepEqual([...beatsWithTag(beats, 'subplot')], ['c']);
  });
  it('untagged cards are never highlighted; no filter means no highlight set', () => {
    for (const t of TAGS) assert.ok(!beatsWithTag(beats, t.id).has('d'));
    assert.equal(beatsWithTag(beats, null), null);
    assert.equal(beatsWithTag(beats, 'nope'), null);
  });
  it('the legend is a row of toggle buttons that set the filter', () => {
    const jsx = readFileSync(new URL('../src/components/BeatBoard.jsx', import.meta.url), 'utf8');
    assert.match(jsx, /className=\{`legend-item\$\{on \? ' is-on' : ''\}`\}/);
    assert.match(jsx, /onClick=\{\(\) => setTagFilter\(on \? null : t\.id\)\}/);
    assert.match(jsx, /e\.key === 'Escape' && tagFilter/);
  });
});

describe('Outline exports list every tag', () => {
  const beats = [card('a', { title: 'Storm', tags: ['plot', 'theme'] }), card('b', { title: 'Old', tag: 'subplot' })];
  it('Fountain and Markdown', () => {
    const f = beatsToFountain(beats, 'T', 4);
    assert.match(f, /\[\[Plot · Theme\]\]/);
    assert.match(f, /\[\[Subplot\]\]/);
    const md = beatsToMarkdown(beats, 'T', 4);
    assert.match(md, /### 1\. Storm · \*Plot · Theme\*/);
    assert.match(md, /### 2\. Old · \*Subplot\*/);
  });
});
