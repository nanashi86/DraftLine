import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHARACTER_FIELDS, PRIMARY_ROLES, SECONDARY_ROLES, addCharacter, newCharacter, normalizeCharacter, roleSummary, splitLegacyRole,
  updateCharacter,
} from '../src/lib/bible.js';
import { STRUCTURE_DICTIONARY, dictionaryEntry } from '../src/lib/structureDictionary.js';
import { createProjectStore, toDoc } from '../src/lib/projectStorage.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { renameCharacter } from '../src/lib/renameCharacter.js';
import { bioCard } from '../src/lib/cueBio.js';
import { makeBlock } from '../src/lib/screenplay.js';
import { createFakeIndexedDB } from './helpers/fakeIndexedDB.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('Character roles: the data model', () => {
  it('a bio has primaryRole, secondaryRole and relationship — no single role field', () => {
    const c = newCharacter({ name: 'FITO' });
    assert.deepEqual([c.primaryRole, c.secondaryRole, c.relationship], ['', 'none', '']);
    assert.ok(!('role' in c));
    assert.deepEqual(CHARACTER_FIELDS.map((f) => f.key), ['name', 'relationship', 'age', 'traits', 'backstory']);
    assert.equal(CHARACTER_FIELDS.find((f) => f.key === 'relationship').placeholder, 'e.g., Brother-in-law to Fito, manages textile warehouse');
  });
  it('Primary Role and Secondary Function offer exactly the listed options', () => {
    assert.deepEqual(PRIMARY_ROLES.map((r) => r.label), [
      'Protagonist', 'Antagonist', 'Deuteragonist', 'Tritagonist', 'Supporting Character', 'Minor Character / Cameo',
    ]);
    assert.deepEqual(SECONDARY_ROLES.map((r) => r.label), [
      'None', 'Foil', 'Catalyst / Instigator', 'Mentor / Guide', 'Confidant(e)', 'Love Interest', 'Skeptic / Voice of Reason',
      'Henchman / Enforcer', 'Threshold Guardian', 'Shadow / Mirror',
    ]);
  });
  it('every role but None links to its Glossary definition', () => {
    for (const r of [...PRIMARY_ROLES, ...SECONDARY_ROLES.filter((x) => x.id !== 'none')]) {
      assert.ok(dictionaryEntry(STRUCTURE_DICTIONARY, r.dict), r.label);
    }
  });
  it('the header summary: "Deuteragonist (Foil)", "Protagonist", or nothing', () => {
    assert.equal(roleSummary({ primaryRole: 'deuteragonist', secondaryRole: 'foil' }), 'Deuteragonist (Foil)');
    assert.equal(roleSummary({ primaryRole: 'protagonist', secondaryRole: 'none' }), 'Protagonist');
    assert.equal(roleSummary({ primaryRole: '', secondaryRole: 'mentor' }), '(Mentor / Guide)');
    assert.equal(roleSummary({ primaryRole: '', secondaryRole: 'none' }), '');
    assert.equal(roleSummary({ primaryRole: 'bogus', secondaryRole: 'bogus' }), '');
  });
  it('the picks edit independently', () => {
    let { list, character } = addCharacter([], { name: 'TONY' });
    list = updateCharacter(list, character.id, { primaryRole: 'antagonist' });
    list = updateCharacter(list, character.id, { secondaryRole: 'shadow' });
    list = updateCharacter(list, character.id, { relationship: 'Fito’s cousin' });
    assert.deepEqual([list[0].primaryRole, list[0].secondaryRole, list[0].relationship], ['antagonist', 'shadow', 'Fito’s cousin']);
  });
});

describe('Character roles: older bios (one free-text role)', () => {
  it('role words become the picks; the rest becomes the Relationship', () => {
    assert.deepEqual(splitLegacyRole('Protagonist · Theo’s older sister'), { primaryRole: 'protagonist', secondaryRole: 'none', relationship: 'Theo’s older sister' });
    assert.deepEqual(splitLegacyRole('Antagonist (Shadow), Moïse’s chief of staff'), { primaryRole: 'antagonist', secondaryRole: 'shadow', relationship: 'Moïse’s chief of staff' });
    assert.deepEqual(splitLegacyRole('Villain'), { primaryRole: 'antagonist', secondaryRole: 'none', relationship: '' });
    assert.deepEqual(splitLegacyRole('Mentor to Fito'), { primaryRole: '', secondaryRole: 'mentor', relationship: 'to Fito' });
    assert.deepEqual(splitLegacyRole('Fito’s mother'), { primaryRole: '', secondaryRole: 'none', relationship: 'Fito’s mother' });
  });
  it('loading migrates them and drops the old field; new fields already set win', () => {
    const c = normalizeCharacter({ id: 'x', name: 'MARIE', role: 'Protagonist · Theo’s sister', age: '45', traits: '', backstory: '' });
    assert.deepEqual([c.primaryRole, c.secondaryRole, c.relationship, 'role' in c], ['protagonist', 'none', 'Theo’s sister', false]);
    const kept = normalizeCharacter({ id: 'y', name: 'X', role: 'Villain', primaryRole: 'tritagonist', relationship: 'Kept' });
    assert.deepEqual([kept.primaryRole, kept.relationship], ['tritagonist', 'Kept']);
  });
  it('old projects and backups open with the new fields', async () => {
    const legacy = [{ id: 'c1', name: 'FITO', role: 'Deuteragonist (Foil) · Tony’s cousin', age: '10', traits: 'Fast', backstory: '' }];
    const store = createProjectStore({ indexedDB: createFakeIndexedDB() });
    const rec = await store.restoreProject({ id: 'p', title: 'Run!', script: [makeBlock('scene')], characters: legacy });
    const [fito] = toDoc(rec.record ?? (await store.getProject('p'))).characters;
    assert.deepEqual([fito.primaryRole, fito.secondaryRole, fito.relationship], ['deuteragonist', 'foil', 'Tony’s cousin']);
    const { record } = parseBackup(serializeBackup({ id: 'p', title: 'Run!', script: [makeBlock('scene')], characters: legacy }));
    assert.equal(toDoc(record).characters[0].primaryRole, 'deuteragonist');
  });
  it('a renamed character’s relationship text is renamed too; the cue card shows roles and relationship', () => {
    const fito = newCharacter({ name: 'TONY', primaryRole: 'protagonist', relationship: 'Fito’s older cousin' });
    const { project } = renameCharacter({ blocks: [], beats: [], characters: [fito] }, 'FITO', 'Marc');
    assert.equal(project.characters[0].relationship, 'Marc’s older cousin');
    const card = bioCard({ ...fito, secondaryRole: 'mentor', age: '30' });
    assert.equal(card.meta, 'Protagonist (Mentor / Guide) · 30');
    assert.equal(card.relationship, 'Fito’s older cousin');
  });
});

describe('Character roles: the Bios form', () => {
  const ui = read('components/CharactersDrawer.jsx');
  it('two pickers side by side, each with an (i), then a full-width Relationship', () => {
    const pickers = ui.slice(ui.indexOf('function RolePickers'), ui.indexOf('function CharacterCard'));
    assert.match(pickers, /Primary Role\s*\{tips && <InfoTip/);
    assert.match(pickers, /Secondary Function\s*\{tips && <InfoTip/);
    assert.match(pickers, /PRIMARY_ROLES\.map/);
    assert.match(pickers, /SECONDARY_ROLES\.map/);
    assert.match(ui, /\{f\.key === 'relationship' && <RolePickers/);
    assert.match(read('components/ProjectBibleDrawer.css'), /\.pb-roles \{ display: grid; grid-template-columns: 1fr 1fr;/);
  });
  it('the collapsed header shows the roles: "FITO · Deuteragonist (Foil)"', () => {
    assert.match(ui, /\{roleSummary\(c\) \? <><span aria-hidden="true">· <\/span>\{roleSummary\(c\)\}<\/> :/);
  });
  it('an (i) click opens Story Bible → Glossary at that term', () => {
    assert.match(read('App.jsx'), /const openGlossary = useCallback\(\(id\) => \{\s*setBibleTab\('dna'\);\s*setDock\('bible'\);\s*setGlossaryTerm\(\{ id \}\);/);
    assert.match(read('components/StoryDna.jsx'), /if \(showTerm\?\.id\) \{\s*setOpenId\(showTerm\.id\);\s*setView\('dictionary'\);/);
  });
});
