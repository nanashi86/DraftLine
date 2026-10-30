// Plan → Breakdowns: whether each scene's breakdown card starts open or folded.
//
// The state is { closed, except }: every card follows `closed` (true = folded) except the ids in
// `except`, which were toggled by hand; Expand All / Collapse All resets `except`. A card is open when
// closed !== except.has(id).
//
// A script with more than 10 scenes opens Breakdowns folded, so it reads as a list of scenes to pick
// from rather than a long scroll of open forms; a short script opens with every card open. That's
// decided once per script, when Plan first opens for it; after that Expand All / Collapse All and the
// single-card toggles are in charge until another script is opened.

/** More scenes than this and Breakdowns opens folded. */
export const PLAN_FOLD_SCENES = 10;

/** The starting fold for a script with `sceneCount` scenes. */
export function initialPlanFold(sceneCount = 0) {
  return { closed: sceneCount > PLAN_FOLD_SCENES, except: new Set() };
}
