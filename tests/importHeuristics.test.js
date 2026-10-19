import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installDOMParser } from './helpers/miniDom.js';
import { END_RE, isCueShaped, isEndMarker, startsLikeProse } from '../src/lib/sluglines.js';
import { looksLikeCue, parseTextScript } from '../src/lib/textScriptParser.js';
import { parseFountain, toFountain } from '../src/lib/fountain.js';
import { parseFDX, toFDX } from '../src/lib/fdx.js';
import { applyFixes, auditScript, isCharacterIntro, ISSUE_KINDS } from '../src/lib/formatDoctor.js';
import { ELEMENT_META, ELEMENT_TYPES, ENTER_NEXT, buildItems, paginate } from '../src/lib/screenplay.js';
import { SHORTCUTS } from '../src/lib/shortcuts.js';

installDOMParser();

const types = (blocks) => blocks.map((b) => `${b.type}:${b.text}`);
const both = (src) => [parseTextScript(src).blocks, parseFountain(src).blocks];
const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });

const FITO = 'FITO (10)--copper skin, bare feet--darts between the market stalls.';

describe('character cues vs. character introductions', () => {
  it('a cue is a lone all-caps name with only standard extensions', () => {
    for (const t of ['MARIE', 'MARIE (V.O.)', 'THEO (O.S.)', "THEO (CONT'D)", 'JEAN-CLAUDE', 'DR. SMITH', 'MARIE (INTO PHONE)', '@McCLANE']) {
      assert.ok(isCueShaped(t), t);
    }
  });
  it('an age, dashes, em-dashes or sentence punctuation make it a character introduction', () => {
    for (const t of ['FITO (10)', 'FITO (10)--COPPER SKIN', 'FITO — BAREFOOT', 'MARIE (30S)', 'MARIE, 40', 'THE MAN - TIRED', 'HE RUNS!', 'STOP.']) {
      assert.ok(!isCueShaped(t), t);
      assert.ok(!looksLikeCue(t, 'Hello.'), t);
    }
  });
  it('a next line that carries on in lower case is description, not dialogue', () => {
    assert.ok(startsLikeProse('copper skin, bare feet'));
    assert.ok(!startsLikeProse('Stop him!'));
    assert.ok(!startsLikeProse('--and another thing.'), 'an interrupted speech resuming stays dialogue');
    assert.ok(!looksLikeCue('FITO', 'copper skin, bare feet, darts…'));
    assert.ok(looksLikeCue('FITO', 'Over here!'));
  });

  it('"FITO (10)--copper skin…" parses as Action (text and Fountain)', () => {
    for (const blocks of both(`INT. MARKET - DAY\n\n${FITO}\n\nMARIE\nStop him!`)) {
      assert.deepEqual(types(blocks), ['scene:INT. MARKET - DAY', `action:${FITO}`, 'character:MARIE', 'dialogue:Stop him!']);
    }
  });
  it('an all-caps intro line followed by an action paragraph stays one Action block', () => {
    for (const src of ['FITO (10)--COPPER SKIN, BARE FEET\nHe darts between the stalls.', 'FITO (10)\ncopper skin, bare feet, darts between the stalls.']) {
      for (const blocks of both(`${src}\n\nMARIE (V.O.)\nStop him!`)) {
        assert.equal(blocks[0].type, 'action', src);
        assert.equal(blocks[0].text, src);
        assert.deepEqual(types(blocks.slice(1)), ['character:MARIE (V.O.)', 'dialogue:Stop him!']);
      }
    }
  });
  it('real cues still parse, extensions included', () => {
    for (const blocks of both("JEAN-CLAUDE (CONT'D)\nBonjour.\n\nTHEO (O.S.)\nIn here.")) {
      assert.deepEqual(types(blocks), ["character:JEAN-CLAUDE (CONT'D)", 'dialogue:Bonjour.', 'character:THEO (O.S.)', 'dialogue:In here.']);
    }
  });
});

describe('SUPER: / TITLE: / SUBTITLE: / … WITH ENGLISH SUBTITLES: cues', () => {
  const src = 'The village wakes.\nSUPER: PORT-AU-PRINCE, 1986\nSmoke rises over the hills.\n\nIN CREOLE WITH ENGLISH SUBTITLES:\n\nMARIE\nBonjou.\n\nSUBTITLE: GOOD MORNING.\nTITLE: PART ONE';
  it('come out of the surrounding Action as their own Format Cues', () => {
    for (const blocks of both(src)) {
      assert.deepEqual(types(blocks), [
        'action:The village wakes.',
        'format_cue:SUPER: PORT-AU-PRINCE, 1986',
        'action:Smoke rises over the hills.',
        'format_cue:IN CREOLE WITH ENGLISH SUBTITLES:',
        'character:MARIE',
        'dialogue:Bonjou.',
        'format_cue:SUBTITLE: GOOD MORNING.',
        'format_cue:TITLE: PART ONE',
      ]);
    }
  });
  it('get exactly one blank line before and after on the page', () => {
    const blocks = parseTextScript(src).blocks.map((b, k) => ({ ...b, id: `b${k}` }));
    const { place } = paginate(buildItems(blocks));
    const gapBefore = (k) => place[k].topLine - (place[k - 1].topLine + place[k - 1].lines);
    assert.equal(gapBefore(1), 1, 'blank line above SUPER:');
    assert.equal(gapBefore(2), 1, 'blank line below SUPER:');
    assert.equal(gapBefore(3), 1, 'blank line above the subtitles cue');
  });
  it('are never character cues, even above a line of text', () => {
    assert.ok(!looksLikeCue('SUPER: PARIS', 'Night.'));
    assert.ok(!looksLikeCue('SUBTITLE: HELLO', 'Night.'));
  });
});

describe('THE END', () => {
  it('matches standalone THE END, with or without FADE OUT. before it', () => {
    for (const t of ['THE END', 'The End', 'THE END.', 'FADE OUT. THE END', 'FADE OUT.  THE END']) assert.ok(isEndMarker(t), t);
    for (const t of ['THE END OF THE ROAD', 'It was the end.', 'FADE OUT.']) assert.ok(!isEndMarker(t), t);
    assert.ok(END_RE.test('THE END'));
  });
  it('is Centered, below its transition (text and Fountain)', () => {
    for (const src of ['She leaves.\n\nFADE OUT.\n\nTHE END', 'She leaves.\n\nFADE OUT. THE END', 'She leaves.\n\nFADE OUT.\nTHE END']) {
      for (const blocks of both(src)) {
        assert.deepEqual(types(blocks), ['action:She leaves.', 'transition:FADE OUT.', 'centered:THE END'], src);
      }
    }
  });
  it('sits two lines below the transition, on its page', () => {
    const blocks = [B('a', 'action', 'She leaves.'), B('t', 'transition', 'FADE OUT.'), B('e', 'centered', 'THE END')];
    const { place } = paginate(buildItems(blocks));
    assert.equal(place[2].topLine - (place[1].topLine + place[1].lines), 2);
    assert.equal(place[2].page, place[1].page);
  });
  it('round-trips through Fountain (> THE END <) and Final Draft (centered Action)', () => {
    const blocks = [{ type: 'transition', text: 'FADE OUT.' }, { type: 'centered', text: 'THE END' }];
    const ftn = toFountain({ blocks });
    assert.match(ftn, /^> THE END <$/m);
    assert.deepEqual(types(parseFountain(ftn).blocks), ['transition:FADE OUT.', 'centered:THE END']);
    const xml = toFDX({ meta: {}, blocks });
    assert.match(xml, /<Paragraph Alignment="Center" Type="Action">\s*<Text>THE END<\/Text>/);
    assert.deepEqual(types(parseFDX(xml).blocks), ['transition:FADE OUT.', 'centered:THE END']);
  });
  it('a left-aligned THE END in a Final Draft file comes in centered', () => {
    const xml = '<?xml version="1.0"?><FinalDraft><Content><Paragraph Type="Action"><Text>FADE OUT. THE END</Text></Paragraph></Content></FinalDraft>';
    assert.deepEqual(types(parseFDX(xml).blocks), ['transition:FADE OUT.', 'centered:THE END']);
  });
  it('is a first-class element on Alt+8; Enter after it goes to Action', () => {
    assert.equal(ELEMENT_TYPES[7], 'centered'); // Alt+8
    assert.equal(ELEMENT_META.centered.label, 'Centered');
    assert.equal(ENTER_NEXT.centered, 'action');
    assert.equal(SHORTCUTS['Alt+8'], 'Centered');
  });
});

describe('Format Doctor: false dialogue, unspaced cues, script endings', () => {
  const MONOLOGUE = "Here's where I have a problem. You come into my office, you sit in my chair, and you tell me the "
    + 'country is ready. Ready for what? The ports are closed, the roads to the south belong to men who were boys '
    + 'when I first ran for office, and every morning the price of rice climbs a little higher than the morning before. '
    + 'I have signed every paper you put in front of me--every one--and still the people in Martissant ask me where '
    + 'the money went. So no, I will not stand on that balcony and tell them to be patient. Not again. Not this time. '
    + 'If you want a speech, write one for yourself, and read it to the mothers waiting outside the gate.';

  it('never flags a long monologue after a valid cue', () => {
    assert.ok(MONOLOGUE.length > 600);
    const script = [B('c', 'character', "PRESIDENT MOÏSE (CONT'D)"), B('d', 'dialogue', MONOLOGUE)];
    assert.deepEqual(auditScript(script), []);
    assert.deepEqual(auditScript([B('c', 'character', 'MOÏSE'), B('d', 'dialogue', MONOLOGUE)]), [], 'no parenthetical needed');
  });
  it('never flags dialogue starting with "--" or an em-dash after a valid cue', () => {
    for (const cue of ['PATRICK (O.S.)', "PRESIDENT MOÏSE (CONT'D)", 'BOB', 'McCLANE', 'marie', 'THE MAN IN THE GREY HAT']) {
      for (const line of ['--and another thing.', '— and then he left.', '--', 'Wait--what?', 'I--I don’t know.']) {
        assert.deepEqual(auditScript([B('c', 'character', cue), B('d', 'dialogue', line)]), [], `${cue} / ${line}`);
      }
    }
    const longer = [B('c', 'character', 'BOB'), B('d1', 'dialogue', 'Wait.'), B('p', 'parenthetical', '(beat)'), B('d2', 'dialogue', '—and then he left.')];
    assert.deepEqual(auditScript(longer), []);
  });
  it('recognises a character-introduction pattern, case-sensitively on the name', () => {
    assert.ok(isCharacterIntro('FITO (10)--copper skin with curly hair, darts between the stalls.'));
    assert.ok(isCharacterIntro('MARIE (40s)—sharp-eyed, a ledger under one arm.'));
    assert.ok(isCharacterIntro('FITO--copper skin', new Set(['FITO'])), 'a known character, no age');
    for (const t of ['FITO--copper skin', 'Wait--what?', 'No--', '--and another thing.', 'I--I don’t know.', "Here's where I have a problem..."]) {
      assert.ok(!isCharacterIntro(t), t);
    }
  });
  it('flags a character introduction merged into a speech', () => {
    const script = [B('c', 'character', 'MARIE'), B('d', 'dialogue', 'FITO (10)--copper skin with curly hair, darts past.')];
    const issues = auditScript(script);
    assert.deepEqual(issues.map((i) => `${i.id}:${i.kind}:${i.to}`), ['d:falsedialogue:action']);
    assert.equal(ISSUE_KINDS.falsedialogue.fix, 'Make Action');
    assert.deepEqual(types(applyFixes(script, issues)), ['character:MARIE', 'action:FITO (10)--copper skin with curly hair, darts past.']);
  });
  it('flags an introduction split into a "cue" and a dash line, and folds it back into one Action', () => {
    const script = [B('c', 'character', 'FITO (10)'), B('d', 'dialogue', '--copper skin, bare feet--darts between the stalls.'), B('x', 'action', 'Marie follows.')];
    const issues = auditScript(script);
    assert.deepEqual(issues.map((i) => `${i.id}:${i.kind}`), ['d:falsedialogue']);
    const fixed = applyFixes(script, issues);
    assert.deepEqual(types(fixed), [`action:${FITO.replace('the market stalls', 'the stalls')}`, 'action:Marie follows.']);
    assert.equal(fixed[0].id, 'c');
    assert.deepEqual(auditScript(fixed), []);
  });
  it('still flags orphan dialogue with no cue above it', () => {
    const script = [B('a', 'action', 'The horn blares.'), B('d', 'dialogue', 'Who said that?')];
    assert.deepEqual(auditScript(script).map((i) => `${i.id}:${i.kind}`), ['d:orphan']);
  });

  it('flags a SUPER:/SUBTITLE: line run into Action and splits it out, keeping marks and the note', () => {
    const text = 'The village wakes.\nSUPER: PORT-AU-PRINCE, 1986\nSmoke rises.';
    const script = [B('a', 'action', text, { note: 'n', marks: { i: [[text.indexOf('Smoke'), text.indexOf('Smoke') + 5]] } })];
    const issues = auditScript(script);
    assert.deepEqual(issues.map((i) => i.kind), ['unspaced']);
    const fixed = applyFixes(script, issues);
    assert.deepEqual(types(fixed), ['action:The village wakes.', 'format_cue:SUPER: PORT-AU-PRINCE, 1986', 'action:Smoke rises.']);
    assert.equal(fixed[0].id, 'a');
    assert.equal(fixed[0].note, 'n');
    assert.deepEqual(fixed[2].marks, { i: [[0, 5]] });
    assert.equal(new Set(fixed.map((b) => b.id)).size, 3);
    assert.deepEqual(auditScript(fixed), []);
  });
  it('leaves a SUPER: that already stands on its own alone', () => {
    assert.deepEqual(auditScript([B('a', 'action', 'Dawn.'), B('s', 'format_cue', 'SUBTITLE: HELLO'), B('b', 'action', 'Night.')]), []);
  });

  it('flags THE END as left-aligned Action or a Transition, and centers it in one click', () => {
    const script = [B('t', 'transition', 'FADE OUT.'), B('e', 'action', 'THE END')];
    const issues = auditScript(script);
    assert.deepEqual(issues.map((i) => `${i.id}:${i.kind}:${i.to}`), ['e:ending:centered']);
    assert.equal(ISSUE_KINDS.ending.fix, 'Center ‘THE END’');
    assert.deepEqual(types(applyFixes(script, issues)), ['transition:FADE OUT.', 'centered:THE END']);
  });
  it('splits a combined "FADE OUT. THE END"', () => {
    const script = [B('a', 'action', 'She leaves.'), B('e', 'transition', 'FADE OUT. THE END')];
    const fixed = applyFixes(script, auditScript(script));
    assert.deepEqual(types(fixed), ['action:She leaves.', 'transition:FADE OUT.', 'centered:THE END']);
    assert.deepEqual(auditScript(fixed), []);
  });
});
