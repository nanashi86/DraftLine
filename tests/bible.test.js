import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCharacter, addSection, defaultStoryNotes, filterCharacters, importNotes, markdownBlocks, missingFromScript,
  moveCharacter, normalizeStoryNotes, removeCharacter, removeSection, sortCharacters, splitByHeadings,
  updateCharacter, updateSection,
} from '../src/lib/bible.js';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';
import { createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { intersects, placeNote, popRect } from '../src/lib/notePlacement.js';

const names = (list) => list.map((c) => c.name).join(',');

describe('Character Bios: CRUD', () => {
  it('adds, updates and removes characters, with every bio field', () => {
    let { list, character } = addCharacter([], { name: 'MARIE' });
    assert.deepEqual(Object.keys(character).sort(), ['age', 'backstory', 'id', 'name', 'primaryRole', 'relationship', 'secondaryRole', 'traits']);
    assert.deepEqual([character.primaryRole, character.secondaryRole, character.relationship], ['', 'none', '']);
    ({ list } = addCharacter(list, { name: 'THEO' }));
    list = updateCharacter(list, character.id, {
      primaryRole: 'protagonist', relationship: 'Theo’s older sister', age: '10 in 1986, 45 in 2021', traits: 'Stubborn', backstory: 'Left Jacmel at 17.',
    });
    assert.deepEqual(
      [list[0].primaryRole, list[0].relationship, list[0].age, list[0].traits, list[0].backstory],
      ['protagonist', 'Theo’s older sister', '10 in 1986, 45 in 2021', 'Stubborn', 'Left Jacmel at 17.'],
    );
    assert.equal(updateCharacter(list, 'nope', { name: 'X' }), list, 'unknown id changes nothing');
    list = removeCharacter(list, character.id);
    assert.equal(names(list), 'THEO');
  });
  it('reorders, sorts A–Z (unnamed last) and filters by name, ignoring case and accents', () => {
    const list = ['THEO', '', 'Émile', 'augustin', 'MARIE'].map((name) => addCharacter([], { name }).character);
    assert.equal(names(moveCharacter(list, list[0].id, 1)), ',THEO,Émile,augustin,MARIE');
    assert.equal(moveCharacter(list, list[0].id, -1), list, 'cannot move above the top');
    assert.equal(names(sortCharacters(list)), 'augustin,Émile,MARIE,THEO,');
    assert.equal(names(filterCharacters(list, 'emi')), 'Émile');
    assert.equal(names(filterCharacters(list, ' ')), names(list));
  });
  it('lists script speakers that have no bio yet', () => {
    const list = [addCharacter([], { name: 'Marie' }).character];
    assert.deepEqual(missingFromScript(list, ['MARIE', 'THEO', 'AUGUSTIN']), ['THEO', 'AUGUSTIN']);
  });
});

describe('Story Notes', () => {
  it('a new project starts with Logline, Tone, Timeline, Pitch, Scratchpad (Theme lives in Story DNA)', () => {
    assert.deepEqual(defaultStoryNotes().sections.map((s) => s.title), ['Logline', 'Tone', 'Timeline', 'Pitch', 'Scratchpad']);
    assert.equal(defaultStoryNotes().version, 3);
  });
  it('older notes are renamed and reordered with every word kept (same section ids)', () => {
    const old = {
      sections: [
        { id: 'l', title: 'Logline', body: 'A ferry, a storm, a choice.' },
        { id: 't', title: 'Timeline & Lore', body: '1986 — Jacmel' },
        { id: 'm', title: 'Themes & Motifs', body: 'Exile and return' },
        { id: 'o', title: 'Tone', body: '' },
        { id: 'p', title: 'Pitch', body: 'Two siblings…' },
        { id: 'g', title: 'General Scratchpad', body: 'Loose ideas' },
        { id: 'r', title: 'Research', body: 'Ferry routes 1991' },
      ],
    };
    const n = normalizeStoryNotes(old);
    // On its own (no Story DNA to hand it to) the old Themes text is kept, after the presets.
    assert.deepEqual(n.sections.map((s) => `${s.id}:${s.title}:${s.body}`), [
      'l:Logline:A ferry, a storm, a choice.',
      'o:Tone:',
      't:Timeline:1986 — Jacmel',
      'p:Pitch:Two siblings…',
      'g:Scratchpad:Loose ideas',
      'm:Themes:Exile and return',
      'r:Research:Ferry routes 1991',
    ]);
    assert.equal(n.version, 3);
  });
  it('the original three-section notes gain the missing presets; custom sections follow, in their order', () => {
    const old = { sections: [
      { id: 'c1', title: 'Locations', body: 'Jacmel' },
      { id: 't', title: 'Timeline & Lore', body: '' },
      { id: 'm', title: 'Themes & Motifs', body: 'Exile.' },
      { id: 'c2', title: 'Music', body: 'Kompa' },
      { id: 'g', title: 'General Scratchpad', body: '' },
    ] };
    assert.deepEqual(normalizeStoryNotes(old).sections.map((s) => s.title),
      ['Logline', 'Tone', 'Timeline', 'Pitch', 'Scratchpad', 'Themes', 'Locations', 'Music']);
  });
  it('if an old and a new name meet, their text is combined — nothing is lost', () => {
    const both = { sections: [{ id: 'a', title: 'Themes', body: 'Mine.' }, { id: 'b', title: 'Themes & Motifs', body: 'Older.' }] };
    const themes = normalizeStoryNotes(both).sections.filter((s) => s.title === 'Themes');
    assert.equal(themes.length, 1);
    assert.equal(themes[0].body, 'Mine.\n\nOlder.');
  });
  it('migrates once: after that, deleted or reordered presets stay the way you left them', () => {
    let n = normalizeStoryNotes({ sections: [{ id: 'g', title: 'General Scratchpad', body: 'x' }] });
    n = removeSection(n, n.sections.find((s) => s.title === 'Tone').id);
    assert.deepEqual(normalizeStoryNotes(n).sections.map((s) => s.title), ['Logline', 'Timeline', 'Pitch', 'Scratchpad']);
  });
  it('edits, adds and removes sections; new sections go after Scratchpad', () => {
    let n = defaultStoryNotes();
    n = updateSection(n, n.sections[0].id, { body: 'A ferry, a storm.' });
    const added = addSection(n, 'Research');
    n = removeSection(added.notes, n.sections[2].id);
    assert.deepEqual(n.sections.map((s) => s.title), ['Logline', 'Tone', 'Pitch', 'Scratchpad', 'Research']);
    assert.equal(n.sections[0].body, 'A ferry, a storm.');
  });
  it('a legacy plain-markdown string becomes the scratchpad', () => {
    const n = normalizeStoryNotes('just text');
    assert.equal(n.sections.at(-1).title, 'Scratchpad');
    assert.equal(n.sections.at(-1).body, 'just text');
  });
  it('Import from Notes: append, replace, or split by headings into matching/new sections', () => {
    const base = defaultStoryNotes();
    const timeline = base.sections[2].id;
    const a = importNotes(updateSection(base, timeline, { body: 'Old.' }), 'New.', { targetId: timeline });
    assert.equal(a.sections[2].body, 'Old.\n\nNew.');
    assert.equal(importNotes(a, 'Only this.', { targetId: timeline, mode: 'replace' }).sections[2].body, 'Only this.');
    // A pasted "# Timeline & Lore" heading (an old name) lands in Timeline; unknown headings add sections.
    const pasted = 'Loose intro.\n\n# Timeline & Lore\n1986 — Jacmel.\n\n## Locations\n- Jacmel\n- Port-au-Prince';
    const s = importNotes(base, pasted, { targetId: base.sections[4].id, mode: 'sections' });
    assert.deepEqual(s.sections.map((x) => x.title), ['Logline', 'Tone', 'Timeline', 'Pitch', 'Scratchpad', 'Locations']);
    assert.equal(s.sections[2].body, '1986 — Jacmel.');
    assert.equal(s.sections[4].body, 'Loose intro.');
    assert.equal(s.sections[5].body, '- Jacmel\n- Port-au-Prince');
  });
  it('splits on Markdown and underlined headings', () => {
    assert.deepEqual(splitByHeadings('Intro\n\nLore\n====\nA\n### B\nC').map((p) => p.title), [null, 'Lore', 'B']);
  });
  it('reads Markdown as data (headings, lists, quotes) — never raw HTML', () => {
    const b = markdownBlocks('# Title\nPara one\ncontinues.\n\n- a\n- b\n1. one\n> quote\n---\n<script>x</script>');
    assert.deepEqual(b.map((x) => x.type), ['h', 'p', 'ul', 'ol', 'quote', 'hr', 'p']);
    assert.equal(b[1].text, 'Para one continues.');
    assert.equal(b[6].text, '<script>x</script>'); // stays text; the view renders it as text
  });
});

describe('Bible persistence across project switches', () => {
  it('each project keeps its own bios and notes in IndexedDB', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const notesA = defaultStoryNotes();
    const a = await store.saveActiveProject({
      meta: { title: 'What Happened to Haiti?' },
      blocks: [makeBlock('scene', 'EXT. PORT-AU-PRINCE - DAY')],
      characters: [addCharacter([], { name: 'MARIE', age: '10 in 1986, 45 in 2021' }).character],
      storyNotes: updateSection(notesA, notesA.sections[0].id, { body: '1986: Jean-Claude leaves.' }),
    });
    const b = await store.saveActiveProject({ meta: { title: 'Run!' }, blocks: [makeBlock('scene', 'INT. HOUSE - NIGHT')] });
    // "Switch" to B, then back to A: each loads its own Bible.
    const docB = toDoc(await store.getProject(b.id));
    assert.deepEqual(docB.characters, []);
    assert.deepEqual(docB.storyNotes.sections.map((s) => s.body), ['', '', '', '', '']);
    const docA = toDoc(await store.getProject(a.id));
    assert.equal(docA.characters[0].age, '10 in 1986, 45 in 2021');
    assert.equal(docA.storyNotes.sections[0].body, '1986: Jean-Claude leaves.');
    // Editing A's notes and saving keeps B untouched.
    await store.saveActiveProject({ ...docA, storyNotes: updateSection(docA.storyNotes, docA.storyNotes.sections[2].id, { body: 'idea' }) });
    assert.deepEqual(toDoc(await store.getProject(b.id)).storyNotes.sections.map((s) => s.body), ['', '', '', '', '']);
    assert.equal(toDoc(await store.getProject(a.id)).storyNotes.sections[2].body, 'idea');
  });
  it('a duplicated project carries a copy of its Bible', async () => {
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const a = await store.saveActiveProject({ meta: { title: 'A' }, blocks: [makeBlock('scene', 'X')], characters: [addCharacter([], { name: 'BOB' }).character] });
    const c = await store.duplicateProject(a.id);
    assert.equal(toDoc(c).characters[0].name, 'BOB');
  });
});

describe('margin note popover never covers the script', () => {
  const IN = 96;
  // A page at x = 300…1116, text column 1.5in…7.5in from its left edge.
  const page = { left: 300, right: 300 + 8.5 * IN, top: 0, bottom: 11 * IN };
  const textCol = { left: page.left + 1.5 * IN, right: page.left + 7.5 * IN, top: 0, bottom: 11 * IN };
  const anchor = { left: textCol.left, right: textCol.right, top: 400, bottom: 432 };
  const size = { width: 260, height: 150 };

  it('opens in the gutter right of the page when there is room — clear of all text', () => {
    const r = placeNote({ anchor, page, view: { left: 0, right: 1500, top: 0, bottom: 900 }, size });
    assert.equal(r.placement, 'gutter-right');
    assert.equal(intersects(popRect(r, size), page), false);
    assert.equal(intersects(popRect(r, size), textCol), false);
  });
  it('uses the left gutter when only that side has room', () => {
    const r = placeNote({ anchor, page, view: { left: 0, right: page.right + 40, top: 0, bottom: 900 }, size });
    assert.equal(r.placement, 'gutter-left');
    assert.equal(intersects(popRect(r, size), page), false);
  });
  it('in a narrow window it opens below (or above) the element — never on the annotated line', () => {
    const view = { left: page.left - 20, right: page.right + 20, top: 0, bottom: 900 };
    const below = placeNote({ anchor, page, view, size });
    assert.equal(below.placement, 'below');
    assert.equal(intersects(popRect(below, size), anchor), false);
    const low = { ...anchor, top: 800, bottom: 832 };
    const above = placeNote({ anchor: low, page, view, size });
    assert.equal(above.placement, 'above');
    assert.equal(intersects(popRect(above, size), low), false);
  });
});
