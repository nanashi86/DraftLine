import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENTER_NEXT, TAB_NEXT, enterFlow, enterNextType,
} from '../src/lib/screenplay.js';
import { EXTENSION_CYCLE, acceptAdvances, cycleExtension, getSuggestions, sceneTab } from '../src/lib/autocomplete.js';
import { backspaceAt, backspaceStepBack } from '../src/lib/editing.js';

// "Hands never leave the keyboard": every element-to-element move is a Tab, Enter or Backspace.

const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });
const editor = readFileSync(new URL('../src/components/Editor.jsx', import.meta.url), 'utf8');

describe('Enter', () => {
  it('Scene Heading → Action · Action → Action · Character → Dialogue · Parenthetical → Dialogue', () => {
    assert.deepEqual(enterFlow(B('s', 'scene', 'INT. FERRY - NIGHT')), { next: 'action' });
    assert.deepEqual(enterFlow(B('a', 'action', 'Rain.')), { next: 'action' });
    assert.deepEqual(enterFlow(B('c', 'character', 'MARIE')), { next: 'dialogue' });
    assert.deepEqual(enterFlow(B('p', 'parenthetical', '(low)')), { next: 'dialogue' });
  });
  it('Dialogue → Action in one press; splitting a speech mid-line keeps both halves Dialogue', () => {
    assert.equal(ENTER_NEXT.dialogue, 'action');
    assert.equal(enterNextType(B('d', 'dialogue', 'We go now.')), 'action');
    assert.equal(enterNextType(B('d', 'dialogue', 'We go'), ' now.'), 'dialogue');
    assert.match(editor, /const nb = tailBlock\(enterNextType\(b, after\), b, after\);/);
  });
});

describe('Tab', () => {
  it('empty Action → Character cue; Dialogue → Parenthetical', () => {
    assert.equal(TAB_NEXT.action, 'character');
    assert.equal(TAB_NEXT.dialogue, 'parenthetical');
  });

  it('Scene Heading: on to the time of day, then down to Action', () => {
    assert.deepEqual(sceneTab('INT. FERRY'), { text: 'INT. FERRY - ' });
    assert.deepEqual(sceneTab('ext. pier  '), { text: 'ext. pier - ' }, 'trailing spaces tidied, case kept');
    assert.deepEqual(sceneTab('INT. FERRY -'), { text: 'INT. FERRY - ' }, 'a dangling dash is finished, not doubled');
    assert.deepEqual(sceneTab('INT. FERRY - NIGHT'), { advance: true });
    assert.deepEqual(sceneTab('BACK TO THE PIER'), { advance: true }, 'secondary headings are complete as typed');
    assert.deepEqual(sceneTab('INT. '), { stay: true });
    assert.deepEqual(sceneTab(''), { convert: 'action' });
    // and the time-of-day list opens on the new " - "
    const b = B('n', 'scene', 'INT. FERRY - ');
    assert.ok(getSuggestions(b, [b]).some((s) => s.kind === 'Time' && s.value === 'INT. FERRY - NIGHT'));
  });

  it('Character cue: (O.S.) → (V.O.) → (CONT\'D) → none, and round again', () => {
    assert.deepEqual(EXTENSION_CYCLE, ['O.S.', 'V.O.', "CONT'D"]);
    const seen = [];
    let t = 'MARIE';
    for (let i = 0; i < 5; i++) { t = cycleExtension(t); seen.push(t); }
    assert.deepEqual(seen, ['MARIE (O.S.)', 'MARIE (V.O.)', "MARIE (CONT'D)", 'MARIE', 'MARIE (O.S.)']);
  });

  it('extensions keep the dual-dialogue caret and other notes', () => {
    assert.equal(cycleExtension('THEO ^'), 'THEO (O.S.) ^');
    assert.equal(cycleExtension("THEO (CONT'D) ^"), 'THEO ^');
    assert.equal(cycleExtension('THEO (CONT’D)'), 'THEO', 'curly apostrophe counts');
    assert.equal(cycleExtension('THEO (ON PHONE)'), 'THEO (ON PHONE) (O.S.)');
    assert.equal(cycleExtension('marie (v.o.)'), "marie (CONT'D)");
  });

  it('the editor routes Tab: suggestions first, then heading / cue rules, then the type change', () => {
    const tab = editor.slice(editor.indexOf("case 'Tab': {"), editor.indexOf("case 'Backspace': {"));
    assert.ok(editor.indexOf("(e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey") < editor.indexOf("case 'Tab': {"), 'an open list claims Tab first');
    assert.match(tab, /if \(!blank && b\.type === 'scene'\) \{\s*const st = sceneTab\(text\);/);
    assert.match(tab, /setTypedIn\(b\.id\);/, 'so the time-of-day list opens');
    assert.match(tab, /if \(!blank && b\.type === 'character'\) \{\s*const next = cycleExtension\(text\);/);
    assert.match(tab, /setTypeAt\(idx, TAB_NEXT\[b\.type\], start\);/, 'empty lines still change type');
  });
});

describe('Backspace on an empty line', () => {
  it('steps back to Action first; only an empty Action line is deleted', () => {
    for (const type of ['character', 'dialogue', 'transition', 'scene', 'format_cue', 'centered']) {
      assert.equal(backspaceStepBack(B('x', type, ''), 0, 0), 'action', type);
      assert.equal(backspaceStepBack(B('x', type, '  '), 0, 0), 'action', `${type}, spaces only`);
    }
    assert.equal(backspaceStepBack(B('x', 'action', ''), 0, 0), null);
    assert.equal(backspaceStepBack(B('x', 'character', 'MARIE'), 0, 0), null, 'not on a line with text');
    const script = [B('a', 'action', 'Rain.'), B('c', 'character', '')];
    assert.equal(backspaceStepBack(script[1], 0, 0), 'action');
    const r = backspaceAt([script[0], { ...script[1], type: 'action' }], 1, 0, 0);
    assert.deepEqual(r.blocks.map((b) => b.id), ['a'], 'then the next Backspace removes it');
  });
  it('the editor checks the step-back before deleting (after the empty-parenthetical rule)', () => {
    const bs = editor.slice(editor.indexOf("case 'Backspace': {"), editor.indexOf("case 'Delete': {"));
    assert.ok(bs.indexOf("text === '()'") < bs.indexOf('backspaceStepBack(b, start, end)'));
    assert.ok(bs.indexOf('backspaceStepBack(b, start, end)') < bs.indexOf('backspaceAt(cur, idx, start, end)'));
  });
});

describe('Predictive autocomplete', () => {
  const script = [
    B('s1', 'scene', 'EXT. HARBOR - DAWN'),
    B('c1', 'character', 'AUGUSTIN'), B('d1', 'dialogue', 'Last crossing.'),
    B('c1b', 'character', 'AUGUSTIN'), B('d1b', 'dialogue', 'Go.'),
    B('s2', 'scene', 'INT. FERRY - DAY'),
    B('c2', 'character', 'MARIE'), B('d2', 'dialogue', 'Theo?'),
    B('s3', 'scene', 'EXT. HARBOR - DAY'),
    B('s4', 'scene', 'INT. WHEELHOUSE - NIGHT'),
    B('c4', 'character', 'MAX (V.O.)'), B('d4', 'dialogue', 'Steady.'),
  ];
  const at = (afterId, b) => {
    const i = script.findIndex((x) => x.id === afterId);
    return [...script.slice(0, i + 1), b, ...script.slice(i + 1)];
  };

  it('I / E offer INT. / EXT. straight away', () => {
    const b = B('n', 'scene', 'E');
    assert.deepEqual(getSuggestions(b, [b]).map((s) => s.label), ['EXT.']);
    const i = B('n', 'scene', 'i');
    assert.deepEqual(getSuggestions(i, [i]).map((s) => s.label), ['INT.', 'INT./EXT.']);
  });

  it('locations: most used first, then the most recent above the line you are on', () => {
    const b = B('n', 'scene', 'INT. ');
    const blocks = at('d4', b);
    // HARBOR ×2 leads; FERRY and WHEELHOUSE once each, WHEELHOUSE used more recently.
    assert.deepEqual(getSuggestions(b, blocks).filter((s) => s.kind === 'Location').map((s) => s.label), ['HARBOR', 'WHEELHOUSE', 'FERRY']);
    const w = B('n', 'scene', 'INT. W');
    assert.deepEqual(getSuggestions(w, at('d4', w)).map((s) => s.value), ['INT. WHEELHOUSE - ']);
  });

  it('characters: whoever speaks in this scene comes first, then the script by lines and recency', () => {
    const cue = B('n', 'character', 'M');
    // In the wheelhouse scene MAX has spoken; MARIE has more lines overall but not here.
    assert.deepEqual(getSuggestions(cue, at('d4', cue)).map((s) => s.label), ['MAX', 'MARIE']);
    const early = B('n', 'character', 'M');
    // In the ferry scene MARIE speaks.
    assert.deepEqual(getSuggestions(early, at('d2', early)).map((s) => s.label), ['MARIE', 'MAX']);
  });

  it('Story Bible characters who have not spoken yet are offered after the script’s', () => {
    const cue = B('n', 'character', 'MA');
    const s = getSuggestions(cue, at('d4', cue), { cast: ['Manman', 'Marie', ''] });
    assert.deepEqual(s.map((x) => [x.label, x.kind]), [['MAX', 'Character'], ['MARIE', 'Character'], ['MANMAN', 'Story Bible']]);
  });

  it('Enter or Tab accepts: a cue moves into its Dialogue line, a heading stays put — no stray lines', () => {
    assert.equal(acceptAdvances(B('c', 'character', 'MA'), 'Enter'), true);
    assert.equal(acceptAdvances(B('c', 'character', 'MA'), 'Tab'), true);
    assert.equal(acceptAdvances(B('s', 'scene', 'INT. F'), 'Tab'), false);
    const accept = editor.slice(editor.indexOf('const acceptSuggestion = useCallback('), editor.indexOf('useImperativeHandle('));
    assert.match(accept, /if \(next && \(next\.type === 'dialogue' \|\| next\.type === 'parenthetical'\)\) \{\s*commit\(splice\(cur, idx, 1, updated\), \{ id: next\.id/, 'an existing Dialogue line is reused, not doubled');
  });

  it('↑ / ↓ move through the list, wrapping around', () => {
    assert.match(editor, /if \(e\.key === 'ArrowDown' \|\| e\.key === 'ArrowUp'\) \{\s*e\.preventDefault\(\);\s*const n = ac\.list\.length;\s*const i = \(ac\.index \+ \(e\.key === 'ArrowDown' \? 1 : n - 1\)\) % n;/);
    assert.match(editor, /return getSuggestions\(activeBlock, blocks, \{ cast \}\);/);
  });
});
