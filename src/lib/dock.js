// The right dock holds one drawer at a time — the Story Bible, Characters (Bios · Dialogue),
// Snapshots or Margin Notes. Opening one closes the other; the workspace makes room for
// whichever is open (on wide screens the script and Scene Board flex beside it, on narrow ones
// it overlays them). Only the Story Bible and Characters reopen after a reload.

export const DOCK_PANELS = ['bible', 'characters', 'snapshots', 'notes'];
/** From this width the Scenes list and the dock sit beside the page; below it they cover it (App.css). */
export const PANELS_BESIDE_MIN_WIDTH = 1100;
export const REOPENED_PANELS = ['bible', 'characters'];

/** Toggle `panel`: open it (closing the other), or close it if it's the one showing. */
export function toggleDock(current, panel) {
  return current === panel ? null : panel;
}

/** Open `panel` (closing the other). */
export const openDock = (_current, panel) => panel;

/** Close `panel` if it's the one showing. */
export const closeDock = (current, panel) => (current === panel ? null : current);

/**
 * Saved preference → dock. The Dialogue panel used to be its own drawer ('tuner'); it's now the
 * Dialogue tab of Characters, so 'tuner' — and the oldest prefs' `tunerOpen` (default on) —
 * open Characters.
 */
export function dockFromPrefs(prefs = {}) {
  if (prefs.dock === undefined && prefs.tunerOpen === undefined) return null; // a first visit: nothing over the page
  if (prefs.dock === null || REOPENED_PANELS.includes(prefs.dock)) return prefs.dock;
  if (DOCK_PANELS.includes(prefs.dock)) return null; // Snapshots / Notes are opened on purpose
  if (prefs.dock === 'tuner') return 'characters';
  return (prefs.tunerOpen ?? true) ? 'characters' : null;
}

/** Which Characters tab to start on: Dialogue for anyone coming from the old Dialogue drawer. */
export function characterTabFromPrefs(prefs = {}) {
  if (prefs.characterTab === 'bios' || prefs.characterTab === 'dialogue') return prefs.characterTab;
  return prefs.dock === 'tuner' || (prefs.dock === undefined && (prefs.tunerOpen ?? true)) ? 'dialogue' : 'bios';
}

/**
 * What's open when DraftLine loads: { dock, navOpen }. Where panels sit beside the page, what the
 * writer last left open (the Scenes list open on a first visit, Characters closed). Where they'd cover
 * it (phones, small tablets, narrow windows), nothing opens on its own: the script comes first.
 */
export function startingPanels(prefs = {}, width = Infinity) {
  if (width < PANELS_BESIDE_MIN_WIDTH) return { dock: null, navOpen: false };
  return { dock: dockFromPrefs(prefs), navOpen: prefs.navOpen ?? true };
}
