import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTextScript } from '../src/lib/textScriptParser.js';

const types = (r) => r.blocks.map((b) => b.type);

describe('text importer layouts', () => {
  it('Google Docs / Word paste (one paragraph per line, no blank lines)', () => {
    const r = parseTextScript([
      'EXT. HARBOR - DAWN',
      'Mist over black water.',
      'THEO',
      "You said six. It's not even five-thirty.",
      'MARIE',
      '(catching her breath)',
      "That's the same thing.",
      "She doesn't answer.",
      'CUT TO:',
      'INT./EXT. FERRY - CONTINUOUS',
    ].join('\n'));
    assert.equal(r.layout, 'compact');
    assert.deepEqual(types(r), [
      'scene', 'action', 'character', 'dialogue', 'character', 'parenthetical', 'dialogue', 'action', 'transition', 'scene',
    ]);
  });

  it('blank-line separated text keeps wrapped dialogue together', () => {
    const r = parseTextScript('INT. KITCHEN - NIGHT\n\nROSA\nYou\'re late.\nAgain.\n\nBOOM. The window SHATTERS.\n\nSMASH CUT TO:\n');
    assert.equal(r.layout, 'blank-line');
    assert.deepEqual(types(r), ['scene', 'character', 'dialogue', 'action', 'transition']);
    assert.equal(r.blocks[2].text, "You're late.\nAgain.");
  });

  it('PDF copy: indentation, page furniture, scene numbers, page-break CONT\'D', () => {
    const pdf = [
      '                                                            1.',
      '',
      "     12   INT. WAREHOUSE - NIGHT                                   12",
      '',
      '          Rain hammers the skylights. JONAH (40s) circles a',
      '          crate, flashlight in his teeth.',
      '',
      '                              KESSLER (O.S.)',
      '                         (from the dark,',
      '                          amused)',
      "                    My mother's alive, Jonah.",
      '                              (MORE)',
      '                                                            2.',
      "                              KESSLER (CONT'D)",
      "                    That's the problem.",
      '',
      '          Jonah spins.',
    ].join('\n');
    const r = parseTextScript(pdf);
    assert.equal(r.layout, 'indented');
    assert.equal(r.cleaned, 3);
    assert.equal(r.blocks[0].text, 'INT. WAREHOUSE - NIGHT');
    assert.equal(r.blocks[1].text, 'Rain hammers the skylights. JONAH (40s) circles a crate, flashlight in his teeth.');
    assert.deepEqual(types(r), ['scene', 'action', 'character', 'parenthetical', 'dialogue', 'action']);
    assert.equal(r.blocks[3].text, '(from the dark, amused)');
    assert.equal(r.blocks[4].text, "My mother's alive, Jonah. That's the problem.");
  });

  it('Auto-Detect off imports every paragraph as Action', () => {
    const r = parseTextScript('INT. A - DAY\n\nBOB\nHi.', { autoDetect: false });
    assert.deepEqual(new Set(types(r)), new Set(['action']));
  });

  it('hands real Fountain files to the Fountain parser', () => {
    const r = parseTextScript('Title: X\nAuthor: Y\n\nINT. A - DAY\n\nHi.\n');
    assert.equal(r.layout, 'fountain');
    assert.equal(r.meta.title, 'X');
  });
});
