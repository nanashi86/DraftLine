import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  it('position "3 of 12" ("– of 12" before the first step); ‹ › loop', () => {
    assert.equal(stepperPosition(-1, 12), '– of 12');
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

describe('Dialogue stepper: look and wiring', () => {
  const ui = read('components/DialogueStepper.jsx');
  const app = read('App.jsx');
  const css = read('App.css');
  it('Lucide line icons (Theater, ChevronLeft/Right, X) at 13px, stroke 1.75 — no emoji', () => {
    assert.match(ui, /import \{ ChevronLeft, ChevronRight, Theater, X \} from 'lucide-react';/);
    assert.match(ui, /const ICON = \{ size: 13, strokeWidth: 1\.75, 'aria-hidden': true \};/);
    for (const icon of ['Theater', 'ChevronLeft', 'ChevronRight', 'X']) assert.match(ui, new RegExp(`<${icon} \\{\\.\\.\\.ICON\\}`), icon);
    assert.ok(!/\p{Extended_Pictographic}/u.test(ui.replace(/\/\/.*|\/\*[\s\S]*?\*\/|^ \*.*$/gm, '')), 'no emoji in the markup');
    assert.match(css, /\.dlg-icon \{ flex: none; color: var\(--muted\); \}/);
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(pkg.dependencies['lucide-react'], /^\d+\.\d+\.\d+$/, 'pinned');
  });
  it('the density pill’s shape and type, on a neutral surface; uppercase name', () => {
    const pill = /\.dlg-pill \{([^}]*)\}/.exec(css)[1];
    for (const d of ['border: 1px solid var(--line-soft)', 'border-radius: 999px', 'color: var(--muted)']) assert.ok(pill.includes(d), d);
    assert.match(css, /\.dlg-name \{[^}]*text-transform: uppercase; letter-spacing: 0\.04em;/);
    assert.match(css, /\.dlg-main \{[^}]*font: inherit;/, 'the status bar’s own font and size');
  });
  it('[ icon NAME n of N ‹ › ] [ × ]: the pill opens the list; × clears the filter', () => {
    assert.match(ui, /<Theater \{\.\.\.ICON\} className="dlg-icon" \/>\s*<span className="dlg-name">\{name\}<\/span>\s*<span className="dlg-pos">\{stepperPosition\(index, total\)\}<\/span>/);
    assert.match(ui, /className=\{`dlg-main\$\{listOpen \? ' is-open' : ''\}`\}\s*onClick=\{\(\) => setListOpen\(\(o\) => !o\)\}/);
    assert.match(ui, /onClick=\{\(\) => onStep\('prev'\)\}/);
    assert.match(ui, /onClick=\{\(\) => onStep\('next'\)\}/);
    assert.match(ui, /className="dlg-clear" onClick=\{\(\) => \{ setListOpen\(false\); onClear\(\); \}\}/);
    assert.match(ui, /setListOpen\(false\);\s*onGo\(i\);/, 'a row jumps there');
    assert.match(ui, /createPortal\(/, 'the list floats above the status bar like the Skim Risks list');
  });
  it('the app: only while a filter is on, right cluster; steps scroll + pulse; × clears selectedChar', () => {
    assert.match(app, /<span className="status-spacer" \/>\s*\{filter && \(\s*<DialogueStepper\s*name=\{filter\.name\}\s*stops=\{dialogueStopList\}\s*index=\{dialogueIndex\}\s*onStep=\{stepSpeech\}\s*onGo=\{jumpToSpeech\}\s*onClear=\{\(\) => setSelectedChar\(null\)\}/);
    assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => editorRef\.current\?\.pulseBlock\(target\.id\)\)\);/);
    assert.match(app, /const dialogueIndex = filter && dialoguePos\.name === filter\.name \?/, 'a new character starts from “– of N”');
    assert.match(app, /dialogueStops\(analysis, filter\.name, \{ sceneOf: analysis\.sceneOfBlock, scenes, pageOf: layout\.pageOfBlock \}\)/);
    assert.match(app, /const act = dialogueKeyAction\(e\);\s*if \(!act\) return;\s*e\.preventDefault\(\);\s*stepSpeechRef\.current\(act\);/);
    assert.ok(read('lib/reveal.js').includes("scrollIntoView({ block: 'center', behavior: 'smooth' })"), 'smooth, centered');
  });
});
