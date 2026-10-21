import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SECTIONS, SYNOPSIS_ACTS, defaultStoryNotes, emptySynopsis, migrateStoryBible, normalizeStoryNotes, normalizeSynopsis,
  setSynopsisAct, storyNotesMarkdown, synopsisIndex, themeLine,
} from '../src/lib/bible.js';
import { renameCharacter, revertRename } from '../src/lib/renameCharacter.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { toRecord } from '../src/lib/projectStorage.js';
import { emptyStoryDna } from '../src/lib/storyDna.js';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import { createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { makeBlock } from '../src/lib/screenplay.js';

/** Notes as a project saved them before Theme moved to Story DNA (version 2, six presets). */
const v2Notes = (themes = '', extra = []) => ({
  version: 2,
  sections: [
    { id: 'l', title: 'Logline', body: 'A ferry, a storm, a choice.' },
    { id: 'th', title: 'Themes', body: themes },
    { id: 'to', title: 'Tone', body: 'Salt and rain.' },
    { id: 'ti', title: 'Timeline', body: '' },
    { id: 'p', title: 'Pitch', body: '' },
    { id: 's', title: 'Scratchpad', body: 'Loose ideas' },
    ...extra,
  ],
});
const titles = (n) => n.sections.map((s) => s.title);

describe('Story Bible: one home for Theme', () => {
  it('the Notes tab shows Logline, Tone, Timeline, Pitch and Scratchpad — no Themes card', () => {
    assert.deepEqual(DEFAULT_SECTIONS, ['Logline', 'Tone', 'Timeline', 'Pitch', 'Scratchpad']);
    assert.deepEqual(titles(defaultStoryNotes()), DEFAULT_SECTIONS);
  });
  it('the DNA tab keeps "Theme · revealed by the climax" as the field', () => {
    const dna = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
    assert.match(dna, /<span className="dna-label">Theme<span className="dna-hint">revealed by the climax<\/span><\/span>/);
  });
});

describe('migration: Themes note → Story DNA Theme', () => {
  it('moves "Moral Dilemma" into a blank DNA Theme and drops the card', () => {
    const { storyNotes, storyDna, movedTheme } = migrateStoryBible(v2Notes('Moral Dilemma'), emptyStoryDna());
    assert.equal(storyDna.theme, 'Moral Dilemma');
    assert.equal(movedTheme, true);
    assert.deepEqual(titles(storyNotes), ['Logline', 'Tone', 'Timeline', 'Pitch', 'Scratchpad']);
    assert.equal(storyNotes.version, 3);
    // Everything else is untouched, ids included.
    assert.equal(storyNotes.sections.find((s) => s.id === 'to').body, 'Salt and rain.');
    assert.equal(storyNotes.sections.find((s) => s.id === 's').body, 'Loose ideas');
  });
  it('a list or several lines become one line (DNA Theme is a single field)', () => {
    assert.equal(themeLine('- Exile\n- Return home\n\n* Fathers and daughters'), 'Exile; Return home; Fathers and daughters');
    assert.equal(themeLine('1. Power\n2) Silence'), 'Power; Silence');
    const { storyDna } = migrateStoryBible(v2Notes('# Themes\n- Exile\n- Return'), undefined);
    assert.equal(storyDna.theme, 'Themes; Exile; Return');
  });
  it('an empty Themes card simply goes', () => {
    const { storyNotes, storyDna, movedTheme } = migrateStoryBible(v2Notes('   '), { ...emptyStoryDna(), theme: 'Kept as is' });
    assert.deepEqual(titles(storyNotes), DEFAULT_SECTIONS);
    assert.equal(storyDna.theme, 'Kept as is');
    assert.equal(movedTheme, false);
  });
  it('never overwrites: if DNA Theme says something else, the card stays as one of your notes', () => {
    const { storyNotes, storyDna } = migrateStoryBible(v2Notes('Moral Dilemma'), { ...emptyStoryDna(), theme: 'Power eats its own' });
    assert.equal(storyDna.theme, 'Power eats its own');
    const card = storyNotes.sections.find((s) => s.title === 'Themes');
    assert.equal(card.body, 'Moral Dilemma');
    assert.equal(card.id, 'th');
  });
  it('if DNA Theme already says the same thing, the duplicate card goes', () => {
    const { storyNotes } = migrateStoryBible(v2Notes('Moral Dilemma'), { ...emptyStoryDna(), theme: 'Moral Dilemma' });
    assert.ok(!titles(storyNotes).includes('Themes'));
  });
  it('the oldest notes ("Themes & Motifs") migrate the same way', () => {
    const v1 = { sections: [{ id: 'm', title: 'Themes & Motifs', body: 'Exile and return' }, { id: 'g', title: 'General Scratchpad', body: 'x' }] };
    const { storyNotes, storyDna } = migrateStoryBible(v1, {});
    assert.equal(storyDna.theme, 'Exile and return');
    assert.deepEqual(titles(storyNotes), DEFAULT_SECTIONS);
  });
  it('runs once: a "Themes" section you add yourself later is left alone', () => {
    const current = { ...defaultStoryNotes(), sections: [...defaultStoryNotes().sections, { id: 'mine', title: 'Themes', body: 'My own list' }] };
    const { storyNotes, storyDna } = migrateStoryBible(current, emptyStoryDna());
    assert.equal(storyDna.theme, '');
    assert.equal(storyNotes.sections.at(-1).body, 'My own list');
  });
  it('custom sections keep their place after the presets', () => {
    const { storyNotes } = migrateStoryBible(v2Notes('Moral Dilemma', [{ id: 'r', title: 'Research', body: 'Ferry routes' }]), {});
    assert.deepEqual(titles(storyNotes), [...DEFAULT_SECTIONS, 'Research']);
  });
  it('without Story DNA in hand (notes alone), the Themes text is kept, never dropped', () => {
    assert.deepEqual(titles(normalizeStoryNotes(v2Notes('Moral Dilemma'))), [...DEFAULT_SECTIONS, 'Themes']);
  });
});

describe('migration happens when a project opens', () => {
  it('an old project record loads with Theme in DNA, and saves that way', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const rec = await store.saveActiveProject({ meta: { title: 'What Happened to Haiti?' }, blocks: [makeBlock('scene', 'INT. PALACE - NIGHT')] });
    // Simulate a record written by the previous version.
    const old = { ...rec, storyNotes: v2Notes('Moral Dilemma'), storyDna: { ...emptyStoryDna(), theme: '' } };
    const doc = toDoc(old);
    assert.equal(doc.storyDna.theme, 'Moral Dilemma');
    assert.deepEqual(titles(doc.storyNotes), DEFAULT_SECTIONS);
    const saved = await store.saveActiveProject(doc);
    assert.equal(saved.storyDna.theme, 'Moral Dilemma');
    assert.equal(saved.storyNotes.version, 3);
    assert.deepEqual(toDoc(saved).storyNotes, doc.storyNotes, 'stable on the next open');
  });
});

describe('Story Notes: three-act Synopsis card', () => {
  const ui = readFileSync(new URL('../src/components/ProjectBibleDrawer.jsx', import.meta.url), 'utf8');
  it('has Act I: Setup, Act II: Confrontation, Act III: Resolution with their placeholders', () => {
    assert.deepEqual(SYNOPSIS_ACTS.map((a) => [a.key, a.label]), [
      ['act1', 'Act I: Setup'], ['act2', 'Act II: Confrontation'], ['act3', 'Act III: Resolution'],
    ]);
    assert.deepEqual(SYNOPSIS_ACTS.map((a) => a.placeholder), [
      'Act I setup, world-building, inciting incident...',
      'Act II escalating stakes, midpoint reversal, all-hope-is-lost moment...',
      'Act III climax, ultimate confrontation, and resolution...',
    ]);
  });
  it('renders all three in both states: one labelled box per act when editing, three labelled blocks otherwise', () => {
    const card = ui.slice(ui.indexOf('function SynopsisCard'), ui.indexOf('function StoryNotes'));
    assert.equal((card.match(/SYNOPSIS_ACTS\.map/g) || []).length, 2);
    assert.match(card, /<AutoTextarea[\s\S]*?placeholder=\{a\.placeholder\}[\s\S]*?onChange=\{\(e\) => onChange\(a\.key, e\.target\.value\)\}/);
    assert.match(card, /<span className="micro-label">\{a\.label\}<\/span>/);
    assert.match(card, /\{editing \? 'Done' : 'Edit'\}/);
  });
  it('a new project starts with an empty synopsis, placed right after Pitch', () => {
    const n = defaultStoryNotes();
    assert.deepEqual(n.synopsis, emptySynopsis());
    assert.equal(n.sections[synopsisIndex(n.sections) - 1].title, 'Pitch');
    assert.equal(synopsisIndex([{ id: 'a', title: 'Logline', body: '' }]), 1, 'no Pitch → at the end');
  });
  it('each act edits independently', () => {
    let n = defaultStoryNotes();
    n = setSynopsisAct(n, 'act2', 'Marie misses the ferry.');
    n = setSynopsisAct(n, 'act1', 'Marie comes home.');
    assert.deepEqual(n.synopsis, { act1: 'Marie comes home.', act2: 'Marie misses the ferry.', act3: '' });
    assert.equal(setSynopsisAct(n, 'act9', 'x'), n, 'unknown keys are ignored');
  });
  it('older shapes load: a plain-text synopsis becomes Act I; missing or junk becomes empty', () => {
    assert.deepEqual(normalizeSynopsis('One long paragraph.'), { act1: 'One long paragraph.', act2: '', act3: '' });
    assert.deepEqual(normalizeSynopsis({ act2: 'B', act3: 7 }), { act1: '', act2: 'B', act3: '' });
    assert.deepEqual(normalizeSynopsis(null), emptySynopsis());
    const old = normalizeStoryNotes({ version: 3, sections: [{ id: 'x', title: 'Logline', body: 'L' }] });
    assert.deepEqual(old.synopsis, emptySynopsis());
    assert.deepEqual(normalizeStoryNotes({ version: 3, sections: [], synopsis: 'Text' }).synopsis.act1, 'Text');
  });
  it('persists: through the project library and inside .draftline backups', async () => {
    const notes = setSynopsisAct(setSynopsisAct(defaultStoryNotes(), 'act1', 'Setup.'), 'act3', 'Resolution.');
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const rec = await store.saveActiveProject({ meta: { title: 'Run!' }, blocks: [makeBlock('scene')], storyNotes: notes });
    assert.deepEqual(toDoc(await store.getProject(rec.id)).storyNotes.synopsis, { act1: 'Setup.', act2: '', act3: 'Resolution.' });
    const { record } = parseBackup(serializeBackup(toRecord({ id: 'p', meta: {}, blocks: [makeBlock('scene')], storyNotes: notes })));
    assert.deepEqual(toDoc(record).storyNotes.synopsis, { act1: 'Setup.', act2: '', act3: 'Resolution.' });
  });
  it('exports with the other notes — after Pitch, as Act I / II / III', () => {
    let n = defaultStoryNotes();
    const body = (title, text) => { n = { ...n, sections: n.sections.map((s) => (s.title === title ? { ...s, body: text } : s)) }; };
    body('Logline', 'A sister brings her brother home.');
    body('Pitch', 'Two siblings, one ferry, one storm.');
    body('Scratchpad', 'Check tide tables.');
    n = setSynopsisAct(setSynopsisAct(n, 'act1', 'Marie returns.'), 'act3', 'They turn back.');
    const md = storyNotesMarkdown(n, 'The Last Ferry');
    assert.match(md, /^# The Last Ferry — Story Notes/);
    const at = (t) => md.indexOf(t);
    assert.ok(at('## Logline') < at('## Pitch') && at('## Pitch') < at('## Synopsis') && at('## Synopsis') < at('## Scratchpad'));
    assert.match(md, /## Synopsis\n\n### Act I: Setup\n\nMarie returns\.\n\n### Act III: Resolution\n\nThey turn back\./);
    assert.ok(!/Act II:|## Tone|## Timeline/.test(md), 'empty acts and sections are left out');
    assert.match(ui, /navigator\.clipboard\.writeText\(storyNotesMarkdown\(notes, projectTitle\)\)/);
  });
  it('renaming a character reaches the synopsis, and undo puts it back', () => {
    const notes = setSynopsisAct(defaultStoryNotes(), 'act2', 'Fito runs. FITO hides.');
    const project = { blocks: [], beats: [], characters: [], storyNotes: notes, storyDna: emptyStoryDna() };
    const { project: after, changed } = renameCharacter(project, 'FITO', 'Marc');
    assert.equal(after.storyNotes.synopsis.act2, 'Marc runs. MARC hides.');
    const back = revertRename({ ...after }, changed, 'undo');
    assert.equal(back.storyNotes.synopsis.act2, 'Fito runs. FITO hides.');
  });
});
