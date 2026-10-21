// Toolbar helpers: what the ⋮ (More) menu holds, and whether a toolbar button is really on screen.

/**
 * Is `el` actually showing on the toolbar? It isn't when a breakpoint hides it
 * (display: none) or when a narrow, sideways-scrolling bar has it out of view.
 */
export function isOnBar(el, bar) {
  if (!el || !bar || el.offsetParent === null) return false;
  const r = el.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  return r.left >= b.left - 1 && r.right <= b.right + 1;
}

/**
 * The ⋮ menu, top to bottom: View Snapshots · Margin Notes — Keyboard Shortcuts — Load Sample —
 * User Guide · About DraftLine, plus Focus, Story Bible and/or Characters first (toolbar order), but only while
 * the toolbar can't show them itself (narrow windows). Snapshots and Notes show their counts.
 */
export function moreMenuItems({
  bibleOnBar, charactersOnBar, onBible, onCharacters, onSnapshots, snapshotCount = 0, onNotes, noteCount = 0,
  onShortcuts, onSample, onAbout, focusOnBar = true, onFocus, onGuide,
}) {
  const panels = [
    !focusOnBar && onFocus && { label: 'Focus', hint: 'Esc exits', onSelect: onFocus },
    !bibleOnBar && { label: 'Story Bible', hint: 'Alt+I', onSelect: onBible },
    !charactersOnBar && { label: 'Characters', hint: 'Alt+C', onSelect: onCharacters },
  ].filter(Boolean);
  return [
    ...(panels.length ? [...panels, { divider: true }] : []),
    { label: 'View Snapshots', hint: String(snapshotCount), onSelect: onSnapshots },
    { label: 'Margin Notes', hint: String(noteCount), onSelect: onNotes },
    { divider: true },
    { label: 'Keyboard Shortcuts', hint: 'Ctrl+/', onSelect: onShortcuts },
    { divider: true },
    { label: 'Load Sample', hint: 'The Last Ferry', onSelect: onSample },
    { divider: true },
    ...(onGuide ? [{ label: 'User Guide', hint: 'F1', onSelect: onGuide }] : []),
    { label: 'About DraftLine', onSelect: onAbout },
  ];
}
