import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardTitleParts, joinCardTitle, sceneCardTitle } from '../src/lib/beats.js';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the first rule whose selector is exactly `sel`. */
const rule = (css, sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = code(css).match(new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `no rule for ${sel}`);
  return m[1];
};

describe('Scene Board in Split: card headline number', () => {
  it('hides a leading "N." that matches the card number', () => {
    assert.deepEqual(cardTitleParts('1. INT. STATION SIX - NIGHT', 1), { lead: '1. ', text: 'INT. STATION SIX - NIGHT' });
    assert.deepEqual(cardTitleParts('12A. EXT. ROOF - DAY', '12A'), { lead: '12A. ', text: 'EXT. ROOF - DAY' });
  });
  it('keeps the number when it differs from the card number, or there is none', () => {
    assert.deepEqual(cardTitleParts('3. INT. STATION SIX - NIGHT', 1), { lead: '', text: '3. INT. STATION SIX - NIGHT' });
    assert.deepEqual(cardTitleParts('The heist goes wrong', 1), { lead: '', text: 'The heist goes wrong' });
    assert.deepEqual(cardTitleParts('1.5 million reasons', 1), { lead: '', text: '1.5 million reasons' });
    assert.deepEqual(cardTitleParts('', 1), { lead: '', text: '' });
    assert.deepEqual(cardTitleParts(undefined, 1), { lead: '', text: '' });
    assert.deepEqual(cardTitleParts('1. INT. HALL - DAY', null), { lead: '', text: '1. INT. HALL - DAY' });
  });
  it('a scene card built from scene 1 reads without the duplicate on card 1', () => {
    const t = sceneCardTitle({ number: 1, heading: 'int. station six - night' });
    assert.equal(cardTitleParts(t, 1).text, 'INT. STATION SIX - NIGHT');
  });
  it('display only: editing puts the hidden prefix back, so the saved title is unchanged', () => {
    const saved = '1. INT. STATION SIX - NIGHT';
    const { lead, text } = cardTitleParts(saved, 1);
    assert.equal(joinCardTitle(lead, text), saved);
    assert.equal(joinCardTitle(lead, 'INT. STATION SEVEN - NIGHT'), '1. INT. STATION SEVEN - NIGHT');
    assert.equal(joinCardTitle('', 'Free text'), 'Free text');
  });
  it('clearing the headline clears it (no orphan "1. ")', () => {
    assert.equal(joinCardTitle('1. ', ''), '');
    assert.equal(joinCardTitle('1. ', '   '), '   ');
  });
  it('the card textarea shows the stripped text and saves through joinCardTitle', () => {
    const board = read('components/BeatBoard.jsx');
    assert.match(board, /const title = cardTitleParts\(beat\.title, number\);/);
    assert.match(board, /className="card-title"\s+value=\{title\.text\}/);
    assert.match(board, /onField\(beat\.id, 'title', joinCardTitle\(title\.lead, /);
    assert.match(board, /<span className="card-num">\{number\}<\/span>/);
  });
});

describe('Scene Board in Split: layout', () => {
  const css = read('components/BeatBoard.css');
  it('act columns keep a 220px minimum in Split (compact)', () => {
    const r = rule(css, '.board.is-compact .board-cols');
    assert.match(r, /grid-template-columns:\s*repeat\(var\(--cols, 4\), minmax\(220px, 1fr\)\)/);
    assert.doesNotMatch(css, /minmax\(176px/);
  });
  it('the full board keeps its wider minimum', () => {
    assert.match(rule(css, '.board-cols'), /minmax\(230px, 1fr\)/);
  });
  it('the columns scroll sideways when they run out of room', () => {
    assert.match(rule(css, '.board-cols'), /overflow-x:\s*auto/);
    assert.match(rule(css, '.board'), /min-width:\s*0/);
  });
  it('the board is compact in Split view', () => {
    assert.match(read('App.jsx'), /compact=\{view === 'split'\}/);
  });
  it('headlines break between words, not mid-word, and are never hyphenated', () => {
    const r = rule(css, '.card-title');
    assert.match(r, /word-break:\s*normal/);
    assert.match(r, /overflow-wrap:\s*break-word/);
    assert.match(r, /hyphens:\s*manual/);
    assert.doesNotMatch(r, /break-all|anywhere/);
  });
});
