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
    // Word for word as given; Catalyst adds one note after it, on Save the Cat's other use of the word.
    for (const [id, def] of Object.entries(ROLE_DEFINITIONS)) {
      const got = dictionaryEntry(STRUCTURE_DICTIONARY, id)?.definition;
      if (id === 'catalyst') assert.ok(got.startsWith(`${def} (In Save the Cat`), id);
      else assert.equal(got, def, id);
    }
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
  'Protagonist', 'Antagonist', 'Deuteragonist', 'Tritagonist', 'Supporting', 'Minor / Cameo',
  'Catalyst', 'Confidant(e)', 'Foil', 'Henchman / Enforcer', 'Love Interest', 'Mentor / Guide',
  'Shadow / Mirror', 'Skeptic / Voice of Reason', 'Threshold Guardian',
];
const CRAFT = [
  'All Is Lost / Crisis', 'B-Story', 'Cliffhanger', 'Climax', 'Complications', 'Conflict / Obstacle', 'Deus ex machina', 'Flashback', 'Flaw',
  'Foreshadowing', 'Goal / Desire', 'Inciting Incident', 'Love triangle', 'MacGuffin', 'Midpoint', 'Quest', 'Red herring',
  'Resolution / Falling Action', 'Setup & Payoff', 'Stakes', 'Text / Subtext / Context', 'Ticking Clock', 'Want vs. Need',
];

describe('Glossary: three sections — Character Roles, Narrative & Dramatic Craft, Screenplay Format', () => {
  const ui = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
  const list = ui.slice(ui.indexOf('function Dictionary('), ui.indexOf('export default function StoryDna'));

  it('lists the terms in exactly the order given, Protagonist first among the roles', () => {
    const [roles, craft, format] = glossarySections(mergeDictionary());
    assert.deepEqual([roles.label, roles.total, craft.label, craft.total, format.label, format.total], ['Character Roles', 15, 'Narrative & Dramatic Craft', 23, 'Screenplay Format', 19]);
    assert.deepEqual(roles.entries.map((e) => e.term), ROLES);
    assert.deepEqual(craft.entries.map((e) => e.term), CRAFT);
  });
  it('every term is in exactly one section, and nothing is left out', () => {
    const all = GLOSSARY_SECTIONS.flatMap((x) => x.ids);
    assert.equal(new Set(all).size, all.length);
    assert.deepEqual([...all].sort(), STRUCTURE_DICTIONARY.map((e) => e.id).sort());
    assert.equal(sectionOf('protagonist'), 'roles');
    assert.equal(sectionOf('climax'), 'craft');
    assert.equal(sectionOf('more'), 'format');
  });
  it('the role terms carry the Bios picker names, so each ⓘ opens the term you picked', () => {
    for (const r of [...PRIMARY_ROLES, ...SECONDARY_ROLES.filter((x) => x.id !== 'none')]) {
      assert.equal(dictionaryEntry(STRUCTURE_DICTIONARY, r.dict).term, r.label);
    }
  });
  it('each section has a subheader with its term count — no 1–57 numbering on the rows', () => {
    assert.match(list, /<h3 id=\{`dict-sec-\$\{sec\.id\}`\} className="dict-section-head micro-label">\s*\{sec\.label\}/);
    assert.match(list, /<span className="dict-section-count">\{searching \? `\$\{sec\.entries\.length\} of \$\{sec\.total\}` : sec\.total\}<\/span>/);
    assert.ok(!/dict-n\b|indexOf\(e\) \+ 1/.test(list), 'rows have no number');
    assert.match(list, /<span className="pb-chev" aria-hidden="true">▸<\/span>\s*<b>\{e\.term\}<\/b>\s*\{e\.starter \?/);
    assert.ok(!/dict-n/.test(readFileSync(new URL('../src/components/ProjectBibleDrawer.css', import.meta.url), 'utf8')));
  });
  it('search filters across all three sections; a section with no match drops out', () => {
    assert.deepEqual(glossarySections(STRUCTURE_DICTIONARY, 'protagonist').map((x) => x.id), ['roles', 'craft']);
    const mentor = glossarySections(STRUCTURE_DICTIONARY, 'wisdom');
    assert.deepEqual(mentor.map((x) => [x.id, x.entries.map((e) => e.id)]), [['roles', ['mentor']]]);
    assert.deepEqual(glossarySections(STRUCTURE_DICTIONARY, 'cliffhanger').map((x) => x.id), ['craft']);
    assert.deepEqual(glossarySections(STRUCTURE_DICTIONARY, 'zzzz'), []);
    assert.match(list, /const sections = glossarySections\(dictionary, query\);/);
  });
});

describe('Glossary: Screenplay Format', () => {
  const FORMAT = [
    'Scene Heading (Slugline)', 'Action', 'Character Cue', 'Dialogue', 'Parenthetical (Wryly)', 'V.O. / O.S. / O.C.', '(CONT’D)', '(MORE)',
    'Dual Dialogue', 'Transition', 'Beat', 'Insert', 'Intercut', 'Montage / Series of Shots', 'One Page, One Minute', 'Page Eighths',
    'Pre-lap', 'Spec Script', 'Super (Superimpose)',
  ];
  it('the page’s elements in the order they appear, then the other terms A–Z', () => {
    const format = glossarySections(mergeDictionary()).find((x) => x.id === 'format');
    assert.deepEqual(format.entries.map((e) => e.term), FORMAT);
    const rest = FORMAT.slice(10);
    assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b)));
  });
  it('every term starts as DraftLine’s starter text and can be made your own, like the others', () => {
    const merged = mergeDictionary({ more: { definition: 'My class handout on page breaks.' } });
    assert.equal(dictionaryEntry(merged, 'more').definition, 'My class handout on page breaks.');
    assert.equal(dictionaryEntry(merged, 'more').starter, false);
    assert.equal(dictionaryEntry(merged, 'contd').starter, true);
    for (const id of GLOSSARY_SECTIONS.find((x) => x.id === 'format').ids) assert.ok(dictionaryEntry(STRUCTURE_DICTIONARY, id).definition.length > 60, id);
  });
  it('search finds the format terms writers look up', () => {
    assert.deepEqual(glossarySections(STRUCTURE_DICTIONARY, 'pre-lap').map((x) => [x.id, x.entries.map((e) => e.id)]), [['format', ['prelap']]]);
    assert.ok(searchDictionary(STRUCTURE_DICTIONARY, 'voice-over').some((e) => e.id === 'extensions'));
    assert.ok(searchDictionary(STRUCTURE_DICTIONARY, 'INT./EXT.').some((e) => e.id === 'sceneHeading'), 'the example is searched too');
  });
  it('Format Doctor findings point at real format terms, for findings that exist', async () => {
    const { ISSUE_KINDS } = await import('../src/lib/formatDoctor.js');
    const { FORMAT_TERM_FOR_ISSUE } = await import('../src/lib/structureDictionary.js');
    const format = new Set(GLOSSARY_SECTIONS.find((x) => x.id === 'format').ids);
    for (const [kind, id] of Object.entries(FORMAT_TERM_FOR_ISSUE)) {
      assert.ok(ISSUE_KINDS[kind], `finding ${kind} exists`);
      assert.ok(format.has(id), `${kind} → ${id} is a Screenplay Format term`);
    }
    assert.equal(FORMAT_TERM_FOR_ISSUE.orphanparen, 'parenthetical');
    assert.equal(FORMAT_TERM_FOR_ISSUE.slugformat, 'sceneHeading');
  });
  it('a finding’s chip opens its term: Format Doctor closes, Story Bible → DNA → Glossary opens at it', () => {
    const modal = readFileSync(new URL('../src/components/FormatDoctorModal.jsx', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(modal, /const term = onTerm && FORMAT_TERM_FOR_ISSUE\[k\];/);
    assert.match(modal, /className=\{`fd-chip fd-k-\$\{k\} is-term`\}\s*onClick=\{\(\) => onTerm\(term\)\}/);
    assert.match(modal, /<BookOpen size=\{12\} strokeWidth=\{1\.75\} aria-hidden className="fd-chip-term" \/>/);
    assert.match(app, /onTerm=\{\(id\) => \{\s*closeDoctor\(\);\s*openGlossary\(id\);/);
  });
  it('the starter / yours badges explain themselves on hover', () => {
    const ui = readFileSync(new URL('../src/components/StoryDna.jsx', import.meta.url), 'utf8');
    assert.match(ui, /title="DraftLine’s starter definition\. Open the term and click Edit to use your own wording">starter</);
    assert.match(ui, /title="Your wording, kept for all your projects\. Edit → Reset to starter text brings DraftLine’s back">yours</);
  });
});
