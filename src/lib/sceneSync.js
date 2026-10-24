// Scene Board ↔ script: moving a scene card moves its scene in the screenplay.
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
 * Reconnect scene cards whose scene no longer exists by that id. Replacing the script
 * (File → Import… → Load into Editor) gives every element a new id, which used to leave each
 * scene card pointing at nothing: it still looked like a scene card, but dragging it only
 * moved the board. A card whose title is still in its generated "N. HEADING" form is matched
 * to a scene with that heading that no other card holds: the one numbered N if there are
 * several, otherwise the first. Cards you've retitled, and cards with no match, are left as
 * they are. Returns the same array when nothing changes.
 */
export function relinkSceneCards(beats, blocks) {
  const headings = blocks.filter((b) => b.type === 'scene');
  const live = new Set(headings.map((b) => b.id));
  const stale = beats.filter((b) => b.sceneId && !live.has(b.sceneId));
  if (!stale.length) return beats;
  const claimed = new Set(beats.filter((b) => b.sceneId && live.has(b.sceneId)).map((b) => b.sceneId));
  const num = sceneNumbersOf(blocks);
  const fresh = new Map();
  for (const card of boardOrder(stale)) {
    const m = GENERATED.exec(card.title.trim());
    if (!m) continue;
    const want = m[2].trim().toUpperCase();
    const open = headings.filter((h) => !claimed.has(h.id) && h.text.trim().toUpperCase() === want);
    if (!open.length) continue;
    const pick = open.find((h) => num[h.id] === Number(m[1])) || open[0];
    claimed.add(pick.id);
    fresh.set(card.id, pick.id);
  }
  if (!fresh.size) return beats;
  return beats.map((b) => (fresh.has(b.id) ? { ...b, sceneId: fresh.get(b.id) } : b));
}

/**
 * Drop / keyboard-move a card: the board change plus, for a scene card, the script change.
 * Returns { beats, blocks, scriptMoved }.
 */
export function moveCardAndScene(beats, blocks, id, act, index) {
  const moved = moveBeat(relinkSceneCards(beats, blocks), id, act, index);
  const card = moved.find((b) => b.id === id);
  if (!card?.sceneId) return { beats: moved, blocks, scriptMoved: false };
  const nextBlocks = moveSceneForBeats(blocks, moved, card.sceneId);
  if (nextBlocks === blocks) return { beats: moved, blocks, scriptMoved: false };
  return { beats: renumberSceneCards(moved, nextBlocks), blocks: nextBlocks, scriptMoved: true };
}

/**
 * One Scene Board move as an undo step: moveCardAndScene plus how Ctrl+Z / Ctrl+Shift+Z put
 * the board back and forth. The script side is the history's own (its previous and next block
 * arrays); `undoBeats(cur)` / `redoBeats(cur)` turn the board as it is at that moment into the
 * board before / after the move — exactly, if nothing else changed it since, or by moving just
 * that card back if you've edited other cards in between.
 * Returns { blocks, beats, scriptMoved, heading, undoBeats, redoBeats }.
 */
export function moveCardStep(beats, blocks, id, act, index) {
  const r = moveCardAndScene(beats, blocks, id, act, index);
  const before = relinkSceneCards(beats, blocks);
  const after = r.beats;
  const old = before.find((b) => b.id === id);
  if (!r.scriptMoved || !old) return { ...r, heading: null, undoBeats: () => before, redoBeats: () => after };
  const oldIndex = byAct(before)[old.act].indexOf(old);
  return {
    ...r,
    heading: r.blocks.find((b) => b.id === old.sceneId)?.text.trim() || 'Scene',
    undoBeats: (cur) => (cur === after ? before : moveBeat(cur, id, old.act, oldIndex)),
    redoBeats: (cur) => (cur === before ? after : moveBeat(cur, id, act, index)),
  };
}
