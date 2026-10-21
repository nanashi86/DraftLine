// Architectural check: the User Guide describes the app from the app's own definitions.
// src/content/userGuide.md is a template; its {{placeholders}} are filled from
// src/config/features.js, which reads every value from the module that defines it. These tests
// fail when the guide hard-codes a fact the config owns, when a placeholder has no value, or when
// the rendered guide no longer matches what the app does.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLOR_TOKENS, FEATURES, GUIDE_VALUES, guideValues, listText } from '../src/config/features.js';
import { fillGuide, parseGuide } from '../src/lib/userGuide.js';
import {
  ACT_STRUCTURES, CHARACTER_FIELDS, DEFAULT_SECTIONS, PRIMARY_ROLES, SECONDARY_ROLES, actsFor, treatmentActHeading,
} from '../src/lib/bible.js';
import { PACING_TARGETS, PACING_TOLERANCE, STRUCTURES, TAGS } from '../src/lib/beats.js';
import { DNA_QUESTIONS, PLOT_DEVICES } from '../src/lib/storyDna.js';
import { GLOSSARY_SECTIONS } from '../src/lib/structureDictionary.js';
import { ELEMENT_SHORTCUTS, SHORTCUTS } from '../src/lib/shortcuts.js';
import { CANVAS_THEMES } from '../src/lib/canvasTheme.js';

const source = readFileSync(new URL('../src/content/userGuide.md', import.meta.url), 'utf8');
const filled = fillGuide(source, GUIDE_VALUES, { shortcuts: SHORTCUTS });
const text = filled.text;
const flat = text.replace(/\s+/g, ' ');

describe('User Guide template: every placeholder resolves', () => {
  it('no placeholder without a value, no shortcut that doesn’t exist', () => {
    assert.deepEqual(filled.missing, []);
    assert.ok(!/\{\{|\}\}/.test(text), 'nothing left unfilled');
  });
  it('the guide really is a template (it uses the config, not copies of it)', () => {
    const used = new Set([...source.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1]));
    assert.ok(used.size > 30, `${used.size} placeholders`);
    for (const k of ['acts.structures', 'acts.labels.3', 'acts.labels.4', 'acts.importExamples', 'notes.sections', 'roles.primary',
      'roles.secondary', 'dna.questions', 'board.tags', 'board.targets.3', 'board.targets.4', 'themes']) assert.ok(used.has(k), k);
  });
  it('unknown placeholders and fake shortcuts are reported, and stay visible', () => {
    const r = fillGuide('A {{nope}} and {{key:Ctrl+Q}} and {{key:Esc}}', {}, { shortcuts: SHORTCUTS });
    assert.deepEqual(r.missing, ['nope', 'key:Ctrl+Q']);
    assert.equal(r.text, 'A {{nope}} and `Ctrl+Q` and `Esc`');
  });
});

describe('User Guide source: no hand-copied app facts', () => {
  it('shortcuts only as {{key:…}} (so each is checked against the shortcut list)', () => {
    assert.ok(!/`(?:Ctrl|Alt|Shift)\+[^`]+`|`F1`/.test(source));
  });
  it('act names, pacing targets, note cards, roles and tags come from the config', () => {
    for (const label of [...ACT_STRUCTURES.flatMap((n) => actsFor('synopsis', n, null).map((a) => a.label))]) assert.ok(!source.includes(label), label);
    assert.ok(!/25 \/ 50 \/ 25|25% each/.test(source), 'pacing targets');
    assert.ok(!source.includes('**Logline**, **Tone**'), 'note sections');
    assert.ok(!source.includes('Protagonist, Antagonist'), 'primary roles');
    assert.ok(!source.includes('**Plot**, **Subplot**'), 'board tags');
    assert.ok(!/in eight questions|past four lines/.test(source), 'counts');
  });
});

describe('Rendered User Guide matches the app', () => {
  it('both act structures, with every act label and the Treatment headings', () => {
    assert.ok(flat.includes(`in ${ACT_STRUCTURES.map((n) => `${n} acts`).join(' or ')}`));
    for (const n of ACT_STRUCTURES) {
      for (const a of actsFor('synopsis', n, null)) assert.ok(flat.includes(a.label), a.label);
      for (const a of actsFor('treatment', n, null)) assert.ok(flat.includes(`\`### ${treatmentActHeading(a)}\``), treatmentActHeading(a));
    }
    for (const h of ['### ACT I: SETUP', '### ACT II', '### ACT 1', '### ACT 2A', '### ACT 2B', '### ACT 3']) assert.ok(flat.includes(`\`${h}\``), h);
  });
  it('the default note cards, the roles, the bio fields', () => {
    for (const s of DEFAULT_SECTIONS) assert.ok(flat.includes(`**${s}**`), s);
    for (const r of [...PRIMARY_ROLES, ...SECONDARY_ROLES.filter((x) => x.id !== 'none')]) assert.ok(flat.includes(r.label), r.label);
    for (const f of CHARACTER_FIELDS) assert.ok(flat.includes(`**${f.label}**`), f.label);
  });
  it('the Blueprint questions in order, the plot devices, the Glossary sections', () => {
    const g = parseGuide(text).chapters.find((c) => c.title === 'Story Bible').topics.find((t) => t.title === 'DNA: Blueprint');
    const ol = g.blocks.find((b) => b.type === 'ol');
    assert.deepEqual(ol.items, DNA_QUESTIONS.map((q) => `**${q.label}**: ${q.question.replace(/’/g, "'")}`));
    for (const d of PLOT_DEVICES) assert.ok(flat.includes(d.label), d.label);
    for (const s of GLOSSARY_SECTIONS) assert.ok(flat.includes(`**${s.label.replace('&', '&')}**`), s.label);
  });
  it('Scene Board columns, tags and pacing numbers', () => {
    for (const n of [3, 4]) {
      assert.ok(flat.includes(STRUCTURES[n].map((c) => c.label).join(' · ')), `${n}-act columns`);
      assert.ok(flat.includes(`${PACING_TARGETS[n].join(' / ')}%`), `${n}-act targets`);
    }
    for (const t of TAGS) assert.ok(flat.includes(`**${t.label}**`), t.label);
    assert.ok(flat.includes(`more than ${PACING_TOLERANCE} points`));
  });
  it('every element with its own shortcut, and the page colours', () => {
    for (const e of ELEMENT_SHORTCUTS) assert.ok(flat.includes(`**${e.label}** (\`${e.combo}\`)`), e.label);
    for (const t of CANVAS_THEMES) assert.ok(flat.includes(`**${t.label}**`), t.label);
  });
});

describe('Feature config drives the guide', () => {
  it('a change to a feature definition changes the guide text', () => {
    const only3 = guideValues({ ...FEATURES, acts: { ...FEATURES.acts, structures: [3] } });
    assert.equal(only3['acts.structures'], '3 acts');
    assert.ok(!only3['acts.importExamples'].includes('2A'));
    const renamed = guideValues({ ...FEATURES, notes: { ...FEATURES.notes, sections: ['Logline', 'Beat Sheet'] } });
    assert.equal(fillGuide('Cards: {{notes.sections}}.', renamed).text, 'Cards: **Logline** and **Beat Sheet**.');
    assert.equal(listText(['a', 'b', 'c'], 'or'), 'a, b or c');
  });
  it('the modal renders the filled template', () => {
    const ui = readFileSync(new URL('../src/components/UserGuideModal.jsx', import.meta.url), 'utf8');
    assert.match(ui, /parseGuide\(fillGuide\(userGuideMarkdown, GUIDE_VALUES, \{ shortcuts: SHORTCUTS \}\)\.text\)/);
  });
  it('colour tokens in the config match the stylesheets', () => {
    const css = ['index.css', 'components/BeatBoard.css'].map((f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')).join('\n');
    for (const [name, value] of Object.entries(COLOR_TOKENS)) {
      assert.match(css, new RegExp(`--${name}: ${value};`, 'i'), `--${name}`);
    }
  });
});
