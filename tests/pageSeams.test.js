import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ELEMENT_META, ELEMENT_TYPES, PAGE_HEIGHT_LINES, PAGE_LINES, SPLIT_MIN_LINES, buildItems, contdCue, paginate,
} from '../src/lib/screenplay.js';
import { toFountain } from '../src/lib/fountain.js';
import { serializeBackup } from '../src/lib/backup.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/**
 * A script whose element heights are fixed: each entry is [type, lines, text?, extra?].
 * Returns { blocks, items, layout, at(i) } with the layout of the i-th entry.
 */
function lay(spec) {
  const blocks = spec.map(([type, , text = `${type} text`, extra = {}], i) => ({ id: `b${i}`, type, text, ...extra }));
  const measured = Object.fromEntries(spec.map(([, n], i) => [`b${i}`, n]));
  const items = buildItems(blocks);
  const layout = paginate(items, measured);
  const at = (i) => layout.place[items.findIndex((it) => it.blocks.some((b) => b.id === `b${i}`))];
  return { blocks, items, layout, at };
}
// Page 1 opens with a heading (line 0) and an action paragraph of `n` lines from line 2: the page
// is then used to line 2 + n.
const opening = (n) => [['scene', 1, 'INT. FERRY - NIGHT'], ['action', n]];

describe('Page seams: scene headings', () => {
  it('a heading with fewer than 2 lines of what follows at the page bottom moves to the next page', () => {
    // Used to line 49; the heading would sit on 51 with one action line on 53, the rest overflowing.
    const { at } = lay([...opening(47), ['scene', 1, 'EXT. DOCK - DAY'], ['action', 1], ['action', 10]]);
    assert.equal(at(2).page, 1, 'heading on page 2');
    assert.equal(at(2).topLine, 0, 'at its top');
    assert.equal(at(3).page, 1, 'with the line that follows it');
  });
  it('a heading never ends a page, even before a long speech', () => {
    const { layout, items } = lay([...opening(50), ['scene', 1, 'EXT. DOCK - DAY'], ['character', 1, 'FITOH'], ['dialogue', 30]]);
    items.forEach((it, k) => {
      if (it.type !== 'scene' || k + 1 >= items.length) return;
      assert.equal(layout.place[k + 1].page, layout.place[k].page, 'what follows a heading starts on its page');
    });
  });
  it('a heading with room for 2 more lines stays put', () => {
    const { at } = lay([...opening(40), ['scene', 1, 'EXT. DOCK - DAY'], ['action', 2]]);
    assert.equal(at(2).page, 0);
  });
});

describe('Page seams: transitions', () => {
  it('a transition never starts a page: it stays with what precedes it', () => {
    const { layout, items } = lay([...opening(50), ['action', 2], ['transition', 1, 'CUT TO:']]);
    const t = items.findIndex((it) => it.type === 'transition');
    assert.ok(layout.place[t].topLine > 0, 'not at the top of a page');
    assert.equal(layout.place[t].page, layout.place[t - 1].page, 'on the same page as the action before it');
  });
});

describe('Page seams: splitting dialogue with (MORE) and (CONT\'D)', () => {
  // Cue on line 44 of page 1, then 12 lines of dialogue: 8 fit (line 53 holds (MORE)), 4 go on.
  const split = () => lay([...opening(41), ['character', 1, 'FITOH'], ['dialogue', 12, 'All the words.']]);

  it('splits at a dialogue line: (MORE) under the last line here, NAME (CONT\'D) over the rest', () => {
    const { at } = split();
    assert.deepEqual(at(3).pieces.map(({ page, topLine, from, to, more, cont }) => ({ page, topLine, from, to, more, cont })), [
      { page: 0, topLine: 45, from: 0, to: 8, more: true, cont: null },
      { page: 1, topLine: 1, from: 8, to: 12, more: false, cont: "FITOH (CONT'D)" },
    ]);
    assert.ok(45 + 8 + 1 <= PAGE_LINES, '(MORE) still inside the page');
  });
  it('the editor column: the second piece starts one page card on, below the (CONT\'D) line', () => {
    const [a, b] = split().at(3).pieces;
    assert.equal(b.marginGaps, 1);
    assert.equal(b.marginLines, PAGE_HEIGHT_LINES + 0 - (a.topLine + (a.to - a.from) + 1));
  });
  it('fewer than 2 lines of room: the whole speech, cue included, moves to the next page', () => {
    // Cue on line 51; after it only line 52 is free above the (MORE) line.
    const { at } = lay([...opening(48), ['character', 1, 'FITOH'], ['dialogue', 6]]);
    assert.equal(at(2).page, 1);
    assert.equal(at(2).topLine, 0);
    assert.equal(at(3).pieces, undefined, 'no seam');
  });
  it('at least 2 lines of dialogue must be left for the next page', () => {
    // Cue 44 · dialogue 45–52 · (paren) · 1 line. Splitting after all 8 lines would leave a
    // parenthetical and a single line of dialogue, so it splits after 7: 2 dialogue lines go on.
    const { at } = lay([...opening(41), ['character', 1, 'FITOH'], ['dialogue', 8], ['parenthetical', 1, '(beat)'], ['dialogue', 1]]);
    const [a, b] = at(3).pieces;
    assert.equal(a.to, 7);
    assert.ok(a.more);
    assert.equal(b.to - b.from + 1, SPLIT_MIN_LINES, '1 line here + 1 after the parenthetical');
    assert.equal(at(4).page, 1);
  });
  it('never splits directly after a parenthetical: with no dialogue room after it, the speech moves', () => {
    // Cue on 51, parenthetical on 52, (MORE) would need 53 + a dialogue line: no room.
    const { at } = lay([...opening(48), ['character', 1, 'MARIE'], ['parenthetical', 1, '(quietly)'], ['dialogue', 8]]);
    assert.equal(at(2).page, 1, 'cue moved');
    assert.equal(at(3).page, 1, 'parenthetical moved with it');
    assert.equal(at(4).pieces, undefined);
  });
  it('splits between dialogue paragraphs too; a parenthetical goes with the dialogue after it', () => {
    // Cue 44 · dialogue 45–48 · (paren) 49 · dialogue 6 lines: best split is inside the 2nd dialogue.
    const { at } = lay([...opening(41), ['character', 1, 'MARIE'], ['dialogue', 4], ['parenthetical', 1, '(beat)'], ['dialogue', 6]]);
    const [a, b] = at(5).pieces;
    assert.equal(at(4).page, 0, 'the parenthetical stays with the dialogue line under it');
    assert.equal(a.page, 0);
    assert.ok(a.more && a.to - a.from >= 1);
    assert.equal(b.cont, "MARIE (CONT'D)");
    // And the element boundary works: when the 2nd dialogue can't keep 2 lines here, the seam
    // falls after the 1st, and the parenthetical opens page 2 under the (CONT'D).
    const edge = lay([...opening(44), ['character', 1, 'MARIE'], ['dialogue', 4], ['parenthetical', 1, '(beat)'], ['dialogue', 6]]);
    assert.ok(edge.at(3).pieces?.[0].more, '(MORE) after the 1st dialogue paragraph');
    assert.equal(edge.at(4).page, 1);
    assert.equal(edge.at(4).pieces[0].cont, "MARIE (CONT'D)");
  });
  it('a speech longer than a page splits as often as it needs to', () => {
    const { at } = lay([['character', 1, 'FITOH'], ['dialogue', 120]]);
    const ps = at(1).pieces;
    assert.ok(ps.length >= 3);
    ps.slice(0, -1).forEach((p) => assert.ok(p.more));
    ps.slice(1).forEach((p) => assert.equal(p.cont, "FITOH (CONT'D)"));
    assert.equal(ps.reduce((n, p) => n + p.to - p.from, 0), 120, 'every line placed once');
  });
  it('dual dialogue never splits', () => {
    // A dual pair is measured as one row, under its first cue's id: 12 lines here.
    const { layout, items } = lay([...opening(41), ['character', 12, 'A'], ['dialogue', 8], ['character', 1, 'B', { dual: true }], ['dialogue', 8]]);
    const d = items.findIndex((it) => it.kind === 'dual');
    assert.equal(layout.place[d].page, 1);
    assert.equal(layout.place[d].pieces, undefined);
  });
  it('(CONT\'D) keeps the cue\'s extension and never doubles', () => {
    assert.equal(contdCue('Marie (V.O.)'), "MARIE (V.O.) (CONT'D)");
    assert.equal(contdCue("FITOH (CONT'D)"), "FITOH (CONT'D)");
    assert.equal(contdCue('FITOH (CONT’D)'), 'FITOH (CONT’D)');
    assert.equal(contdCue('@McClane ^'), "MCCLANE (CONT'D)");
  });
});

describe('Page seams are layout only', () => {
  it('pagination never changes the script', () => {
    const { blocks } = lay([...opening(41), ['character', 1, 'FITOH'], ['dialogue', 12, 'All the words.']]);
    const before = JSON.stringify(blocks);
    paginate(buildItems(blocks), Object.fromEntries(blocks.map((b, i) => [b.id, [1, 41, 1, 12][i]])));
    assert.equal(JSON.stringify(blocks), before);
  });
  it('Fountain and .draftline exports carry no (MORE) or (CONT\'D)', () => {
    const { blocks, at } = lay([...opening(41), ['character', 1, 'FITOH'], ['dialogue', 12, 'All the words.']]);
    assert.ok(at(3).pieces, 'the speech is split on the page');
    const fountain = toFountain({ meta: { title: 'Seams' }, blocks });
    const backup = serializeBackup({ id: 'p1', script: blocks, meta: { title: 'Seams' } });
    for (const out of [fountain, backup]) {
      assert.ok(!/\(MORE\)/.test(out), 'no (MORE)');
      assert.ok(!/CONT['’]D/.test(out), "no (CONT'D)");
    }
  });
  it('the editor and print draw them as aria-hidden layout lines', () => {
    const editor = read('src/components/Editor.jsx');
    const print = read('src/components/PrintView.jsx');
    assert.match(editor, /<div className="el-seam el-contd" aria-hidden="true">\{piece\.cont\}<\/div>/);
    assert.match(editor, /<div className="el-seam el-more" aria-hidden="true">\(MORE\)<\/div>/);
    assert.match(print, /\{piece\?\.more && <div className="el-seam el-more">\(MORE\)<\/div>\}/);
    assert.match(read('src/components/Editor.css'), /\.el-seam \{[^}]*margin-left: calc\(var\(--in\) \* 2\.2 - var\(--el-left\)\)/);
  });
});

describe('Spellcheck per element type', () => {
  it('prose is checked; names, sluglines, transitions, parentheticals and cues are not', () => {
    const want = { scene: false, action: true, character: false, parenthetical: false, dialogue: true, transition: false, format_cue: false, centered: true };
    assert.deepEqual(Object.fromEntries(ELEMENT_TYPES.map((t) => [t, ELEMENT_META[t].spellcheck])), want);
  });
  it('the editor sets spellcheck and autocorrect from it on every element', () => {
    const editor = read('src/components/Editor.jsx');
    assert.match(editor, /spellCheck=\{meta\.spellcheck\}\s*autoCorrect=\{meta\.spellcheck \? 'on' : 'off'\}/);
  });
});
