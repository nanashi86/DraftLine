import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildItems, makeBlock, paginate, toggleDualAt, PAGE_LINES } from '../src/lib/screenplay.js';
import { beatsToFountain, byAct, moveBeat, newBeat, sampleBeats, structureFor } from '../src/lib/beats.js';
import { getSuggestions } from '../src/lib/autocomplete.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const actions = (n) => Array.from({ length: n }, () => makeBlock('action', 'Line.'));

describe('pagination', () => {
  it('never strands a Character cue at the bottom of a page', () => {
    // 26 one-line actions = 51 lines; a 1 + 1 + 3-line speech no longer fits.
    const bs = [...actions(26), makeBlock('character', 'BOB'),
      makeBlock('dialogue', 'Hello there, this line wraps across more than one line of the dialogue column for sure.')];
    const items = buildItems(bs);
    const { place } = paginate(items);
    const cue = items.findIndex((it) => it.type === 'character');
    assert.equal(place[cue - 1].page, 0);
    assert.equal(place[cue].page, 1);
    assert.equal(place[cue + 1].page, 1);
  });
  it('keeps a scene heading with the line after it', () => {
    const bs = [...actions(26), makeBlock('scene', 'INT. X - DAY'), makeBlock('action', 'Something.')];
    const { place } = paginate(buildItems(bs));
    assert.equal(place[26].page, 1);
    assert.equal(place[27].page, 1);
  });
  it('fills pages to at most 54 lines', () => {
    const { place } = paginate(buildItems(actions(200)));
    for (const p of place) assert.ok(p.topLine + p.lines <= PAGE_LINES);
  });
});

describe('dual dialogue', () => {
  const bs = SAMPLE_SCRIPT.blocks.map(([t, x, e]) => makeBlock(t, x, e));
  it('the sample has one dual pair', () => {
    assert.equal(buildItems(bs).filter((it) => it.kind === 'dual').length, 1);
  });
  it('toggling inside the pair removes it', () => {
    const i = bs.findIndex((b) => b.text === 'Are you out of your mind?');
    assert.equal(buildItems(toggleDualAt(bs, i).blocks).filter((it) => it.kind === 'dual').length, 0);
  });
  it('refuses outside a speech', () => {
    assert.ok(toggleDualAt(bs, 2).error);
  });
});

describe('beat board', () => {
  const [a, b, c] = [newBeat(0, { title: 'A' }), newBeat(0, { title: 'B' }), newBeat(0, { title: 'C' })];
  const d = newBeat(1, { title: 'D' });
  const cols = (bs) => byAct(bs).map((col) => col.map((x) => x.title).join('')).join('|');
  it('reorders within and across acts', () => {
    assert.equal(cols(moveBeat([a, b, c, d], a.id, 0, 2)), 'BCA|D||');
    assert.equal(cols(moveBeat([a, b, c, d], b.id, 1, 0)), 'AC|BD||');
    assert.equal(cols(moveBeat([a, b, c, d], a.id, 3, 0)), 'BC|D||A');
  });
  it('3-Act mode is a view of the same four acts', () => {
    assert.deepEqual(structureFor(3).map((col) => col.acts), [[0], [1, 2], [3]]);
    assert.equal(structureFor(3)[2].name, 'Climax & Resolution');
    assert.equal(structureFor(4)[3].name, 'Climax & Resolution');
  });
  it('outline export follows the active structure', () => {
    const out3 = beatsToFountain(sampleBeats(), 'T', 3);
    assert.deepEqual(out3.match(/^# .*/gm), ['# Act 1: Setup', '# Act 2: Confrontation', '# Act 3: Climax & Resolution']);
    assert.match(out3, /\[\[Midpoint\]\]/);
    assert.equal(beatsToFountain(sampleBeats(), 'T', 4).match(/^# .*/gm).length, 4);
  });
});

describe('autocomplete', () => {
  const bs = SAMPLE_SCRIPT.blocks.map(([t, x, e]) => makeBlock(t, x, e));
  it('offers INT. / EXT. / INT./EXT. (not I/E.)', () => {
    const sc = makeBlock('scene', '');
    assert.deepEqual(getSuggestions(sc, [...bs, sc]).map((s) => s.label), ['INT.', 'EXT.', 'INT./EXT.']);
  });
  it('still recognises a typed I/E. and suggests locations', () => {
    const sc = makeBlock('scene', 'I/E. ');
    assert.ok(getSuggestions(sc, [...bs, sc]).some((s) => s.kind === 'Location'));
  });
  it('completes character names already in the script', () => {
    const ch = makeBlock('character', 'm');
    assert.deepEqual(getSuggestions(ch, [...bs, ch]).map((s) => s.value), ['MARIE']);
  });
});
