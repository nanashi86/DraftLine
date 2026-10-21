import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GLOSSARY_SECTIONS, STRUCTURE_DICTIONARY, dictionaryEntry, glossarySections, mergeDictionary, searchDictionary, sectionOf,
} from '../src/lib/structureDictionary.js';
import { PRIMARY_ROLES, SECONDARY_ROLES } from '../src/lib/bible.js';

const ROLE_DEFINITIONS = {
  protagonist: 'The primary driver of the story whose goals and moral choices dictate the plot.',
  antagonist: 'The primary obstacle or opposing force standing between the protagonist and their goal.',
  deuteragonist: 'The second most important character, often acting as a principal partner, rival, or counterweight.',
  tritagonist: 'The third most significant character, often serving as a catalyst, instigator, or key moral witness.',
  foil: 'A character whose contrasting values, background, or choices highlight and challenge the protagonist’s traits.',
  catalyst: 'A character whose action, death, or arrival triggers the central conflict or forces the protagonist out of the status quo.',
  mentor: 'A figure providing wisdom, instruction, or ethical boundaries to the protagonist.',
  confidant: 'A trusted ally who allows the protagonist’s inner thoughts and vulnerabilities to be vocalized.',
  shadow: 'A dark reflection of the protagonist showing the catastrophic outcome of their negative impulses.',
};

describe('Glossary: screenplay roles', () => {
  it('has the standard definitions, word for word', () => {
    for (const [id, def] of Object.entries(ROLE_DEFINITIONS)) assert.equal(dictionaryEntry(STRUCTURE_DICTIONARY, id)?.definition, def, id);
    assert.equal(dictionaryEntry(STRUCTURE_DICTIONARY, 'confidant').term, 'Confidant(e)');
  });
  it('every role term is listed under Character Roles and searchable', () => {
    const roles = glossarySections(STRUCTURE_DICTIONARY).find((x) => x.id === 'roles').entries;
    assert.equal(roles.length, 15);
    for (const id of Object.keys(ROLE_DEFINITIONS)) assert.ok(roles.some((r) => r.id === id), id);
    assert.deepEqual(searchDictionary(STRUCTURE_DICTIONARY, 'deuteragonist').map((e) => e.id), ['deuteragonist']);
    assert.ok(searchDictionary(STRUCTURE_DICTIONARY, 'dark reflection').some((e) => e.id === 'shadow'));
  });
  it('like every entry, they start as starter text and can be replaced with your own wording', () => {
    const merged = mergeDictionary({ foil: { definition: 'Mine.' } });
    assert.equal(dictionaryEntry(merged, 'foil').definition, 'Mine.');
    assert.equal(dictionaryEntry(merged, 'foil').starter, false);
    assert.equal(dictionaryEntry(merged, 'mentor').starter, true);
  });
});

const ROLES = [
  'Protagonist', 'Antagonist', 'Deuteragonist', 'Tritagonist', 'Supporting Character', 'Minor / Cameo',
  'Catalyst', 'Confidant(e)', 'Foil', 'Henchman / Enforcer', 'Love Interest', 'Mentor / Guide',
  'Shadow / Mirror', 'Skeptic / Voice of Reason', 'Threshold Guardian',
];
const CRAFT = [
  'Cliffhanger', 'Climax', 'Conflict / Debate', 'Deus ex machina', 'Falling Action', 'Flashback', 'Flaw', 'Foreshadowing',
  'Goal / Desire', 'Inciting Incident', 'Love triangle', 'MacGuffin', 'Quest', 'Red herring', 'Rising Action',
  'Text / Subtext / Context',
];

describe('Glossary: two sections — Character Roles, and Narrative & Dramatic Craft', () => {
  const ui = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
  const list = ui.slice(ui.indexOf('function Dictionary('), ui.indexOf('export default function StoryDna'));

  it('lists the terms in exactly the order given, Protagonist first among the roles', () => {
    const [roles, craft] = glossarySections(mergeDictionary());
    assert.deepEqual([roles.label, roles.total, craft.label, craft.total], ['Character Roles', 15, 'Narrative & Dramatic Craft', 16]);
    assert.deepEqual(roles.entries.map((e) => e.term), ROLES);
    assert.deepEqual(craft.entries.map((e) => e.term), CRAFT);
  });
  it('every term is in exactly one section, and nothing is left out', () => {
    const all = GLOSSARY_SECTIONS.flatMap((x) => x.ids);
    assert.equal(new Set(all).size, all.length);
    assert.deepEqual([...all].sort(), STRUCTURE_DICTIONARY.map((e) => e.id).sort());
    assert.equal(sectionOf('protagonist'), 'roles');
    assert.equal(sectionOf('climax'), 'craft');
  });
  it('the role terms carry the Bios picker names, so each ⓘ opens the term you picked', () => {
    for (const r of [...PRIMARY_ROLES, ...SECONDARY_ROLES.filter((x) => x.id !== 'none')]) {
      assert.equal(dictionaryEntry(STRUCTURE_DICTIONARY, r.dict).term, r.label);
    }
  });
  it('each section has a subheader with its term count — no 1–31 numbering on the rows', () => {
    assert.match(list, /<h3 id=\{`dict-sec-\$\{sec\.id\}`\} className="dict-section-head micro-label">\s*\{sec\.label\}/);
    assert.match(list, /<span className="dict-section-count">\{searching \? `\$\{sec\.entries\.length\} of \$\{sec\.total\}` : sec\.total\}<\/span>/);
    assert.ok(!/dict-n\b|indexOf\(e\) \+ 1/.test(list), 'rows have no number');
    assert.match(list, /<span className="pb-chev" aria-hidden="true">▸<\/span>\s*<b>\{e\.term\}<\/b>\s*\{e\.starter \?/);
    assert.ok(!/dict-n/.test(readFileSync(new URL('../src/components/ProjectBibleDrawer.css', import.meta.url), 'utf8')));
  });
  it('search filters across both sections; a section with no match drops out', () => {
    assert.deepEqual(glossarySections(STRUCTURE_DICTIONARY, 'protagonist').map((x) => x.id), ['roles', 'craft']);
    const mentor = glossarySections(STRUCTURE_DICTIONARY, 'wisdom');
    assert.deepEqual(mentor.map((x) => [x.id, x.entries.map((e) => e.id)]), [['roles', ['mentor']]]);
    assert.deepEqual(glossarySections(STRUCTURE_DICTIONARY, 'cliffhanger').map((x) => x.id), ['craft']);
    assert.deepEqual(glossarySections(STRUCTURE_DICTIONARY, 'zzzz'), []);
    assert.match(list, /const sections = glossarySections\(dictionary, query\);/);
  });
});
