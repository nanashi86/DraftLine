import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENTER_NEXT, SHIFT_TAB_NEXT, TAB_NEXT, enterFlow, flowHints, opensParenthetical,
} from '../src/lib/screenplay.js';
import { acceptAdvances, getSuggestions } from '../src/lib/autocomplete.js';
import { PACING_TOLERANCE, actPacing, formatPacingPages } from '../src/lib/beats.js';
import {
  CANVAS_THEME_KEY, DEFAULT_CANVAS_THEME, nextCanvasTheme, readCanvasTheme, writeCanvasTheme,
} from '../src/lib/canvasTheme.js';
import { createFakeStorage } from './helpers/fakeIndexedDB.js';

const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Tab & Enter flow', () => {
  it('empty Action + Tab → Character', () => {
    assert.equal(TAB_NEXT.action, 'character');
  });
  it('Character + Enter → a Dialogue line below', () => {
    assert.deepEqual(enterFlow(B('c', 'character', 'MARIE')), { next: 'dialogue' });
  });
  it('Dialogue with text + Enter → another Dialogue line; Enter again on that empty line → Action', () => {
    assert.deepEqual(enterFlow(B('d', 'dialogue', 'We go now.')), { next: 'dialogue' });
    assert.deepEqual(enterFlow(B('d2', 'dialogue', '')), { convertTo: 'action' });
    assert.deepEqual(enterFlow(B('d3', 'dialogue', '   ')), { convertTo: 'action' });
  });
  it('Dialogue + Tab → Parenthetical; "(" at the start of an empty Dialogue line → Parenthetical', () => {
    assert.equal(TAB_NEXT.dialogue, 'parenthetical');
    assert.equal(opensParenthetical(B('d', 'dialogue', ''), '('), true);
    assert.equal(opensParenthetical(B('d', 'dialogue', 'Hey'), '('), false, 'only on an empty line');
    assert.equal(opensParenthetical(B('a', 'action', ''), '('), false, 'only in Dialogue');
    assert.equal(opensParenthetical(B('d', 'dialogue', ''), 'x'), false);
  });
  it('Parenthetical + Enter → Dialogue; Transition + Enter → Action', () => {
    assert.deepEqual(enterFlow(B('p', 'parenthetical', '(quietly)')), { next: 'dialogue' });
    assert.deepEqual(enterFlow(B('t', 'transition', 'CUT TO:')), { next: 'action' });
    assert.equal(ENTER_NEXT.transition, 'action');
  });
  it('every other Enter / Tab rule is unchanged', () => {
    assert.equal(ENTER_NEXT.scene, 'action');
    assert.equal(ENTER_NEXT.action, 'action');
    assert.equal(TAB_NEXT.parenthetical, 'dialogue');
    assert.equal(SHIFT_TAB_NEXT.action, 'scene');
    assert.deepEqual(enterFlow(B('a', 'action', '')), { next: 'action' }, 'an empty Action line just adds another');
  });
  it('the status bar hints follow the rules', () => {
    assert.equal(flowHints('dialogue').enter, 'Dialogue');
    assert.equal(flowHints('transition').enter, 'Action');
    assert.equal(flowHints('character').enter, 'Dialogue');
  });
  it('the editor wires "(" , Enter and accepted suggestions to these rules', () => {
    const editor = src('components/Editor.jsx');
    assert.match(editor, /opensParenthetical\(b, e\.key\) && start === end/);
    assert.match(editor, /type: 'parenthetical', text: '\(\)' \}\), \{ id: b\.id, caret: 1 \}/);
    assert.match(editor, /enterFlow\(b\)\.convertTo/);
    assert.match(editor, /acceptSuggestion\(ac\.list\[ac\.index\], acceptAdvances\(b, e\.key\)\)/);
  });
});

describe('autocomplete', () => {
  const script = [
    B('s1', 'scene', 'INT. NATIONAL PALACE - NIGHT'),
    B('c1', 'character', 'PRESIDENT MOÏSE'),
    B('d1', 'dialogue', 'Sit.'),
    B('s2', 'scene', 'EXT. PALACE GATES - DAY'),
    B('c2', 'character', 'PATRICK (O.S.)'),
    B('d2', 'dialogue', 'Sir?'),
    B('s3', 'scene', 'INT. NATIONAL PALACE - DAY'),
    B('c3', 'character', 'PATRICK'),
    B('d3', 'dialogue', 'Now.'),
  ];
  const typing = (type, text) => {
    const b = B('new', type, text);
    return getSuggestions(b, [...script, b]);
  };
  it('a scene heading starting "I" or "E" offers INT. / EXT.', () => {
    assert.deepEqual(typing('scene', 'I').map((s) => s.value), ['INT. ', 'INT./EXT. ']);
    assert.deepEqual(typing('scene', 'e').map((s) => s.value), ['EXT. ']);
  });
  it('after INT. / EXT. it offers the project’s locations, most used first', () => {
    const loc = typing('scene', 'INT. ').filter((s) => s.kind === 'Location').map((s) => s.label);
    assert.deepEqual(loc, ['NATIONAL PALACE', 'PALACE GATES']);
    assert.deepEqual(typing('scene', 'EXT. PAL').map((s) => s.value), ['EXT. PALACE GATES - ']);
  });
  it('a character cue offers existing names matching the prefix, most lines first', () => {
    assert.deepEqual(typing('character', 'P').map((s) => s.label), ['PATRICK', 'PRESIDENT MOÏSE']);
    assert.deepEqual(typing('character', 'pr').map((s) => s.label), ['PRESIDENT MOÏSE']);
    assert.deepEqual(typing('character', 'PATRICK'), [], 'nothing once the name is complete');
  });
  it('accepting a name with Enter or Tab moves on to its Dialogue line; a heading stays put on Tab', () => {
    assert.equal(acceptAdvances(B('c', 'character', 'P'), 'Enter'), true);
    assert.equal(acceptAdvances(B('c', 'character', 'P'), 'Tab'), true);
    assert.equal(acceptAdvances(B('s', 'scene', 'INT. '), 'Tab'), false);
  });
  it('is fast: 2,000 scenes and 2,000 speeches answer in well under a frame', () => {
    const big = [];
    for (let i = 0; i < 2000; i++) {
      big.push(B(`s${i}`, 'scene', `INT. ROOM ${i % 300} - NIGHT`), B(`c${i}`, 'character', `CHAR${i % 150}`), B(`d${i}`, 'dialogue', 'Hi.'));
    }
    const b = B('x', 'character', 'CHAR1');
    const t = performance.now();
    for (let k = 0; k < 10; k++) getSuggestions(b, big);
    assert.ok((performance.now() - t) / 10 < 16, 'under 16 ms per keystroke');
  });
});

describe('Beat Board act pacing', () => {
  // Five scenes: lengths in eighths of a page (8 = one page). 96 pages in all.
  const scenes = [
    { id: 's1', eighths: 8 * 30 }, { id: 's2', eighths: 8 * 20 }, { id: 's3', eighths: 8 * 20 },
    { id: 's4', eighths: 8 * 20 }, { id: 's5', eighths: 8 * 6 },
  ];
  const card = (id, act, sceneId) => ({ id, act, title: '', synopsis: '', tag: 'plot', ...(sceneId ? { sceneId } : {}) });

  it('4 acts: pages and share per column, from the scene cards in it', () => {
    const beats = [card('a', 0, 's1'), card('b', 1, 's2'), card('c', 2, 's3'), card('d', 3, 's4'), card('e', 3, 's5'), card('own', 0)];
    const p = actPacing(beats, scenes, 4);
    assert.deepEqual(p.map((c) => c.label), ['30 pgs · 31%', '20 pgs · 21%', '20 pgs · 21%', '26 pgs · 27%']);
    assert.deepEqual(p.map((c) => c.status), ['ok', 'ok', 'ok', 'ok']);
  });
  it('3 acts: Act 2 adds up 2A and 2B; Act 1 above 32% gets a dot', () => {
    const beats = [card('a', 0, 's1'), card('x', 0, 's5'), card('b', 1, 's2'), card('c', 2, 's3'), card('d', 3, 's4')];
    const p = actPacing(beats, scenes, 3);
    assert.deepEqual(p.map((c) => c.pct), [38, 42, 21]);
    assert.equal(p[0].status, 'long');
    assert.match(p[0].note, /Act 1 runs 38% of the script — the usual share is about 25%/);
    assert.equal(p[1].label, '40 pgs · 42%');
    assert.equal(p[1].status, 'short', '42% is more than 7 points under 50%');
    assert.equal(p[2].status, 'ok');
    assert.equal(PACING_TOLERANCE, 7);
  });
  it('the share is of the whole script — scenes without cards still count toward the total', () => {
    const p = actPacing([card('a', 0, 's5')], scenes, 4);
    assert.equal(p[0].label, '6 pgs · 6%');
    assert.deepEqual(p.slice(1).map((c) => c.status), ['none', 'none', 'none']);
  });
  it('nothing to show until the board has scene cards', () => {
    assert.deepEqual(actPacing([card('own', 0)], scenes, 4), []);
    assert.deepEqual(actPacing([], [], 3), []);
  });
  it('page labels', () => {
    assert.equal(formatPacingPages(8), '1 pg');
    assert.equal(formatPacingPages(12), '1.5 pgs');
    assert.equal(formatPacingPages(6), '6/8 pg');
    assert.equal(formatPacingPages(8 * 24), '24 pgs');
  });
});

describe('canvas theme', () => {
  it('defaults to Paper and persists Midnight under draftline_canvas_theme', () => {
    const storage = createFakeStorage();
    assert.equal(CANVAS_THEME_KEY, 'draftline_canvas_theme');
    assert.equal(readCanvasTheme(storage), 'paper');
    assert.equal(DEFAULT_CANVAS_THEME, 'paper');
    assert.equal(writeCanvasTheme('midnight', storage), true);
    assert.equal(storage.getItem('draftline_canvas_theme'), 'midnight');
    assert.equal(readCanvasTheme(storage), 'midnight');
    assert.equal(nextCanvasTheme('midnight'), 'paper');
    assert.equal(nextCanvasTheme('paper'), 'midnight');
  });
  it('ignores junk and survives blocked storage', () => {
    const storage = createFakeStorage({ draftline_canvas_theme: 'neon' });
    assert.equal(readCanvasTheme(storage), 'paper');
    assert.equal(writeCanvasTheme('neon', storage), false);
    const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    assert.equal(readCanvasTheme(blocked), 'paper');
    assert.equal(writeCanvasTheme('midnight', blocked), false);
    assert.equal(readCanvasTheme(null), 'paper');
  });
  it('Midnight colours the page on screen only; print is always black on white', () => {
    const css = src('index.css');
    const block = css.slice(css.indexOf(".app[data-canvas='midnight']"));
    assert.match(block, /--paper: #1f1f22/);
    assert.match(block, /--ink: #e4e4e7/);
    const print = src('components/PrintView.css');
    assert.match(print, /\.print-root \{[^}]*--ink: #000;[^}]*--paper: #fff;[^}]*color: #000;[^}]*background: #fff;/s);
    const app = src('App.jsx');
    assert.match(app, /data-canvas=\{canvasTheme\}/);
    // The print view is rendered outside .app, so it can't inherit the Midnight variables.
    assert.ok(app.lastIndexOf('<PrintView') > app.lastIndexOf('data-canvas='));
    assert.ok(app.indexOf('</div>\n\n      {printing && (') > 0);
  });
});
