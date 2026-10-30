import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FIND_SCOPES, MATCH_LIMIT, findMatches, hitsById, nearestMatch, replaceMatches,
} from '../src/lib/findReplace.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

const script = () => [
  B('s1', 'scene', 'EXT. FERRY - DAWN'),
  B('a1', 'action', 'The ferry idles. A ferryman waves at the Ferry.', { marks: { b: [[4, 9]] } }),
  B('c1', 'character', 'MARIE'),
  B('d1', 'dialogue', 'Is that the ferry?'),
  B('s2', 'scene', 'INT. FERRY - CABIN - NIGHT'),
  B('a2', 'action', 'Cats catch nothing.', { note: 'keep' }),
];

describe('Find', () => {
  it('finds every match in script order, ignoring case by default', () => {
    const m = findMatches(script(), 'ferry');
    assert.deepEqual(m.map((x) => `${x.id}:${x.start}`), ['s1:5', 'a1:4', 'a1:19', 'a1:41', 'd1:12', 's2:5']);
  });
  it('Match case, Whole word and the element filter narrow it', () => {
    assert.equal(findMatches(script(), 'ferry', { matchCase: true }).length, 3);
    assert.deepEqual(findMatches(script(), 'ferry', { wholeWord: true }).map((x) => x.start), [5, 4, 41, 12, 5], 'not inside "ferryman"');
    assert.deepEqual(findMatches(script(), 'ferry', { scope: 'scene' }).map((x) => x.id), ['s1', 's2']);
    assert.deepEqual(findMatches(script(), 'ferry', { scope: 'dialogue' }).map((x) => x.id), ['d1']);
    assert.deepEqual(findMatches(script(), 'cat', { wholeWord: true }), [], '"Cats" and "catch" are other words');
    assert.deepEqual(FIND_SCOPES.map((s) => s.id), ['all', 'scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition']);
  });
  it('treats the search as plain text, never a pattern', () => {
    const blocks = [B('a', 'action', 'Is it (really) $5.00? Yes [sic].')];
    assert.equal(findMatches(blocks, '(really)').length, 1);
    assert.equal(findMatches(blocks, '$5.00?').length, 1);
    assert.equal(findMatches(blocks, '[sic]').length, 1);
    assert.equal(findMatches(blocks, '.*').length, 0);
  });
  it('an empty search finds nothing; a huge one stops at the limit', () => {
    assert.deepEqual(findMatches(script(), ''), []);
    const big = [B('a', 'action', 'a'.repeat(MATCH_LIMIT + 50))];
    assert.equal(findMatches(big, 'a').length, MATCH_LIMIT);
  });
  it('starts from the cursor: the first match at or after it, wrapping to the top', () => {
    const blocks = script();
    const m = findMatches(blocks, 'ferry');
    assert.equal(nearestMatch(m, blocks, 'a1', 10), 2, 'after "The ferry", the next one in the same line');
    assert.equal(nearestMatch(m, blocks, 'c1', 0), 4, 'from the cue: the dialogue under it');
    assert.equal(nearestMatch(m, blocks, 'a2', 0), 0, 'past the last: back to the first');
    assert.equal(nearestMatch([], blocks, 'a1', 0), -1);
  });
  it('groups matches per element for the highlights, marking the current one', () => {
    const map = hitsById(findMatches(script(), 'ferry'), 2);
    assert.deepEqual(map.get('a1'), [[4, 9, false], [19, 24, true], [41, 46, false]]);
    assert.equal(map.has('c1'), false);
  });
});

describe('Replace', () => {
  it('replaces one match, leaving the rest and everything else about the element', () => {
    const blocks = script();
    const [, second] = findMatches(blocks, 'ferry');
    const { blocks: next, count } = replaceMatches(blocks, [second], 'boat');
    assert.equal(count, 1);
    assert.equal(next[1].text, 'The boat idles. A ferryman waves at the Ferry.');
    assert.equal(next[0], blocks[0], 'untouched elements are the same objects');
    assert.equal(next[1].id, 'a1');
  });
  it('Replace All changes every match in one new script, and formatting follows the text', () => {
    const blocks = script();
    const { blocks: next, count } = replaceMatches(blocks, findMatches(blocks, 'ferry', { wholeWord: true }), 'boat');
    assert.equal(count, 5);
    assert.equal(next[1].text, 'The boat idles. A ferryman waves at the boat.');
    assert.deepEqual(next[1].marks, { b: [[4, 8]] }, 'the bold word is still bold');
    assert.equal(next[5].note, 'keep');
    assert.equal(JSON.stringify(blocks), JSON.stringify(script()), 'the old script is not mutated');
  });
  it('a replacement can contain the search, and an empty one deletes', () => {
    const blocks = [B('a', 'action', 'go go')];
    assert.equal(replaceMatches(blocks, findMatches(blocks, 'go'), 'go go').blocks[0].text, 'go go go go');
    assert.equal(replaceMatches(blocks, findMatches(blocks, 'go '), '').blocks[0].text, 'go');
  });
  it('nothing to replace: the same array back', () => {
    const blocks = script();
    assert.equal(replaceMatches(blocks, [], 'x').blocks, blocks);
  });
});

describe('Find & Replace in the app', () => {
  const app = read('src/App.jsx');
  const bar = read('src/components/FindBar.jsx');
  const editor = read('src/components/Editor.jsx');
  it('Ctrl+F finds, Ctrl+H replaces — in Write; Esc closes the bar from anywhere', () => {
    assert.match(app, /mod && !e\.altKey && !e\.shiftKey && \(e\.code === 'KeyF' \|\| e\.code === 'KeyH'\) && findAllowedRef\.current\) \{\s*e\.preventDefault\(\);[^\n]*\n\s*openFindRef\.current\(e\.code === 'KeyH'\);/);
    assert.match(app, /findAllowedRef\.current = !inPlan;/);
    assert.match(app, /e\.key === 'Escape' && closeFindRef\.current && !e\.defaultPrevented/);
    const sc = read('src/lib/shortcuts.js');
    assert.match(sc, /\['Ctrl\+F', 'Find in the script/);
    assert.match(sc, /\['Ctrl\+H', 'Find & Replace'\]/);
  });
  it('a floating bar, not a dialog: nothing added to the toolbar or canvas until it opens', () => {
    assert.match(app, /\{find\.open && showEditor && \(\s*<div className="find-dock">\s*<FindBar/);
    assert.doesNotMatch(bar, /<dialog|showModal/);
    assert.match(read('src/components/FindBar.css'), /\.find-dock \{\s*position: sticky;\s*top: 0;\s*height: 0;/);
    assert.match(bar, /Enter[\s\S]*onStep\(e\.shiftKey \? -1 : 1\)/);
    assert.match(bar, /if \(e\.ctrlKey \|\| e\.metaKey\) onReplaceAll\(\);\s*else onReplace\(\);/);
  });
  it('Replace All is one undo step, with a snapshot first; Viewing blocks replacing', () => {
    const all = app.slice(app.indexOf('const replaceAll = () => {'), app.indexOf('const blocksById = '));
    assert.match(all, /if \(isLocked\) \{ notifyLocked\(\); return; \}/);
    assert.ok(all.indexOf("autoSnapshotRef.current('Replace All', { force: true })") < all.indexOf('set(next)'));
    assert.match(all, /notify\(`Replaced \$\{count\}/);
    assert.match(bar, /disabled=\{locked \|\| !total\} onClick=\{onReplaceAll\}/);
  });
  it('matches are highlighted in the text, on every page piece, never printed', () => {
    assert.match(editor, /\{hits && <FindMarks text=\{block\.text\} hits=\{hits\} \/>\}/);
    assert.match(editor, /hits=\{findHits\?\.get\(b\.id\) \|\| null\}/);
    assert.match(read('src/components/Editor.css'), /@media print \{ \.el-find \{ display: none; \} \}/);
    assert.match(app, /findHits=\{findHits\}/);
  });
  it('closing with a search on leaves a Find stepper in the status bar; ✕ ends the search', () => {
    assert.match(app, /\{findOn && !find\.open && \(\s*<FindStepper/);
    assert.match(app, /onDismiss=\{endFind\}/);
    assert.match(app, /const endFind = \(\) => setFind\(\(f\) => \(\{ \.\.\.f, open: false, query: '' \}\)\);/);
  });
});
