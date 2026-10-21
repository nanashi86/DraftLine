// The right dock holds one drawer at a time — the Story Bible, Characters (Bios · Dialogue),
// Snapshots or Margin Notes. Opening one closes the other; the workspace makes room for
// whichever is open (on wide screens the script and Scene Board flex beside it, on narrow ones
// it overlays them). Only the Story Bible and Characters reopen after a reload.

export const DOCK_PANELS = ['bible', 'characters', 'snapshots', 'notes'];
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
