import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installDOMParser } from './helpers/miniDom.js';
import { isFormatCue, isSecondarySlugline, isSceneHeadingLine } from '../src/lib/sluglines.js';
import { parseTextScript } from '../src/lib/textScriptParser.js';
import { parseFountain, toFountain } from '../src/lib/fountain.js';
import { parseFDX, toFDX } from '../src/lib/fdx.js';
import { applyFixes, auditScript } from '../src/lib/formatDoctor.js';
import { ELEMENT_TYPES, ENTER_NEXT, buildItems, paginate } from '../src/lib/screenplay.js';

installDOMParser();

const types = (r) => r.blocks.map((b) => b.type);

describe('secondary sluglines', () => {
  it('BACK TO, LATER, MOMENTS LATER, RESUME, CONTINUOUS, SAME', () => {
    for (const t of ['BACK TO THE CINEUS RESIDENCE', 'LATER', 'MOMENTS LATER', 'RESUME SCENE', 'CONTINUOUS', 'SAME']) {
      assert.ok(isSecondarySlugline(t), t);
    }
  });
  it('but not shouts, mixed case, names that merely start that way, or "BACK TO:"', () => {
    for (const t of ['LATER!', 'Later that night, she calls.', 'SAMEER', 'BACK TO:', 'LATERAL THINKING']) {
      assert.ok(!isSecondarySlugline(t), t);
    }
  });
  it('underline markup is ignored when checking headings', () => {
    assert.ok(isSceneHeadingLine('<u>FLASHBACK</u> - CROIX-DES-BOSSALES - NIGHT'));
    assert.ok(isSceneHeadingLine('_FLASHBACK_ - CROIX-DES-BOSSALES - NIGHT'));
    assert.ok(isSceneHeadingLine('<u>INT.</u> CAR - DAY'));
  });
  it('the importer tags them as scenes — except a shout right under a cue', () => {
    const r = parseTextScript('INT. CINEUS RESIDENCE - DAY\n\nMarie packs.\n\nBACK TO THE CINEUS RESIDENCE\n\nMoments later.\n\nTHEO\nLATER\n\nMOMENTS LATER\n\nShe is gone.');
    assert.deepEqual(types(r), ['scene', 'action', 'scene', 'action', 'character', 'dialogue', 'scene', 'action']);
  });
  it('the Format Doctor offers a one-click "Convert to Scene Heading"', () => {
    const blocks = [
      { id: 'a', type: 'action', text: 'BACK TO THE CINEUS RESIDENCE' },
      { id: 'b', type: 'action', text: 'Marie packs.' },
    ];
    const issues = auditScript(blocks);
    assert.deepEqual(issues.map((i) => [i.id, i.kind, i.to]), [['a', 'secondary', 'scene']]);
    assert.equal(applyFixes(blocks, issues)[0].type, 'scene');
  });
});

describe('Format Cue element', () => {
  it('is a first-class type on Alt+2, and Enter after it goes to Action', () => {
    assert.equal(ELEMENT_TYPES[1], 'format_cue');
    assert.equal(ENTER_NEXT.format_cue, 'action');
  });
  it('recognises language, sequence and on-screen cues', () => {
    for (const t of ['IN CREOLE WITH ENGLISH SUBTITLES:', 'BEGIN FLASHBACK', 'END MONTAGE', 'SUPER: PORT-AU-PRINCE, 1991', 'TITLE: PART ONE']) {
      assert.ok(isFormatCue(t), t);
    }
    for (const t of ['End of the line, she says.', 'Begin again.', 'END OF ACT ONE', 'MARIE']) assert.ok(!isFormatCue(t), t);
  });
  it('the importer tags them (never as character cues), even right above dialogue', () => {
    const r = parseTextScript('INT. MARKET - DAY\n\nIN CREOLE WITH ENGLISH SUBTITLES:\n\nMARIE\nWe go now.\n\nBEGIN FLASHBACK\nTHEO\nRun.\n\nEND FLASHBACK');
    assert.deepEqual(types(r), ['scene', 'format_cue', 'character', 'dialogue', 'format_cue', 'character', 'dialogue', 'format_cue']);
  });
  it('the Format Doctor never flags a format cue, and offers to tag untagged ones', () => {
    const blocks = [
      { id: 'f', type: 'format_cue', text: 'END MONTAGE' },
      { id: 'd', type: 'dialogue', text: 'Hi.' },
      { id: 'g', type: 'format_cue', text: 'BACK TO THE HOUSE' },
      { id: 'h', type: 'action', text: 'BEGIN FLASHBACK' },
      { id: 'i', type: 'action', text: 'SUPER: PARIS' },
    ];
    const issues = auditScript(blocks);
    assert.ok(!issues.some((i) => i.id === 'f' || i.id === 'g'));
    assert.deepEqual(issues.filter((i) => i.id === 'h').map((i) => i.to), ['format_cue']);
    assert.ok(!issues.some((i) => i.id === 'i'), 'on-screen text may stay Action');
  });
  it('exports to Fountain as caps Action and reads back as a Format Cue', () => {
    const blocks = [
      { type: 'format_cue', text: 'in creole with english subtitles:' },
      { type: 'character', text: 'MARIE' },
      { type: 'dialogue', text: 'Nou ale.' },
      { type: 'format_cue', text: 'END FLASHBACK' },
    ];
    const out = toFountain({ meta: {}, blocks });
    assert.match(out, /^IN CREOLE WITH ENGLISH SUBTITLES:$/m);
    assert.deepEqual(types(parseFountain(out)), ['format_cue', 'character', 'dialogue', 'format_cue']);
  });
  it('exports to Final Draft as a bold General paragraph, and imports back exactly', () => {
    const blocks = [{ type: 'format_cue', text: 'Sound of rain stops', marks: { u: [[0, 5]] } }];
    const xml = toFDX({ meta: {}, blocks });
    assert.match(xml, /<Paragraph Type="General">\s*<Text Style="Bold\+Underline">SOUND<\/Text>\s*<Text Style="Bold"> OF RAIN STOPS<\/Text>/);
    const back = parseFDX(xml).blocks;
    assert.deepEqual(back.map((b) => [b.type, b.text, b.marks]), [['format_cue', 'SOUND OF RAIN STOPS', { u: [[0, 5]] }]]);
  });
  it('keeps "BEGIN …" with what follows and "END …" with what precedes at a page break', () => {
    const filler = Array.from({ length: 26 }, (_, k) => ({ id: `a${k}`, type: 'action', text: 'Line.' }));
    // 26 actions × 2 lines = 52 lines; a cue at 53–54 would strand at the foot of page 1.
    const begin = [...filler, { id: 'cue', type: 'format_cue', text: 'BEGIN FLASHBACK' }, { id: 'x', type: 'action', text: 'Rain.' }];
    const p1 = paginate(buildItems(begin)).place;
    assert.equal(p1[26].page, p1[27].page, 'BEGIN travels with what follows');
    const end = [...filler.slice(0, 26), { id: 'x', type: 'action', text: 'Rain.' }, { id: 'cue', type: 'format_cue', text: 'END FLASHBACK' }];
    const p2 = paginate(buildItems(end)).place;
    assert.equal(p2[26].page, p2[27].page, 'END stays with what precedes');
  });
});
