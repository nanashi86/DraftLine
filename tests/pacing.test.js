import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTION_LINE_LIMIT, SEGMENT_CHAR_LIMIT, SEGMENT_WORD_LIMIT, actionDensity, actionLines, densityLabel, densityReason, densityTitle,
  isDenseAction,
} from '../src/lib/pacing.js';
import { toFountain } from '../src/lib/fountain.js';
import { toFDX } from '../src/lib/fdx.js';

const act = (id, text) => ({ id, type: 'action', text });
const words = (n, w = 'word') => Array.from({ length: n }, () => w).join(' '); // "word word …": 5 chars a word
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Action line counting', () => {
  it('wraps at 60 characters a line on word boundaries, like the paginator', () => {
    assert.equal(actionLines(act('a', 'Rain.')), 1);
    assert.equal(actionLines(act('a', words(12))), 1); // 59 chars
    assert.equal(actionLines(act('a', words(13))), 2); // 64 chars
    assert.equal(actionLines(act('a', words(48))), 4); // 4 × 12 words
    assert.equal(actionLines(act('a', words(49))), 5);
  });
  it('counts hard line breaks as lines', () => {
    assert.equal(actionLines(act('a', 'One.\nTwo.\nThree.\nFour.\nFive.')), 5);
    assert.equal(actionLines(act('a', 'One.\n\nTwo.')), 3);
  });
  it('uses the editor’s measured lines when it has them; empty blocks count as 0', () => {
    assert.equal(actionLines(act('a', 'Short.'), 6), 6);
    assert.equal(actionLines(act('a', words(49)), 0), 5, 'no measurement → estimate');
    assert.equal(actionLines(act('a', '   ')), 0);
  });
});

describe('Dense (skim-risk) action', () => {
  it(`more than ${ACTION_LINE_LIMIT} rendered lines is dense; ${ACTION_LINE_LIMIT} is fine`, () => {
    assert.equal(actionLines(act('a', words(44))), 4);
    assert.equal(densityReason(act('a', words(44))), null);
    assert.equal(densityReason(act('a', words(49))), 'lines');
    assert.equal(densityReason(act('a', 'a\nb\nc\nd')), null);
    assert.equal(densityReason(act('a', 'a\nb\nc\nd\ne')), 'lines');
    assert.equal(densityReason(act('a', 'Short.'), 5), 'lines', 'measured lines win');
  });
  it(`one unbroken stretch over ${SEGMENT_CHAR_LIMIT} characters or ${SEGMENT_WORD_LIMIT} words is dense even if it measures shorter`, () => {
    assert.equal(densityReason(act('a', words(46, 'a')), 3), 'run-on'); // 46 words, 91 chars
    assert.equal(densityReason(act('a', 'x'.repeat(SEGMENT_CHAR_LIMIT + 1)), 3), 'run-on');
    assert.equal(densityReason(act('a', `${words(30)}\n${words(30)}`), 4), null, 'broken into short stretches');
  });
  it('only action counts — dialogue, headings and other elements are never flagged', () => {
    for (const type of ['dialogue', 'scene', 'character', 'parenthetical', 'transition', 'centered', 'format_cue']) {
      assert.equal(isDenseAction({ id: 'x', type, text: words(80) }), false, type);
    }
  });
});

describe('Density across the script', () => {
  const blocks = [
    { id: 's', type: 'scene', text: 'INT. FERRY - NIGHT' },
    act('a1', 'Rain.'),
    act('a2', words(60)),
    { id: 'd', type: 'dialogue', text: words(80) },
    act('a3', words(20)),
    act('a4', 'One.\nTwo.\nThree.\nFour.\nFive.'),
    act('empty', '  '),
  ];
  it('counts dense blocks and the skim-risk share of action blocks (empty ones excluded)', () => {
    const d = actionDensity(blocks);
    assert.equal(d.total, 4);
    assert.equal(d.dense, 2);
    assert.equal(d.percent, 50);
    assert.deepEqual([...d.ids], ['a2', 'a4']);
    assert.deepEqual(d.list.map((x) => [x.id, x.lines, x.reason]), [['a2', 5, 'lines'], ['a4', 5, 'lines']]);
  });
  it('measured lines from the editor are used', () => {
    assert.equal(actionDensity(blocks, { a1: 5 }).dense, 3);
  });
  it('no action at all: 0 of 0, 0 %', () => {
    assert.deepEqual({ ...actionDensity([]), ids: [] }, { total: 0, dense: 0, percent: 0, ids: [], list: [] });
  });
  it('status text: Optimal, or N Skim Risk(s)', () => {
    assert.equal(densityLabel(actionDensity([act('a', 'Rain.')])), 'Density: Optimal');
    assert.equal(densityLabel(actionDensity([act('a', words(60))])), 'Density: 1 Skim Risk');
    assert.equal(densityLabel(actionDensity(blocks)), 'Density: 2 Skim Risks');
    assert.match(densityTitle(actionDensity(blocks)), /^2 of 4 action paragraphs \(50%\) run past 4 lines/);
  });
});

describe('Density Mode is editor-only', () => {
  it('a clickable amber pill toggles it; Optimal is plain muted text', () => {
    const app = read('App.jsx');
    assert.match(app, /className=\{`status-density is-risk\$\{densityMode \? ' is-on' : ''\}`\}\s*onClick=\{\(\) => setDensityMode\(\(on\) => !on\)\}/);
    assert.match(app, /<span className="status-density" title=\{densityTitle\(density\)\}>\{densityLabel\(density\)\}<\/span>/);
    assert.match(app, /dense=\{densityMode && density\.dense \? density\.ids : null\}/);
  });
  it('the mark is a faint 2px left border drawn outside the text column', () => {
    assert.match(read('components/Editor.css'), /\.sheet \.el\.is-dense::after \{[^}]*position: absolute;[^}]*border-left: 2px solid rgba\(217, 83, 47, 0\.4\);[^}]*pointer-events: none;/);
  });
  it('exports and print never see it', () => {
    const blocks = [act('a', words(60))];
    assert.ok(!/dense|is-dense/.test(toFountain({ meta: {}, blocks })));
    assert.ok(!/dense|is-dense/.test(toFDX({ meta: {}, blocks })));
    assert.ok(!/dense|density/i.test(read('components/PrintView.jsx')));
  });
});
