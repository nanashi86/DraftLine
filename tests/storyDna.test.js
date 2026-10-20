import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeIndexedDB, createFakeStorage } from './helpers/fakeIndexedDB.js';
import {
  CONFLICT_TYPES, DNA_QUESTIONS, DNA_TOGGLES, GENRES, emptyStoryDna, genresFromText, matchConflictType,
  normalizeStoryDna, setAnswer, setField, setToggle, storyDnaProgress, toggleGenre,
} from '../src/lib/storyDna.js';
import { BIBLE_TABS, DEFAULT_BIBLE_TAB, bibleTabBadge } from '../src/lib/bible.js';
import { closeDock, dockFromPrefs, openDock, toggleDock } from '../src/lib/dock.js';
import {
  STRUCTURE_DICTIONARY, dictionaryEntry, mergeDictionary, searchDictionary,
} from '../src/lib/structureDictionary.js';
import { DICTIONARY_KEY, bootLibrary, createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { SHORTCUTS, SHORTCUT_SECTIONS, keycaps } from '../src/lib/shortcuts.js';
import { makeBlock } from '../src/lib/screenplay.js';

describe('Story DNA', () => {
  it('has the eight narrative questions in order, each tied to a dictionary term', () => {
    assert.deepEqual(DNA_QUESTIONS.map((q) => q.label), [
      'Protagonist', 'Inciting Incident', 'Goal / Desire', 'Flaw', 'Conflict / Debate', 'Rising Action', 'Climax', 'Falling Action',
    ]);
    for (const q of DNA_QUESTIONS) assert.ok(dictionaryEntry(STRUCTURE_DICTIONARY, q.dict), q.dict);
    assert.deepEqual(DNA_TOGGLES.map((t) => t.label), ['Special Plot Technique', 'Foreshadowing', 'Flashback']);
  });
  it('offers the six conflict types', () => {
    assert.deepEqual(CONFLICT_TYPES, [
      'Individual vs. Individual', 'Individual vs. Nature', 'Individual vs. Society',
      'Individual vs. Technology', 'Individual vs. Supernatural', 'Individual vs. Self',
    ]);
  });
  it('edits immutably and counts answered questions', () => {
    let d = emptyStoryDna();
    d = setAnswer(d, 'protagonist', 'Marie, 45, who left Haiti at 10.');
    d = setField(d, 'conflictType', 'Individual vs. Society');
    d = setToggle(d, 'flashback', { on: true, notes: '1986 Jacmel' });
    assert.equal(storyDnaProgress(d), 1);
    assert.equal(emptyStoryDna().answers.protagonist, '');
    assert.deepEqual(d.flashback, { on: true, notes: '1986 Jacmel' });
  });
  it('migrates missing or older shapes into a complete blueprint', () => {
    assert.deepEqual(normalizeStoryDna(undefined), emptyStoryDna());
    const old = normalizeStoryDna({ genre: 'Drama', flashback: true, foreshadowing: 'the ferry horn', climax: 'She turns back.', conflictType: 'man vs. self' });
    assert.deepEqual(old.genres, ['Drama']);
    assert.equal('genre' in old, false);
    assert.deepEqual(old.flashback, { on: true, notes: '' });
    assert.deepEqual(old.foreshadowing, { on: true, notes: 'the ferry horn' });
    assert.equal(old.answers.climax, 'She turns back.');
    assert.equal(old.conflictType, 'Individual vs. Self');
    assert.equal(matchConflictType('nonsense'), '');
  });
  it('persists in the project record and switches with the project', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const dna = setAnswer(setField(emptyStoryDna(), 'theme', 'Home is a choice'), 'goal', 'Get Theo off the island');
    const a = await store.saveActiveProject({ meta: { title: 'A' }, blocks: [makeBlock('scene', 'X')], storyDna: dna });
    const b = await store.saveActiveProject({ meta: { title: 'B' }, blocks: [makeBlock('scene', 'Y')] });
    assert.deepEqual(toDoc(await store.getProject(a.id)).storyDna, dna);
    assert.deepEqual(toDoc(await store.getProject(b.id)).storyDna, emptyStoryDna());
    const legacy = { ...(await store.getProject(b.id)) };
    delete legacy.storyDna; // a record saved before Story DNA existed
    assert.deepEqual(toDoc(legacy).storyDna, emptyStoryDna());
  });
});

describe('Genre checklist', () => {
  it('has the 13 options, in order', () => {
    assert.deepEqual(GENRES, [
      'Drama', 'Thriller', 'Crime', 'Horror', 'Comedy', 'Action', 'Adventure', 'Romance', 'Fantasy',
      'Science Fiction', 'Western', 'Noire', 'Other',
    ]);
  });
  it('ticks and unticks genres, kept in checklist order', () => {
    let d = emptyStoryDna();
    d = toggleGenre(toggleGenre(toggleGenre(d, 'Thriller', true), 'Drama', true), 'Other', true);
    assert.deepEqual(d.genres, ['Drama', 'Thriller', 'Other']);
    d = toggleGenre(d, 'Thriller', false);
    assert.deepEqual(d.genres, ['Drama', 'Other']);
  });
  it('an old single-text genre becomes checkboxes (unknown words go to Other)', () => {
    assert.deepEqual(genresFromText('Political drama · thriller'), { genres: ['Thriller', 'Other'], genreOther: 'Political drama' });
    assert.deepEqual(genresFromText('Sci-Fi / noir and Horror'), { genres: ['Horror', 'Science Fiction', 'Noire'], genreOther: '' });
    assert.deepEqual(normalizeStoryDna({ genre: 'Crime, Western' }).genres, ['Crime', 'Western']);
    assert.deepEqual(normalizeStoryDna({ genres: ['Western', 'bogus', 'Drama'] }).genres, ['Drama', 'Western']);
  });
  it('persists as an array on the project record', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const dna = setField(toggleGenre(toggleGenre(emptyStoryDna(), 'Horror', true), 'Other', true), 'genreOther', 'Folk tale');
    const rec = await store.saveActiveProject({ meta: { title: 'Run!' }, blocks: [makeBlock('scene', 'X')], storyDna: dna });
    const back = toDoc(await store.getProject(rec.id)).storyDna;
    assert.deepEqual([back.genres, back.genreOther], [['Horror', 'Other'], 'Folk tale']);
    // a record saved with the old single field still loads
    const legacy = { ...(await store.getProject(rec.id)), storyDna: { genre: 'Horror' } };
    assert.deepEqual(toDoc(legacy).storyDna.genres, ['Horror']);
  });
});

describe('Story Bible tabs', () => {
  it('Story DNA first (and the default), then Character Bios, then Story Notes', () => {
    assert.deepEqual(BIBLE_TABS.map((t) => t.label), ['Story DNA', 'Character Bios', 'Story Notes']);
    assert.equal(DEFAULT_BIBLE_TAB, 'dna');
  });
  it('Character Bios shows the character count; Story Notes has no word-count badge', () => {
    assert.equal(bibleTabBadge('characters', { characters: [{}] }), '1');
    assert.equal(bibleTabBadge('notes', { characters: [{}] }), null);
    assert.equal(bibleTabBadge('dna', { dnaAnswered: 3, dnaTotal: 8 }), '3/8');
  });
});

describe('right dock (Dialogue / Story Bible)', () => {
  it('holds one panel: opening the Story Bible closes Dialogue and vice versa', () => {
    assert.equal(toggleDock('tuner', 'bible'), 'bible');
    assert.equal(toggleDock('bible', 'tuner'), 'tuner');
    assert.equal(openDock('tuner', 'bible'), 'bible');
  });
  it('toggling the open panel closes it; closing the other panel changes nothing', () => {
    assert.equal(toggleDock('bible', 'bible'), null);
    assert.equal(closeDock('bible', 'tuner'), 'bible');
    assert.equal(closeDock('bible', 'bible'), null);
  });
  it('reads older prefs (tunerOpen) and new ones (dock)', () => {
    assert.equal(dockFromPrefs({}), 'tuner');
    assert.equal(dockFromPrefs({ tunerOpen: false }), null);
    assert.equal(dockFromPrefs({ dock: 'bible', tunerOpen: false }), 'bible');
    assert.equal(dockFromPrefs({ dock: null, tunerOpen: true }), null);
  });
});

describe('Structure Dictionary', () => {
  it('has the 11 terms, in order, with the conflict types and the text/subtext example', () => {
    assert.deepEqual(STRUCTURE_DICTIONARY.map((e) => e.term), [
      'Protagonist', 'Inciting Incident', 'Goal / Desire', 'Flaw', 'Conflict / Debate', 'Rising Action', 'Climax',
      'Falling Action', 'Text / Subtext / Context', 'Foreshadowing', 'Flashback',
    ]);
    assert.deepEqual(dictionaryEntry(STRUCTURE_DICTIONARY, 'conflict').items.map((i) => i.term), CONFLICT_TYPES);
    assert.match(dictionaryEntry(STRUCTURE_DICTIONARY, 'textSubtext').example, /gun/);
    assert.match(dictionaryEntry(STRUCTURE_DICTIONARY, 'textSubtext').example, /drink/);
  });
  it('your own wording replaces the starter text, and Reset brings the starter back', () => {
    const merged = mergeDictionary({ flaw: { definition: 'My teacher’s exact words.' } });
    assert.equal(dictionaryEntry(merged, 'flaw').definition, 'My teacher’s exact words.');
    assert.equal(dictionaryEntry(merged, 'flaw').starter, false);
    assert.equal(dictionaryEntry(merged, 'climax').starter, true);
    assert.equal(dictionaryEntry(mergeDictionary({}), 'flaw').definition, dictionaryEntry(STRUCTURE_DICTIONARY, 'flaw').definition);
  });
  it('searches terms, definitions, examples and conflict types', () => {
    assert.deepEqual(searchDictionary(STRUCTURE_DICTIONARY, 'supernatural').map((e) => e.id), ['conflict']);
    assert.deepEqual(searchDictionary(STRUCTURE_DICTIONARY, 'GUN').map((e) => e.id), ['textSubtext']);
    assert.equal(searchDictionary(STRUCTURE_DICTIONARY, '  ').length, 11);
  });
  it('your wording is kept library-wide and loaded at start-up', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    await store.setSetting(DICTIONARY_KEY, { flaw: { definition: 'Mine.' } });
    const boot = await bootLibrary({ store, storage: createFakeStorage(), makeFirstDoc: () => ({ meta: {}, blocks: [makeBlock('scene', 'X')], beats: [] }) });
    assert.deepEqual(boot.dictionary, { flaw: { definition: 'Mine.' } });
  });
});

describe('keyboard shortcuts dialog', () => {
  it('lists Projects, Bible, margin notes and clear formatting', () => {
    assert.match(SHORTCUTS['Alt+P'], /Projects drawer/);
    assert.match(SHORTCUTS['Alt+I'], /^Story Bible/);
    assert.match(SHORTCUTS['Alt+T'], /^Dialogue\b/);
    assert.match(SHORTCUTS['Alt+N'], /Margin ScriptNote/);
    assert.match(SHORTCUTS['Ctrl+\\'], /Clear formatting/);
  });
  it('covers Alt+1…8 elements and the four formatting keys', () => {
    for (let i = 1; i <= 8; i++) assert.ok(SHORTCUTS[`Alt+${i}`], `Alt+${i}`);
    for (const k of ['Ctrl+B', 'Ctrl+I', 'Ctrl+U', 'Ctrl+Shift+X']) assert.ok(SHORTCUTS[k], k);
  });
  it('never lists one combo twice', () => {
    const all = SHORTCUT_SECTIONS.flatMap((s) => s.rows.map(([c]) => c));
    assert.equal(new Set(all).size, all.length);
  });
  it('renders keycaps, with Mac symbols on a Mac', () => {
    assert.deepEqual(keycaps('Ctrl+Shift+X'), ['Ctrl', 'Shift', 'X']);
    assert.deepEqual(keycaps('Ctrl+Shift+X', true), ['⌘', '⇧', 'X']);
    assert.deepEqual(keycaps('Ctrl+\\'), ['Ctrl', '\\']);
    assert.deepEqual(keycaps('Alt+I', true), ['⌥', 'I']);
  });
});
