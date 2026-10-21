import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACT2B_MARKER, MIDPOINT_KEYWORDS, act2Split, act2bAnchors, realignActs, slugLocation, splitAtStoryTurn, convertActs, convertNotesActs, defaultStoryNotes, joinAct2, normalizeStoryNotes, restoreSplit, splitAct2,
} from '../src/lib/bible.js';

const acts = (o) => ({ act1: '', act2: '', act2b: '', act3: '', ...o });

describe('3 → 4 acts: Act II splits into Act 2A and Act 2B', () => {
  it('at a marker: "### Act 2B" / "## Midpoint" headings (their whole line), "---", "[ACT 2B]"', () => {
    assert.deepEqual(splitAct2('The storm rises.\n\n### ACT 2B: Fall & Crisis\n\nThe ferry sinks.'), ['The storm rises.', 'The ferry sinks.']);
    assert.deepEqual(splitAct2('Rising.\n## Midpoint\nFalling.'), ['Rising.', 'Falling.']);
    assert.deepEqual(splitAct2('Rising.\n\n---\n\nFalling.'), ['Rising.', 'Falling.']);
    assert.deepEqual(splitAct2('Rising. [act 2b] Falling.'), ['Rising.', 'Falling.']);
    assert.ok(ACT2B_MARKER.test('###ACT 2B') && ACT2B_MARKER.test('## MIDPOINT') && !ACT2B_MARKER.test('the midpoint'));
  });
  it('no marker: at the paragraph break nearest half the length', () => {
    const t = 'Marie boards the ferry.\n\nThe storm rises. Theo hides below.\n\nThe captain refuses to turn back.\n\nAll seems lost.';
    assert.deepEqual(splitAct2(t), ['Marie boards the ferry.\n\nThe storm rises. Theo hides below.', 'The captain refuses to turn back.\n\nAll seems lost.']);
    const long = `${'a'.repeat(10)}\n\n${'b'.repeat(60)}\n\n${'c'.repeat(30)}`; // breaks at ~11% and ~70%
    assert.deepEqual(splitAct2(long), [`${'a'.repeat(10)}\n\n${'b'.repeat(60)}`, 'c'.repeat(30)], 'the break nearest 50%, whichever side');
  });
  it('never leaves Act 2B empty while Act II has words: one paragraph splits at a line, then a sentence, then a word', () => {
    assert.deepEqual(splitAct2('Line one\nLine two\nLine three'), ['Line one\nLine two', 'Line three']);
    assert.deepEqual(splitAct2('One sentence here. Another one there. Then it turns. And ends.'), ['One sentence here. Another one there.', 'Then it turns. And ends.']);
    assert.deepEqual(splitAct2('three plain words'), ['three', 'plain words']);
    assert.deepEqual(splitAct2('Everything before.\n\n### Act 2B'), ['Everything', 'before.'], 'a marker with nothing after it');
    for (const t of ['A.\n\nB.', 'x y', 'Rising.\n---\nFalling.', 'One. Two.']) assert.ok(splitAct2(t)[1], t);
  });
  it('convertActs: only when Act II has text and Act 2B is empty', () => {
    assert.deepEqual(convertActs(acts({ act1: 'I', act2: 'A.\n\nB.', act3: 'III' }), 3, 4), acts({ act1: 'I', act2: 'A.', act2b: 'B.', act3: 'III' }));
    const kept = acts({ act2: 'Two.\n\nMore.', act2b: 'Already here.' });
    assert.deepEqual(convertActs(kept, 3, 4), kept, '2B already written: left alone');
    assert.deepEqual(convertActs(acts({ act1: 'I' }), 3, 4), acts({ act1: 'I' }));
  });
});

describe('4 → 3 acts: Act 2A and Act 2B join into Act II, with nothing added to the prose', () => {
  it('a plain blank line between the trimmed halves — no "ACT 2B" text', () => {
    assert.equal(joinAct2('  The storm. \n', '\nThe fall.  '), 'The storm.\n\nThe fall.');
    assert.deepEqual(convertActs(acts({ act2: 'Two A.', act2b: 'Two B.' }), 4, 3), acts({ act2: 'Two A.\n\nTwo B.' }));
    assert.deepEqual(convertActs(acts({ act2: 'Only 2A.' }), 4, 3), acts({ act2: 'Only 2A.' }), 'nothing in 2B: nothing added');
    assert.equal(joinAct2('', 'Only 2B.'), 'Only 2B.');
    for (const t of [joinAct2('A.\n\nMore.', 'B.'), convertNotesActs({ ...defaultStoryNotes(), synopsis: acts({ act2: 'A.', act2b: 'B.' }) }, 4, 3).synopsis.act2]) {
      assert.ok(!/ACT\s*2B/i.test(t), t);
    }
  });
  it('the boundary is kept out of sight: offset plus the words either side', () => {
    assert.deepEqual(act2Split('Two A.', 'Two B.'), { at: 8, head: 'Two A.', tail: 'Two B.' });
    assert.deepEqual(act2Split('', 'Only 2B.'), { at: 0, head: '', tail: 'Only 2B.' });
    assert.equal(act2Split('Only 2A.', '  '), null);
    const long = 'x'.repeat(100);
    assert.equal(act2Split(long, long).head.length, 32, 'only a few words, not a copy of the act');
  });
});

describe('3 → 4 after a join: the remembered split comes back exactly', () => {
  const four = { ...defaultStoryNotes(),
    synopsis: acts({ act1: 'Setup.', act2: 'Escalation.\n\nMore escalation.\n\n- a list', act2b: 'Fall.\n\nCrisis, then worse.', act3: 'End.' }),
    treatment: acts({ act2: 'Sequence A.', act2b: 'Sequence B.\n\nAnd C.' }) };
  it('round trip 4 → 3 → 4, both cards, multi-paragraph halves included; the metadata is then used up', () => {
    const three = convertNotesActs(four, 4, 3);
    assert.deepEqual(Object.keys(three.actSplits), ['synopsis', 'treatment']);
    const back = convertNotesActs(three, 3, 4);
    assert.deepEqual(back.synopsis, four.synopsis);
    assert.deepEqual(back.treatment, four.treatment);
    assert.equal(back.actSplits, undefined);
  });
  it('survives edits elsewhere in Act II (found by its words), and saves with the project', () => {
    const three = convertNotesActs(four, 4, 3);
    const edited = { ...three, synopsis: { ...three.synopsis, act2: `A new opening paragraph.\n\n${three.synopsis.act2}\n\nA new last line.` } };
    const back = convertNotesActs(edited, 3, 4);
    assert.equal(back.synopsis.act2, 'A new opening paragraph.\n\nEscalation.\n\nMore escalation.\n\n- a list');
    assert.equal(back.synopsis.act2b, 'Fall.\n\nCrisis, then worse.\n\nA new last line.');
    assert.deepEqual(normalizeStoryNotes(three).actSplits, three.actSplits, 'kept by normalizeStoryNotes (storage, backups)');
    assert.equal(normalizeStoryNotes({ ...three, actSplits: { synopsis: { at: 'x' } } }).actSplits, undefined, 'junk dropped');
  });
  it('the boundary’s words gone: falls back to a typed marker, then the middle', () => {
    assert.equal(restoreSplit('Totally rewritten.', { at: 5, head: 'Two A.', tail: 'Two B.' }), null);
    const three = convertNotesActs(four, 4, 3);
    const rewritten = { ...three, synopsis: { ...three.synopsis, act2: 'New A.\n\nNew B.' } };
    assert.deepEqual([convertNotesActs(rewritten, 3, 4).synopsis.act2, convertNotesActs(rewritten, 3, 4).synopsis.act2b], ['New A.', 'New B.']);
    assert.equal(restoreSplit('Same. Same. Same.', { at: 99, head: 'Same.', tail: 'Same.' }), null, 'ambiguous: not guessed');
  });
});

describe('Switching acts converts the Synopsis and the Treatment', () => {
  it('both cards; untouched notes come back as the same object (not an edit)', () => {
    const notes = { ...defaultStoryNotes(), synopsis: acts({ act2: 'S-a.\n\nS-b.' }), treatment: acts({ act2: 'T-a.\n---\nT-b.' }) };
    const four = convertNotesActs(notes, 3, 4);
    assert.deepEqual([four.synopsis.act2, four.synopsis.act2b, four.treatment.act2, four.treatment.act2b], ['S-a.', 'S-b.', 'T-a.', 'T-b.']);
    const three = convertNotesActs(four, 4, 3);
    assert.equal(three.synopsis.act2, 'S-a.\n\nS-b.');
    assert.equal(three.treatment.act2b, '');
    const blank = defaultStoryNotes();
    assert.equal(convertNotesActs(blank, 3, 4), blank);
    assert.equal(convertNotesActs(four, 4, 4), four);
  });
  it('the app converts on either switch (Notes or Scene Board), then changes the view', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /const changeActMode = useCallback\(\(next\) => \{\s*if \(!ACT_STRUCTURES\.includes\(next\) \|\| next === actMode\) return;\s*setStoryNotes\(\(notes\) => convertNotesActs\(notes, actMode, next, \{ beats, blocks \}\)\);\s*setActMode\(next\);\s*\}, \[actMode, beats, blocks\]\);/);
    assert.equal((app.match(/onActModeChange=\{changeActMode\}/g) || []).length, 2);
    assert.ok(!/onActModeChange=\{setActMode\}/.test(app));
  });
});

describe('3 → 4: Act 2B found from the Scene Board, then the midpoint', () => {
  const ACT2 = [
    'Jean-Luc returns to Pétion-Ville and takes the job.',
    'He meets Cassandre at the gala; sparks and suspicion.',
    'A BMW tears through the market: a hit and run. The driver is Carlo, nephew of Cassandre.',
    'Jean-Luc digs in; the family closes ranks.',
    'At Morne Calvaire, he finds the car burned out.',
  ];
  const text = ACT2.join('\n\n');
  const notes = (t = text) => ({ ...defaultStoryNotes(), synopsis: acts({ act2: t }), treatment: acts({ act2: t }) });
  const board = {
    beats: [{ id: 'a', act: 1, title: 'The gala' }, { id: 'b', act: 2, title: 'Burned out', sceneId: 's9' }, { id: 'c', act: 2, title: 'Later' }],
    blocks: [{ id: 's1', type: 'scene', text: 'INT. GALA - NIGHT' }, { id: 's9', type: 'scene', text: 'EXT. MORNE CALVAIRE - NIGHT' }],
  };

  it('scene anchor: the first Act 2B card’s scene location (or its own heading / title)', () => {
    assert.deepEqual(act2bAnchors(board), ['MORNE CALVAIRE', 'Burned out']);
    assert.deepEqual(act2bAnchors({ beats: [{ act: 2, title: 'EXT. MORNE CALVAIRE - DAY' }] }), ['MORNE CALVAIRE']);
    assert.deepEqual(act2bAnchors({ beats: [{ act: 1, title: 'x' }] }), [], 'no Act 2B card');
    assert.equal(slugLocation('INT./EXT. FERRY - WHEELHOUSE - CONTINUOUS'), 'FERRY - WHEELHOUSE');
    assert.equal(slugLocation('The letter'), '');
    // Without the midpoint words, the anchor alone decides.
    assert.deepEqual(splitAct2(text, { anchors: act2bAnchors(board), keywords: null }), [ACT2.slice(0, 4).join('\n\n'), ACT2[4]]);
  });
  it('anchors and midpoint words together: whichever paragraph comes FIRST starts Act 2B — Synopsis and Treatment', () => {
    const four = convertNotesActs(notes(), 3, 4, board);
    for (const card of ['synopsis', 'treatment']) {
      assert.equal(four[card].act2, ACT2.slice(0, 2).join('\n\n'), card);
      assert.ok(four[card].act2b.startsWith('A BMW tears through the market'), card);
    }
    const anchorFirst = [ACT2[0], 'Dawn at Morne Calvaire.', ACT2[2]].join('\n\n');
    assert.deepEqual(splitAct2(anchorFirst, { anchors: ['MORNE CALVAIRE'] }), [ACT2[0], `Dawn at Morne Calvaire.\n\n${ACT2[2]}`]);
  });
  it('midpoint keywords: the Carlo / hit-and-run paragraph starts Act 2B', () => {
    for (const k of ['Carlo', 'a hit and run', 'the BMW', 'nephew of Cassandre']) assert.ok(MIDPOINT_KEYWORDS.test(k), k);
    const four = convertNotesActs(notes(), 3, 4); // no Scene Board anchor
    assert.equal(four.synopsis.act2, ACT2.slice(0, 2).join('\n\n'));
    assert.equal(four.synopsis.act2b, ACT2.slice(2).join('\n\n'));
    assert.ok(four.synopsis.act2b.startsWith('A BMW tears through the market'));
    const noMatch = { beats: [{ act: 2, title: 'Somewhere else entirely' }], blocks: [] };
    assert.equal(convertNotesActs(notes(), 3, 4, noMatch).synopsis.act2b, ACT2.slice(2).join('\n\n'), 'anchor not in the text: keywords next');
  });
  it('a Treatment written with single line breaks splits by line at the Carlo / hit-and-run line', () => {
    const lines = ACT2.join('\n');
    const four = convertNotesActs({ ...defaultStoryNotes(), treatment: acts({ act2: lines }) }, 3, 4);
    assert.equal(four.treatment.act2, ACT2.slice(0, 2).join('\n'));
    assert.equal(four.treatment.act2b, ACT2.slice(2).join('\n'));
  });
  it('fallback: the paragraph break nearest the middle; no headers ever added', () => {
    const plain = 'One.\n\nTwo.\n\nThree.\n\nFour.';
    assert.deepEqual(splitAct2(plain, { anchors: ['Nowhere'] }), ['One.\n\nTwo.', 'Three.\n\nFour.']);
    const four = convertNotesActs(notes(), 3, 4, board);
    assert.equal(`${four.synopsis.act2}\n\n${four.synopsis.act2b}`, text, 'only split — not a character added or lost');
    assert.ok(!/ACT\s*2B/i.test(four.synopsis.act2 + four.synopsis.act2b));
  });
  it('splits between paragraphs only, never before the first; whole words for anchors', () => {
    assert.equal(splitAct2('Carlo arrives.\n\nNothing here.', { anchors: [] })[1], 'Nothing here.', 'a keyword in the first paragraph doesn’t empty 2A: falls through');
    assert.deepEqual(splitAct2('A.\n\nAt the Gallery.\n\nAt the gala.', { anchors: ['GALA'], keywords: null }), ['A.\n\nAt the Gallery.', 'At the gala.']);
    assert.deepEqual(splitAtStoryTurn('Nothing.\n\nStill nothing.'), null);
  });
  it('a remembered join and a typed marker still come first', () => {
    const t = 'Rising.\n\n---\n\nThe BMW at Morne Calvaire.\n\nMore.';
    assert.deepEqual(splitAct2(t, { anchors: ['MORNE CALVAIRE'] }), ['Rising.', 'The BMW at Morne Calvaire.\n\nMore.']);
    const four = { ...defaultStoryNotes(), synopsis: acts({ act2: 'Before Carlo.\n\nStill 2A.', act2b: 'Real 2B.' }) };
    const back = convertNotesActs(convertNotesActs(four, 4, 3), 3, 4, board);
    assert.deepEqual([back.synopsis.act2, back.synopsis.act2b], ['Before Carlo.\n\nStill 2A.', 'Real 2B.']);
  });
});

describe('Auto-Align Acts (Notes, 4 acts): re-split existing 2A / 2B without losing a word', () => {
  const two = ['Jean-Luc takes the job.', 'He meets Cassandre at the gala.', 'A BMW tears through the market: a hit and run. Carlo drove.', 'The family closes ranks.'];
  const misplaced = { ...defaultStoryNotes(),
    synopsis: acts({ act1: 'Setup.', act2: two.slice(0, 3).join('\n\n'), act2b: two[3], act3: 'End.' }),
    treatment: acts({ act2: two[0], act2b: two.slice(1).join('\n\n') }) };
  it('moves the Carlo / hit-and-run paragraph to the top of Act 2B in both cards', () => {
    const { notes, changed } = realignActs(misplaced);
    assert.deepEqual(changed, ['synopsis', 'treatment']);
    for (const card of ['synopsis', 'treatment']) {
      assert.equal(notes[card].act2, two.slice(0, 2).join('\n\n'), card);
      assert.equal(notes[card].act2b, two.slice(2).join('\n\n'), card);
    }
    assert.equal(notes.synopsis.act1, 'Setup.');
    assert.equal(notes.synopsis.act3, 'End.');
    assert.deepEqual(notes.sections, misplaced.sections, 'other notes untouched');
  });
  it('already aligned (or nothing to go on): the same notes object back', () => {
    const { notes } = realignActs(misplaced);
    const again = realignActs(notes);
    assert.equal(again.notes, notes);
    assert.deepEqual(again.changed, []);
    const blank = defaultStoryNotes();
    assert.equal(realignActs(blank).notes, blank);
  });
  it('the button: Notes toolbar, 4 acts only, wired to the Scene Board and script', () => {
    const ui = readFileSync(new URL('../src/components/ProjectBibleDrawer.jsx', import.meta.url), 'utf8');
    assert.match(ui, /\{onRealignActs && actMode === 4 && \(\s*<button[\s\S]*?onClick=\{onRealignActs\}[\s\S]*?>\s*Auto-Align Acts\s*<\/button>/);
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /const r = realignActs\(storyNotes, \{ beats, blocks \}\);/);
    assert.match(app, /onRealignActs=\{realignStoryActs\}/);
  });
});
