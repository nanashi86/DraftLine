import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACT2B_MARKER, convertActs, convertNotesActs, defaultStoryNotes, joinAct2, splitAct2 } from '../src/lib/bible.js';

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

describe('4 → 3 acts: Act 2A and Act 2B join into Act II', () => {
  it('as `${act2a}\\n\\n### ACT 2B\\n\\n${act2b}` (trimmed)', () => {
    assert.equal(joinAct2('  The storm. \n', '\nThe fall.  '), 'The storm.\n\n### ACT 2B\n\nThe fall.');
    assert.deepEqual(convertActs(acts({ act2: 'Two A.', act2b: 'Two B.' }), 4, 3), acts({ act2: 'Two A.\n\n### ACT 2B\n\nTwo B.' }));
    assert.deepEqual(convertActs(acts({ act2: 'Only 2A.' }), 4, 3), acts({ act2: 'Only 2A.' }), 'nothing in 2B: nothing added');
    assert.equal(joinAct2('', 'Only 2B.'), '### ACT 2B\n\nOnly 2B.');
  });
  it('round trip: 4 → 3 → 4 restores the exact split, multi-paragraph halves included', () => {
    const four = acts({ act1: 'Setup.', act2: 'Escalation.\n\nMore escalation.\n\n- a list', act2b: 'Fall.\n\nCrisis, then worse.', act3: 'End.' });
    assert.deepEqual(convertActs(convertActs(four, 4, 3), 3, 4), four);
    const only2b = acts({ act2b: 'Fall.' });
    assert.deepEqual(convertActs(convertActs(only2b, 4, 3), 3, 4), only2b);
    const three = acts({ act2: 'A one.\n\nA two.\n\nB one.\n\nB two.' });
    const split = convertActs(three, 3, 4);
    assert.deepEqual(convertActs(split, 4, 3).act2, 'A one.\n\nA two.\n\n### ACT 2B\n\nB one.\n\nB two.', 'no text lost');
  });
});

describe('Switching acts converts the Synopsis and the Treatment', () => {
  it('both cards; untouched notes come back as the same object (not an edit)', () => {
    const notes = { ...defaultStoryNotes(), synopsis: acts({ act2: 'S-a.\n\nS-b.' }), treatment: acts({ act2: 'T-a.\n---\nT-b.' }) };
    const four = convertNotesActs(notes, 3, 4);
    assert.deepEqual([four.synopsis.act2, four.synopsis.act2b, four.treatment.act2, four.treatment.act2b], ['S-a.', 'S-b.', 'T-a.', 'T-b.']);
    const three = convertNotesActs(four, 4, 3);
    assert.equal(three.synopsis.act2, 'S-a.\n\n### ACT 2B\n\nS-b.');
    assert.equal(three.treatment.act2b, '');
    const blank = defaultStoryNotes();
    assert.equal(convertNotesActs(blank, 3, 4), blank);
    assert.equal(convertNotesActs(four, 4, 4), four);
  });
  it('the app converts on either switch (Notes or Scene Board), then changes the view', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(app, /const changeActMode = useCallback\(\(next\) => \{\s*if \(!ACT_STRUCTURES\.includes\(next\) \|\| next === actMode\) return;\s*setStoryNotes\(\(notes\) => convertNotesActs\(notes, actMode, next\)\);\s*setActMode\(next\);/);
    assert.equal((app.match(/onActModeChange=\{changeActMode\}/g) || []).length, 2);
    assert.ok(!/onActModeChange=\{setActMode\}/.test(app));
  });
});
