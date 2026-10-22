// Feature configuration: one place that gathers the app's real definitions — act structures, note
// cards, roles, Blueprint questions, Scene Board tags and pacing, shortcuts, colours — for
// anything that describes the app, above all the User Guide.
//
// Nothing here is a second copy: every value is read from the module that defines it, so when a
// feature changes, the guide changes with it. src/content/userGuide.md uses `{{name}}`
// placeholders (see GUIDE_VALUES below), filled in by lib/userGuide.js fillGuide();
// tests/userGuide.test.js fails if a placeholder has no value or the guide drifts from the app.

import {
  ACT_STRUCTURES, CHARACTER_FIELDS, DEFAULT_ACT_STRUCTURE, DEFAULT_SECTIONS, PRIMARY_ROLES, SECONDARY_ROLES, SYNOPSIS_AFTER, TREATMENT,
  actsFor, treatmentActHeading,
} from '../lib/bible.js';
import { PACING_TARGETS, PACING_TOLERANCE, STRUCTURES, TAGS } from '../lib/beats.js';
import { CONFLICT_TYPES, DEFAULT_DEVICES, DNA_QUESTIONS, GENRES, PLOT_DEVICES } from '../lib/storyDna.js';
import { GLOSSARY_SECTIONS } from '../lib/structureDictionary.js';
import { DUAL_SHORTCUT, ELEMENT_SHORTCUTS, SHORTCUTS } from '../lib/shortcuts.js';
import { CANVAS_THEMES } from '../lib/canvasTheme.js';
import { ACTION_LINE_LIMIT } from '../lib/pacing.js';
import { LOCK_COMBO } from '../lib/lock.js';
import { SNAPSHOT_DIR } from '../lib/folderSync.js';
import { SPEC_STAMP_ANGLE, SPEC_STAMP_TEXT } from '../lib/specStamp.js';
import { AUTHOR_PLACEHOLDER } from '../lib/authorDefaults.js';
import { LATE_NIGHT_HOURS, MILESTONES, PAGE_MILESTONES, SESSION_WORD_GOAL } from '../lib/milestones.js';
import { NOIR_COMBO, isNoirGenre } from '../lib/noir.js';
import { PAGE_LINES } from '../lib/screenplay.js';

/** The app's colour tokens (src/index.css :root, BeatBoard.css). tests check the CSS still matches. */
export const COLOR_TOKENS = {
  accent: '#c8553d', // typewriter-ribbon red: buttons, the D, picked pills
  text: '#e9e7e2',
  muted: '#9a9890', // labels, pills, secondary text
  'tag-plot': '#c8553d',
  'tag-subplot': '#3d7cc8',
  'tag-character': '#3f9a6b',
  'tag-theme': '#8a5cc8',
};

export const FEATURES = {
  acts: {
    structures: ACT_STRUCTURES,
    default: DEFAULT_ACT_STRUCTURE,
    cards: ['Synopsis', TREATMENT.label],
    labels: Object.fromEntries(ACT_STRUCTURES.map((n) => [n, actsFor('synopsis', n, null).map((a) => a.label)])),
    treatmentHeadings: Object.fromEntries(ACT_STRUCTURES.map((n) => [n, actsFor('treatment', n, null).map(treatmentActHeading)])),
  },
  notes: { sections: DEFAULT_SECTIONS, fixedCardsAfter: SYNOPSIS_AFTER },
  board: { structures: STRUCTURES, tags: TAGS, pacingTargets: PACING_TARGETS, pacingTolerance: PACING_TOLERANCE },
  characters: { primaryRoles: PRIMARY_ROLES, secondaryRoles: SECONDARY_ROLES.filter((r) => r.id !== 'none'), fields: CHARACTER_FIELDS },
  dna: { questions: DNA_QUESTIONS, conflictTypes: CONFLICT_TYPES, plotDevices: PLOT_DEVICES, defaultDevices: DEFAULT_DEVICES },
  glossary: { sections: GLOSSARY_SECTIONS },
  shortcuts: SHORTCUTS,
  elements: ELEMENT_SHORTCUTS,
  canvasThemes: CANVAS_THEMES,
  density: { lineLimit: ACTION_LINE_LIMIT },
  lock: { combo: LOCK_COMBO },
  sync: { snapshotDir: SNAPSHOT_DIR },
  colors: COLOR_TOKENS,
  // Editor Curiosities & Secrets (the guide's last chapter)
  curiosities: {
    stamp: { text: SPEC_STAMP_TEXT, angle: SPEC_STAMP_ANGLE },
    defaultAuthor: AUTHOR_PLACEHOLDER,
    milestones: MILESTONES,
    wordGoal: SESSION_WORD_GOAL,
    lateNight: LATE_NIGHT_HOURS,
    pages: PAGE_MILESTONES,
    noir: { combo: NOIR_COMBO, genre: GENRES.find(isNoirGenre) },
  },
};

// ---- Wording helpers -------------------------------------------------------------------------
const bold = (s) => `**${s}**`;
/** ['a', 'b', 'c'] → "a, b and c"; `or` for "a, b or c". */
export const listText = (items, last = 'and') => (items.length <= 1 ? items.join('')
  : `${items.slice(0, -1).join(', ')} ${last} ${items[items.length - 1]}`);
const roman = (n) => ['I', 'II', 'III', 'IV'][n - 1];

/**
 * Every placeholder the guide can use: `{{name}}` → Markdown. `{{key:Ctrl+S}}` (any combo) is
 * handled by fillGuide and must be a real shortcut.
 */
export function guideValues(f = FEATURES) {
  const v = {};
  const acts = f.acts;
  v['acts.structures'] = listText(acts.structures.map((n) => `${n} acts`), 'or'); // "3 acts or 4 acts"
  v['acts.cards'] = listText(acts.cards.map(bold));
  for (const n of acts.structures) {
    v[`acts.labels.${n}`] = acts.labels[n].join(', ');
    v[`acts.short.${n}`] = acts.labels[n].map((l) => l.split(':')[0]).join(', ');
    v[`acts.headings.${n}`] = acts.treatmentHeadings[n].map((h) => `\`### ${h}\``).join(', ');
    v[`board.columns.${n}`] = f.board.structures[n].map((c) => c.label).join(' · ');
    v[`board.targets.${n}`] = `${f.board.pacingTargets[n].join(' / ')}%`;
  }
  v['acts.importExamples'] = `${acts.structures.includes(3) ? '`### ACT I: SETUP`, `### ACT II`' : ''}${acts.structures.includes(4) ? ', `### ACT 1`, `### ACT 2A`, `### ACT 2B`, `### ACT 3`' : ''}`;
  v['acts.default'] = `${acts.default} acts`;
  v['notes.sections'] = listText(f.notes.sections.map(bold));
  v['notes.fixedAfter'] = f.notes.fixedCardsAfter;
  v['board.tags'] = listText(f.board.tags.map((t) => bold(t.label)));
  v['board.tolerance'] = String(f.board.pacingTolerance);
  v['roles.primary'] = listText(f.characters.primaryRoles.map((r) => r.label), 'or');
  v['roles.secondary'] = listText(f.characters.secondaryRoles.map((r) => r.label), 'or');
  v['bio.fields'] = f.characters.fields.map((x) => `- ${bold(x.label)}`).join('\n');
  v['dna.count'] = { 8: 'eight' }[f.dna.questions.length] || String(f.dna.questions.length);
  v['dna.questions'] = f.dna.questions.map((q, i) => `${i + 1}. ${bold(q.label)}: ${q.question.replace(/’/g, "'")}`).join('\n');
  v['dna.conflictTypes'] = listText(f.dna.conflictTypes.map((t) => t.replace(/^Individual vs\. /, '')), 'or');
  const devLabel = (id) => f.dna.plotDevices.find((d) => d.id === id)?.label;
  v['dna.defaultDevices'] = listText(f.dna.defaultDevices.map(devLabel));
  v['dna.optionalDevices'] = listText(f.dna.plotDevices.filter((d) => !f.dna.defaultDevices.includes(d.id)).map((d) => d.label));
  v['glossary.sections'] = listText(f.glossary.sections.map((s) => bold(s.label)));
  v['density.lines'] = { 4: 'four' }[f.density.lineLimit] || String(f.density.lineLimit);
  v['plan.pageLines'] = String(PAGE_LINES); // Plan: page eighths are measured against this
  v['lock.combo'] = `\`${f.lock.combo}\``;
  v['sync.snapshotDir'] = f.sync.snapshotDir;
  v['themes'] = f.canvasThemes.map((t) => `${bold(t.label)} (${t.hint.charAt(0).toLowerCase()}${t.hint.slice(1)})`).join(' or ');
  for (const e of f.elements) v[`element.${e.type}`] = `${bold(e.label)} (\`${e.combo}\`)`;
  v['element.dual'] = `\`${DUAL_SHORTCUT.combo}\``;
  const cur = f.curiosities;
  v['curiosities.stampText'] = `“${cur.stamp.text}”`;
  v['curiosities.stampAngle'] = `${cur.stamp.angle}°`;
  v['curiosities.defaultAuthor'] = cur.defaultAuthor;
  v['curiosities.wordGoal'] = String(cur.wordGoal);
  const hour = (h) => (h === 0 ? 'midnight' : `${h}:00 AM`);
  v['curiosities.lateNight'] = `${hour(cur.lateNight[0])} and ${hour(cur.lateNight[1])}`;
  for (const [id, page] of cur.pages) v[`curiosities.${id}`] = String(page);
  const quoted = (s) => (/^[“"]/.test(s) ? s : `“${s}”`);
  for (const [id, text] of Object.entries(cur.milestones)) v[`milestones.${id}`] = quoted(text);
  v['curiosities.noirCombo'] = `\`${cur.noir.combo}\``;
  v['curiosities.noirGenre'] = cur.noir.genre;
  v['acts.roman'] = acts.structures.includes(3) ? [1, 2, 3].map((n) => `Act ${roman(n)}`).join(', ') : '';
  return v;
}

export const GUIDE_VALUES = guideValues();
