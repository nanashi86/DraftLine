import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  boardOrder, moveCardAndScene, moveCardStep, relinkSceneCards, splitScenes,
} from '../src/lib/sceneSync.js';
import { byAct } from '../src/lib/beats.js';

// Scene Board drag → script: the move is direct (no confirm step), the scene travels whole,
// one Ctrl+Z takes script and board back, and it keeps working after the script has been
// replaced by an import (new element ids).

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

function script(p = '') {
  return [
    B(`${p}fi`, 'transition', 'FADE IN:'),
    B(`${p}s1`, 'scene', 'EXT. HARBOR - DAWN'),
    B(`${p}a1`, 'action', 'Mist over the water.', { marks: { i: [[0, 4]] } }),
    B(`${p}c1`, 'character', 'MARIE'),
    B(`${p}p1`, 'parenthetical', '(low)'),
    B(`${p}d1`, 'dialogue', 'We go now.', { note: 'quiet' }),
    B(`${p}s2`, 'scene', 'INT. FERRY - DAY'),
    B(`${p}a2`, 'action', 'Benches. A radio.'),
    B(`${p}c2`, 'character', 'THEO'),
    B(`${p}d2`, 'dialogue', 'You left a letter.'),
    B(`${p}s3`, 'scene', 'EXT. BOW - LATER'),
    B(`${p}a3`, 'action', 'Wind. Spray.'),
  ];
}
const card = (id, act, sceneId, title) => ({ id, act, title, synopsis: '', tags: ['plot'], ...(sceneId ? { sceneId } : {}) });
const board = (p = '') => [
  card('k1', 0, `${p}s1`, '1. EXT. HARBOR - DAWN'),
  card('k2', 0, `${p}s2`, '2. INT. FERRY - DAY'),
  card('own', 0, null, 'My own beat'),
  card('k3', 1, `${p}s3`, '3. EXT. BOW - LATER'),
];
const headings = (blocks) => blocks.filter((b) => b.type === 'scene').map((b) => b.text);
const chunk = (blocks, id) => splitScenes(blocks).chunks.find((c) => c.id === id).blocks;

/**
 * The same contract as hooks/useHistory.js: set(next, key, effect) pushes a step, undo/redo
 * restore the block arrays and run that step's effect. The board is App's separate state.
 */
function app(blocks, beats) {
  const h = { past: [], present: blocks, future: [], effects: new Map(), beats };
  const setBeats = (v) => { h.beats = v; };
  return {
    h,
    drag(id, act, index) { // App.moveCard
      const r = moveCardStep(h.beats, h.present, id, act, index);
      if (!r.scriptMoved) { setBeats(r.beats); return r; }
      h.effects.set(r.blocks, { undo: () => setBeats(r.undoBeats(h.beats)), redo: () => setBeats(r.redoBeats(h.beats)) });
      h.past.push(h.present); h.present = r.blocks; h.future = [];
      setBeats(r.beats);
      return r;
    },
    undo() {
      const leaving = h.present;
      h.future.unshift(leaving); h.present = h.past.pop();
      h.effects.get(leaving)?.undo();
    },
    redo() {
      const arriving = h.future.shift();
      h.past.push(h.present); h.present = arriving;
      h.effects.get(arriving)?.redo();
    },
  };
}

describe('Scene Board drag reorders the screenplay directly', () => {
  it('dragging Scene 1 after Scene 2 puts Scene 2 first in the script, immediately', () => {
    const a = app(script(), board());
    // Act 1 holds k1, k2, own: dropping k1 at index 1 (between k2 and the own card) = after Scene 2.
    const r = a.drag('k1', 0, 1);
    assert.equal(r.scriptMoved, true, 'the script moved in the same call: no confirm or apply step');
    assert.deepEqual(headings(a.h.present), ['INT. FERRY - DAY', 'EXT. HARBOR - DAWN', 'EXT. BOW - LATER']);
    assert.deepEqual(boardOrder(a.h.beats).filter((b) => b.sceneId).map((b) => b.sceneId), ['s2', 's1', 's3']);
    assert.equal(r.heading, 'EXT. HARBOR - DAWN');
  });

  it('the moved scene keeps its slugline, action, cue, parenthetical and dialogue together, untouched', () => {
    const before = script();
    const a = app(before, board());
    a.drag('k1', 0, 1);
    const moved = chunk(a.h.present, 's1');
    assert.deepEqual(moved.map((b) => b.id), ['s1', 'a1', 'c1', 'p1', 'd1']);
    moved.forEach((b) => assert.equal(b, before.find((x) => x.id === b.id), `${b.id} is the same element, marks and note included`));
    assert.deepEqual(chunk(a.h.present, 's2').map((b) => b.id), ['s2', 'a2', 'c2', 'd2']);
    assert.equal(a.h.present[0].id, 'fi', 'FADE IN stays first');
    assert.equal(a.h.present.length, before.length, 'nothing lost or duplicated');
  });

  it('one Ctrl+Z restores both the script and the board; Ctrl+Shift+Z redoes both', () => {
    const blocks = script();
    const beats = board();
    const a = app(blocks, beats);
    a.drag('k1', 0, 1);
    const movedBlocks = a.h.present;
    const movedBeats = a.h.beats;
    a.undo();
    assert.equal(a.h.present, blocks, 'the original script array');
    assert.deepEqual(a.h.beats, beats, 'the original board');
    a.redo();
    assert.equal(a.h.present, movedBlocks);
    assert.equal(a.h.beats, movedBeats);
  });

  it('undo after editing another card moves only that scene card back and keeps the edit', () => {
    const a = app(script(), board());
    a.drag('k1', 0, 1);
    a.h.beats = a.h.beats.map((b) => (b.id === 'own' ? { ...b, title: 'Edited' } : b));
    a.undo();
    assert.deepEqual(byAct(a.h.beats)[0].map((b) => b.id), ['k1', 'k2', 'own']);
    assert.equal(a.h.beats.find((b) => b.id === 'own').title, 'Edited');
    assert.deepEqual(headings(a.h.present), ['EXT. HARBOR - DAWN', 'INT. FERRY - DAY', 'EXT. BOW - LATER']);
  });

  it('App wires the drop straight to the script history: no confirm, one undo step', () => {
    const src = read('src/App.jsx');
    const fn = src.slice(src.indexOf('const moveCard = (id, act, index) => {'), src.indexOf('// ---- Rename a character everywhere'));
    assert.match(fn, /moveCardStep\(s\.beats, s\.blocks, id, act, index\)/);
    assert.match(fn, /set\(r\.blocks, null, \{\s*undo: \(\) => setBeats\(r\.undoBeats\(latest\.current\.beats\)\),\s*redo: \(\) => setBeats\(r\.redoBeats\(latest\.current\.beats\)\),\s*\}\);/);
    assert.doesNotMatch(fn, /\bconfirm\(|set\w*Confirm|set\w*Pending|<\w*Modal|await /, 'no dialog or deferred apply in the way');
    const board = read('src/components/BeatBoard.jsx');
    assert.match(board, /onDrop=\{[\s\S]*?if \(onMoveCard\) onMoveCard\(id, drop\.act, drop\.index\);/);
    assert.match(src, /onMoveCard=\{moveCard\}/);
  });
});

describe('Scene cards stay linked when the script is replaced (the regression)', () => {
  // File → Import… → Load into Editor makes every element anew, with new ids. The board used to
  // keep pointing at the old ones, so a drag silently moved the board only.
  it('a drag after an import still moves the imported script', () => {
    const imported = script('n'); // same scenes, new ids
    const r = moveCardAndScene(board(), imported, 'k1', 0, 1);
    assert.equal(r.scriptMoved, true);
    assert.deepEqual(headings(r.blocks), ['INT. FERRY - DAY', 'EXT. HARBOR - DAWN', 'EXT. BOW - LATER']);
    assert.equal(r.beats.find((b) => b.id === 'k1').sceneId, 'ns1');
  });

  it('relinkSceneCards matches generated titles to unclaimed headings; live links are left alone', () => {
    const relinked = relinkSceneCards(board(), script('n'));
    assert.deepEqual(relinked.map((b) => b.sceneId ?? null), ['ns1', 'ns2', null, 'ns3']);
    const live = board();
    assert.equal(relinkSceneCards(live, script()), live, 'nothing stale: the same array');
  });

  it('repeated headings go to the scene with the card\'s number; retitled and unmatched cards stay as they are', () => {
    const blocks = [B('x1', 'scene', 'INT. CAR - NIGHT'), B('x2', 'scene', 'EXT. ROAD - NIGHT'), B('x3', 'scene', 'INT. CAR - NIGHT')];
    const beats = [
      card('c3', 0, 'old3', '3. INT. CAR - NIGHT'),
      card('c1', 0, 'old1', '1. INT. CAR - NIGHT'),
      card('mine', 0, 'old2', 'The long drive'), // retitled: no way to tell which scene
      card('gone', 0, 'old9', '9. EXT. MOON - DAY'), // no such heading any more
    ];
    const out = relinkSceneCards(beats, blocks);
    assert.equal(out.find((b) => b.id === 'c3').sceneId, 'x3');
    assert.equal(out.find((b) => b.id === 'c1').sceneId, 'x1');
    assert.equal(out.find((b) => b.id === 'mine').sceneId, 'old2');
    assert.equal(out.find((b) => b.id === 'gone').sceneId, 'old9');
  });

  it('a heading another card already holds is never taken twice', () => {
    const blocks = [B('x1', 'scene', 'INT. CAR - NIGHT')];
    const beats = [card('live', 0, 'x1', 'Custom title'), card('stale', 0, 'old', '1. INT. CAR - NIGHT')];
    assert.equal(relinkSceneCards(beats, blocks), beats);
  });

  it('App relinks on import (one undo step with the script) and when a project opens', () => {
    const src = read('src/App.jsx');
    const imp = src.slice(src.indexOf('const importScript = '), src.indexOf('const printScript = '));
    assert.match(imp, /relinkSceneCards\(beforeBeats, incoming\)/);
    assert.match(imp, /set\(incoming, null, afterBeats === beforeBeats \? null : \{\s*undo: \(\) => setBeats\(beforeBeats\),\s*redo: \(\) => setBeats\(afterBeats\),/);
    assert.match(src, /setBeats\(relinkSceneCards\(doc\.beats, bl\)\)/, 'opening a project mends old links');
    assert.match(src, /beats: relinkSceneCards\(d\.beats, bl\)/, 'and so does the first load');
  });
});
