import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_CATEGORIES, excerpt, nameVariants, renameCharacter, renameCue, renamePreview, replaceName, revertRename, titleCase,
} from '../src/lib/renameCharacter.js';
import { analyzeScript } from '../src/lib/screenplay.js';

const B = (id, type, text, extra = {}) => ({ id, type, text, ...extra });
const V = (o, n) => nameVariants(o, n);
const r = (text, o = 'FITO', n = 'MARC') => replaceName(text, V(o, n)).text;

function project() {
  return {
    blocks: [
      B('s1', 'scene', "INT. FITO'S ROOM - NIGHT"),
      B('a1', 'action', 'FITO (10)--copper skin, bare feet--darts past. Fito grins.', { marks: { b: [[0, 4]] } }),
      B('c1', 'character', 'FITO (V.O.)'),
      B('d1', 'dialogue', 'Nobody catches Fito.'),
      B('c2', 'character', 'MARIE'),
      B('p2', 'parenthetical', '(to Fito)'),
      B('d2', 'dialogue', "Fito! Fito's bike is gone. FITO, now!", { note: 'Fito should flinch here' }),
      B('c3', 'character', "FITO (O.S.) (CONT'D)"),
      B('d3', 'dialogue', 'Coming!'),
      B('c4', 'character', 'FITO ^', { dual: true }),
      B('d4', 'dialogue', 'Me too.'),
      B('a2', 'action', 'A rose by the window. Fitness posters. AFITO, FITOS and JEAN-FITO stay.'),
    ],
    beats: [
      { id: 'b1', act: 0, title: 'Fito runs', synopsis: 'FITO is chased.', tag: 'plot' },
      { id: 'b2', act: 1, title: 'Midpoint', synopsis: 'Marie waits.', tag: 'plot' },
    ],
    characters: [
      { id: 'ch1', name: 'Fito', role: 'Witness', age: '10', traits: '', backstory: 'Fito grew up in Cité Soleil.' },
      { id: 'ch2', name: 'Marie', role: '', age: '', traits: 'Protective of Fito', backstory: '' },
    ],
    storyNotes: { version: 2, sections: [{ id: 'n1', title: 'Logline', body: 'A boy named Fito sees too much.' }, { id: 'n2', title: 'Tone', body: '' }] },
    storyDna: { genres: [], genreOther: '', theme: '', technique: { on: false, notes: '' }, foreshadowing: { on: true, notes: 'FITO hears the shot.' }, flashback: { on: false, notes: '' }, conflictType: '', answers: { protagonist: 'Fito' } },
  };
}

describe('rename: character cues keep their extensions', () => {
  it('swaps only the name', () => {
    assert.equal(renameCue('FITO', 'Marc'), 'MARC');
    assert.equal(renameCue('FITO (V.O.)', 'Marc'), 'MARC (V.O.)');
    assert.equal(renameCue("FITO (O.S.) (CONT'D)", 'Marc'), "MARC (O.S.) (CONT'D)");
    assert.equal(renameCue('FITO(V.O.)', 'Marc'), 'MARC (V.O.)');
    assert.equal(renameCue('FITO ^', 'Marc'), 'MARC ^');
    assert.equal(renameCue('@Fito', 'Marc'), '@MARC');
    assert.equal(renameCue('PRESIDENT MOÏSE (CONT’D)', 'President Jovenel'), 'PRESIDENT JOVENEL (CONT’D)');
  });
  it('renames every cue for that speaker, keeps dual dialogue, and the Tuner sees the new name', () => {
    const { project: p, counts } = renameCharacter(project(), 'FITO', 'Marc');
    const cues = p.blocks.filter((b) => b.type === 'character').map((b) => b.text);
    assert.deepEqual(cues, ['MARC (V.O.)', 'MARIE', "MARC (O.S.) (CONT'D)", 'MARC ^']);
    assert.equal(counts.cues, 3);
    assert.equal(p.blocks.find((b) => b.id === 'c4').dual, true);
    const names = analyzeScript(p.blocks).characterList.map((c) => c.name).sort();
    assert.deepEqual(names, ['MARC', 'MARIE']);
  });
});

describe('rename: dialogue mentions', () => {
  it('replaces whole-name mentions, keeping each one’s case', () => {
    const { project: p, counts } = renameCharacter(project(), 'FITO', 'Marc');
    const t = (id) => p.blocks.find((b) => b.id === id).text;
    assert.equal(t('d1'), 'Nobody catches Marc.');
    assert.equal(t('d2'), "Marc! Marc's bike is gone. MARC, now!");
    assert.equal(t('p2'), '(to Marc)');
    assert.equal(counts.dialogue, 5 + 1, 'four in dialogue, one parenthetical, one in a margin note');
    assert.equal(p.blocks.find((b) => b.id === 'd2').note, 'Marc should flinch here');
  });
});

describe('rename: action and description casing', () => {
  it('ALL CAPS stays ALL CAPS, Title Case stays Title Case — formatting moves with the text', () => {
    const { project: p } = renameCharacter(project(), 'FITO', 'Jean-Marc');
    const a1 = p.blocks.find((b) => b.id === 'a1');
    assert.equal(a1.text, 'JEAN-MARC (10)--copper skin, bare feet--darts past. Jean-Marc grins.');
    assert.deepEqual(a1.marks, { b: [[0, 9]] }, 'bold over the name now covers the longer name');
    assert.equal(p.blocks.find((b) => b.id === 's1').text, "INT. JEAN-MARC'S ROOM - NIGHT");
  });
  it('only the name as typed, ALL CAPS and Title Case match — never lower case', () => {
    assert.equal(r('Rose waits. ROSE runs. a rose wilts.', 'Rose', 'Lena'), 'Lena waits. LENA runs. a rose wilts.');
    assert.equal(titleCase("jovenel o'brien-moïse"), "Jovenel O'Brien-Moïse");
    assert.deepEqual(V('McClane', 'Gruber').map((v) => v.from).sort(), ['MCCLANE', 'McClane', 'Mcclane']);
    assert.equal(r('McClane and MCCLANE.', 'McClane', 'Gruber'), 'Gruber and GRUBER.');
  });
  it('multi-word names match across any spacing', () => {
    assert.equal(r('PRESIDENT  MOÏSE enters. President Moïse sits.', 'President Moïse', 'General Paul'), 'GENERAL PAUL enters. General Paul sits.');
  });
});

describe('rename: word boundaries', () => {
  it('never changes a longer word, a name inside a word, or part of a hyphenated name', () => {
    const { project: p } = renameCharacter(project(), 'FITO', 'Marc');
    assert.equal(p.blocks.find((b) => b.id === 'a2').text, 'A rose by the window. Fitness posters. AFITO, FITOS and JEAN-FITO stay.');
    assert.equal(r('FITOS fito_2 FITO2 Fito-Ray Ray-Fito'), 'FITOS fito_2 FITO2 Fito-Ray Ray-Fito');
  });
  it('allows punctuation, possessives, quotes and dashes around the name', () => {
    assert.equal(r('"Fito!" (FITO) Fito\'s, Fito’s --FITO-- Fito.'), '"Marc!" (MARC) Marc\'s, Marc’s --MARC-- Marc.');
  });
  it('handles accented names (no ASCII-only \\b)', () => {
    assert.equal(r('MOÏSE, Moïse. MOÏSES stays.', 'Moïse', 'Paul'), 'PAUL, Paul. MOÏSES stays.');
  });
});

describe('rename: Beat Board & Story Bible', () => {
  it('renames cards, bios (including the bio’s own name), notes and Story DNA', () => {
    const { project: p, counts } = renameCharacter(project(), 'FITO', 'Marc');
    assert.deepEqual(p.beats.map((b) => [b.title, b.synopsis]), [['Marc runs', 'MARC is chased.'], ['Midpoint', 'Marie waits.']]);
    assert.equal(p.characters[0].name, 'Marc');
    assert.equal(p.characters[0].backstory, 'Marc grew up in Cité Soleil.');
    assert.equal(p.characters[1].traits, 'Protective of Marc');
    assert.equal(p.storyNotes.sections[0].body, 'A boy named Marc sees too much.');
    assert.equal(p.storyDna.foreshadowing.notes, 'MARC hears the shot.');
    assert.equal(p.storyDna.answers.protagonist, 'Marc');
    assert.equal(counts.notes, 2 + 3 + 1 + 2);
  });
});

describe('rename: categories, immutability and undo', () => {
  it('each category can be switched off; counts are reported either way', () => {
    const before = project();
    const { project: p, counts, total } = renameCharacter(before, 'FITO', 'Marc', { ...ALL_CATEGORIES, dialogue: false, notes: false });
    assert.equal(p.blocks.find((b) => b.id === 'c1').text, 'MARC (V.O.)');
    assert.equal(p.blocks.find((b) => b.id === 'd1').text, 'Nobody catches Fito.');
    assert.equal(p.blocks.find((b) => b.id === 'd2').note, 'Fito should flinch here');
    assert.equal(p.beats, before.beats);
    assert.equal(p.characters, before.characters);
    assert.equal(p.storyNotes, before.storyNotes);
    assert.ok(counts.dialogue > 0 && counts.notes > 0);
    assert.equal(total, counts.cues + counts.action);
  });
  it('never mutates the input and reuses every untouched object', () => {
    const before = project();
    const frozen = JSON.stringify(before);
    const { project: p } = renameCharacter(before, 'FITO', 'Marc');
    assert.equal(JSON.stringify(before), frozen);
    assert.equal(p.blocks.find((b) => b.id === 'c2'), before.blocks.find((b) => b.id === 'c2'));
    assert.equal(p.beats[1], before.beats[1]);
  });
  it('same, empty or unknown names change nothing', () => {
    const before = project();
    assert.equal(renameCharacter(before, 'FITO', 'FITO ').total, 0);
    assert.equal(renameCharacter(before, 'FITO', 'fito').counts.cues, 0, 'cues are caps either way');
    assert.equal(renameCharacter(before, 'FITO', '').total, 0);
    assert.equal(renameCharacter(before, 'ZED', 'Marc').total, 0);
  });
  it('undo puts back only what the rename changed — later edits survive — and redo reapplies', () => {
    const before = project();
    const { project: after, changed } = renameCharacter(before, 'FITO', 'Marc');
    // The writer edits another beat after renaming.
    const edited = { ...after, beats: [after.beats[0], { ...after.beats[1], title: 'Midpoint (edited)' }] };
    const undone = revertRename(edited, changed, 'undo');
    assert.equal(undone.beats[0], before.beats[0]);
    assert.equal(undone.beats[1].title, 'Midpoint (edited)');
    assert.equal(undone.characters[0], before.characters[0]);
    assert.equal(undone.storyNotes.sections[0], before.storyNotes.sections[0]);
    assert.equal(undone.storyDna, before.storyDna);
    const redone = revertRename({ ...edited, ...undone }, changed, 'redo');
    assert.equal(redone.beats[0], after.beats[0]);
    assert.equal(redone.characters[0].name, 'Marc');
  });
  it('previews a few before → after lines per category', () => {
    const pv = renamePreview(project(), 'FITO', 'Marc');
    assert.deepEqual(pv.cues[0], { before: 'FITO (V.O.)', after: 'MARC (V.O.)' });
    assert.ok(pv.dialogue.length && pv.action.length && pv.notes.length);
  });
  it('trims long previews around the change', () => {
    const long = 'Rows of bolted benches. A radio crackles weather warnings in two languages. Fito drops beside her.';
    const ex = excerpt(long, long.replace('Fito', 'Marc'));
    assert.ok(ex.before.startsWith('…') && ex.before.includes('Fito drops'), ex.before);
    assert.ok(ex.after.includes('Marc drops'));
    assert.deepEqual(excerpt('FITO', 'MARC'), { before: 'FITO', after: 'MARC' });
  });
});
