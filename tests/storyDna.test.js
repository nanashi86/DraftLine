import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeIndexedDB, createFakeStorage } from './helpers/fakeIndexedDB.js';
import {
  CONFLICT_TYPES, DNA_QUESTIONS, GENRES, PLOT_DEVICES, addDevice, emptyStoryDna, genresFromText, matchConflictType,
  normalizeStoryDna, setAnswer, setDevice, setField, storyDnaProgress, toggleGenre,
  DEFAULT_DEVICES, plotDeviceLayout, removeDevice,
} from '../src/lib/storyDna.js';
import { BIBLE_TABS, CHARACTER_TABS, DEFAULT_BIBLE_TAB, DEFAULT_CHARACTER_TAB, bibleTabBadge } from '../src/lib/bible.js';
import { DOCK_PANELS, characterTabFromPrefs, closeDock, dockFromPrefs, openDock, toggleDock } from '../src/lib/dock.js';
import {
  STRUCTURE_DICTIONARY, dictionaryEntry, mergeDictionary, searchDictionary,
} from '../src/lib/structureDictionary.js';
import { DICTIONARY_KEY, bootLibrary, createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { SHORTCUTS, SHORTCUT_SECTIONS, keycaps } from '../src/lib/shortcuts.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { readFileSync } from 'node:fs';

describe('Story DNA', () => {
  it('has the eight narrative questions in order, each tied to a dictionary term', () => {
    assert.deepEqual(DNA_QUESTIONS.map((q) => q.label), [
      'Protagonist', 'Inciting Incident', 'Goal / Desire', 'Flaw', 'Conflict / Debate', 'Rising Action', 'Climax', 'Falling Action',
    ]);
    for (const q of DNA_QUESTIONS) assert.ok(dictionaryEntry(STRUCTURE_DICTIONARY, q.dict), q.dict);
    for (const d of PLOT_DEVICES) assert.ok(dictionaryEntry(STRUCTURE_DICTIONARY, d.dict), d.dict);
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
    d = setDevice(d, 'flashback', { on: true, notes: '1986 Jacmel' });
    assert.equal(storyDnaProgress(d), 1);
    assert.equal(emptyStoryDna().answers.protagonist, '');
    assert.deepEqual(d.devices, [{ id: 'foreshadowing', on: false, notes: '' }, { id: 'flashback', on: true, notes: '1986 Jacmel' }]);
    assert.equal(emptyStoryDna().devices[1].on, false, 'the original is untouched');
  });
  it('migrates missing or older shapes into a complete blueprint', () => {
    assert.deepEqual(normalizeStoryDna(undefined), emptyStoryDna());
    const old = normalizeStoryDna({ genre: 'Drama', flashback: true, foreshadowing: 'the ferry horn', climax: 'She turns back.', conflictType: 'man vs. self' });
    assert.deepEqual(old.genres, ['Drama']);
    assert.equal('genre' in old, false);
    assert.deepEqual(old.devices, [{ id: 'foreshadowing', on: true, notes: 'the ferry horn' }, { id: 'flashback', on: true, notes: '' }]);
    assert.equal('flashback' in old, false, 'the old fixed toggles are gone from the shape');
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

describe('Genre pills', () => {
  it('has the 13 options, in order — Noir spelt right', () => {
    assert.deepEqual(GENRES, [
      'Drama', 'Thriller', 'Crime', 'Horror', 'Comedy', 'Action', 'Adventure', 'Romance', 'Fantasy',
      'Science Fiction', 'Western', 'Noir', 'Other',
    ]);
  });
  it('projects saved with the old "Noire" spelling load as Noir', () => {
    assert.deepEqual(normalizeStoryDna({ genres: ['Noire', 'Crime'] }).genres, ['Crime', 'Noir']);
    assert.deepEqual(genresFromText('noire').genres, ['Noir']);
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
    assert.deepEqual(genresFromText('Sci-Fi / noir and Horror'), { genres: ['Horror', 'Science Fiction', 'Noir'], genreOther: '' });
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

describe('drawer tabs', () => {
  it('Story Bible: DNA (the default), then Notes', () => {
    assert.deepEqual(BIBLE_TABS.map((t) => [t.id, t.label]), [['dna', 'DNA'], ['notes', 'Notes']]);
    assert.equal(DEFAULT_BIBLE_TAB, 'dna');
  });
  it('Characters: Bios (the default), then Dialogue', () => {
    assert.deepEqual(CHARACTER_TABS.map((t) => [t.id, t.label]), [['bios', 'Bios'], ['dialogue', 'Dialogue']]);
    assert.equal(DEFAULT_CHARACTER_TAB, 'bios');
  });
  it('labels stay one short word so they never wrap; tooltips carry the detail', () => {
    for (const t of [...BIBLE_TABS, ...CHARACTER_TABS]) {
      assert.match(t.label, /^\S{1,8}$/, t.label);
      assert.ok(t.title.length > t.label.length, t.id);
    }
    assert.equal(BIBLE_TABS[0].title, 'Blueprint & Glossary');
  });
  it('badges: DNA progress, bio count, speaking characters; Notes has none', () => {
    assert.equal(bibleTabBadge('dna', { dnaAnswered: 3, dnaTotal: 8 }), '3/8');
    assert.equal(bibleTabBadge('bios', { characters: [{}] }), '1');
    assert.equal(bibleTabBadge('dialogue', { speakers: ['MARIE', 'THEO'] }), '2');
    assert.equal(bibleTabBadge('notes', { characters: [{}] }), null);
  });
});

describe('right dock (Story Bible / Characters)', () => {
  it('holds one drawer: opening Characters closes the Story Bible and vice versa', () => {
    assert.deepEqual(DOCK_PANELS, ['bible', 'characters', 'snapshots', 'notes']);
    assert.equal(dockFromPrefs({ dock: 'snapshots' }), null, 'Snapshots / Notes don’t reopen on load');
    assert.equal(dockFromPrefs({ dock: 'notes' }), null);
    assert.equal(toggleDock('characters', 'bible'), 'bible');
    assert.equal(toggleDock('bible', 'characters'), 'characters');
    assert.equal(openDock('characters', 'bible'), 'bible');
  });
  it('toggling the open drawer closes it; closing the other changes nothing', () => {
    assert.equal(toggleDock('bible', 'bible'), null);
    assert.equal(closeDock('bible', 'characters'), 'bible');
    assert.equal(closeDock('bible', 'bible'), null);
  });
  it('reads every older pref: the Dialogue drawer ("tuner", tunerOpen) now opens Characters → Dialogue', () => {
    assert.equal(dockFromPrefs({}), 'characters');
    assert.equal(dockFromPrefs({ tunerOpen: false }), null);
    assert.equal(dockFromPrefs({ dock: 'tuner' }), 'characters');
    assert.equal(dockFromPrefs({ dock: 'bible', tunerOpen: false }), 'bible');
    assert.equal(dockFromPrefs({ dock: null, tunerOpen: true }), null);
    assert.equal(dockFromPrefs({ dock: 'characters' }), 'characters');
    assert.equal(characterTabFromPrefs({}), 'dialogue');
    assert.equal(characterTabFromPrefs({ dock: 'tuner' }), 'dialogue');
    assert.equal(characterTabFromPrefs({ dock: 'bible' }), 'bios');
    assert.equal(characterTabFromPrefs({ dock: 'characters', characterTab: 'bios' }), 'bios');
    assert.equal(characterTabFromPrefs({ dock: null, characterTab: 'dialogue' }), 'dialogue');
  });
});

describe('Story Glossary', () => {
  it('has the 31 terms, in order — story terms, plot devices, then character roles — with the conflict types and the text/subtext example', () => {
    assert.deepEqual(STRUCTURE_DICTIONARY.map((e) => e.term), [
      'Protagonist', 'Inciting Incident', 'Goal / Desire', 'Flaw', 'Conflict / Debate', 'Rising Action', 'Climax',
      'Falling Action', 'Text / Subtext / Context', 'Foreshadowing', 'Flashback',
      'Deus ex machina', 'MacGuffin', 'Quest', 'Cliffhanger', 'Red herring', 'Love triangle',
      'Antagonist', 'Deuteragonist', 'Tritagonist', 'Supporting Character', 'Minor Character / Cameo', 'Foil', 'Catalyst',
      'Mentor', 'Confidant(e)', 'Love Interest', 'Skeptic / Voice of Reason', 'Henchman / Enforcer', 'Threshold Guardian', 'Shadow',
    ]);
    for (const e of STRUCTURE_DICTIONARY) assert.ok(e.definition.length > 40, `${e.term} has a real definition`);
    assert.equal(new Set(STRUCTURE_DICTIONARY.map((e) => e.id)).size, 31);
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
    assert.equal(searchDictionary(STRUCTURE_DICTIONARY, '  ').length, 31);
    assert.deepEqual(searchDictionary(STRUCTURE_DICTIONARY, 'false clue').map((e) => e.id), ['redHerring']);
    assert.deepEqual(searchDictionary(STRUCTURE_DICTIONARY, 'deus').map((e) => e.id), ['deusExMachina']);
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
    assert.match(SHORTCUTS['Alt+C'], /^Characters \(Bios · Dialogue\)/);
    assert.match(SHORTCUTS['Alt+T'], /^Characters → Dialogue/);
    assert.match(SHORTCUTS['Alt+N'], /Margin note for this line \(quotes any selected words\)/);
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

describe('Plot Devices: defaults and layout', () => {
  const OFF = [{ id: 'foreshadowing', on: false, notes: '' }, { id: 'flashback', on: false, notes: '' }];

  it('a new script starts with Foreshadowing and Flashback, both No (enabled: false)', () => {
    assert.deepEqual(DEFAULT_DEVICES, ['foreshadowing', 'flashback']);
    assert.deepEqual(emptyStoryDna().devices, OFF);
  });

  it('any script loading without explicit devices gets them back, set to No', () => {
    for (const raw of [undefined, null, {}, { devices: [] }, { devices: 'junk' }, { theme: 'Home' }]) {
      assert.deepEqual(normalizeStoryDna(raw).devices, OFF, JSON.stringify(raw));
    }
    const project = toDoc({ id: 'p', title: 'Old', script: [makeBlock('scene')], storyDna: { theme: 'x', devices: [] } });
    assert.deepEqual(project.storyDna.devices, OFF);
  });

  it('stored values for the defaults are kept; the defaults always lead the list', () => {
    const d = normalizeStoryDna({ devices: [{ id: 'redHerring', on: true, notes: 'bike' }, { id: 'flashback', on: true, notes: '1986' }] });
    assert.deepEqual(d.devices, [
      { id: 'foreshadowing', on: false, notes: '' },
      { id: 'flashback', on: true, notes: '1986' },
      { id: 'redHerring', on: true, notes: 'bike' },
    ]);
  });

  it('new devices append beneath Flashback, in the order added', () => {
    let d = addDevice(emptyStoryDna(), 'macguffin');
    d = addDevice(d, 'redHerring');
    assert.deepEqual(d.devices.map((x) => x.id), ['foreshadowing', 'flashback', 'macguffin', 'redHerring']);
  });

  it('the defaults can be set to No but not removed', () => {
    const d = setDevice(emptyStoryDna(), 'foreshadowing', { on: true, notes: 'horn' });
    const r = removeDevice(d, 'foreshadowing');
    assert.deepEqual(r.devices[0], { id: 'foreshadowing', on: false, notes: 'horn' });
    assert.equal(r.devices.length, 2);
  });

  it('collapsed until Yes: rows set to No with no notes show no notes box', () => {
    const rows = plotDeviceLayout(emptyStoryDna()).filter((x) => x.kind === 'device');
    assert.deepEqual(rows.map((r) => [r.id, r.on, r.expanded, r.removable]), [
      ['foreshadowing', false, false, false], ['flashback', false, false, false],
    ]);
    const on = plotDeviceLayout(setDevice(emptyStoryDna(), 'flashback', { on: true }));
    assert.equal(on[1].expanded, true);
  });

  it('the add-device control comes after (below) every device row', () => {
    let d = emptyStoryDna();
    for (const id of [null, 'macguffin', 'redHerring']) {
      if (id) d = addDevice(d, id);
      const layout = plotDeviceLayout(d);
      const last = layout[layout.length - 1];
      assert.equal(last.kind, 'add');
      assert.equal(layout.filter((x) => x.kind === 'add').length, 1);
      assert.deepEqual(layout.slice(0, -1).map((x) => x.id), d.devices.map((x) => x.id));
      assert.ok(!last.options.some((o) => d.devices.some((x) => x.id === o.id)), 'offers only devices not yet added');
    }
    // Every device added: no picklist left.
    for (const dev of PLOT_DEVICES) d = addDevice(d, dev.id);
    assert.ok(plotDeviceLayout(d).every((x) => x.kind === 'device'));
  });

  it('the section renders a plain "Plot Devices" label, then rows and picklist in layout order', () => {
    const src = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
    const section = src.slice(src.indexOf('function PlotDevices'), src.indexOf('function Blueprint'));
    assert.match(section, /<h3 className="dna-label dna-devices-title"[^>]*>Plot Devices<\/h3>/);
    assert.ok(!/dna-devices-head/.test(section), 'no header row holding the picklist');
    const label = section.indexOf('>Plot Devices<');
    const loop = section.indexOf('plotDeviceLayout(dna).map');
    assert.ok(label > 0 && loop > label, 'label first, then the layout (rows, then picklist)');
    assert.equal((section.match(/className="dna-device-add"/g) || []).length, 1);
    assert.ok(section.indexOf('className="dna-device-add"') > loop, 'the picklist is rendered from the layout');
  });
});
