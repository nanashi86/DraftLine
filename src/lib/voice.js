// Characters → Dialogue: two measures of a character's voice.
//   Monologues — speeches running past MONOLOGUE_LINES printed lines (or MONOLOGUE_WORDS words).
//   Cadence    — from average words per dialogue line: short and quick, long and explanatory, or between.

import { ELEMENT_META, wrapOffsets } from './screenplay.js';

export const MONOLOGUE_LINES = 5;
export const MONOLOGUE_WORDS = 60;
export const CADENCE = { fast: 8, expository: 20 }; // avg words per line: < fast → Fast / Banter; > expository → Expository

const wordCount = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
/** Printed lines of a dialogue block, wrapped at the Dialogue width (35 characters). */
export const printedLines = (text) => (String(text || '').trim() ? wrapOffsets(String(text).trim(), ELEMENT_META.dialogue.cpl).length : 0);

/** Is this speech (an analyzeScript() entry: its parts) a monologue? Its dialogue, parentheticals aside. */
export function isMonologue(entry) {
  const lines = (entry?.parts || []).filter((p) => p.type === 'dialogue');
  const printed = lines.reduce((n, p) => n + printedLines(p.text), 0);
  const words = lines.reduce((n, p) => n + wordCount(p.text), 0);
  return printed > MONOLOGUE_LINES || words > MONOLOGUE_WORDS;
}

/** "Fast / Banter", "Balanced" or "Expository" for an average of `avg` words per line. */
export function cadenceLabel(avg) {
  if (!Number.isFinite(avg) || avg <= 0) return '—';
  if (avg < CADENCE.fast) return 'Fast / Banter';
  if (avg > CADENCE.expository) return 'Expository';
  return 'Balanced';
}

/** A character's voice from analyzeScript(): { monologues, avg, cadence }. */
export function voiceMetrics(c) {
  if (!c) return { monologues: 0, avg: 0, cadence: '—' };
  const avg = c.lines ? c.words / c.lines : 0;
  return { monologues: c.entries.filter(isMonologue).length, avg, cadence: cadenceLabel(avg) };
}
