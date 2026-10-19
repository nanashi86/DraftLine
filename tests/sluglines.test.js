import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasTimeOfDaySuffix, isActBreak, isOnScreenText, isSlugline } from '../src/lib/sluglines.js';
import { parseTextScript } from '../src/lib/textScriptParser.js';
import { parseFountain, toFountain } from '../src/lib/fountain.js';

const VARIANTS = [
  'INT. KITCHEN - NIGHT', 'EXT. KITCHEN - NIGHT', 'EST. CITY - DAY',
  'INT./EXT. CAR - DAY', 'EXT./INT. CAR - DAY',
  'INT/EXT. CAR - DAY', 'EXT/INT. CAR - DAY',
  'INT/EXT CAR - DAY', 'EXT/INT CAR - DAY',
  'I/E. CAR - DAY', 'I/E CAR - DAY',
  'INT / EXT. CAR - DAY', 'int. kitchen - night', '12 INT. WAREHOUSE - NIGHT 12', '12A EXT/INT. DOCK - DAY',
];

describe('slugline detection', () => {
  for (const v of VARIANTS) {
    it(`recognises "${v}"`, () => {
      assert.ok(isSlugline(v));
      const r = parseTextScript(`${v}\n\nShe waits.`);
      assert.equal(r.blocks[0].type, 'scene');
    });
  }
  it('strips scene numbers and uppercases', () => {
    assert.equal(parseTextScript('12 int/ext. car - day 12\n\nGo.').blocks[0].text, 'INT/EXT. CAR - DAY');
  });
  it('does not mistake ordinary words for sluglines', () => {
    for (const t of ['INTERIOR DESIGN is her thing.', 'EXTRAS mill around.', 'Interstate traffic.', 'Esther waits.']) {
      assert.ok(!isSlugline(t), t);
      assert.equal(parseTextScript(t).blocks[0].type, 'action', t);
    }
  });
  it('Fountain import accepts the variants; export forces non-standard ones with "."', () => {
    assert.equal(parseFountain('EXT/INT. CAR - DAY\n\nGo.\n').blocks[0].type, 'scene');
    assert.match(toFountain({ meta: {}, blocks: [{ type: 'scene', text: 'EXT/INT CAR - DAY' }] }), /^\.EXT\/INT CAR - DAY$/m);
    assert.match(toFountain({ meta: {}, blocks: [{ type: 'scene', text: 'INT./EXT. CAR - DAY' }] }), /^INT\.\/EXT\. CAR - DAY$/m);
  });
  it('spots a time-of-day suffix without INT./EXT.', () => {
    assert.ok(hasTimeOfDaySuffix('BACK ALLEY - NIGHT'));
    assert.ok(!hasTimeOfDaySuffix('It was the best day'));
  });
});

describe('act markers', () => {
  for (const t of ['ACT 1', 'ACT ONE', 'ACT IV', 'ACT 1[b]', 'END OF ACT TWO', 'ACT TWO: THE STORM']) {
    it(`strips "${t}"`, () => assert.ok(isActBreak(t)));
  }
  for (const t of ['Act one of the play begins.', 'ACTION!', 'ACTOR', 'Act 2 is where it falls apart']) {
    it(`keeps "${t}"`, () => assert.ok(!isActBreak(t)));
  }
  it('never reach the script on import', () => {
    const r = parseTextScript('ACT ONE\n\nFADE IN:\n\nINT. A - DAY\n\nRain.\n\nEND OF ACT ONE\n\nACT 1[b]\n\nEXT. B - NIGHT\n\nWind.');
    assert.equal(r.actBreaks, 3);
    assert.ok(r.blocks.every((b) => !/ACT/.test(b.text)));
    assert.deepEqual(r.blocks.map((b) => b.type), ['transition', 'scene', 'action', 'scene', 'action']);
  });
});

describe('transitions and on-screen text', () => {
  it('FADE IN: and …TO: lines are transitions even mid-paragraph', () => {
    const r = parseTextScript('FADE IN:\nEXT. A - DAY\nRain.\n\nSMASH CUT TO:\nINT. B - NIGHT\n');
    assert.deepEqual(r.blocks.map((b) => b.type), ['transition', 'scene', 'action', 'transition', 'scene']);
  });
  it('SUPER: / TITLE: lines become Format Cues, never a character cue', () => {
    for (const t of ['SUPER: PARIS, 1942', 'SUPER: Three years later', 'TITLE: CHAPTER ONE', 'INSERT: THE LETTER']) {
      assert.ok(isOnScreenText(t), t);
      const r = parseTextScript(`INT. A - DAY\n${t}\nShe reads it.`);
      assert.equal(r.blocks[1].type, 'format_cue', t);
      assert.equal(r.blocks[1].text, t);
    }
  });
});
