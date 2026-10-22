import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  quarters, scanScene, scanValueShifts, scoreTokens, shiftsToApply, tokenize,
} from '../src/lib/valueShiftScanner.js';
import { VALUE_SHIFTS } from '../src/lib/beats.js';
import { moreMenuItems } from '../src/lib/toolbar.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let n = 0;
const el = (type, text) => ({ id: `e${++n}`, type, text });
/** A scene from [type, text] pairs, padded in the middle so the quarters don't overlap. */
const scene = (opening, closing) => [
  ...opening.map(([t, x]) => el(t, x)),
  el('action', 'The room is a room. Chairs, a table, a window onto the street below, the usual afternoon traffic going by outside.'),
  el('action', 'Somewhere a radio plays. A clock on the wall ticks toward the hour while the kettle sits on the stove.'),
  ...closing.map(([t, x]) => el(t, x)),
];

describe('Value Shift scanner: the four shifts', () => {
  it('+ / − : calm and cooperation, then a weapon and a sudden exit', () => {
    const r = scanScene(scene(
      [['action', 'Marie and Theo laugh together over coffee, calm and relaxed.'], ['character', 'THEO'], ['dialogue', 'Thank you. I mean it.']],
      [['action', 'The door bursts in. A man with a gun.'], ['character', 'MAN'], ['dialogue', 'Nobody move.'], ['action', 'Theo storms out.']],
    ));
    assert.equal(r.shift, '+-');
    assert.equal(r.open, '+');
    assert.equal(r.close, '-');
    assert.ok(r.cues.close.some((c) => c.word === 'gun'));
    assert.equal(r.confidence, 'clear');
  });
  it('− / + : a threat and a fight, then relief and an embrace', () => {
    const r = scanScene(scene(
      [['action', 'Augustin glares. Rain, the storm, a siren far off.'], ['character', 'AUGUSTIN'], ['dialogue', 'You lied to me. Get out.']],
      [['action', 'She smiles. He nods, relieved, and they embrace.'], ['character', 'AUGUSTIN'], ['dialogue', 'Welcome home.']],
    ));
    assert.equal(r.shift, '-+');
  });
  it('+ / + : warm all the way through (static)', () => {
    const r = scanScene(scene(
      [['action', 'Sunlight. The family laughs around the table.'], ['dialogue', 'Happy birthday!']],
      [['action', 'They dance. Everyone cheers.'], ['dialogue', 'Best day ever.']],
    ));
    assert.equal(r.shift, '++');
    assert.ok(VALUE_SHIFTS.find((v) => v.id === r.shift).static);
  });
  it('− / − : bleak start, worse ending (static)', () => {
    const r = scanScene(scene(
      [['action', 'The ward is dark and cold. Marie is crying, afraid.'], ['dialogue', 'He’s dying.']],
      [['action', 'The monitor flatlines. A scream. She discovers the body.']],
    ));
    assert.equal(r.shift, '--');
  });
});

describe('Value Shift scanner: reading the words', () => {
  it('tokenizes like a reader (curly quotes, case, punctuation)', () => {
    assert.deepEqual(tokenize('Don’t — he’s GONE.'), ["don't", "he's", 'gone']);
  });
  it('a negator flips the charged word after it', () => {
    assert.equal(scoreTokens(tokenize('You are not safe here')).score, -1);
    assert.equal(scoreTokens(tokenize('Never afraid')).score, 1);
    assert.equal(scoreTokens(tokenize('No.')).score, -1, 'on its own, a refusal');
    assert.equal(scoreTokens(tokenize('It is not a gun')).score, -1, 'a weapon stays a weapon');
  });
  it('outcome beats weigh double at the end of a scene, not at its start', () => {
    assert.equal(scoreTokens(tokenize('he draws a knife')).score, -1);
    assert.equal(scoreTokens(tokenize('he draws a knife'), { closing: true }).score, -2);
    assert.equal(scoreTokens(tokenize('she walks out'), { closing: true }).score, -2, 'phrases match');
  });
  it('whole-word stems and camera words do not misfire', () => {
    for (const s of ['the history of the hut', 'breakfast on a huge plate', 'WIDE SHOT of the harbor', 'they explore the coast', 'she closes the door']) {
      assert.equal(scoreTokens(tokenize(s)).cues.length, 0, s);
    }
  });
  it('quarters are 25% each, at least a few words, never more than half', () => {
    const words = Array.from({ length: 100 }, (_, i) => `w${i}`);
    const q = quarters(words);
    assert.equal(q.opening.length, 25);
    assert.equal(q.closing[0], 'w75');
    const short = quarters(words.slice(0, 8));
    assert.equal(short.opening.length, 4);
  });
  it('reads Action, Dialogue and Parentheticals only — not cues, headings or transitions', () => {
    const r = scanScene([el('character', 'KILLER'), el('transition', 'SMASH CUT TO:'), el('action', 'They smile.')]);
    assert.equal(r.words, 2);
  });
  it('neutral scenes keep a calm (+) charge and are marked weak', () => {
    const r = scanScene([el('action', 'A hallway. A door.')]);
    assert.equal(r.shift, '++');
    assert.equal(r.confidence, 'weak');
  });
  it('is deterministic', () => {
    const blocks = SAMPLE_SCRIPT.blocks.map(([type, text], i) => ({ id: `b${i}`, type, text }));
    assert.deepEqual(scanValueShifts(blocks), scanValueShifts(blocks));
  });
});

describe('Value Shift scanner: scenes and cards', () => {
  const blocks = SAMPLE_SCRIPT.blocks.map(([type, text], i) => ({ id: `b${i}`, type, text }));
  const rows = scanValueShifts(blocks);
  it('one suggestion per scene heading, numbered, keyed by the heading id cards link to', () => {
    const headings = blocks.filter((b) => b.type === 'scene');
    assert.deepEqual(rows.map((r) => r.id), headings.map((b) => b.id));
    assert.deepEqual(rows.map((r) => r.number), headings.map((_, i) => i + 1));
    assert.ok(rows.every((r) => VALUE_SHIFTS.some((v) => v.id === r.shift)));
  });
  it('reads The Last Ferry’s wheelhouse scene as a turn (− / +): the storm, then the laugh', () => {
    assert.equal(rows.find((r) => /WHEELHOUSE/.test(r.heading)).shift, '-+');
  });
  it('applies only to linked cards whose shift differs', () => {
    const beats = [
      { id: 'k1', sceneId: rows[0].id, tags: [] },
      { id: 'k2', sceneId: rows[1].id, tags: [], valueShift: rows[1].shift },
      { id: 'k3', tags: [] },
      { id: 'k4', sceneId: rows[2].id, tags: [], valueShift: rows[2].shift === '++' ? '--' : '++' },
    ];
    const all = shiftsToApply(beats, rows, new Set(rows.map((r) => r.id)));
    assert.deepEqual([...all.keys()], ['k1', 'k4']);
    assert.equal(all.get('k1'), rows[0].shift);
    assert.deepEqual([...shiftsToApply(beats, rows, new Set([rows[0].id])).keys()], ['k1'], 'one accepted');
  });
});

describe('Scene Board: Analyze Value Shifts', () => {
  const board = read('src/components/BeatBoard.jsx');
  const modal = read('src/components/ValueShiftModal.jsx');
  it('sits beside Populate from Script, with a line icon (no emoji)', () => {
    const at = board.indexOf('label="Populate from Script"');
    const btn = board.indexOf('aria-hidden /> Analyze Value Shifts');
    assert.ok(at > 0 && btn > at && btn < board.indexOf('label="Export Outline"'));
    assert.match(board, /<Zap size=\{13\}/);
    assert.doesNotMatch(board + modal, /⚡/);
  });
  it('reads the script only when opened', () => {
    assert.match(board, /onClick=\{\(\) => setShiftScan\(scanValueShifts\(getBlocks\(\)\)\)\}/);
    assert.match(read('src/App.jsx'), /getBlocks=\{getBlocks\}/);
  });
  it('lists Scene # · Slugline · Suggested · Current, with ✓ per scene and Apply to All Cards', () => {
    for (const h of ['Sc.', 'Slugline', 'Suggested', 'Current']) assert.ok(modal.includes(`>${h}<`), h);
    assert.match(modal, /<Check size=/);
    assert.match(modal, /Apply to All Cards/);
  });
  it('applying sets the cards’ valueShift through the board (saved with the project, Undo for all)', () => {
    assert.match(board, /setValueShift\(\{ \.\.\.b, valueShift: undefined \}, changes\.get\(b\.id\)\)/);
    assert.match(board, /Value Shift set on \$\{changes\.size\}/);
  });
});

describe('Status bar: one Format Doctor control', () => {
  const app = read('src/App.jsx');
  const left = app.slice(app.indexOf('<div className="status-left">'), app.indexOf('<span className="status-spacer" />'));
  it('the left cluster is telemetry only: element, save / sync, Edit, scenes, notes, words', () => {
    assert.doesNotMatch(left, /Format Doctor|status-doctor|setDoctorOpen/);
    const order = ['status-type', 'status-save', '<LockBadge', 'scenes</span>', "'note' : 'notes'", 'words</span>'].map((k) => left.indexOf(k));
    assert.ok(order.every((i) => i >= 0), String(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });
  it('the Format stepper on the right is its control there', () => {
    const right = app.slice(app.indexOf('<div className="status-right">'));
    assert.match(right, /<FormatStepper[\s\S]*onOpenDoctor=\{\(\) => setDoctorOpen\(true\)\}/);
    assert.doesNotMatch(read('src/App.css'), /\.status-doctor/);
  });
  it('⋮ → Format Doctor opens it any time (with the count, or Clean)', () => {
    let opened = false;
    const items = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, onFormatDoctor: () => { opened = true; }, issueCount: 3 });
    const fd = items.find((i) => i.label === 'Format Doctor');
    assert.equal(fd.hint, '3');
    fd.onSelect();
    assert.ok(opened);
    assert.equal(moreMenuItems({ onFormatDoctor() {} }).find((i) => i.label === 'Format Doctor').hint, 'Clean');
    assert.match(app, /onFormatDoctor: \(\) => setDoctorOpen\(true\)/);
  });
});
