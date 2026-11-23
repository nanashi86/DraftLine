// Acts of the script's scenes, read from the Scene Board (the only place acts are set).
//
// A scene card stores one of four underlying acts (beats.js: 0 = Act 1, 1 = Act 2A, 2 = Act 2B,
// 3 = Act 3) and the scene it stands for (`sceneId`). The board's structure (3 or 4 acts) only
// decides how those four are labelled: in 3-Act mode 2A and 2B are both "Act 2". So this never
// stores anything: switching structure, dragging a card or redistributing the board changes the
// result the moment the board changes.
//
// Used by the Scenes sidebar (its act labels) and by Table Read (its Act range).
//
// Nothing is invented: a scene without a card has no act of its own and stays under the act above
// it in the script (no new boundary is drawn there); scenes before the first carded scene, or a
// board with no scene cards at all, get no act.

import { structureFor } from './beats.js';

/** The act label ("Act 1", "Act 2A"…) a card's underlying act shows as in structure `mode`. */
export function actLabelFor(act, mode) {
  const col = structureFor(mode).find((c) => c.acts.includes(act));
  return col ? col.label : null;
}

/**
 * One entry per scene id, in script order: { id, label, own }.
 *   label — the act the scene sits under (null before any carded scene, or with no scene cards)
 *   own   — true when the scene's own card set it (false when carried down from the scene above)
 */
export function sceneActs(sceneIds, beats, mode) {
  const actOf = new Map();
  for (const b of Array.isArray(beats) ? beats : []) {
    if (b && b.sceneId && !actOf.has(b.sceneId) && Number.isInteger(b.act)) actOf.set(b.sceneId, b.act);
  }
  let label = null;
  return sceneIds.map((id) => {
    const own = actOf.has(id) ? actLabelFor(actOf.get(id), mode) : null;
    if (own) label = own;
    return { id, label, own: !!own };
  });
}

/**
 * Where the sidebar draws an act label: the ids of the shown scenes that start a new act, with the
 * label. `shownIds` is the list as it's shown (search may hide scenes); a label is drawn above a
 * shown scene when its act differs from the shown scene above it, so no empty act is ever drawn.
 * Returns Map id → label.
 */
export function actHeaders(acts, shownIds) {
  const labelOf = new Map(acts.map((a) => [a.id, a.label]));
  const out = new Map();
  let prev = null;
  for (const id of shownIds) {
    const label = labelOf.get(id) ?? null;
    if (label && label !== prev) out.set(id, label);
    prev = label;
  }
  return out;
}

/**
 * The run of scenes in the same act as `sceneId`, as the sidebar groups them: { label, ids } (the
 * scene ids in script order), or null when that scene has no act (Table Read's Act range).
 */
export function actRunOf(acts, sceneId) {
  const k = acts.findIndex((a) => a.id === sceneId);
  if (k < 0 || !acts[k].label) return null;
  const { label } = acts[k];
  let lo = k;
  let hi = k;
  while (lo > 0 && acts[lo - 1].label === label) lo -= 1;
  while (hi + 1 < acts.length && acts[hi + 1].label === label) hi += 1;
  return { label, ids: acts.slice(lo, hi + 1).map((a) => a.id) };
}
