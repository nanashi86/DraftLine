// Action density ("skim risk"): action paragraphs long enough that readers start to skim.
//
// An action block is dense when it runs past ACTION_LINE_LIMIT rendered lines — or when any
// stretch of it without a line break is longer than SEGMENT_CHAR_LIMIT characters or
// SEGMENT_WORD_LIMIT words (a wall of text, however the page happens to wrap it).
// Rendered lines come from the editor's own measurement when it has one (lineMap), otherwise
// from the same 60-characters-per-line wrap the paginator uses.

import { ELEMENT_META, wrapOffsets } from './screenplay.js';

export const ACTION_LINE_LIMIT = 4;
export const SEGMENT_CHAR_LIMIT = 240;
export const SEGMENT_WORD_LIMIT = 45;

const words = (s) => (s.match(/\S+/g) || []).length;

/** Rendered lines of an action block: the measured count if known, else the 60-cpl wrap. */
export function actionLines(block, measured) {
  if (!block.text.trim()) return 0;
  if (Number.isFinite(measured) && measured > 0) return measured;
  return wrapOffsets(block.text.replace(/\s+$/, ''), ELEMENT_META.action.cpl).length;
}

/** Why a block is dense: 'lines', 'run-on' (one unbroken stretch too long), or null. */
export function densityReason(block, measured) {
  if (block.type !== 'action' || !block.text.trim()) return null;
  if (actionLines(block, measured) > ACTION_LINE_LIMIT) return 'lines';
  const runOn = block.text.split('\n').some((seg) => seg.trim().length > SEGMENT_CHAR_LIMIT || words(seg) > SEGMENT_WORD_LIMIT);
  return runOn ? 'run-on' : null;
}

export const isDenseAction = (block, measured) => densityReason(block, measured) !== null;

/**
 * Density across the script: { total (action blocks with text), dense, percent (of total, whole
 * number), ids: Set of dense block ids, list: [{ id, lines, reason }] in script order }.
 * `lineMap` is the editor's measured lines per block id (optional).
 */
export function actionDensity(blocks, lineMap = {}) {
  const list = [];
  let total = 0;
  for (const b of blocks) {
    if (b.type !== 'action' || !b.text.trim()) continue;
    total += 1;
    const reason = densityReason(b, lineMap[b.id]);
    if (reason) list.push({ id: b.id, lines: actionLines(b, lineMap[b.id]), reason });
  }
  return {
    total,
    dense: list.length,
    percent: total ? Math.round((list.length / total) * 100) : 0,
    ids: new Set(list.map((d) => d.id)),
    list,
  };
}

/** The status bar's words: "Density: Optimal" or "Density: 3 Skim Risks". */
export function densityLabel(d) {
  if (!d.dense) return 'Density: Optimal';
  return `Density: ${d.dense} Skim ${d.dense === 1 ? 'Risk' : 'Risks'}`;
}

/** Its tooltip. */
export function densityTitle(d, on = false) {
  if (!d.total) return 'No action paragraphs yet';
  if (!d.dense) return `All ${d.total} action ${d.total === 1 ? 'paragraph stays' : 'paragraphs stay'} within ${ACTION_LINE_LIMIT} lines`;
  return `${d.dense} of ${d.total} action ${d.total === 1 ? 'paragraph' : 'paragraphs'} (${d.percent}%) run past ${ACTION_LINE_LIMIT} lines — `
    + `readers tend to skim them. ${on ? 'Click to hide the highlights' : 'Click to highlight them in the script'}`;
}
