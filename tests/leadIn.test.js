import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEAD_IN_COLON_MAX, PAGE_LINES, buildItems, isLeadInAction, paginate } from '../src/lib/screenplay.js';
import { ISSUE_KINDS, applyFixes, auditScript, canFix, strandedAtPageBottom } from '../src/lib/formatDoctor.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const A = (text) => ({ id: 'x', type: 'action', text });
const cue = { id: 'c', type: 'character', text: 'MARIE' };
const heading = { id: 's', type: 'scene', text: 'EXT. DOCK - NIGHT' };
const action = { id: 'a', type: 'action', text: 'The horn blares.' };

/** Fixed element heights, like pageSeams.test.js: [type, lines, text?]. */
function lay(spec) {
  const blocks = spec.map(([type, , text = `${type} text`], i) => ({ id: `b${i}`, type, text }));
  const measured = Object.fromEntries(spec.map(([, n], i) => [`b${i}`, n]));
  const items = buildItems(blocks);
  const layout = paginate(items, measured);
  const at = (i) => layout.place[items.findIndex((it) => it.blocks.some((b) => b.id === `b${i}`))];
  return { blocks, layout, at };
}
// A heading on line 0 and an action of n lines from line 2: the page is used to line 2 + n.
const opening = (n) => [['scene', 1, 'INT. FERRY - NIGHT'], ['action', n]];

describe('isLeadInAction', () => {
  it('a) a short line ending in a colon', () => {
    assert.equal(isLeadInAction(A('She reads it aloud:')), true);
    assert.equal(isLeadInAction(A('  On the screen:  ')), true, 'trimmed');
    assert.equal(isLeadInAction(A(`${'x'.repeat(LEAD_IN_COLON_MAX)}:`)), false, `${LEAD_IN_COLON_MAX} characters or more is a paragraph`);
  });
  it('b) lead-in keywords: language cues, PRE-LAP, SUPER, INSERT, TITLE, CHYRON', () => {
    for (const t of [
      'IN CREOLE WITH ENGLISH SUBTITLES', 'IN FRENCH SUBTITLED', 'IN SPANISH/ENGLISH WITH SUBTITLES', 'PRE-LAP: a ferry horn',
      'SUPER: PORT-AU-PRINCE, 1991', 'INSERT - THE LETTER', 'TITLE CARD', 'CHYRON: Day 3', 'Super: Port-au-Prince', 'insert: the letter',
    ]) assert.equal(isLeadInAction(A(t)), true, t);
  });
  it('b) ordinary Action that starts with one of those words is not a lead-in', () => {
    for (const t of ['Insert the key into the lock.', 'Superstition keeps him off the boat.', 'Titles roll over the water.', 'Supermarket lights flicker.']) {
      assert.equal(isLeadInAction(A(t)), false, t);
    }
  });
  it('c) one line in capitals right before a cue or a heading', () => {
    assert.equal(isLeadInAction(A('SILENCE.'), cue), true);
    assert.equal(isLeadInAction(A('BLACK.'), heading), true);
    assert.equal(isLeadInAction(A('SILENCE.'), action), false, 'not before Action');
    assert.equal(isLeadInAction(A('SILENCE.')), false, 'needs to know what follows');
    assert.equal(isLeadInAction(A('Silence.'), cue), false, 'not in capitals');
    assert.equal(isLeadInAction(A('1991.'), cue), false, 'no letters');
    assert.equal(isLeadInAction(A(`${'A'.repeat(61)}`), cue), false, 'longer than one Action line');
  });
  it('only Action, and only one paragraph', () => {
    assert.equal(isLeadInAction({ type: 'dialogue', text: 'Read it:' }), false);
    assert.equal(isLeadInAction({ type: 'format_cue', text: 'SUPER: 1991' }), false);
    assert.equal(isLeadInAction(A('She reads:\nThe rest of the paragraph.')), false);
    assert.equal(isLeadInAction(A('')), false);
    assert.equal(isLeadInAction(null), false);
  });
});

describe('Page breaks: lead-in Action never ends a page', () => {
  // Used to line 52: a 1-line Action would sit on line 53, the last line of the page.
  it('a lead-in on the last line moves to the next page with what it introduces', () => {
    const { at } = lay([...opening(50), ['action', 1, 'She reads it aloud:'], ['action', 3]]);
    assert.equal(at(2).page, 1, 'lead-in on page 2');
    assert.equal(at(2).topLine, 0, 'at its top');
    assert.equal(at(3).page, 1, 'with the paragraph it introduces');
  });
  it('ordinary Action in the same place stays at the bottom of the page', () => {
    const { at } = lay([...opening(50), ['action', 1, 'The horn blares.'], ['action', 3]]);
    assert.equal(at(2).page, 0);
    assert.equal(at(2).topLine, PAGE_LINES - 1, 'on the last line');
  });
  it('a capitals line before a speech moves with the speech', () => {
    const { at } = lay([...opening(50), ['action', 1, 'SILENCE.'], ['character', 1, 'MARIE'], ['dialogue', 2]]);
    assert.equal(at(2).page, 1);
    assert.equal(at(3).page, 1);
  });
  it('the same capitals line before more Action is not held back', () => {
    const { at } = lay([...opening(50), ['action', 1, 'SILENCE.'], ['action', 3]]);
    assert.equal(at(2).page, 0);
  });
  it('a lead-in can still sit above a speech that splits across the page', () => {
    // Room for the lead-in, the cue and 2+ dialogue lines with (MORE): it stays, the speech splits.
    const { at } = lay([...opening(38), ['action', 1, 'SUPER: PORT-AU-PRINCE, 1991'], ['character', 1, 'MARIE'], ['dialogue', 20]]);
    assert.equal(at(2).page, 0);
    assert.equal(at(3).page, 0, 'the cue stays with it');
    assert.ok(at(4).pieces?.length === 2, 'the speech splits');
  });
  it('a lead-in at the very end of the script is left alone', () => {
    const { at } = lay([...opening(50), ['action', 1, 'She reads it aloud:']]);
    assert.equal(at(2).page, 0);
  });
});

describe('Format Doctor: stranded at the bottom of a page', () => {
  const blocks = [
    { id: 'l', type: 'action', text: 'She reads it aloud:' },
    { id: 'n', type: 'action', text: 'Come home.' },
    { id: 'h', type: 'scene', text: 'EXT. DOCK - NIGHT' },
    { id: 'm', type: 'action', text: 'Fog.' },
    { id: 'c', type: 'character', text: 'MARIE' },
    { id: 'd', type: 'dialogue', text: 'Go.' },
    { id: 'p', type: 'action', text: 'The horn blares.' },
    { id: 'q', type: 'action', text: 'Gulls.' },
  ];
  // Every element alone at the foot of page 1, with what follows on page 2.
  const split = { pageOfBlock: { l: 1, n: 2, h: 3, m: 4, c: 5, d: 6, p: 7, q: 8 } };

  it('flags a lead-in, a heading and a cue on an earlier page than what follows them', () => {
    const found = auditScript(blocks, { layout: split }).filter((i) => i.kind === 'pagebottom');
    assert.deepEqual(found.map((i) => [i.id, i.page]), [['l', 1], ['h', 3], ['c', 5]]);
  });
  it('never flags ordinary Action, nor anything without a layout or on the same page', () => {
    assert.equal(auditScript(blocks).some((i) => i.kind === 'pagebottom'), false, 'no layout');
    const same = { pageOfBlock: Object.fromEntries(blocks.map((b) => [b.id, 1])) };
    assert.equal(auditScript(blocks, { layout: same }).some((i) => i.kind === 'pagebottom'), false);
    assert.equal(strandedAtPageBottom(blocks[6], blocks[7], split.pageOfBlock), false, 'ordinary Action');
    assert.equal(strandedAtPageBottom(blocks[0], blocks[1], {}), false, 'blocks the layout does not know (out of date)');
  });
  it('is quiet while the element, or the one after it, is being typed in', () => {
    assert.equal(auditScript(blocks, { layout: split, skipId: 'n' }).some((i) => i.id === 'l' && i.kind === 'pagebottom'), false);
  });
  it('can be ignored, and has no automatic fix: Fix All leaves the script as it is', () => {
    assert.equal(auditScript(blocks, { layout: split, ignore: new Set(['l|pagebottom']) }).some((i) => i.id === 'l'), false);
    assert.equal(canFix('pagebottom'), false);
    assert.equal(ISSUE_KINDS.pagebottom.label, 'Stranded at the bottom of a page');
    const issues = auditScript(blocks, { layout: split }).filter((i) => i.kind === 'pagebottom');
    assert.deepEqual(applyFixes(blocks, issues), blocks, 'nothing removed or changed');
  });
  it('a real layout keeps lead-ins with what follows, so the Doctor finds nothing', () => {
    const { blocks: b, layout } = lay([...opening(50), ['action', 1, 'She reads it aloud:'], ['action', 3], ['scene', 1, 'EXT. DOCK - DAY'], ['action', 2]]);
    assert.equal(auditScript(b, { layout }).some((i) => i.kind === 'pagebottom'), false);
  });
  it('the app hands the Doctor the live layout', () => {
    const app = read('src/App.jsx');
    assert.match(app, /auditScript\(blocks, \{ skipId: activeId, ignore: ignoredIssues, layout \}\)/);
  });
});
