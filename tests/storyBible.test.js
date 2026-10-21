import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SECTIONS, SYNOPSIS_ACTS, TREATMENT, TREATMENT_TARGET, defaultStoryNotes, emptySynopsis, importNotes, migrateStoryBible,
  normalizeStoryNotes, normalizeSynopsis, setSynopsisAct, setTreatment, splitByHeadings, storyNotesMarkdown, synopsisIndex, themeLine,
  updateSection,
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

describe('Story Notes: Treatment card', () => {
  const ui = readFileSync(new URL('../src/components/ProjectBibleDrawer.jsx', import.meta.url), 'utf8');
  it('label and placeholder', () => {
    assert.equal(TREATMENT.label, 'Treatment');
    assert.equal(TREATMENT.placeholder, 'Write or paste your full narrative treatment here (sequence-by-sequence prose, scene breakdowns, subplots)...');
  });
  it('sits directly below the Synopsis, with Edit / Done like it', () => {
    assert.match(ui, /const fixedCards = \(\s*<>\s*\{synopsisCard\}\s*<TreatmentCard/);
    assert.match(ui, /\{i === synopsisIndex\(notes\.sections\) && fixedCards\}/);
    assert.match(ui, /\{synopsisIndex\(notes\.sections\) >= notes\.sections\.length && fixedCards\}/);
    const card = ui.slice(ui.indexOf('function TreatmentCard'), ui.indexOf('function StoryNotes'));
    assert.match(card, /\{editing \? 'Done' : 'Edit'\}/);
    assert.match(card, /<AutoTextarea[^>]*placeholder=\{TREATMENT\.placeholder\}/);
    assert.match(card, /onChange=\{\(e\) => onChange\(e\.target\.value\)\}/);
    assert.match(ui, /onChange=\{\(text\) => onChange\(setTreatment\(notes, text\)\)\}/, 'saves through the notes like every card');
  });
  it('a new project has an empty treatment; older notes load with one', () => {
    assert.equal(defaultStoryNotes().treatment, '');
    assert.equal(normalizeStoryNotes(v2Notes('')).treatment, '');
    assert.equal(normalizeStoryNotes({ ...defaultStoryNotes(), treatment: 42 }).treatment, '');
    assert.equal(normalizeStoryNotes('old free text').treatment, '');
  });
  it('saves input: through the library and inside .draftline backups', async () => {
    const notes = setTreatment(defaultStoryNotes(), 'Sequence 1. Marie at the harbor.');
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const rec = await store.saveActiveProject({ meta: { title: 'Run!' }, blocks: [makeBlock('scene', 'EXT. HARBOR')], storyNotes: notes });
    assert.equal(toDoc(await store.getProject(rec.id)).storyNotes.treatment, 'Sequence 1. Marie at the harbor.');
    const { record } = parseBackup(serializeBackup(rec));
    assert.equal(toDoc(record).storyNotes.treatment, 'Sequence 1. Marie at the harbor.');
  });
  it('Copy as Markdown: "## Treatment" right after the Synopsis', () => {
    let n = setSynopsisAct(defaultStoryNotes(), 'act1', 'Marie returns.');
    n = setTreatment(n, 'Opening prose.');
    n = updateSection(n, n.sections.find((x) => x.title === 'Scratchpad').id, { body: 'Loose ideas.' });
    const md = storyNotesMarkdown(n, 'Run!');
    assert.ok(md.indexOf('### Act I: Setup') < md.indexOf('## Treatment'));
    assert.ok(md.indexOf('## Treatment') < md.indexOf('## Scratchpad'));
    assert.match(md, /## Treatment\n\nOpening prose\.\n/);
    // with no synopsis text, the treatment still comes out (in the same place)
    assert.match(storyNotesMarkdown(setTreatment(defaultStoryNotes(), 'Only this.')), /^## Treatment\n\nOnly this\.\n$/);
    assert.ok(!/Treatment/.test(storyNotesMarkdown(defaultStoryNotes())), 'an empty treatment is left out');
  });
  it('Import from Notes: "## Treatment" fills the card, sub-headings and all; Copy → Import round-trips', () => {
    const text = '# Ideas\n\nA note.\n\n## Treatment\n\nOpening.\n\n### Sequence 2: The Storm\n\nWind.\n\n## Logline\n\nShe goes back.';
    const base = defaultStoryNotes();
    const out = importNotes(base, text, { mode: 'sections', targetId: base.sections[0].id });
    assert.equal(out.treatment, 'Opening.\n\n### Sequence 2: The Storm\n\nWind.');
    assert.equal(out.sections.find((x) => x.title === 'Logline').body, 'She goes back.');
    assert.ok(!out.sections.some((x) => /Treatment|Sequence/.test(x.title)), 'no stray sections');
    let n = setSynopsisAct(defaultStoryNotes(), 'act2', 'It falls apart.');
    n = setTreatment(n, 'Long prose.\n\n### Part Two\n\nMore.');
    const back = importNotes(defaultStoryNotes(), storyNotesMarkdown(n, 'Run!'), { mode: 'sections' });
    assert.equal(back.treatment, n.treatment);
    assert.deepEqual(back.synopsis, n.synopsis);
    assert.deepEqual(back.sections.map((x) => x.title), DEFAULT_SECTIONS, 'no "Run! — Story Notes" section');
  });
  it('Import from Notes can paste straight into the Treatment (append or replace)', () => {
    const n = setTreatment(defaultStoryNotes(), 'First.');
    assert.equal(importNotes(n, 'Second.', { targetId: TREATMENT_TARGET, mode: 'append' }).treatment, 'First.\n\nSecond.');
    assert.equal(importNotes(n, 'New.', { targetId: TREATMENT_TARGET, mode: 'replace' }).treatment, 'New.');
    assert.match(ui, /<option value=\{TREATMENT_TARGET\}>\{TREATMENT\.label\}<\/option>/);
    assert.deepEqual(splitByHeadings('## A\n\nx\n\n### B').map((p) => p.level), [2, 3]);
  });
  it('renaming a character reaches the treatment, and undo puts it back', () => {
    const storyNotes = setTreatment(defaultStoryNotes(), 'FITO runs. Fito hides.');
    const project = { blocks: [makeBlock('character', 'FITO')], beats: [], characters: [], storyNotes, storyDna: emptyStoryDna() };
    const { project: p2, changed } = renameCharacter(project, 'FITO', 'Marc');
    assert.equal(p2.storyNotes.treatment, 'MARC runs. Marc hides.');
    const undone = revertRename({ beats: [], characters: [], storyNotes: p2.storyNotes, storyDna: p2.storyDna }, changed, 'undo');
    assert.equal(undone.storyNotes.treatment, 'FITO runs. Fito hides.');
  });
});

