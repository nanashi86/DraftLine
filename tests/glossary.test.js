import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STRUCTURE_DICTIONARY, dictionaryEntry, groupHeadingAt, mergeDictionary, searchDictionary,
} from '../src/lib/structureDictionary.js';

const ROLE_DEFINITIONS = {
  protagonist: 'The primary driver of the story whose goals and moral choices dictate the plot.',
  antagonist: 'The primary obstacle or opposing force standing between the protagonist and their goal.',
  deuteragonist: 'The second most important character, often acting as a principal partner, rival, or counterweight.',
  tritagonist: 'The third most significant character, often serving as a catalyst, instigator, or key moral witness.',
  foil: 'A character whose contrasting values, background, or choices highlight and challenge the protagonist’s traits.',
  catalyst: 'A character whose actions or arrival fundamentally disrupts the status quo and forces the narrative into motion.',
  mentor: 'A figure providing wisdom, instruction, or ethical boundaries to the protagonist.',
  confidant: 'A trusted ally who allows the protagonist’s inner thoughts and vulnerabilities to be vocalized.',
  shadow: 'A dark reflection of the protagonist showing the catastrophic outcome of their negative impulses.',
};

describe('Glossary: screenplay roles', () => {
  it('has the standard definitions, word for word', () => {
    for (const [id, def] of Object.entries(ROLE_DEFINITIONS)) assert.equal(dictionaryEntry(STRUCTURE_DICTIONARY, id)?.definition, def, id);
    assert.equal(dictionaryEntry(STRUCTURE_DICTIONARY, 'confidant').term, 'Confidant(e)');
  });
  it('every role term is grouped under Character Roles and searchable', () => {
    const roles = STRUCTURE_DICTIONARY.filter((e) => e.group === 'Character Roles');
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
  it('the Glossary list shows a "Character Roles" heading before the group', () => {
    const ui = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
    assert.match(ui, /const heading = groupHeadingAt\(shown, i\);/);
    const at = STRUCTURE_DICTIONARY.map((_, i) => groupHeadingAt(STRUCTURE_DICTIONARY, i));
    assert.equal(at.filter(Boolean).length, 1);
    assert.equal(STRUCTURE_DICTIONARY[at.indexOf('Character Roles')].id, 'antagonist'); // Protagonist stays with the Blueprint terms
    const found = searchDictionary(STRUCTURE_DICTIONARY, 'protagonist');
    assert.equal(groupHeadingAt([dictionaryEntry(STRUCTURE_DICTIONARY, 'mentor')], 0), 'Character Roles');
    assert.ok(found.length > 1);
    assert.match(ui, /<li className="dict-group micro-label" aria-hidden="true">\{heading\}<\/li>/);
  });
});
