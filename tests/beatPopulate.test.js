import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  byAct, columnForPage, firstSentence, formatPageTargets, newBeat, pageBounds, parseSceneRanges, populateByPages,
  populateByRanges, rangesFromPageTargets, structureFor, validateSceneRanges,
} from '../src/lib/beats.js';

/** Scenes starting on the given pages, numbered 1…n. */
const scenesOn = (pages) => pages.map((page, i) => ({
  id: `s${i + 1}`, number: i + 1, heading: `INT. ROOM ${i + 1} - DAY`, page, snippet: `Scene ${i + 1} opens. More follows.`,
}));
/** Column contents as scene numbers: "1,2|3|4" (by underlying act 1 | 2A | 2B | 3). */
const acts = (beats) => byAct(beats).map((col) => col.map((b) => b.title.split('.')[0]).join(',')).join('|');

describe('proportional page targets', () => {
  it('3 Acts: Act 1 ≤ 25%, Act 2 ≤ 75%, Act 3 the rest — e.g. a 96-page script', () => {
    assert.deepEqual(pageBounds(3, 96), [24, 72]);
    assert.equal(formatPageTargets(3, 96), 'pp. 1–24 · 25–72 · 73+');
    assert.deepEqual([1, 24, 25, 72, 73, 96].map((p) => columnForPage(p, 3, 96)), [0, 0, 1, 1, 2, 2]);
  });
  it('4 Acts: Act 1 ≤ 25%, 2A ≤ 50%, 2B ≤ 75%, Act 3 the rest — e.g. a 110-page script', () => {
    assert.deepEqual(pageBounds(4, 110), [27, 55, 82]);
    assert.equal(formatPageTargets(4, 110), 'pp. 1–27 · 28–55 · 56–82 · 83+');
    assert.deepEqual([1, 27, 28, 55, 56, 82, 83, 110].map((p) => columnForPage(p, 4, 110)), [0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('scales with the script: a 34-page script still fills every act', () => {
    assert.equal(formatPageTargets(4, 34), 'pp. 1–8 · 9–17 · 18–25 · 26+');
    const { beats } = populateByPages([], scenesOn([1, 5, 9, 14, 18, 22, 26, 34]), 4, 34);
    assert.equal(acts(beats), '1,2|3,4|5,6|7,8');
  });
  it('very short scripts keep the bounds increasing', () => {
    assert.deepEqual(pageBounds(4, 3), [1, 2, 3]);
    assert.equal(formatPageTargets(3, 1), 'pp. 1 · 2 · 3+');
  });
  it('a scene is never split: it goes wholly to the act its first page falls in', () => {
    // Scene 2 starts on p. 24 (the last page of Act 1 in a 96-page script) and runs on for pages.
    const { beats } = populateByPages([], scenesOn([1, 24, 26]), 3, 96);
    assert.equal(acts(beats), '1,2|3||');
  });
  it('cards are titled "N. SLUGLINE", summarised by the first sentence, and linked to the scene', () => {
    const [card] = populateByPages([], scenesOn([1]), 4, 100).beats;
    assert.equal(card.title, '1. INT. ROOM 1 - DAY');
    assert.equal(card.synopsis, 'Scene 1 opens.');
    assert.equal(card.sceneId, 's1');
  });
});

describe('Act 2 lane memory', () => {
  it('3-Act placement gives each Act 2 card a lane from the 50% midpoint page', () => {
    // 96 pages: Act 2 = pp. 25–72, midpoint = p. 48.
    const { beats } = populateByPages([], scenesOn([1, 30, 48, 49, 70, 80]), 3, 96);
    assert.equal(acts(beats), '1|2,3|4,5|6');
  });
  it('toggling 3 ↔ 4 Acts moves nothing: the lanes are the placement', () => {
    const { beats } = populateByPages([], scenesOn([1, 30, 60, 90]), 4, 100);
    const before = beats.map((b) => b.act);
    // Both views read the same underlying acts; Act 2 in 3-Act view = lanes 2A then 2B.
    assert.deepEqual(structureFor(3)[1].acts, [1, 2]);
    assert.deepEqual(beats.map((b) => b.act), before);
    assert.deepEqual(byAct(beats).map((c) => c.length), [1, 1, 1, 1]);
  });
  it('an intentional midpoint survives: 5 cards in 2A and 1 in 2B stay that way', () => {
    const cards = [...['a', 'b', 'c', 'd', 'e'].map((t) => newBeat(1, { title: t })), newBeat(2, { title: 'f' })];
    assert.deepEqual(byAct(cards).map((c) => c.length), [0, 5, 1, 0]);
  });
});

describe('re-populating', () => {
  it('keeps your own cards and your edits to scene cards, and adds new scenes', () => {
    const first = populateByPages([], scenesOn([1, 30]), 4, 100).beats;
    const edited = first.map((b) => (b.sceneId === 's1' ? { ...b, synopsis: 'My note.', tag: 'theme' } : b));
    const mine = newBeat(3, { title: 'Ending idea' });
    const r = populateByPages([...edited, mine], scenesOn([1, 30, 90]), 4, 100);
    assert.deepEqual([r.created, r.updated, r.kept], [1, 2, 1]);
    const s1 = r.beats.find((b) => b.sceneId === 's1');
    assert.deepEqual([s1.synopsis, s1.tag, s1.id], ['My note.', 'theme', first[0].id]);
    assert.equal(byAct(r.beats)[3].map((b) => b.title).join(' / '), '3. INT. ROOM 3 - DAY / Ending idea');
  });
});

describe('scene ranges', () => {
  it('parses lists and ranges', () => {
    assert.deepEqual(parseSceneRanges('1-3, 5, 7–8').numbers, [1, 2, 3, 5, 7, 8]);
    assert.match(parseSceneRanges('1-x').error, /isn’t a scene number/);
    assert.match(parseSceneRanges('9-4').error, /backwards/);
  });
  it('3 Acts takes three ranges and needs every scene exactly once', () => {
    assert.equal(validateSceneRanges(['1-4', '5-9', '10-12'], 12, 3).ok, true);
    const bad = validateSceneRanges(['1-4', '4-9', '10-11'], 12, 3);
    assert.equal(bad.ok, false);
    assert.match(bad.errors.join(' '), /In two acts: scene 4 \(Act 1 and Act 2\)/);
    assert.match(bad.errors.join(' '), /Not assigned yet: scene 12/);
    assert.match(validateSceneRanges(['1-4', '5-9', '10-14'], 12, 3).errors.join(' '), /No such scenes: 13–14 \(the script has 12\)/);
  });
  it('4 Acts takes four ranges (2A and 2B separately)', () => {
    const v = validateSceneRanges(['1-3', '4-6', '7-9', '10-12'], 12, 4);
    assert.equal(v.ok, true);
    assert.deepEqual(v.counts, [3, 3, 3, 3]);
    assert.equal(validateSceneRanges(['1-3', '4-9', '10-12'], 12, 4).ok, false, 'three inputs are not enough in 4-Act mode');
  });
  it('Apply maps cards straight to their columns', () => {
    const scenes = scenesOn(Array.from({ length: 12 }, (_, i) => i + 1));
    assert.equal(acts(populateByRanges([], scenes, 4, ['1-2', '3-7', '8-10', '11-12'], 12).beats), '1,2|3,4,5,6,7|8,9,10|11,12');
    // 3 Acts: Act 2's lanes follow the midpoint page (p. 6 of 12).
    assert.equal(acts(populateByRanges([], scenes, 3, ['1-2', '3-10', '11-12'], 12).beats), '1,2|3,4,5,6|7,8,9,10|11,12');
    assert.match(populateByRanges([], scenes, 3, ['1-2', '3-10', '']).error, /Not assigned yet: scenes 11–12/);
  });
  it('defaults to the page-target placement, written as ranges', () => {
    assert.deepEqual(rangesFromPageTargets(scenesOn([1, 10, 30, 60, 80]), 4, 100), ['1-2', '3', '4', '5']);
    assert.deepEqual(rangesFromPageTargets(scenesOn([1, 10, 30, 60, 80]), 3, 100), ['1-2', '3-4', '5']);
  });
});

describe('first sentence', () => {
  it('stops at the first full stop, question or exclamation', () => {
    assert.equal(firstSentence('Rain. Then wind.'), 'Rain.');
    assert.equal(firstSentence('Is she gone? Yes.'), 'Is she gone?');
    assert.equal(firstSentence('MARIE (30s) waits by the pier'), 'MARIE (30s) waits by the pier');
    assert.equal(firstSentence(''), '');
  });
});
