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
 * The ⋮ menu, top to bottom: Keyboard Shortcuts · Load Sample · About DraftLine — plus
 * Dialogue and/or Story Bible first, but only while the toolbar can't show them itself.
 */
export function moreMenuItems({ dialogueOnBar, bibleOnBar, onDialogue, onBible, onShortcuts, onSample, onAbout }) {
  const panels = [
    !dialogueOnBar && { label: 'Dialogue', hint: 'Alt+T', onSelect: onDialogue },
    !bibleOnBar && { label: 'Story Bible', hint: 'Alt+I', onSelect: onBible },
  ].filter(Boolean);
  return [
    ...(panels.length ? [...panels, { divider: true }] : []),
    { label: 'Keyboard Shortcuts', hint: 'Ctrl+/', onSelect: onShortcuts },
    { divider: true },
    { label: 'Load Sample', hint: 'The Last Ferry', onSelect: onSample },
    { divider: true },
    { label: 'About DraftLine', onSelect: onAbout },
  ];
}
