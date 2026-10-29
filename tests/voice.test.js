import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CADENCE, MONOLOGUE_LINES, MONOLOGUE_WORDS, cadenceLabel, isMonologue, printedLines, speechLength, voiceMetrics } from '../src/lib/voice.js';
import { analyzeScript, makeBlock } from '../src/lib/screenplay.js';

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('Characters → Dialogue: voice metrics', () => {
  it('Monologues: a speech over 5 printed lines (35-character Dialogue width) or over 60 words', () => {
    assert.deepEqual([MONOLOGUE_LINES, MONOLOGUE_WORDS], [5, 60]);
    assert.equal(printedLines('short'), 1);
    assert.equal(isMonologue({ parts: [{ type: 'dialogue', text: words(61) }] }), true, 'over 60 words');
    assert.equal(isMonologue({ parts: [{ type: 'dialogue', text: 'x'.repeat(34 * 6) }] }), true, 'six printed lines');
    assert.equal(isMonologue({ parts: [{ type: 'dialogue', text: words(20) }] }), false);
    // A speech broken by a parenthetical still counts as one speech.
    assert.equal(isMonologue({ parts: [{ type: 'dialogue', text: words(35) }, { type: 'parenthetical', text: '(beat)' }, { type: 'dialogue', text: words(30) }] }), true);
  });
  it('Cadence: under 8 words a line Fast / Banter, over 20 Expository, else Balanced', () => {
    assert.deepEqual(CADENCE, { fast: 8, expository: 20 });
    assert.equal(cadenceLabel(5), 'Fast / Banter');
    assert.equal(cadenceLabel(8), 'Balanced');
    assert.equal(cadenceLabel(20), 'Balanced');
    assert.equal(cadenceLabel(21), 'Expository');
    assert.equal(cadenceLabel(0), '—');
  });
  it('from the script: counts and cadence per character', () => {
    const blocks = [
      makeBlock('character', 'MARIE'), makeBlock('dialogue', 'Go.'),
      makeBlock('character', 'AUGUSTIN'), makeBlock('dialogue', words(70)),
      makeBlock('character', 'MARIE'), makeBlock('dialogue', 'Now. Please.'),
    ];
    const a = analyzeScript(blocks);
    assert.deepEqual(voiceMetrics(a.characters.get('MARIE')), { monologues: 0, avg: 1.5, cadence: 'Fast / Banter' });
    assert.deepEqual(voiceMetrics(a.characters.get('AUGUSTIN')), { monologues: 1, avg: 70, cadence: 'Expository' });
  });
  it('shown under the Dialogue tab’s header metrics', () => {
    const ui = readFileSync(new URL('../src/components/DialogueTuner.jsx', import.meta.url), 'utf8');
    assert.match(ui, /avg words\/line<\/span>\s*\{voice\.monologues > 0 \? \(/);
    assert.match(ui, /<b>\{voice\.monologues\}<\/b> \{voice\.monologues === 1 \? 'monologue' : 'monologues'\}/);
    assert.match(ui, /<b>0<\/b> monologues<\/span>/, 'none: plain text, not a button');
    assert.match(ui, /Cadence <b>\{voice\.cadence\}<\/b>/);
  });
});

describe('Characters → Dialogue: the monologue count is a filter', () => {
  const ui = readFileSync(new URL('../src/components/DialogueTuner.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/DialogueTuner.css', import.meta.url), 'utf8');
  it('speechLength: printed dialogue lines and words, parentheticals aside', () => {
    assert.deepEqual(speechLength({ parts: [{ type: 'dialogue', text: words(35) }, { type: 'parenthetical', text: '(beat)' }, { type: 'dialogue', text: words(30) }] }).words, 65);
    assert.equal(speechLength({ parts: [{ type: 'dialogue', text: 'x'.repeat(34 * 6) }] }).printed, 6);
    assert.deepEqual(speechLength(null), { printed: 0, words: 0 });
  });
  it('a toggle button (aria-pressed) that keeps only that character’s monologues', () => {
    assert.match(ui, /className=\{`tuner-mono\$\{monoOnly \? ' is-on' : ''\}`\}\s*aria-pressed=\{monoOnly\}\s*onClick=\{\(\) => setMonoFor\(monoOnly \? null : current\.name\)\}/);
    assert.match(ui, /&& \(!monoOnly \|\| isMonologue\(en\)\)/);
    assert.match(ui, /\{monoOnly && <X size=\{12\} strokeWidth=\{2\} aria-hidden className="tuner-mono-x" \/>\}/, '✕ while on (a line icon, no emoji)');
  });
  it('belongs to the character it was turned on for: picking someone else shows all their speeches', () => {
    assert.match(ui, /const monoOnly = !!current && monoFor === current\.name && voice\.monologues > 0;/);
    assert.match(ui, /if \(monoFor && monoFor !== current\?\.name\) setMonoFor\(null\);/, 'and coming back to them starts unfiltered');
  });
  it('while on: a note above the list, and each speech tagged "Monologue · N lines"; Go ↗ still jumps', () => {
    assert.match(ui, /Showing \{current\.name\}’s/);
    assert.match(ui, /click the count again to see every speech/);
    assert.match(ui, /<p className="tune-mono-tag">Monologue · \{speechLength\(en\)\.printed\}/);
    assert.match(ui, /className="tune-jump" onClick=\{\(\) => onJump\(en\.cue\.id\)\}/);
    assert.match(css, /\.tuner-mono\.is-on \{ border-color: var\(--accent\);/);
    assert.match(css, /\.tune-mono-tag \{[^}]*color: #f0b35a;/);
    // It sits inside its row: no negative margin to overlap Rename… when the stats wrap.
    assert.doesNotMatch(css.match(/\.tuner-mono \{[^}]*\}/)[0], /margin:\s*-/);
    assert.match(css, /\.tuner-stats \{[^}]*gap: 8px 14px;/);
  });
});
