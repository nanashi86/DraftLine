import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ISSUE_KINDS, applyFixes, auditScript, canFix, formatSlugline, hasExtraBlankLines, hasTimeOfDayPart, isCompleteSlugline,
  lowercaseIntroductions, stripBlankLines,
} from '../src/lib/formatDoctor.js';
import { readFileSync } from 'node:fs';

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
  it('Fix All leaves a clean script — except what only the writer can fill in', () => {
    const fixed = applyFixes(script, auditScript(script));
    const left = auditScript(fixed);
    assert.ok(left.every((it) => !canFix(it.kind)), 'nothing fixable is left');
    assert.deepEqual(left.map((it) => [it.kind, it.text]), [['slugincomplete', 'BACK ALLEY - NIGHT']], 'a heading with no INT./EXT. to invent');
    assert.equal(fixed.find((b) => b.id === 'a1').type, 'scene');
    assert.equal(fixed.find((b) => b.id === 'd7').type, 'action');
    assert.ok(!fixed.some((b) => b.id === 'e0' || b.id === 'a9'));
  });
  it('keeps notes on empty lines (they are not "empty")', () => {
    assert.deepEqual(auditScript([B('x', 'action', '', { note: 'keep me' }), B('y', 'action', 'Hi.')]), []);
  });
});

describe('Format Doctor: spec-script hygiene', () => {
  const kinds = (blocks, opts) => auditScript(blocks, opts).map((it) => [it.id, it.kind]);

  it('orphaned cue: a character cue followed by action, a heading or nothing', () => {
    assert.deepEqual(kinds([B('c1', 'character', 'MARIE'), B('a1', 'action', 'She leaves.')]), [['c1', 'orphancue']]);
    assert.deepEqual(kinds([B('c1', 'character', 'MARIE'), B('s1', 'scene', 'INT. FERRY - NIGHT')]), [['c1', 'orphancue']]);
    assert.deepEqual(kinds([B('a0', 'action', 'Rain.'), B('c1', 'character', 'MARIE')]), [['c1', 'orphancue']]);
    assert.deepEqual(kinds([B('c1', 'character', 'MARIE'), B('d1', 'dialogue', 'Hi.')]), [], 'a real speech');
    assert.deepEqual(kinds([B('c1', 'character', 'MARIE'), B('p1', 'parenthetical', '(soft)'), B('d1', 'dialogue', 'Hi.')]), []);
    assert.deepEqual(kinds([B('a0', 'action', 'Rain.'), B('c1', 'character', 'MARIE')], { skipId: 'c1' }), [], 'not while typing the cue');
    const fixed = applyFixes([B('c1', 'character', 'MARIE', { dual: true }), B('a1', 'action', 'x')], auditScript([B('c1', 'character', 'MARIE', { dual: true }), B('a1', 'action', 'x')]));
    assert.deepEqual([fixed[0].type, fixed[0].dual], ['action', undefined]);
  });
  it('orphaned parenthetical: one not followed by dialogue', () => {
    const s = [B('c1', 'character', 'MARIE'), B('d1', 'dialogue', 'Go.'), B('p1', 'parenthetical', '(beat)'), B('a1', 'action', 'She waits.')];
    assert.deepEqual(kinds(s), [['p1', 'orphanparen']]);
    assert.equal(applyFixes(s, auditScript(s))[2].type, 'action');
  });
  it('sluglines: layout is fixable (case, periods, dashes); missing INT./EXT. or time of day is flagged only', () => {
    assert.equal(formatSlugline('int kitchen–night'), 'INT. KITCHEN - NIGHT');
    assert.equal(formatSlugline('Ext. Harbor- dawn'), 'EXT. HARBOR - DAWN');
    assert.equal(formatSlugline('ext/int car -- day'), 'EXT/INT. CAR - DAY', 'the slash spelling is kept; only the period is added');
    assert.equal(formatSlugline('ext./int car -- day'), 'EXT./INT. CAR - DAY');
    assert.equal(formatSlugline('i/e truck - dawn'), 'I/E. TRUCK - DAWN');
    assert.equal(formatSlugline('EXT. PORT-AU-PRINCE - DAY'), 'EXT. PORT-AU-PRINCE - DAY', 'hyphenated names stay');
    const s = [B('s1', 'scene', 'int kitchen–night'), B('s2', 'scene', 'INT. CAR'), B('s3', 'scene', 'HARBOR - NIGHT'), B('s4', 'scene', 'INT. KITCHEN - NIGHT'),
      B('s5', 'scene', 'LATER'), B('s6', 'scene', 'MONTAGE - THE CITY WAKES')];
    assert.deepEqual(kinds(s), [['s1', 'slugformat'], ['s2', 'slugincomplete'], ['s3', 'slugincomplete']]);
    const fixed = applyFixes(s, auditScript(s));
    assert.equal(fixed[0].text, 'INT. KITCHEN - NIGHT');
    assert.equal(fixed[1].text, 'INT. CAR', 'nothing invented');
    assert.equal(canFix('slugincomplete'), false);
    assert.equal(ISSUE_KINDS.slugincomplete.fix, null);
  });
  it('INT/EXT., INT./EXT. and I/E. are all valid prefixes; a time of day may have more after it', () => {
    const ok = [
      'INT/EXT. FACTORY BUILDING - DAY', 'INT./EXT. FACTORY BUILDING - DAY', 'I/E. CAR - NIGHT', 'EXT/INT. PORCH - DUSK',
      'INT. KITCHEN - NIGHT - BACK TO SCENE', 'EXT. ROOF - DAY - CONTINUOUS', 'INT. BAR - NIGHT (1986)', 'INT. FERRY - WHEELHOUSE - NIGHT',
    ];
    for (const h of ok) {
      assert.equal(formatSlugline(h), h, h);
      assert.ok(isCompleteSlugline(h), h);
      assert.deepEqual(kinds([B('s', 'scene', h), B('a', 'action', 'x')]), [], h);
    }
    assert.ok(hasTimeOfDayPart('INT. KITCHEN - NIGHT - BACK TO SCENE'));
    for (const h of ['INT. CINEUS RESIDENCE - NEXT DAY', 'INT. BOUCHARD RESIDENCE - MASTER BEDROOM - FOLLOWING NIGHT',
      'EXT. CROIX-DES-BOSSALES - NIGHT (FLASHBACK)', 'INT. KITCHEN - LATER THAT DAY', 'INT. CAR (MOVING) - NIGHT']) {
      assert.ok(isCompleteSlugline(h), h);
    }
    assert.ok(!hasTimeOfDayPart('INT. NIGHT MARKET'), 'the location itself is never the time');
    assert.ok(!isCompleteSlugline('INT. NIGHT MARKET'));
    assert.ok(!isCompleteSlugline('INT. KITCHEN - BACK TO SCENE'));
    assert.deepEqual(kinds([B('s', 'scene', 'I/E CAR - NIGHT')]).map((k) => k[1]), ['slugformat'], 'a missing period is still offered');
  });
  it('every fix has a short button verb (rows and the status-bar list stay narrow)', () => {
    for (const [k, v] of Object.entries(ISSUE_KINDS)) {
      if (v.fix) assert.ok(v.verb && v.verb.length <= 8, k);
      else assert.equal(v.verb, null, k);
    }
    assert.equal(ISSUE_KINDS.spacing.verb, 'Strip');
    assert.equal(ISSUE_KINDS.slugformat.verb, 'Format');
  });
  it('first introductions: a speaking character first named in lower case in the Action', () => {
    const s = [B('a1', 'action', 'Marie drags a suitcase. A man waves.'), B('c1', 'character', 'MARIE'), B('d1', 'dialogue', 'Hi.'),
      B('c2', 'character', 'MAN'), B('d2', 'dialogue', 'Bonjou.'), B('a2', 'action', 'THEO (20s) runs.'), B('c3', 'character', 'THEO'), B('d3', 'dialogue', 'Wait!')];
    assert.deepEqual(kinds(s), [['a1', 'intro']], 'MARIE flagged; "a man" is not a name; THEO introduced in caps');
    const fixed = applyFixes(s, auditScript(s));
    assert.equal(fixed[0].text, 'MARIE drags a suitcase. A man waves.');
    assert.deepEqual(lowercaseIntroductions([B('a', 'action', 'Theo, then THEO.')], ['THEO']).get('a'), [{ name: 'THEO', at: 0, len: 4 }], 'only the first mention counts');
  });
  it('double blank lines: collapsed inside an element, and none at its start or end; formatting kept', () => {
    assert.ok(hasExtraBlankLines('A\n\n\nB'));
    assert.ok(hasExtraBlankLines('\nA'));
    assert.ok(!hasExtraBlankLines('A\n\nB'), 'one blank line is fine');
    assert.equal(stripBlankLines('\nA\n\n\n\nB\n\n'), 'A\n\nB');
    const b = B('a1', 'action', 'Rain.\n\n\n\nThunder.', { marks: { b: [[9, 17]] } });
    assert.deepEqual(kinds([b]), [['a1', 'spacing']]);
    const [fixed] = applyFixes([b], auditScript([b]));
    assert.equal(fixed.text, 'Rain.\n\nThunder.');
    assert.deepEqual(fixed.marks, { b: [[7, 15]] }, 'bold still on "Thunder."');
  });
  it('Ignore skips just that finding: the element’s next check still gets its turn', () => {
    const b = B('a1', 'action', 'Marie runs.\n\n\n\nShe stops.');
    const s = [b, B('c1', 'character', 'MARIE'), B('d1', 'dialogue', 'Hi.')];
    assert.deepEqual(auditScript(s).map((it) => it.kind), ['intro'], 'one finding per element');
    assert.deepEqual(auditScript(s, { ignore: new Set(['a1|intro']) }).map((it) => it.kind), ['spacing'], 'ignoring it reveals the next');
    assert.deepEqual(auditScript(s, { ignore: new Set(['a1|intro', 'a1|spacing']) }), []);
  });
});

describe('Format Doctor: the dialog and the status-bar list', () => {
  const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  const modal = read('components/FormatDoctorModal.jsx');
  const css = read('components/FormatDoctorModal.css');
  it('each row: one fix button, then Show, then Ignore — no second copy of the fix', () => {
    const actions = modal.slice(modal.indexOf('className="fd-actions"'), modal.indexOf('</span>', modal.indexOf('className="fd-actions"')));
    const at = (k) => actions.indexOf(k);
    assert.ok(at('onFix(it)') > 0 && at('onFix(it)') < at('onShow(it.id)') && at('onShow(it.id)') < at('onIgnore(it)'));
    assert.equal(modal.split('onFix(it)').length - 1, 1, 'one fix button per row');
    assert.match(modal, /title=\{kind\.fix\}>\{kind\.verb\}</);
  });
  it('fixed columns: 180px badge (ellipsis) · 50px page · snippet (Courier, ellipsis) · 170px actions', () => {
    assert.match(css, /grid-template-columns: 180px 50px minmax\(0, 1fr\) 170px;/);
    const kind = css.match(/\.fd-kind \{([^}]*)\}/)[1];
    for (const d of ['overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap']) assert.ok(kind.includes(d), d);
    assert.match(css, /\.fd-page \{[^}]*text-align: center;/);
    assert.match(css, /\.fd-text \{ font: 13px 'Courier Prime'/);
    assert.match(css, /\.fd-actions \{ display: flex; gap: 6px; justify-content: flex-end; \}/);
  });
  it('the status-bar list: title + page tag, then the line in Courier; Fix / Ignore pinned right; floats 4px above the bar', () => {
    const fs = read('components/FormatStepper.jsx');
    assert.match(fs, /label: ISSUE_KINDS\[it\.kind\]\.label,\s*tag: `p\. \$\{pageOfBlock\[it\.id\] \?\? '–'\}`,\s*sub: firstLine\(it\.text\),\s*mono: true,/);
    const ss = read('components/StatusStepper.jsx');
    assert.match(ss, /bottom: window\.innerHeight - barTop \+ 4/);
    const app = read('App.css');
    const list = app.match(/\.stepper-list \{([^}]*)\}/)[1];
    for (const d of ['border: 1px solid #333', 'border-radius: 8px', 'box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5)']) assert.ok(list.includes(d), d);
    assert.match(app, /\.stepper-list \.menu-sub\.is-mono \{ font: 12px\/1\.35 'Courier Prime'/);
    assert.match(app, /\.stepper-list-actions \{[^}]*flex: none;[^}]*white-space: nowrap;/);
  });
});
