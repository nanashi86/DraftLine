import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CADENCE, MONOLOGUE_LINES, MONOLOGUE_WORDS, cadenceLabel, isMonologue, printedLines, voiceMetrics } from '../src/lib/voice.js';
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
    assert.match(ui, /avg words\/line<\/span>\s*<span[^>]*><b>\{voice\.monologues\}<\/b> \{voice\.monologues === 1 \? 'monologue' : 'monologues'\}<\/span>/);
    assert.match(ui, /Cadence <b>\{voice\.cadence\}<\/b>/);
  });
});
