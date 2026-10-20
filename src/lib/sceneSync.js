// Beat Board ↔ script: moving a scene card moves its scene in the screenplay.
//
// A scene is the chunk from its heading up to (not including) the next heading — every
// action, speech, transition and note in between travels with it, untouched and in order.
// Only the dragged card's scene moves: it's placed right after the scene of the nearest
// scene card above it in the new board order (or, if it's now first, right before the
// scene of the nearest one below). Scenes without cards, and everything before the first
// heading (FADE IN:), stay where they are. A closing "FADE OUT. / THE END" stays at the
// very end even when the last scene moves away.
//
// Afterwards, scene-card titles still in their generated "12. INT. HOUSE - NIGHT" form are
// renumbered to the scenes' new numbers; titles you've rewritten are left alone.

import { byAct, moveBeat } from './beats.js';

/** Board reading order: Act 1, 2A, 2B, 3 — top to bottom within each. */
export const boardOrder = (beats) => byAct(beats).flat();

/**
 * Split the script into { pre, chunks: [{ id, blocks }], ending }:
 *   pre    — blocks before the first scene heading
 *   chunks — one per scene heading, in script order
 *   ending — a closing THE END (Centered) and the transition right before it, if the script ends that way
 */
export function splitScenes(blocks) {
  const pre = [];
  const chunks = [];
  for (const b of blocks) {
    if (b.type === 'scene') chunks.push({ id: b.id, blocks: [b] });
    else if (chunks.length) chunks[chunks.length - 1].blocks.push(b);
    else pre.push(b);
  }
  let ending = [];
  const last = chunks[chunks.length - 1];
  if (last) {
    let k = last.blocks.length;
    if (last.blocks[k - 1]?.type === 'centered') {
      k -= 1;
      if (last.blocks[k - 1]?.type === 'transition') k -= 1;
      if (k >= 1) { // never strip the heading itself
        ending = last.blocks.slice(k);
        last.blocks = last.blocks.slice(0, k);
      }
    }
  }
  return { pre, chunks, ending };
}

const join = ({ pre, chunks, ending }) => [...pre, ...chunks.flatMap((c) => c.blocks), ...ending];

/**
 * Move scene `sceneId` so the script follows the card order of `beats` (already moved).
 * Returns the new block array, or the same array if nothing needs to move.
 */
export function moveSceneForBeats(blocks, beats, sceneId) {
  const parts = splitScenes(blocks);
  const from = parts.chunks.findIndex((c) => c.id === sceneId);
  if (from < 0) return blocks;
  const live = new Set(parts.chunks.map((c) => c.id));
  const order = boardOrder(beats).filter((b) => b.sceneId && live.has(b.sceneId)).map((b) => b.sceneId);
  const k = order.indexOf(sceneId);
  if (k < 0) return blocks;

  const [chunk] = parts.chunks.splice(from, 1);
  const prevId = order.slice(0, k).reverse().find((id) => id !== sceneId);
  const nextId = order.slice(k + 1).find((id) => id !== sceneId);
  let at;
  if (prevId) at = parts.chunks.findIndex((c) => c.id === prevId) + 1;
  else if (nextId) at = parts.chunks.findIndex((c) => c.id === nextId);
  else at = from; // the only scene card: nothing to line up with
  if (at === from) {
    parts.chunks.splice(from, 0, chunk);
    return blocks; // already in place
  }
  parts.chunks.splice(at, 0, chunk);
  return join(parts);
}

/** Scene number of every heading: { [sceneId]: n } (every heading counts, as in the margin). */
export function sceneNumbersOf(blocks) {
  const out = {};
  let n = 0;
  for (const b of blocks) if (b.type === 'scene') out[b.id] = ++n;
  return out;
}

const GENERATED = /^(\d+)\.\s+(.*)$/s;

/**
 * Renumber scene-card titles still in their generated "N. HEADING" form. A title whose
 * text no longer matches its scene's heading (you rewrote it) is left alone.
 */
export function renumberSceneCards(beats, blocks) {
  const num = sceneNumbersOf(blocks);
  const heading = new Map(blocks.filter((b) => b.type === 'scene').map((b) => [b.id, b.text.trim().toUpperCase()]));
  let changed = false;
  const out = beats.map((b) => {
    if (!b.sceneId || !num[b.sceneId]) return b;
    const m = GENERATED.exec(b.title.trim());
    if (!m || m[2].trim().toUpperCase() !== heading.get(b.sceneId)) return b;
    const title = `${num[b.sceneId]}. ${m[2].trim()}`;
    if (title === b.title) return b;
    changed = true;
    return { ...b, title };
  });
  return changed ? out : beats;
}

/**
 * Drop / keyboard-move a card: the board change plus, for a scene card, the script change.
 * Returns { beats, blocks, scriptMoved }.
 */
export function moveCardAndScene(beats, blocks, id, act, index) {
  const moved = moveBeat(beats, id, act, index);
  const card = moved.find((b) => b.id === id);
  if (!card?.sceneId) return { beats: moved, blocks, scriptMoved: false };
  const nextBlocks = moveSceneForBeats(blocks, moved, card.sceneId);
  if (nextBlocks === blocks) return { beats: moved, blocks, scriptMoved: false };
  return { beats: renumberSceneCards(moved, nextBlocks), blocks: nextBlocks, scriptMoved: true };
}
