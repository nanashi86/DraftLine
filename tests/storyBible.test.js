import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SECTIONS, defaultStoryNotes, migrateStoryBible, normalizeStoryNotes, themeLine } from '../src/lib/bible.js';
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
  it('the DNA tab keeps "Theme — revealed by the Climax" as the field', () => {
    const dna = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
    assert.match(dna, /Theme <em>— revealed by the Climax<\/em>/);
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
