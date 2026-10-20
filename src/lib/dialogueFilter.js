// Characters → Dialogue filter: picking a character in the Dialogue tab spotlights their
// speeches in the script (everything else fades) until the filter is cleared — with the
// banner's "Clear Filter ✕" or Escape. Nothing here prints: the banner and the fading are
// screen-only (the print view is separate and never sees them).

/**
 * The active filter for `name` in an analyzeScript() result, or null when there's no filter
 * (no name, or that character no longer speaks — e.g. after a rename).
 * Returns { name, lines, speeches, ids } — `ids` is every cue, parenthetical and dialogue
 * block of that character, the ones that stay bright.
 */
export function dialogueFilter(analysis, name) {
  if (!name) return null;
  const c = analysis?.characters?.get(name);
  if (!c) return null;
  const ids = new Set();
  for (const en of c.entries) {
    ids.add(en.cue.id);
    for (const p of en.parts) ids.add(p.id);
  }
  return { name: c.name, lines: c.lines, speeches: c.entries.length, ids };
}

/** "Filtering dialogue: MARIE · 9 lines" */
export const filterLabel = (f) => `Filtering dialogue: ${f.name} · ${f.lines} ${f.lines === 1 ? 'line' : 'lines'}`;
