import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENT_META, ELEMENT_TYPES } from '../src/lib/screenplay.js';
import { ELEMENT_SHORTCUTS, SHORTCUT_SECTIONS, SHORTCUTS, elementCombo, elementForCode } from '../src/lib/shortcuts.js';

const ORDER = [
  ['Alt+1', 'scene', 'Scene Heading'],
  ['Alt+2', 'format_cue', 'Format Cue'],
  ['Alt+3', 'action', 'Action'],
  ['Alt+4', 'character', 'Character'],
  ['Alt+5', 'parenthetical', 'Parenthetical'],
  ['Alt+6', 'dialogue', 'Dialogue'],
  ['Alt+7', 'transition', 'Transition'],
  ['Alt+8', 'centered', 'Centered'],
];

describe('element shortcuts', () => {
  it('follow the registry order: Scene Heading, Format Cue, Action … Centered', () => {
    assert.deepEqual(ELEMENT_TYPES, ORDER.map(([, t]) => t));
    assert.deepEqual(ELEMENT_SHORTCUTS.map((s) => [s.combo, s.type, s.label]), ORDER);
  });
  it('map each Alt+digit key to its element (what the editor uses)', () => {
    for (const [combo, type] of ORDER) {
      assert.equal(elementForCode(`Digit${combo.slice(4)}`), type, combo);
      assert.equal(elementCombo(type), combo);
    }
    assert.equal(elementForCode('Digit9'), null);
    assert.equal(elementForCode('Digit0'), null);
    assert.equal(elementForCode('KeyN'), null);
  });
  it('cover every element type exactly once, with no colliding keys', () => {
    assert.equal(new Set(ELEMENT_SHORTCUTS.map((s) => s.type)).size, Object.keys(ELEMENT_META).length);
    assert.equal(new Set(ELEMENT_SHORTCUTS.map((s) => s.combo)).size, ELEMENT_SHORTCUTS.length);
    assert.equal(new Set(ELEMENT_SHORTCUTS.map((s) => s.code)).size, ELEMENT_SHORTCUTS.length);
    const all = SHORTCUT_SECTIONS.flatMap((s) => s.rows.map(([c]) => c));
    assert.equal(new Set(all).size, all.length, 'no combo listed twice anywhere in the dialog');
  });
  it('appear in the Ctrl+/ dialog in the same order, first in the Elements group', () => {
    const rows = SHORTCUT_SECTIONS.find((s) => s.title === 'Elements').rows.slice(0, 8);
    assert.deepEqual(rows, ORDER.map(([c, , l]) => [c, l]));
    for (const [c, , l] of ORDER) assert.equal(SHORTCUTS[c], l);
  });
});
