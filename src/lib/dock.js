// The right dock holds one panel at a time — the Dialogue Tuner or the Project Bible.
// Opening one closes the other; the workspace makes room for whichever is open (on wide
// screens the script and Beat Board flex beside it, on narrow ones it overlays them).

export const DOCK_PANELS = ['tuner', 'bible'];

/** Toggle `panel`: open it (closing the other), or close it if it's the one showing. */
export function toggleDock(current, panel) {
  return current === panel ? null : panel;
}

/** Open `panel` (closing the other). */
export const openDock = (_current, panel) => panel;

/** Close `panel` if it's the one showing. */
export const closeDock = (current, panel) => (current === panel ? null : current);

/** Saved preference → dock. Older prefs only had `tunerOpen` (default: Tuner showing). */
export function dockFromPrefs(prefs = {}) {
  if (prefs.dock === null || DOCK_PANELS.includes(prefs.dock)) return prefs.dock;
  return (prefs.tunerOpen ?? true) ? 'tuner' : null;
}
