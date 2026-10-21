import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SECTIONS, SYNOPSIS_ACTS, TREATMENT, TREATMENT_ACTS, TREATMENT_TARGETS, defaultStoryNotes, emptySynopsis, importNotes,
  migrateStoryBible, normalizeStoryNotes, normalizeSynopsis, normalizeTreatment, setSynopsisAct, setTreatmentAct, splitByHeadings,
  storyNotesMarkdown, synopsisIndex, themeLine, treatmentActHeading, updateSection, ACT_STRUCTURES, actsFor, treatmentTargets,
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
    // The Synopsis is the shared three-act card (the Treatment is too), given SYNOPSIS_ACTS.
    const card = ui.slice(ui.indexOf('function ActsCard'), ui.indexOf('function StoryNotes'));
    assert.equal((card.match(/acts\.map/g) || []).length, 2);
    assert.match(ui, /<ActsCard\s+label="Synopsis"\s+className="pb-synopsis"\s+acts=\{actsFor\('synopsis', actMode, notes\.synopsis\)\}/);
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
    assert.deepEqual(n.synopsis, { act1: 'Marie comes home.', act2: 'Marie misses the ferry.', act2b: '', act3: '' });
    assert.equal(setSynopsisAct(n, 'act9', 'x'), n, 'unknown keys are ignored');
  });
  it('older shapes load: a plain-text synopsis becomes Act I; missing or junk becomes empty', () => {
    assert.deepEqual(normalizeSynopsis('One long paragraph.'), { act1: 'One long paragraph.', act2: '', act2b: '', act3: '' });
    assert.deepEqual(normalizeSynopsis({ act2: 'B', act3: 7 }), { act1: '', act2: 'B', act2b: '', act3: '' });
    assert.deepEqual(normalizeSynopsis(null), emptySynopsis());
    const old = normalizeStoryNotes({ version: 3, sections: [{ id: 'x', title: 'Logline', body: 'L' }] });
    assert.deepEqual(old.synopsis, emptySynopsis());
    assert.deepEqual(normalizeStoryNotes({ version: 3, sections: [], synopsis: 'Text' }).synopsis.act1, 'Text');
  });
  it('persists: through the project library and inside .draftline backups', async () => {
    const notes = setSynopsisAct(setSynopsisAct(defaultStoryNotes(), 'act1', 'Setup.'), 'act3', 'Resolution.');
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const rec = await store.saveActiveProject({ meta: { title: 'Run!' }, blocks: [makeBlock('scene')], storyNotes: notes });
    assert.deepEqual(toDoc(await store.getProject(rec.id)).storyNotes.synopsis, { act1: 'Setup.', act2: '', act2b: '', act3: 'Resolution.' });
    const { record } = parseBackup(serializeBackup(toRecord({ id: 'p', meta: {}, blocks: [makeBlock('scene')], storyNotes: notes })));
    assert.deepEqual(toDoc(record).storyNotes.synopsis, { act1: 'Setup.', act2: '', act2b: '', act3: 'Resolution.' });
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
    assert.match(ui, /navigator\.clipboard\.writeText\(storyNotesMarkdown\(notes, projectTitle, actMode\)\)/);
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

describe('Story Notes: Treatment card, in three acts like the Synopsis', () => {
  const ui = readFileSync(new URL('../src/components/ProjectBibleDrawer.jsx', import.meta.url), 'utf8');
  const tr = (acts) => Object.entries(acts).reduce((n, [k, v]) => setTreatmentAct(n, k, v), defaultStoryNotes());

  it('the Synopsis’s three acts — ACT I: SETUP · ACT II: CONFRONTATION · ACT III: RESOLUTION — with their own prompts', () => {
    assert.equal(TREATMENT.label, 'Treatment');
    assert.deepEqual(TREATMENT_ACTS.map((a) => [a.key, a.label]), SYNOPSIS_ACTS.map((a) => [a.key, a.label]));
    assert.deepEqual(TREATMENT_ACTS.map(treatmentActHeading), ['ACT I: SETUP', 'ACT II: CONFRONTATION', 'ACT III: RESOLUTION']);
    for (const a of TREATMENT_ACTS) assert.match(a.placeholder, /^Act I{1,3} in full: .+\.\.\.$/);
  });
  it('renders all three act blocks, editing and not — the same card as the Synopsis', () => {
    const card = ui.slice(ui.indexOf('function ActsCard'), ui.indexOf('function StoryNotes'));
    assert.match(card, /\{acts\.map\(\(a\) => \(\s*<label key=\{a\.key\} className="pb-act">\s*<span className="micro-label">\{a\.label\}<\/span>\s*<AutoTextarea/);
    assert.match(card, /\{acts\.map\(\(a\) => \(\s*<div key=\{a\.key\} className="pb-act" data-act=\{a\.key\}>\s*<span className="micro-label">\{a\.label\}<\/span>/);
    assert.match(card, /\{editing \? 'Done' : 'Edit'\}/);
    assert.match(ui, /<ActsCard\s+label="Synopsis"\s+className="pb-synopsis"\s+acts=\{actsFor\('synopsis', actMode, notes\.synopsis\)\}/);
    assert.match(ui, /<ActsCard\s+label=\{TREATMENT\.label\}\s+className="pb-treatment"\s+acts=\{actsFor\('treatment', actMode, notes\.treatment\)\}\s+value=\{normalizeTreatment\(notes\.treatment\)\}/);
    assert.match(ui, /onChange=\{\(key, text\) => onChange\(setTreatmentAct\(notes, key, text\)\)\}/, 'each act saves through the notes');
    assert.match(ui, /const fixedCards = \(\s*<>\s*<ActsCard\s+label="Synopsis"[^]*?<ActsCard\s+label=\{TREATMENT\.label\}/, 'directly below the Synopsis');
  });
  it('each act edits on its own; new projects start empty; an older one-box treatment becomes Act I', () => {
    let n = setTreatmentAct(defaultStoryNotes(), 'act2', 'The storm.');
    n = setTreatmentAct(n, 'act1', 'The harbor.');
    assert.deepEqual(n.treatment, { act1: 'The harbor.', act2: 'The storm.', act2b: '', act3: '' });
    assert.equal(setTreatmentAct(n, 'act9', 'x'), n);
    assert.deepEqual(defaultStoryNotes().treatment, emptySynopsis());
    assert.deepEqual(normalizeStoryNotes({ ...defaultStoryNotes(), treatment: 'Old one-box text.' }).treatment, { act1: 'Old one-box text.', act2: '', act2b: '', act3: '' });
    assert.deepEqual(normalizeStoryNotes(v2Notes('')).treatment, emptySynopsis());
    assert.deepEqual(normalizeTreatment(42), emptySynopsis());
  });
  it('preserves every act across reloads: the project library and .draftline backups', async () => {
    const notes = tr({ act1: 'Sequence 1.', act2: 'Sequence 2.', act2b: '', act3: 'Sequence 3.' });
    const idb = createFakeIndexedDB();
    const rec = await createProjectStore({ indexedDB: idb }).saveActiveProject({ meta: { title: 'Run!' }, blocks: [makeBlock('scene', 'EXT. HARBOR')], storyNotes: notes });
    const reopened = createProjectStore({ indexedDB: idb }); // a reload: a new store on the same database
    assert.deepEqual(toDoc(await reopened.getProject(rec.id)).storyNotes.treatment, { act1: 'Sequence 1.', act2: 'Sequence 2.', act2b: '', act3: 'Sequence 3.' });
    const { record } = parseBackup(serializeBackup(rec));
    assert.deepEqual(toDoc(record).storyNotes.treatment, { act1: 'Sequence 1.', act2: 'Sequence 2.', act2b: '', act3: 'Sequence 3.' });
  });
  it('Copy as Markdown: ## Treatment, then ### ACT I: SETUP / ### ACT II: CONFRONTATION / ### ACT III: RESOLUTION, after the Synopsis', () => {
    let n = setSynopsisAct(defaultStoryNotes(), 'act1', 'Marie returns.');
    n = setTreatmentAct(n, 'act1', 'Dawn.');
    n = setTreatmentAct(n, 'act2', 'Storm.');
    n = setTreatmentAct(n, 'act3', 'Sails.');
    n = updateSection(n, n.sections.find((x) => x.title === 'Scratchpad').id, { body: 'Loose ideas.' });
    const md = storyNotesMarkdown(n, 'Run!');
    assert.match(md, /## Treatment\n\n### ACT I: SETUP\n\nDawn\.\n\n### ACT II: CONFRONTATION\n\nStorm\.\n\n### ACT III: RESOLUTION\n\nSails\.\n/);
    assert.ok(md.indexOf('### Act I: Setup') < md.indexOf('## Treatment') && md.indexOf('## Treatment') < md.indexOf('## Scratchpad'));
    assert.equal(storyNotesMarkdown(tr({ act3: 'Only the end.' })), '## Treatment\n\n### ACT III: RESOLUTION\n\nOnly the end.\n', 'empty acts are left out');
    assert.ok(!/Treatment/.test(storyNotesMarkdown(defaultStoryNotes())));
  });
  it('Import from Notes: ### ACT I / II / III under ## Treatment fill those acts; Copy → Import round-trips', () => {
    const text = '## Treatment\n\n### ACT I: SETUP\n\nDawn.\n\n### Sequence 2\n\nTickets.\n\n### Act II\n\nStorm.\n\n### act 3\n\nSails.\n\n## Logline\n\nShe goes back.';
    const base = defaultStoryNotes();
    const out = importNotes(base, text, { mode: 'sections', targetId: base.sections[0].id });
    assert.deepEqual(out.treatment, { act1: 'Dawn.\n\n### Sequence 2\n\nTickets.', act2: 'Storm.', act2b: '', act3: 'Sails.' });
    assert.equal(out.sections.find((x) => x.title === 'Logline').body, 'She goes back.');
    assert.deepEqual(out.synopsis, emptySynopsis(), 'act headings under ## Treatment never reach the Synopsis');
    assert.ok(!out.sections.some((x) => /Treatment|Sequence|Act/.test(x.title)), 'no stray sections');
    let n = setSynopsisAct(defaultStoryNotes(), 'act2', 'It falls apart.');
    n = setTreatmentAct(n, 'act1', 'Long prose.\n\n### Part Two\n\nMore.');
    n = setTreatmentAct(n, 'act3', 'The end.');
    const back = importNotes(defaultStoryNotes(), storyNotesMarkdown(n, 'Run!'), { mode: 'sections' });
    assert.deepEqual(back.treatment, n.treatment);
    assert.deepEqual(back.synopsis, n.synopsis);
    assert.deepEqual(back.sections.map((x) => x.title), DEFAULT_SECTIONS);
  });
  it('Import from Notes can paste straight into one Treatment act (append or replace)', () => {
    const n = tr({ act2: 'First.' });
    assert.deepEqual(TREATMENT_TARGETS.map((t) => t.label), ['Treatment — Act I (Setup)', 'Treatment — Act II (Confrontation)', 'Treatment — Act III (Resolution)']);
    assert.equal(importNotes(n, 'Second.', { targetId: 'treatment:act2', mode: 'append' }).treatment.act2, 'First.\n\nSecond.');
    assert.equal(importNotes(n, 'New.', { targetId: 'treatment:act2', mode: 'replace' }).treatment.act2, 'New.');
    assert.equal(importNotes(n, 'Opening.', { targetId: 'treatment:act1' }).treatment.act1, 'Opening.');
    assert.match(ui, /\{treatmentTargets\(actMode, notes\.treatment\)\.map\(\(t\) => <option key=\{t\.id\} value=\{t\.id\}>\{t\.label\}<\/option>\)\}/);
    assert.deepEqual(splitByHeadings('## A\n\nx\n\n### B').map((p) => p.level), [2, 3]);
  });
  it('renaming a character reaches every Treatment act, and undo puts them all back', () => {
    const storyNotes = tr({ act1: 'FITO runs.', act2: 'Nobody here.', act2b: '', act3: 'Fito hides.' });
    const project = { blocks: [makeBlock('character', 'FITO')], beats: [], characters: [], storyNotes, storyDna: emptyStoryDna() };
    const { project: p2, changed } = renameCharacter(project, 'FITO', 'Marc');
    assert.deepEqual(p2.storyNotes.treatment, { act1: 'MARC runs.', act2: 'Nobody here.', act2b: '', act3: 'Marc hides.' });
    const state = { beats: [], characters: [], storyNotes: p2.storyNotes, storyDna: p2.storyDna };
    const undone = revertRename(state, changed, 'undo');
    assert.deepEqual(undone.storyNotes.treatment, storyNotes.treatment);
    assert.deepEqual(revertRename(undone, changed, 'redo').storyNotes.treatment, p2.storyNotes.treatment);
    // an older one-box treatment still renames (it becomes Act I)
    const legacy = renameCharacter({ ...project, storyNotes: { ...storyNotes, treatment: 'Fito waits.' } }, 'FITO', 'Marc');
    assert.equal(legacy.project.storyNotes.treatment.act1, 'Marc waits.');
  });
});

describe('Synopsis & Treatment in 3 or 4 acts (the Scene Board’s switch)', () => {
  const ui = readFileSync(new URL('../src/components/ProjectBibleDrawer.jsx', import.meta.url), 'utf8');
  it('3 acts: Act I · II · III; 4 acts: Act 1 · 2A · 2B · 3', () => {
    assert.deepEqual(ACT_STRUCTURES, [3, 4]);
    assert.deepEqual(actsFor('synopsis', 3, null).map((a) => a.label), ['Act I: Setup', 'Act II: Confrontation', 'Act III: Resolution']);
    assert.deepEqual(actsFor('synopsis', 4, null).map((a) => [a.key, a.label]), [
      ['act1', 'Act 1: Setup'], ['act2', 'Act 2A: Escalation to Midpoint'], ['act2b', 'Act 2B: Fall & Crisis'], ['act3', 'Act 3: Climax & Resolution'],
    ]);
    assert.ok(actsFor('treatment', 4, null).every((a) => /in full/.test(a.placeholder)));
  });
  it('switching never hides text: an Act 2B written in 4 acts stays on show (under Act II) in 3 acts', () => {
    assert.deepEqual(actsFor('synopsis', 3, { act2b: 'The fall.' }).map((a) => a.key), ['act1', 'act2', 'act2b', 'act3']);
    assert.deepEqual(actsFor('synopsis', 3, { act2b: '  ' }).map((a) => a.key), ['act1', 'act2', 'act3']);
    assert.equal(actsFor('synopsis', 3, { act2b: 'x' })[2].label, 'Act II (cont.): Fall & Crisis');
  });
  it('the cards and Copy as Markdown follow the active view; a 3 / 4 Acts switch sits in Notes', () => {
    assert.match(ui, /acts=\{actsFor\('synopsis', actMode, notes\.synopsis\)\}/);
    assert.match(ui, /acts=\{actsFor\('treatment', actMode, notes\.treatment\)\}/);
    assert.match(ui, /storyNotesMarkdown\(notes, projectTitle, actMode\)/);
    assert.match(ui, /\{ACT_STRUCTURES\.map\(\(n\) => \(\s*<button[^>]*onClick=\{\(\) => onActModeChange\(n\)\}>\s*\{n\} Acts/);
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.equal((app.match(/actMode=\{actMode\}\s*onActModeChange=\{changeActMode\}/g) || []).length, 2, 'the same actMode as the Scene Board, converting the text either way');
  });
  it('Copy → Import round-trips in both views, 2B included', () => {
    let n = defaultStoryNotes();
    for (const [k, v] of [['act1', 'A.'], ['act2', 'B.'], ['act2b', 'C.'], ['act3', 'D.']]) n = setTreatmentAct(setSynopsisAct(n, k, v), k, `${v} in full`);
    for (const mode of [3, 4]) {
      const back = importNotes(defaultStoryNotes(), storyNotesMarkdown(n, 'Run!', mode), { mode: 'sections' });
      assert.deepEqual([back.synopsis, back.treatment], [n.synopsis, n.treatment], `${mode} acts`);
    }
    assert.match(storyNotesMarkdown(n, '', 4), /## Treatment\n\n### ACT 1: SETUP\n\nA\. in full\n\n### ACT 2A: ESCALATION TO MIDPOINT\n\nB\. in full\n\n### ACT 2B: FALL & CRISIS/);
  });
  it('imports both Roman and 4-act headings: ACT I / II / III and ACT 1 / 2A / 2B / 3 (and "Act 1 notes" stays a section)', () => {
    const t = '## Treatment\n\n### ACT 1\n\nOne.\n\n### ACT 2A\n\nTwo A.\n\n### Act 2B: Fall\n\nTwo B.\n\n### ACT III: RESOLUTION\n\nThree.\n\n## Act 1 notes\n\nMine.';
    const out = importNotes(defaultStoryNotes(), t, { mode: 'sections' });
    assert.deepEqual(out.treatment, { act1: 'One.', act2: 'Two A.', act2b: 'Two B.', act3: 'Three.' });
    assert.equal(out.sections.find((x) => x.title === 'Act 1 notes').body, 'Mine.');
    assert.deepEqual(treatmentTargets(4).map((x) => x.id), ['treatment:act1', 'treatment:act2', 'treatment:act2b', 'treatment:act3']);
    assert.equal(importNotes(defaultStoryNotes(), 'Fall.', { targetId: 'treatment:act2b' }).treatment.act2b, 'Fall.');
  });
  it('rename reaches Act 2B too', () => {
    const storyNotes = setSynopsisAct(setTreatmentAct(defaultStoryNotes(), 'act2b', 'Fito falls.'), 'act2b', 'FITO runs.');
    const { project } = renameCharacter({ blocks: [makeBlock('character', 'FITO')], beats: [], characters: [], storyNotes, storyDna: emptyStoryDna() }, 'FITO', 'Marc');
    assert.equal(project.storyNotes.treatment.act2b, 'Marc falls.');
    assert.equal(project.storyNotes.synopsis.act2b, 'MARC runs.');
  });
});

