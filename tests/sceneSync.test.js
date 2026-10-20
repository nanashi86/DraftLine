import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardOrder, moveCardAndScene, moveSceneForBeats, renumberSceneCards, sceneNumbersOf, splitScenes,
} from '../src/lib/sceneSync.js';
import { analyzeScript } from '../src/lib/screenplay.js';
import { populateByPages } from '../src/lib/beats.js';

const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

/** FADE IN, four scenes full of action/dialogue/notes/formatting, FADE OUT + THE END. */
function script() {
  return [
    B('fi', 'transition', 'FADE IN:'),
    B('s1', 'scene', 'EXT. HARBOR - DAWN'),
    B('a1', 'action', 'Mist over the water.', { marks: { i: [[0, 4]] } }),
    B('c1', 'character', 'MARIE'),
    B('d1', 'dialogue', 'We go now.', { note: 'quiet' }),
    B('s2', 'scene', 'INT. FERRY - DAY'),
    B('a2', 'action', 'Benches. A radio.'),
    B('c2', 'character', 'THEO'),
    B('p2', 'parenthetical', '(not looking)'),
    B('d2', 'dialogue', 'You left a letter.'),
    B('t2', 'transition', 'CUT TO:'),
    B('s3', 'scene', 'EXT. BOW - LATER'),
    B('a3', 'action', 'Wind. Spray.'),
    B('c3a', 'character', 'MARIE', {}),
    B('d3a', 'dialogue', 'Look.'),
    B('c3b', 'character', 'THEO', { dual: true }),
    B('d3b', 'dialogue', 'I see it.'),
    B('s4', 'scene', 'INT. WHEELHOUSE - NIGHT'),
    B('a4', 'action', 'Rain on glass.'),
    B('fo', 'transition', 'FADE OUT.'),
    B('end', 'centered', 'THE END'),
  ];
}

const card = (id, act, sceneId, title) => ({ id, act, title: title ?? '', synopsis: '', tag: 'plot', ...(sceneId ? { sceneId } : {}) });

/** One generated card per scene, all in Act 1, plus a free card. */
function board() {
  return [
    card('k1', 0, 's1', '1. EXT. HARBOR - DAWN'),
    card('k2', 0, 's2', '2. INT. FERRY - DAY'),
    card('k3', 1, 's3', '3. EXT. BOW - LATER'),
    card('k4', 3, 's4', '4. INT. WHEELHOUSE - NIGHT'),
    card('free', 1, null, 'My own beat'),
  ];
}

const ids = (blocks) => blocks.map((b) => b.id);
const headings = (blocks) => blocks.filter((b) => b.type === 'scene').map((b) => b.text);
const chunkOf = (blocks, id) => splitScenes(blocks).chunks.find((c) => c.id === id).blocks.map((b) => b.id);

describe('scene chunks', () => {
  it('a scene runs from its heading to the next; FADE IN stays before, THE END after', () => {
    const p = splitScenes(script());
    assert.deepEqual(ids(p.pre), ['fi']);
    assert.deepEqual(p.chunks.map((c) => c.id), ['s1', 's2', 's3', 's4']);
    assert.deepEqual(chunkOf(script(), 's2'), ['s2', 'a2', 'c2', 'p2', 'd2', 't2']);
    assert.deepEqual(ids(p.ending), ['fo', 'end']);
    assert.deepEqual(chunkOf(script(), 's4'), ['s4', 'a4']);
  });
});

describe('dragging a card reorders the script', () => {
  it('moves the whole scene — every action, speech, parenthetical, transition, note and mark comes along', () => {
    const blocks = script();
    // Drag "4. WHEELHOUSE" (Act 3) to the top of Act 1.
    const { beats, blocks: out, scriptMoved } = moveCardAndScene(board(), blocks, 'k4', 0, 0);
    assert.equal(scriptMoved, true);
    assert.deepEqual(headings(out), ['INT. WHEELHOUSE - NIGHT', 'EXT. HARBOR - DAWN', 'INT. FERRY - DAY', 'EXT. BOW - LATER']);
    assert.deepEqual(ids(out), [
      'fi', 's4', 'a4', 's1', 'a1', 'c1', 'd1', 's2', 'a2', 'c2', 'p2', 'd2', 't2', 's3', 'a3', 'c3a', 'd3a', 'c3b', 'd3b', 'fo', 'end',
    ]);
    // Same elements, same objects — nothing lost, duplicated or rewritten.
    assert.equal(out.length, blocks.length);
    assert.deepEqual([...ids(out)].sort(), [...ids(blocks)].sort());
    for (const b of out) assert.equal(b, blocks.find((x) => x.id === b.id));
    assert.equal(out.find((b) => b.id === 'd1').note, 'quiet');
    assert.deepEqual(out.find((b) => b.id === 'a1').marks, { i: [[0, 4]] });
    // The board: card moved into Act 1, first.
    assert.deepEqual(boardOrder(beats).map((b) => b.id), ['k4', 'k1', 'k2', 'k3', 'free']);
    assert.equal(beats.find((b) => b.id === 'k4').act, 0);
  });

  it('moving within a column: Ferry above Harbor swaps those two scenes only', () => {
    const { blocks: out } = moveCardAndScene(board(), script(), 'k2', 0, 0);
    assert.deepEqual(headings(out), ['INT. FERRY - DAY', 'EXT. HARBOR - DAWN', 'EXT. BOW - LATER', 'INT. WHEELHOUSE - NIGHT']);
    assert.deepEqual(chunkOf(out, 's2'), ['s2', 'a2', 'c2', 'p2', 'd2', 't2'], 'the CUT TO: travels with its scene');
  });

  it('moving across acts: Harbor dropped at the end of Act 3 becomes the last scene, THE END still last', () => {
    const { blocks: out } = moveCardAndScene(board(), script(), 'k1', 3, 1);
    assert.deepEqual(headings(out), ['INT. FERRY - DAY', 'EXT. BOW - LATER', 'INT. WHEELHOUSE - NIGHT', 'EXT. HARBOR - DAWN']);
    assert.deepEqual(ids(out).slice(-2), ['fo', 'end']);
    assert.equal(ids(out)[0], 'fi');
  });

  it('the dual-dialogue pair stays a pair', () => {
    const { blocks: out } = moveCardAndScene(board(), script(), 'k3', 0, 0);
    const i = out.findIndex((b) => b.id === 'c3a');
    assert.deepEqual(ids(out.slice(i, i + 4)), ['c3a', 'd3a', 'c3b', 'd3b']);
    assert.equal(out[i + 2].dual, true);
  });

  it('scene numbering and the scenes list follow the new order', () => {
    const { blocks: out } = moveCardAndScene(board(), script(), 'k4', 0, 0);
    assert.deepEqual(sceneNumbersOf(out), { s4: 1, s1: 2, s2: 3, s3: 4 });
    assert.equal(analyzeScript(out).sceneNumbers.s4, 1);
    assert.equal(analyzeScript(out).sceneOfBlock.a4, 's4');
  });

  it('generated card titles are renumbered; titles you rewrote are not', () => {
    const cards = board();
    cards[1] = { ...cards[1], title: 'The ferry scene (mine)' };
    const { beats } = moveCardAndScene(cards, script(), 'k4', 0, 0);
    const t = Object.fromEntries(beats.map((b) => [b.id, b.title]));
    assert.equal(t.k4, '1. INT. WHEELHOUSE - NIGHT');
    assert.equal(t.k1, '2. EXT. HARBOR - DAWN');
    assert.equal(t.k2, 'The ferry scene (mine)');
    assert.equal(t.k3, '4. EXT. BOW - LATER');
    assert.equal(t.free, 'My own beat');
  });
});

describe('what does not move the script', () => {
  it('your own (unlinked) cards move on the board only', () => {
    const blocks = script();
    const r = moveCardAndScene(board(), blocks, 'free', 3, 0);
    assert.equal(r.scriptMoved, false);
    assert.equal(r.blocks, blocks);
    assert.equal(r.beats.find((b) => b.id === 'free').act, 3);
  });
  it('a move that keeps the scene order (e.g. past an unlinked card) leaves the script as is', () => {
    const blocks = script();
    // Act 2A holds k3 then "free"; dropping k3 below "free" doesn't change the scene order.
    const r = moveCardAndScene(board(), blocks, 'k3', 1, 1);
    assert.deepEqual(boardOrder(r.beats).map((b) => b.id), ['k1', 'k2', 'free', 'k3', 'k4']);
    assert.equal(r.scriptMoved, false);
    assert.equal(r.blocks, blocks);
  });
  it('scenes without a card keep their place; only the dragged scene moves', () => {
    const cards = board().filter((b) => b.id !== 'k2'); // Ferry has no card
    const { blocks: out } = moveCardAndScene(cards, script(), 'k4', 0, 0);
    assert.deepEqual(headings(out), ['INT. WHEELHOUSE - NIGHT', 'EXT. HARBOR - DAWN', 'INT. FERRY - DAY', 'EXT. BOW - LATER']);
  });
  it('a card whose scene was deleted is just a card', () => {
    const blocks = script();
    const cards = [...board(), card('ghost', 0, 'gone', '9. GONE')];
    const r = moveCardAndScene(cards, blocks, 'ghost', 3, 0);
    assert.equal(r.scriptMoved, false);
    assert.equal(moveSceneForBeats(blocks, cards, 'gone'), blocks);
  });
});

describe('integration: Populate from Script, then restructure', () => {
  it('cards made from the script drive the script back', () => {
    const blocks = script();
    const scenes = splitScenes(blocks).chunks.map((c, i) => ({ id: c.id, number: i + 1, heading: c.blocks[0].text, page: i + 1, snippet: '' }));
    const { beats } = populateByPages([], scenes, 4, 4);
    const first = boardOrder(beats)[0];
    const last = boardOrder(beats).at(-1);
    // Drag the last scene's card to the very front of Act 1.
    const r = moveCardAndScene(beats, blocks, last.id, 0, 0);
    assert.equal(r.scriptMoved, true);
    assert.equal(headings(r.blocks)[0], 'INT. WHEELHOUSE - NIGHT');
    assert.equal(boardOrder(r.beats)[0].title, '1. INT. WHEELHOUSE - NIGHT');
    assert.equal(r.beats.find((b) => b.id === first.id).title, '2. EXT. HARBOR - DAWN');
    // Board and script agree, card by card.
    const sceneOrder = headings(r.blocks).map((h) => h.toUpperCase());
    const cardOrder = boardOrder(r.beats).map((b) => b.title.replace(/^\d+\.\s+/, ''));
    assert.deepEqual(cardOrder, sceneOrder);
    assert.equal(r.blocks.length, blocks.length);
  });
  it('renumberSceneCards leaves an already-correct board untouched (same array)', () => {
    const beats = board();
    assert.equal(renumberSceneCards(beats, script()), beats);
  });
});
