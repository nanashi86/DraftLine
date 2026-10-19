import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyFixes, auditScript } from '../src/lib/formatDoctor.js';

const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });
const kinds = (issues) => issues.map((i) => `${i.id}:${i.kind}`);

describe('Format Doctor', () => {
  const script = [
    B('e0', 'action', ''),
    B('a1', 'action', 'EXT/INT. CAR - DAY'),
    B('a2', 'action', 'She drives.'),
    B('a3', 'action', 'BACK ALLEY - NIGHT'),
    B('a4', 'action', 'MARIE'),
    B('d5', 'dialogue', 'Go.'),
    B('a6', 'action', 'The horn blares.'),
    B('d7', 'dialogue', 'Who said that?'),
    B('a8', 'action', 'SUPER: PARIS - NIGHT'),
    B('a9', 'action', 'ACT TWO'),
    B('s10', 'scene', 'INT. FERRY - NIGHT'),
    B('c11', 'character', 'THEO'),
    B('d12', 'dialogue', 'Fine.'),
  ];

  it('flags unclassified sluglines, stray cues, orphaned dialogue, act markers and empty lines', () => {
    assert.deepEqual(kinds(auditScript(script)), ['e0:empty', 'a1:slugline', 'a3:slugline', 'a4:cue', 'd7:orphan', 'a9:act']);
  });
  it('does not flag on-screen text, correct speeches, or the line being typed', () => {
    const ids = auditScript(script, { skipId: 'e0' }).map((i) => i.id);
    for (const ok of ['e0', 'a8', 's10', 'c11', 'd12', 'd5']) assert.ok(!ids.includes(ok), ok);
  });
  it('fixes one issue', () => {
    const [cue] = auditScript(script).filter((i) => i.kind === 'cue');
    const fixed = applyFixes(script, [cue]);
    assert.equal(fixed.find((b) => b.id === 'a4').type, 'character');
    assert.equal(fixed.length, script.length);
  });
  it('Fix All leaves a clean script', () => {
    const fixed = applyFixes(script, auditScript(script));
    assert.deepEqual(auditScript(fixed), []);
    assert.equal(fixed.find((b) => b.id === 'a1').type, 'scene');
    assert.equal(fixed.find((b) => b.id === 'd7').type, 'action');
    assert.ok(!fixed.some((b) => b.id === 'e0' || b.id === 'a9'));
  });
  it('keeps notes on empty lines (they are not "empty")', () => {
    assert.deepEqual(auditScript([B('x', 'action', '', { note: 'keep me' }), B('y', 'action', 'Hi.')]), []);
  });
});
