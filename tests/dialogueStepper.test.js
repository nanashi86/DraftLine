import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { analyzeScript, makeBlock } from '../src/lib/screenplay.js';
import { dialogueKeyAction, dialogueStops, speechSnippet, stepperPosition } from '../src/lib/dialogueFilter.js';
import { stepRisk } from '../src/lib/pacing.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const blocks = [
  makeBlock('scene', 'EXT. HARBOR - DAWN'),
  makeBlock('character', 'MARIE'),
  makeBlock('dialogue', 'I said be here by six.'),
  makeBlock('character', 'THEO'),
  makeBlock('dialogue', 'It’s not even five-thirty.'),
  makeBlock('scene', 'INT. FERRY - NIGHT'),
  makeBlock('character', 'MARIE'),
  makeBlock('parenthetical', '(not looking at him)'),
  makeBlock('dialogue', 'I left a letter for Manman, and I did not say I would ever come back to this island, Theo.'),
];
const analysis = analyzeScript(blocks);
const scenes = [{ id: blocks[0].id, number: 1 }, { id: blocks[5].id, number: 2 }];
const pageOf = Object.fromEntries(blocks.map((b, i) => [b.id, i < 5 ? 1 : 2]));
const ctx = { sceneOf: analysis.sceneOfBlock, scenes, pageOf };

describe('Dialogue stepper: the filtered character’s speeches', () => {
  it('one stop per speech, in order, aimed at its first dialogue line', () => {
    const stops = dialogueStops(analysis, 'MARIE', ctx);
    assert.equal(stops.length, 2);
    assert.deepEqual(stops.map((s) => s.id), [blocks[2].id, blocks[8].id], 'the dialogue block, past any parenthetical');
    assert.deepEqual(stops.map((s) => [s.scene, s.page]), [[1, 1], [2, 2]]);
    assert.equal(stops[0].label, 'Sc. 1 · p. 1 — “I said be here by six.”');
    assert.equal(stops[1].label, "Sc. 2 · p. 2 — “I left a letter for Manman, and I did not say I…”");
  });
  it('switching character changes the name, count and list; no character → nothing', () => {
    const theo = dialogueStops(analysis, 'THEO', ctx);
    assert.deepEqual(theo.map((s) => s.label), ['Sc. 1 · p. 1 — “It’s not even five-thirty.”']);
    assert.deepEqual(dialogueStops(analysis, null, ctx), []);
    assert.deepEqual(dialogueStops(analysis, 'NOBODY', ctx), []);
  });
  it('snippets: one line, cut at a word', () => {
    assert.equal(speechSnippet([{ type: 'dialogue', text: 'Short.' }]), 'Short.');
    assert.equal(speechSnippet([{ type: 'parenthetical', text: '(beat)' }]), '(beat)', 'no dialogue: the parenthetical');
    assert.ok(speechSnippet([{ type: 'dialogue', text: 'word '.repeat(30) }]).length <= 49);
  });
  it('position "3 of 12" (just "12" before the first step); ‹ › loop', () => {
    assert.equal(stepperPosition(-1, 12), '12');
    assert.equal(stepperPosition(12, 12), '12', 'out of range: the count, never "– of"');
    assert.equal(stepperPosition(2, 12), '3 of 12');
    assert.equal(stepRisk(-1, 3, 'next'), 0);
    assert.equal(stepRisk(2, 3, 'next'), 0, 'loops');
    assert.equal(stepRisk(0, 3, 'prev'), 2);
    assert.equal(stepRisk(-1, 3, 'prev'), 2);
  });
  it('keys: Alt+↓ / Alt+↑ anywhere; ] / [ only outside text fields', () => {
    const k = (o) => ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'BODY' }, ...o });
    assert.equal(dialogueKeyAction(k({ altKey: true, key: 'ArrowDown', target: { tagName: 'TEXTAREA' } })), 'next');
    assert.equal(dialogueKeyAction(k({ altKey: true, key: 'ArrowUp' })), 'prev');
    assert.equal(dialogueKeyAction(k({ key: ']' })), 'next');
    assert.equal(dialogueKeyAction(k({ key: '[' })), 'prev');
    for (const tagName of ['TEXTAREA', 'INPUT']) assert.equal(dialogueKeyAction(k({ key: ']', target: { tagName } })), null, `typing ] in a ${tagName}`);
    assert.equal(dialogueKeyAction(k({ key: ']', target: { tagName: 'DIV', isContentEditable: true } })), null);
    assert.equal(dialogueKeyAction(k({ ctrlKey: true, key: ']' })), null);
    assert.equal(dialogueKeyAction(k({ altKey: true, shiftKey: true, key: 'ArrowDown' })), null);
    assert.equal(dialogueKeyAction(k({ key: 'ArrowDown' })), null);
  });
});

describe('Status bar steppers: one capsule for Dialogue and Density', () => {
  const capsule = read('components/StatusStepper.jsx');
  const dlg = read('components/DialogueStepper.jsx');
  const dens = read('components/DensityStepper.jsx');
  const app = read('App.jsx');
  const css = read('App.css');
  // A selector's own rule: the last block that opens with it (not a shared "a,\nb {" list before it).
  const rule = (sel) => [...css.matchAll(new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'gm'))].at(-1)?.[1] ?? '';

  it('both steppers render through StatusStepper — same markup, same classes', () => {
    assert.match(dlg, /<StatusStepper\s+tone="neutral"/);
    assert.match(dens, /<StatusStepper\s+tone="amber"/);
    assert.ok(!/stepper-capsule|createPortal/.test(dlg + dens), 'no capsule or list markup of their own');
    assert.match(capsule, /<span className=\{`stepper is-\$\{tone\}\$\{stepping \? ' is-stepping' : ''\}`\}/);
    assert.match(capsule, /<span className="stepper-capsule" ref=\{anchorRef\}>/);
  });
  it('[ icon Label · n of N  ‹ › ] (✕): chevrons inside the capsule, dismiss outside it', () => {
    const inside = capsule.slice(capsule.indexOf('<span className="stepper-capsule"'), capsule.indexOf('{onDismiss && ('));
    for (const part of ['className="stepper-icon"', 'className="stepper-label"', 'className="stepper-dot" aria-hidden="true">·', 'className="stepper-pos"', "onStep('prev')", "onStep('next')", '<ChevronLeft', '<ChevronRight']) {
      assert.ok(inside.includes(part), part);
    }
    assert.ok(!inside.includes('stepper-dismiss'), 'dismiss is its own button outside the capsule');
    assert.match(capsule, /className="stepper-dismiss" onClick=\{\(\) => \{ setListOpen\(false\); onDismiss\(\); \}\}/);
    assert.ok(!/▴|ChevronUp/.test(capsule + dens), 'no boxed up-arrow button');
  });
  it('geometry: 24px full pill, 11px / 500 / 0.02em; dismiss an 18px circle 6px away; same hover', () => {
    const c = rule('.stepper-capsule');
    for (const d of ['height: 24px', 'border-radius: 9999px', 'font: 500 11px/1 var(--ui-font)', 'letter-spacing: 0.02em']) assert.ok(c.includes(d), d);
    const x = rule('.stepper-dismiss');
    for (const d of ['width: 18px', 'height: 18px', 'margin-left: 6px', 'border-radius: 50%']) assert.ok(x.includes(d), d);
    assert.match(css, /\.stepper-step:hover,\s*\.stepper-dismiss:hover,\s*\.stepper-main\.is-open \{ background: var\(--stepper-hover\); color: var\(--stepper-strong\); \}/);
    assert.match(css, /\.stepper\.is-amber \{ --stepper-ink: var\(--accent-amber\);/);
    assert.match(read('index.css'), /--accent-amber: #f59e0b;/);
  });
  it('the label opens / closes the dropup list; ‹ › step without opening it', () => {
    assert.match(capsule, /const labelClick = \(\) => \{\s*if \(list && stepping\) setListOpen\(\(o\) => !o\);\s*else onLabel\?\.\(\);/);
    assert.match(capsule, /onClick=\{\(\) => onStep\('next'\)\}/);
    assert.ok(!/setListOpen[^\n]*onStep|onStep[^\n]*setListOpen/.test(capsule), 'stepping never touches the list');
    assert.match(capsule, /createPortal\(/);
  });
  it('Dialogue: [ 💬 NAME · n of N ‹ › ] (✕) with the drawer’s own speech bubble; ✕ clears the filter', () => {
    assert.match(dlg, /icon=\{<TabIcon name="dialogue" \/>\}/);
    assert.match(dlg, /label=\{<span className="stepper-name">\{name\}<\/span>\}/);
    assert.match(dlg, /position=\{stepperPosition\(index, total\)\}/);
    assert.match(dlg, /onDismiss=\{onClear\}/);
    assert.match(css, /\.stepper-name \{ text-transform: uppercase;/);
    assert.match(css, /\.stepper-icon \{ display: inline-flex; flex: none; margin-right: 6px;/);
    assert.match(read('components/TabIcon.jsx'), /strokeWidth="1\.75"/);
    assert.match(capsule, /const ICON = \{ size: 13, strokeWidth: 1\.75, 'aria-hidden': true \};/);
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(pkg.dependencies['lucide-react'], /^\d+\.\d+\.\d+$/, 'pinned');
  });
  it('Density: the same compact capsule as Format — "Density · 9 ‹ ›", then "3 of 9" with ✕; never a wide "Skim Risks" button', () => {
    assert.match(dens, /label="Density"/);
    assert.match(dens, /<TriangleAlert size=\{14\} strokeWidth=\{1\.75\} aria-hidden \/>/);
    assert.match(dens, /position=\{riskPosition\(density, on \? index : -1\)\}/);
    assert.match(dens, /onStep=\{onStep\}/);
    assert.match(dens, /onDismiss=\{on \? onOff : undefined\}/);
    assert.doesNotMatch(dens, /skimRisks|onLabel|onStart/);
    assert.match(app, /setDensityMode\(true\); \/\/ ‹ › before the highlights are on turns them on\s*jumpToRisk\(stepRisk\(densityMode \? densityIndex : -1, density\.dense, dir\)\);/);
    assert.ok(!existsSync(new URL('../src/components/DensityNav.jsx', import.meta.url)), 'the old control is gone');
  });
  it('the app: both in the right-hand tools cluster, Dialogue first; only while a filter is on', () => {
    const tools = app.slice(app.indexOf('<div className="status-tools" hidden={inPlan}>'), app.indexOf('<span title="54 lines per page">'));
    assert.ok(tools.indexOf('<DialogueStepper') >= 0 && tools.indexOf('<DialogueStepper') < tools.indexOf('<DensityStepper'));
    assert.match(tools, /\{filter && \(\s*<DialogueStepper\s*name=\{filter\.name\}\s*stops=\{dialogueStopList\}\s*index=\{dialogueIndex\}\s*onStep=\{stepSpeech\}\s*onGo=\{jumpToSpeech\}\s*onClear=\{\(\) => setSelectedChar\(null\)\}/);
    assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => editorRef\.current\?\.pulseBlock\(target\.id\)\)\);/);
    assert.match(app, /const act = dialogueKeyAction\(e\);\s*if \(!act\) return;\s*e\.preventDefault\(\);\s*stepSpeechRef\.current\(act\);/);
  });
});

describe('Characters → Dialogue tab: nothing picked to start', () => {
  const tuner = read('components/DialogueTuner.jsx');
  const app = read('App.jsx');
  it('no default character: no pill lit, an empty state instead of lines', () => {
    assert.match(tuner, /const current = \(selected && analysis\.characters\.get\(selected\)\) \|\| null;/);
    assert.ok(!/characterList\[0\]/.test(tuner), 'never falls back to the first character');
    assert.match(tuner, /\{!current && \(\s*<div className="dialogue-empty-state">Select a character to spotlight their dialogue across the script<\/div>/);
    assert.match(tuner, /aria-selected=\{current\?\.name === c\.name\}/);
    assert.match(app, /const \[selectedChar, setSelectedChar\] = useState\(null\);/, 'the app starts with no filter');
  });
  it('picking a pill: filter on, stepper at 1 of N, scroll + pulse to the first line', () => {
    assert.match(app, /onSelect: selectCharacter,/);
    assert.match(app, /const selectCharacter = \(name\) => \{\s*setSelectedChar\(name\);\s*if \(!name\) return;\s*const first = dialogueStops\(analysis, name,/);
    assert.match(app, /setDialoguePos\(\{ name: analysis\.characters\.get\(name\)\?\.name \?\? name, index: 0 \}\);/);
    assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => editorRef\.current\?\.pulseBlock\(first\.id\)\)\);/);
  });
});

describe('Status bar: the Format stepper', () => {
  const fs = read('components/FormatStepper.jsx');
  const app = read('App.jsx');
  it('the same capsule: [ stethoscope Format · n of N ‹ › ] (✕)', () => {
    assert.match(fs, /import StatusStepper from '\.\/StatusStepper\.jsx';/);
    assert.match(fs, /import \{ Cross \} from 'lucide-react';/);
    assert.match(fs, /const ICON = <Cross size=\{14\} strokeWidth=\{1\.5\} aria-hidden \/>;/, 'a crisp medical cross in the muted ink');
    assert.doesNotMatch(fs, /Stethoscope/);
    assert.match(readFileSync(new URL('../src/App.css', import.meta.url), 'utf8'), /\.stepper\.is-neutral \.stepper-main:hover \.stepper-icon,\s*\.stepper\.is-neutral \.stepper-main\.is-open \.stepper-icon \{ color: var\(--stepper-strong\); \}/);
    assert.match(fs, /label="Format"\s*position=\{stepperPosition\(index, total\)\}/);
    assert.ok(!/\p{Extended_Pictographic}/u.test(fs.replace(/\/\/.*|\/\*[\s\S]*?\*\/|^ \*.*$/gm, '')), 'a line icon, not an emoji');
  });
  it('its list: every finding with Fix (when there is one) and Ignore, and Open Format Doctor…', () => {
    assert.match(fs, /\.\.\.\(canFix\(it\.kind\) \? \[\{ label: 'Fix', primary: true/);
    assert.match(fs, /\{ label: 'Ignore', title: 'Hide this finding for this session', onClick: \(\) => onIgnore\(it\) \}/);
    assert.match(fs, /footer: \{ label: 'Open Format Doctor…', onClick: onOpenDoctor \}/);
    const ss = read('components/StatusStepper.jsx');
    assert.match(ss, /<span className="stepper-list-actions">/, 'row buttons rendered by the shared stepper');
  });
  it('the app: shown while there are findings (until ✕), in the tools cluster; Ignore is per session; ‹ › jump and pulse', () => {
    assert.match(app, /\{showFormatStepper && \(\s*<FormatStepper/);
    assert.match(app, /const showFormatStepper = issues\.some\(\(it\) => !formatHidden\.has\(issueKey\(it\)\)\);/);
    assert.match(app, /onDismiss=\{\(\) => setFormatHidden\(new Set\(issues\.map\(issueKey\)\)\)\}/);
    assert.match(app, /auditScript\(blocks, \{ skipId: activeId, ignore: ignoredIssues, layout \}\)/);
    assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => editorRef\.current\?\.pulseBlock\(it\.id\)\)\);/);
    const tools = app.slice(app.indexOf('<div className="status-tools" hidden={inPlan}>'), app.indexOf('</div>', app.indexOf('<div className="status-tools" hidden={inPlan}>')));
    assert.ok(tools.indexOf('<DialogueStepper') < tools.indexOf('<FormatStepper') && tools.indexOf('<FormatStepper') < tools.indexOf('<DensityStepper'));
  });
  it('Fix All fixes only what can be fixed', () => {
    assert.match(app, /const list = all\.filter\(\(it\) => canFix\(it\.kind\)\);/);
  });
});
