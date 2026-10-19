import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { backspaceAt, deleteAt } from '../src/lib/editing.js';

const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });
const ids = (r) => r.blocks.map((b) => b.id).join(',');

describe('Backspace', () => {
  it('removes an empty first element so the next one becomes line 1 of page 1', () => {
    const bs = [B('a', 'action', ''), B('b', 'transition', 'FADE IN:'), B('c', 'scene', 'EXT. HARBOR - DAWN')];
    const r = backspaceAt(bs, 0, 0, 0);
    assert.equal(ids(r), 'b,c');
    assert.deepEqual(r.focus, { id: 'b', caret: 0 });
  });
  it('treats a whitespace-only element as empty', () => {
    const r = backspaceAt([B('a', 'action', '   '), B('b', 'scene', 'INT. A - DAY')], 0, 0, 0);
    assert.equal(ids(r), 'b');
  });
  it('removes an empty element mid-script and lands at the end of the one above', () => {
    const r = backspaceAt([B('a', 'scene', 'INT. A - DAY'), B('b', 'action', ''), B('c', 'action', 'Rain.')], 1, 0, 0);
    assert.equal(ids(r), 'a,c');
    assert.deepEqual(r.focus, { id: 'a', caret: 'end' });
  });
  it('merges a non-empty element into the one above at position 0, whatever the types', () => {
    const bs = [B('a', 'action', 'She turns.'), B('b', 'dialogue', ' Then runs.')];
    const r = backspaceAt(bs, 1, 0, 0);
    assert.equal(ids(r), 'a');
    assert.equal(r.blocks[0].type, 'action');
    assert.equal(r.blocks[0].text, 'She turns. Then runs.');
    assert.deepEqual(r.focus, { id: 'a', caret: 10 });
  });
  it('keeps both notes when merging', () => {
    const r = backspaceAt([B('a', 'action', 'One.', { note: 'n1' }), B('b', 'action', 'Two.', { note: 'n2' })], 1, 0, 0);
    assert.equal(r.blocks[0].note, 'n1\nn2');
  });
  it('removes an empty element above instead of merging into it', () => {
    const r = backspaceAt([B('a', 'action', ''), B('b', 'scene', 'INT. A - DAY')], 1, 0, 0);
    assert.equal(ids(r), 'b');
    assert.deepEqual(r.focus, { id: 'b', caret: 0 });
  });
  it('leaves normal typing alone (caret not at 0, or a selection)', () => {
    const bs = [B('a', 'action', 'One.'), B('b', 'action', 'Two.')];
    assert.equal(backspaceAt(bs, 1, 2, 2), null);
    assert.equal(backspaceAt(bs, 1, 0, 3), null);
  });
  it('never deletes the last remaining element', () => {
    assert.equal(backspaceAt([B('a', 'action', '')], 0, 0, 0), null);
  });
  it('does nothing at the very start of a non-empty first element', () => {
    assert.equal(backspaceAt([B('a', 'scene', 'INT. A - DAY'), B('b', 'action', 'x')], 0, 0, 0), null);
  });
});

describe('Delete', () => {
  it('removes an empty first element and moves to the next', () => {
    const r = deleteAt([B('a', 'action', ''), B('b', 'transition', 'FADE IN:')], 0, 0, 0);
    assert.equal(ids(r), 'b');
    assert.deepEqual(r.focus, { id: 'b', caret: 0 });
  });
  it('removes an empty last element and moves to the end of the one above', () => {
    const r = deleteAt([B('a', 'action', 'Rain.'), B('b', 'action', '')], 1, 0, 0);
    assert.equal(ids(r), 'a');
    assert.deepEqual(r.focus, { id: 'a', caret: 'end' });
  });
  it('at the end of an element, merges the next one in', () => {
    const r = deleteAt([B('a', 'action', 'Rain.'), B('b', 'action', ' Wind.')], 0, 5, 5);
    assert.equal(r.blocks[0].text, 'Rain. Wind.');
    assert.deepEqual(r.focus, { id: 'a', caret: 5 });
  });
  it('leaves normal typing alone', () => {
    assert.equal(deleteAt([B('a', 'action', 'Rain.'), B('b', 'action', 'x')], 0, 2, 2), null);
  });
});
