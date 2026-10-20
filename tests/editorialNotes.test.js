import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NOTE_LOG_LIMIT, adjacentNote, endNoteSession, hasNote, noteHistory, notedLines, quoteSelection, restoreNoteVersion,
  setNoteText, startNote, withoutNote,
} from '../src/lib/editorialNotes.js';
import { toFountain } from '../src/lib/fountain.js';
import { toFDX } from '../src/lib/fdx.js';

const line = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

describe('Margin notes: non-destructive', () => {
  it('a new note starts empty — or quoting the selected words — and the script text is never changed', () => {
    const b = line('a', 'action', 'Mist over black water.');
    const n = startNote(b, { now: 1 });
    assert.equal(n.note, '');
    assert.equal(n.text, b.text);
    const q = startNote(b, { quote: 'black   water', now: 1 });
    assert.equal(q.note, '“black water” — ');
    assert.equal(q.text, 'Mist over black water.');
  });

  it('quoting into an existing note adds a line; very long selections are trimmed', () => {
    const b = line('a', 'action', 'x', { note: 'Tighten.' });
    assert.equal(startNote(b, { quote: 'x' }).note, 'Tighten.\n“x” — ');
    assert.equal(startNote(b), b, 'opening an existing note changes nothing');
    assert.ok(quoteSelection('w '.repeat(200)).length < 170);
  });

  it('deleting removes the note and its history together', () => {
    const b = line('a', 'action', 'x', { note: 'n', noteAt: 5, noteLog: [{ at: 1, text: 'old' }] });
    assert.deepEqual(setNoteText(b, null), line('a', 'action', 'x'));
    assert.deepEqual(withoutNote(b), line('a', 'action', 'x'));
  });
});

describe('Margin notes: history', () => {
  it('an editing session that changed the note logs the version it started from', () => {
    let b = line('a', 'action', 'x', { note: 'First thought' });
    b = setNoteText(b, 'Second thought', 10);
    b = endNoteSession(b, 'First thought', 20);
    assert.deepEqual(b.noteLog, [{ at: 20, text: 'First thought' }]);
    assert.equal(b.noteAt, 10);
    b = setNoteText(b, 'Third thought', 30);
    b = endNoteSession(b, 'Second thought', 40);
    assert.deepEqual(noteHistory(b).map((h) => [h.text, h.index]), [['Second thought', 1], ['First thought', 0]]);
  });

  it('nothing is logged for an unchanged note, a brand-new note, or an empty start', () => {
    const b = line('a', 'action', 'x', { note: 'Same' });
    assert.equal(endNoteSession(b, 'Same'), b);
    assert.equal(endNoteSession(line('a', 'action', 'x', { note: 'New' }), null).noteLog, undefined);
    assert.equal(endNoteSession(line('a', 'action', 'x', { note: 'Typed' }), '').noteLog, undefined);
  });

  it('a note left empty is dropped when the session ends', () => {
    assert.equal(hasNote(endNoteSession(line('a', 'action', 'x', { note: '  ' }), null)), false);
  });

  it('restoring an earlier version keeps the current one in the history', () => {
    const b = line('a', 'action', 'x', { note: 'Now', noteLog: [{ at: 1, text: 'Then' }] });
    const r = restoreNoteVersion(b, 0, 99);
    assert.equal(r.note, 'Then');
    assert.deepEqual(r.noteLog, [{ at: 1, text: 'Then' }, { at: 99, text: 'Now' }]);
  });

  it(`keeps at most ${NOTE_LOG_LIMIT} earlier versions`, () => {
    let b = line('a', 'action', 'x', { note: 'v0' });
    for (let i = 1; i <= NOTE_LOG_LIMIT + 10; i++) b = endNoteSession(setNoteText(b, `v${i}`, i), `v${i - 1}`, i);
    assert.equal(b.noteLog.length, NOTE_LOG_LIMIT);
    assert.equal(b.noteLog.at(-1).text, `v${NOTE_LOG_LIMIT + 9}`);
  });
});

describe('Margin notes: the drawer’s list', () => {
  const blocks = [
    line('s1', 'scene', 'INT. FERRY - NIGHT', { note: 'Night shoot?\nBudget' }),
    line('a1', 'action', 'Rain.'),
    line('d1', 'dialogue', 'Turn us around.', { note: 'Read flatter', noteLog: [{ at: 1, text: 'Louder' }] }),
  ];
  it('lists annotated lines in script order with page, type, excerpt and first line of the note', () => {
    const l = notedLines(blocks, { s1: 1, d1: 2 });
    assert.deepEqual(l.map((x) => [x.id, x.label, x.page, x.preview, x.versions]), [
      ['s1', 'Scene Heading', 1, 'Night shoot?', 0], ['d1', 'Dialogue', 2, 'Read flatter', 1],
    ]);
  });
  it('‹ › step between notes and wrap around', () => {
    assert.equal(adjacentNote(blocks, 's1', 1), 'd1');
    assert.equal(adjacentNote(blocks, 'd1', 1), 's1');
    assert.equal(adjacentNote(blocks, 's1', -1), 'd1');
  });
});

describe('Margin notes never leave DraftLine', () => {
  const blocks = [
    line('s1', 'scene', 'INT. FERRY - NIGHT', { note: 'PRIVATE-1', noteLog: [{ at: 1, text: 'PRIVATE-OLD' }] }),
    line('c1', 'character', 'MARIE', { note: 'PRIVATE-2' }),
    line('d1', 'dialogue', 'Turn us around.', { note: 'PRIVATE-3' }),
    line('x1', 'action', '', { note: 'PRIVATE-ORPHAN' }),
  ];
  it('not in .fountain', () => {
    assert.ok(!/PRIVATE|\[\[/.test(toFountain({ meta: {}, blocks })));
  });
  it('not in .fdx', () => {
    assert.ok(!/PRIVATE|ScriptNote/.test(toFDX({ meta: {}, blocks })));
  });
  it('not in print / PDF: the print view never renders notes, and the editor is hidden when printing', () => {
    const print = readFileSync(new URL('../src/components/PrintView.jsx', import.meta.url), 'utf8');
    assert.ok(!/\.note\b|note-mark|noteLog/.test(print));
    const css = readFileSync(new URL('../src/components/PrintView.css', import.meta.url), 'utf8');
    assert.match(css, /@media print/);
  });
  it('the marker sits in the left margin; there is no right-margin chip or popover any more', () => {
    const css = readFileSync(new URL('../src/components/Editor.css', import.meta.url), 'utf8');
    assert.match(css, /\.note-mark,\s*\.note-add \{[^}]*left: calc\(-1 \* var\(--el-left\) - var\(--in\) \* 1\.12\)/);
    assert.ok(!/note-flag|note-pop/.test(css));
  });
});
