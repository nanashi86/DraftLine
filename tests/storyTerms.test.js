import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONFLICT_LEVELS, CONFLICT_TYPES, matchConflictType, DNA_QUESTIONS, PLOT_DEVICES, addDevice, availableDevices, deviceInfo, normalizeStoryDna, plotDeviceLayout, removeDevice, storyDnaProgress,
} from '../src/lib/storyDna.js';
import { STRUCTURE_DICTIONARY, dictionaryEntry, mergeDictionary } from '../src/lib/structureDictionary.js';

// The Story DNA wording moved to screenwriting terms. Saved answers, devices and the writer's own
// glossary wording must all land exactly where they were.
describe('Story DNA: the renamed questions keep every saved answer in place', () => {
  const saved = {
    answers: {
      protagonist: 'Marie', incitingIncident: 'The letter', goal: 'Get off the island', flaw: 'Trusts no one',
      conflict: 'Augustin won’t sail', risingAction: 'She bribes the crew', climax: 'The storm sinks the plan', fallingAction: 'She steers it herself',
    },
    conflictType: 'Individual vs. Nature',
  };
  const dna = normalizeStoryDna(saved);
  const byLabel = Object.fromEntries(DNA_QUESTIONS.map((q) => [q.label, { question: q.question, answer: dna.answers[q.key] }]));

  it('each answer is still under the question it was written for', () => {
    assert.deepEqual(byLabel['All Is Lost / Crisis'], { question: 'Why doesn’t that work?', answer: 'The storm sinks the plan' });
    assert.deepEqual(byLabel['Climax / Resolution'], { question: 'How does it end?', answer: 'She steers it herself' });
    assert.deepEqual(byLabel['Complications'], { question: 'What did they do about it?', answer: 'She bribes the crew' });
    assert.deepEqual(byLabel['Conflict / Obstacle'], { question: 'Why can’t they get it?', answer: 'Augustin won’t sail' });
    assert.equal(storyDnaProgress(dna), 8, 'still eight of eight');
    assert.equal(dna.conflictType, 'Individual vs. Nature', 'conflict types are unchanged');
  });
  it('card titles are plain or slash-separated, with no parentheses', () => {
    for (const q of DNA_QUESTIONS) assert.ok(!/[()]/.test(q.label), q.label);
    assert.deepEqual(DNA_QUESTIONS.slice(5).map((q) => q.label), ['Complications', 'All Is Lost / Crisis', 'Climax / Resolution']);
  });
  it('the storage keys did not move (only labels and glossary links changed)', () => {
    assert.deepEqual(DNA_QUESTIONS.map((q) => q.key), ['protagonist', 'incitingIncident', 'goal', 'flaw', 'conflict', 'risingAction', 'climax', 'fallingAction']);
    assert.deepEqual(DNA_QUESTIONS.map((q) => q.question), [
      'Who is it about?', 'What happens that starts the story?', 'What do they want?', 'What must they overcome to get it?',
      'Why can’t they get it?', 'What did they do about it?', 'Why doesn’t that work?', 'How does it end?',
    ]);
  });
  it('each question’s ⓘ opens the term that matches it now', () => {
    const dict = Object.fromEntries(DNA_QUESTIONS.map((q) => [q.label, dictionaryEntry(STRUCTURE_DICTIONARY, q.dict).term]));
    assert.equal(dict['Complications'], 'Complications');
    assert.equal(dict['All Is Lost / Crisis'], 'All Is Lost / Crisis');
    assert.equal(dict['Climax / Resolution'], 'Climax');
    assert.equal(dict['Conflict / Obstacle'], 'Conflict / Obstacle');
    assert.match(dictionaryEntry(STRUCTURE_DICTIONARY, 'climax').definition, /after the crisis/);
  });
});

describe('Plot Devices: Ticking Clock replaces Deus ex machina, without losing a saved one', () => {
  it('the picklist offers Ticking Clock and no longer offers Deus ex machina', () => {
    assert.ok(PLOT_DEVICES.some((d) => d.id === 'tickingClock'));
    assert.ok(!PLOT_DEVICES.some((d) => d.id === 'deusExMachina'));
    assert.equal(addDevice(normalizeStoryDna({}), 'deusExMachina').devices.length, 2, 'it can’t be added any more');
  });
  it('a script that already used Deus ex machina keeps the row, its Yes / No and its notes', () => {
    const dna = normalizeStoryDna({ devices: [{ id: 'deusExMachina', on: true, notes: 'The coast guard arrives' }] });
    assert.deepEqual(dna.devices.find((d) => d.id === 'deusExMachina'), { id: 'deusExMachina', on: true, notes: 'The coast guard arrives' });
    const row = plotDeviceLayout(dna).find((r) => r.id === 'deusExMachina');
    assert.equal(row.info.label, 'Deus ex machina');
    assert.ok(row.removable);
    assert.equal(deviceInfo('deusExMachina').dict, 'deusExMachina', 'its ⓘ still opens the term');
    assert.ok(!availableDevices(dna).some((d) => d.id === 'deusExMachina'));
    assert.ok(!removeDevice(dna, 'deusExMachina').devices.some((d) => d.id === 'deusExMachina'), 'and it can be removed');
  });
});

describe('Glossary: the new and reworded craft terms', () => {
  it('adds Crisis, Ticking Clock, Want vs. Need, Midpoint, Stakes, Setup & Payoff and B-Story', () => {
    for (const id of ['crisis', 'tickingClock', 'wantNeed', 'midpoint', 'stakes', 'setupPayoff', 'bStory']) {
      assert.ok(dictionaryEntry(STRUCTURE_DICTIONARY, id)?.definition.length > 80, id);
    }
  });
  it('renames the terms but keeps their ids, so a writer’s own wording stays on the same entry', () => {
    const mine = mergeDictionary({ fallingAction: { definition: 'My teacher’s wording.' }, conflict: { definition: 'Mine too.' } });
    assert.equal(dictionaryEntry(mine, 'fallingAction').term, 'Resolution / Falling Action');
    assert.equal(dictionaryEntry(mine, 'fallingAction').definition, 'My teacher’s wording.');
    assert.equal(dictionaryEntry(mine, 'conflict').term, 'Conflict / Obstacle');
    assert.equal(dictionaryEntry(mine, 'risingAction').term, 'Complications');
  });
  it('Deus ex machina reads as a warning; Catalyst explains its Save the Cat meaning; Conflict maps to McKee’s three levels', () => {
    assert.match(dictionaryEntry(STRUCTURE_DICTIONARY, 'deusExMachina').definition, /Something to avoid rather than plan/);
    assert.match(dictionaryEntry(STRUCTURE_DICTIONARY, 'catalyst').definition, /Save the Cat/);
    assert.match(dictionaryEntry(STRUCTURE_DICTIONARY, 'conflict').definition, /Inner \(against yourself\), Personal .*the Wider World/);
  });
});

describe('Conflict types grouped under McKee’s three levels', () => {
  const ui = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
  it('Inner, Personal and Wider World hold the six types, each exactly once', () => {
    assert.deepEqual(CONFLICT_LEVELS.map((l) => [l.group, l.types]), [
      ['Inner Conflict', ['Individual vs. Self']],
      ['Personal Conflict', ['Individual vs. Individual']],
      ['Wider World Conflict', ['Individual vs. Society', 'Individual vs. Nature', 'Individual vs. Technology', 'Individual vs. Supernatural']],
    ]);
    const all = CONFLICT_LEVELS.flatMap((l) => l.types);
    assert.equal(new Set(all).size, 6);
    assert.deepEqual([...all].sort(), [...CONFLICT_TYPES].sort());
  });
  it('stored values are unchanged: older scripts and loose spellings still load to the same type', () => {
    assert.deepEqual(CONFLICT_TYPES, [
      'Individual vs. Individual', 'Individual vs. Nature', 'Individual vs. Society', 'Individual vs. Technology', 'Individual vs. Supernatural', 'Individual vs. Self',
    ]);
    assert.equal(normalizeStoryDna({ conflictType: 'Individual vs. Technology' }).conflictType, 'Individual vs. Technology');
    assert.equal(matchConflictType('man vs. nature'), 'Individual vs. Nature');
    assert.equal(matchConflictType('vs self'), 'Individual vs. Self');
  });
  it('the picker wraps its options in one <optgroup> per level; each option’s value is the type itself', () => {
    assert.match(ui, /<option value="">Type of conflict…<\/option>\s*\{CONFLICT_LEVELS\.map\(\(lv\) => \(\s*<optgroup key=\{lv\.id\} label=\{lv\.group\}>\s*\{lv\.types\.map\(\(t\) => <option key=\{t\} value=\{t\}>\{t\}<\/option>\)\}\s*<\/optgroup>/);
  });
  it('the Glossary nests the six types under Inner, Personal and Wider World, matching the picker', () => {
    const items = dictionaryEntry(STRUCTURE_DICTIONARY, 'conflict').items;
    const byLevel = CONFLICT_LEVELS.map((l) => [l.level, items.filter((it) => it.level === l.level).map((it) => it.term)]);
    assert.deepEqual(byLevel, CONFLICT_LEVELS.map((l) => [l.level, l.types]));
    assert.equal(items.length, 6);
    assert.match(ui, /<li key=\{level\} className="dict-item-group">\s*<b>\{level\}<\/b>\s*<ul className="dict-items">/);
    assert.match(ui, /return level \? `\$\{level\}: \$\{terms\}` : terms;/, 'the ⓘ tooltip groups them too');
  });
});
