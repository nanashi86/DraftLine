import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installDOMParser } from './helpers/miniDom.js';
import {
  activeStyles, clearMarks, migrateBlock, parseInline, reconcileMarks, remapRanges, segments,
  toFountainInline, toggleStyle, wordAt,
} from '../src/lib/formatting.js';
import { parseFountain, toFountain } from '../src/lib/fountain.js';
import { parseFDX, toFDX } from '../src/lib/fdx.js';
import { parseTextScript } from '../src/lib/textScriptParser.js';
import { backspaceAt } from '../src/lib/editing.js';
import { pageLabel } from '../src/lib/screenplay.js';

installDOMParser();

/** "b:word,i:other" — which text each style covers, for readable assertions. */
const fmt = (b) => ['b', 'i', 'u', 's']
  .flatMap((k) => (b.marks?.[k] || []).map(([s, e]) => `${k}:${b.text.slice(s, e)}`))
  .join(',');
const shape = (bs) => bs.map((b) => `${b.type}|${b.text}|${fmt(b)}`);

describe('formatting: toggling (Ctrl+B / I / U, Ctrl+Shift+X, Ctrl+\\)', () => {
  it('each style toggles on, then off, independently of the others', () => {
    let m;
    for (const k of ['b', 'i', 'u', 's']) m = toggleStyle(m, k, 0, 5).marks;
    assert.deepEqual(activeStyles(m, 0, 5), { b: true, i: true, u: true, s: true });
    m = toggleStyle(m, 'i', 0, 5).marks;
    assert.deepEqual(activeStyles(m, 0, 5), { b: true, i: false, u: true, s: true });
  });
  it('a style is "active" only when it covers the whole selection', () => {
    const m = toggleStyle(undefined, 'b', 0, 3).marks;
    assert.equal(activeStyles(m, 0, 3).b, true);
    assert.equal(activeStyles(m, 0, 6).b, false);
    // …and toggling a partly-bold selection makes all of it bold first
    assert.deepEqual(toggleStyle(m, 'b', 0, 6).marks, { b: [[0, 6]] });
  });
  it('removing part of a run splits it', () => {
    assert.deepEqual(toggleStyle({ u: [[0, 10]] }, 'u', 3, 5).marks, { u: [[0, 3], [5, 10]] });
  });
  it('clear formatting removes every style from the selection only', () => {
    const m = { b: [[0, 10]], i: [[2, 4]], s: [[8, 12]] };
    assert.deepEqual(clearMarks(m, 1, 9), { b: [[0, 1], [9, 10]], s: [[9, 12]] });
    assert.equal(clearMarks({ u: [[0, 3]] }, 0, 3), undefined);
  });
  it('with no selection, a shortcut takes the word under the caret', () => {
    assert.deepEqual(wordAt('FLASHBACK - CROIX', 4), [0, 9]);
    assert.equal(wordAt('A  B', 2), null);
  });
});

describe('formatting: cursor-boundary isolation', () => {
  it('typing right after (or before) a styled word never extends the style', () => {
    assert.deepEqual(remapRanges('go NOW', 'go NOW!', [[3, 6]]), [[3, 6]]);
    assert.deepEqual(remapRanges('go NOW', 'go xNOW', [[3, 6]]), [[4, 7]]);
  });
  it('typing inside a styled word keeps it styled; deleting it drops the style', () => {
    assert.deepEqual(remapRanges('go NOW', 'go NOOW', [[3, 6]]), [[3, 7]]);
    assert.equal(remapRanges('go NOW', 'go ', [[3, 6]]), undefined);
  });
  it('the history normaliser moves every style with edits it was not told about', () => {
    const prev = [{ id: 'a', text: 'go NOW', marks: { b: [[3, 6]], i: [[0, 2]] } }];
    const next = [{ ...prev[0], text: 'let us go NOW' }];
    assert.deepEqual(reconcileMarks(prev, next)[0].marks, { b: [[10, 13]], i: [[7, 9]] });
    assert.equal(reconcileMarks(prev, prev), prev);
  });
  it('Backspace-merging two elements keeps both elements’ formatting', () => {
    const blocks = [
      { id: 'a', type: 'action', text: 'She sees ', marks: { i: [[4, 8]] } },
      { id: 'b', type: 'action', text: 'the KNIFE.', marks: { b: [[4, 9]], s: [[0, 3]] } },
    ];
    assert.equal(fmt(backspaceAt(blocks, 1, 0, 0).blocks[0]), 'b:KNIFE,i:sees,s:the');
  });
  it('older drafts’ `underline` field becomes marks.u', () => {
    assert.deepEqual(migrateBlock({ id: 'x', text: 'abc', underline: [[0, 1]] }), { id: 'x', text: 'abc', marks: { u: [[0, 1]] } });
  });
});

describe('formatting: markup in', () => {
  it('reads Markdown / Fountain emphasis', () => {
    assert.equal(fmt(parseInline('a **bold** b')), 'b:bold');
    assert.equal(fmt(parseInline('a *soft* b')), 'i:soft');
    assert.equal(fmt(parseInline('a _line_ b')), 'u:line');
    assert.equal(fmt(parseInline('a ~~gone~~ b')), 's:gone');
    assert.equal(fmt(parseInline('***both***')), 'b:both,i:both');
    assert.equal(fmt(parseInline('_**all three**_ and ~~*this*~~')), 'b:all three,i:this,u:all three,s:this');
  });
  it('reads HTML <b>/<strong>, <i>/<em>, <u>, <s>/<strike>/<del>', () => {
    const r = parseInline('<b>B</b> <strong>S</strong> <i>I</i> <em>E</em> <u>U</u> <s>X</s> <del>D</del>');
    assert.equal(r.text, 'B S I E U X D');
    assert.equal(fmt(r), 'b:B,b:S,i:I,i:E,u:U,s:X,s:D');
  });
  it('leaves lone or spaced symbols alone and honours \\ escapes', () => {
    assert.equal(parseInline('5 * 3 = 15').marks, undefined);
    assert.equal(parseInline('file\\_name \\*not\\*').text, 'file_name *not*');
  });
});

describe('formatting: markup out (Fountain)', () => {
  it('writes each style, nesting combinations, hugging words', () => {
    assert.equal(toFountainInline('a big dog', { b: [[2, 5]] }), 'a **big** dog');
    assert.equal(toFountainInline('a big dog', { i: [[1, 6]] }), 'a *big* dog');
    assert.equal(toFountainInline('no more', { s: [[0, 7]] }), '~~no more~~');
    assert.equal(toFountainInline('ab', { b: [[0, 2]], i: [[0, 1]] }), '***a*b**');
    assert.equal(toFountainInline('one\ntwo', { u: [[0, 7]] }), '_one_\n_two_');
    assert.equal(toFountainInline('x*y_z~', undefined), 'x\\*y\\_z\\~');
  });
  it('every combination of the four styles survives a write → read', () => {
    const word = 'WORD';
    for (let mask = 1; mask < 16; mask++) {
      const marks = {};
      ['b', 'i', 'u', 's'].forEach((k, n) => { if (mask & (1 << n)) marks[k] = [[4, 8]]; });
      const text = `say ${word} now`;
      const back = parseInline(toFountainInline(text, marks));
      assert.equal(back.text, text, `mask ${mask}`);
      assert.deepEqual(back.marks, marks, `mask ${mask}`);
    }
  });
  it('segments split runs where styles change', () => {
    assert.deepEqual(segments('abc', { b: [[0, 2]], i: [[1, 3]] }).map((s) => `${s.text}:${s.b ? 'b' : ''}${s.i ? 'i' : ''}`), ['a:b', 'b:bi', 'c:i']);
  });
});

const script = [
  { id: '1', type: 'scene', text: 'FLASHBACK - CROIX-DES-BOSSALES - NIGHT', marks: { u: [[0, 9]] } },
  { id: '2', type: 'action', text: 'The market is EMPTY. A dog_tag glints. 2*3 = 6.', marks: { b: [[14, 19]], i: [[23, 30]] } },
  { id: '3', type: 'character', text: 'MARIE' },
  { id: '4', type: 'parenthetical', text: '(whispering)', marks: { i: [[1, 11]] } },
  { id: '5', type: 'dialogue', text: 'We are NOT leaving. Not ever.', marks: { b: [[7, 10]], u: [[7, 10]], s: [[20, 29]] } },
  { id: '6', type: 'action', text: 'She ran. She ran FAST.', marks: { b: [[17, 21]], i: [[13, 21]], u: [[0, 7]], s: [[4, 7]] } },
];

describe('formatting: round trips', () => {
  it('Fountain **bold**, *italic*, _underline_, ~~strike~~ and combinations', () => {
    const out = toFountain({ meta: {}, blocks: script });
    assert.match(out, /^\._FLASHBACK_ - CROIX-DES-BOSSALES - NIGHT$/m);
    assert.match(out, /The market is \*\*EMPTY\*\*\. A \*dog\\_tag\* glints\. 2\\\*3 = 6\./);
    assert.match(out, /^\(\*whispering\*\)$/m);
    assert.match(out, /We are \*\*_NOT_\*\* leaving\. ~~Not ever\.~~/);
    assert.deepEqual(shape(parseFountain(out).blocks), shape(script));
  });
  it('Final Draft <Text Style="Bold+Italic+Underline+Strikeout">', () => {
    const xml = toFDX({ meta: {}, blocks: script });
    assert.match(xml, /<Text Style="Underline">FLASHBACK<\/Text>/);
    assert.match(xml, /<Text Style="Bold">EMPTY<\/Text>/);
    assert.match(xml, /<Text Style="Italic">dog_tag<\/Text>/);
    assert.match(xml, /<Text Style="Bold\+Underline">NOT<\/Text>/);
    assert.match(xml, /<Text Style="Strikeout">Not ever\.<\/Text>/);
    assert.match(xml, /<Text Style="Bold\+Italic">FAST<\/Text>/);
    assert.deepEqual(shape(parseFDX(xml).blocks), shape(script));
  });
  it('reads Final Draft styles in any order and case', () => {
    const xml = '<FinalDraft><Content><Paragraph Type="Action"><Text Style="strikeout+ITALIC">x</Text><Text>y</Text></Paragraph></Content></FinalDraft>';
    assert.equal(fmt(parseFDX(xml).blocks[0]), 'i:x,s:x');
  });
  it('plain-text import keeps Markdown and HTML formatting (and still classifies the lines)', () => {
    const r = parseTextScript([
      '<u>FLASHBACK</u> - CROIX-DES-BOSSALES - NIGHT',
      '',
      'The market is **EMPTY**. *Nobody* ~~stays~~.',
      '',
      '<b>MARIE</b>',
      'We are <i>not</i> <s>leaving</s>.',
    ].join('\n'));
    assert.deepEqual(shape(r.blocks), [
      'scene|FLASHBACK - CROIX-DES-BOSSALES - NIGHT|u:FLASHBACK',
      'action|The market is EMPTY. Nobody stays.|b:EMPTY,i:Nobody,s:stays',
      'character|MARIE|b:MARIE',
      'dialogue|We are not leaving.|i:not,s:leaving',
    ]);
  });
  it('an HTML tag spanning lines marks each line', () => {
    const r = parseTextScript('INT. A - DAY\n\n<i>She waits.\nAnd waits.</i>');
    assert.equal(fmt(r.blocks[1]), 'i:She waits.,i:And waits.'); // each line italic (the line break itself needs no style)
  });
});

describe('page numbers', () => {
  it('page 1 has none; pages 2+ read "2.", "3." …', () => {
    assert.deepEqual([0, 1, 2, 9].map(pageLabel), ['', '2.', '3.', '10.']);
  });
});

describe('title page emphasis', () => {
  it('Markdown in title page fields becomes styled runs in Final Draft', () => {
    const xml = toFDX({ meta: { title: 'The *Last* Ferry', author: 'Eric', credit: 'Written by', titleFont: 'courier-prime', titleBold: false }, blocks: [] });
    assert.match(xml, /<Text Font="Courier Prime" Size="\d+" Style="Underline">THE <\/Text>/);
    assert.match(xml, /<Text Font="Courier Prime" Size="\d+" Style="Underline\+Italic">LAST<\/Text>/);
  });
});
