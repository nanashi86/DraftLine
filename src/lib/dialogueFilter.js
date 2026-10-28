// Characters → Dialogue filter: picking a character in the Dialogue tab spotlights their
// speeches in the script (everything else fades) until the filter is cleared — with the status
// bar stepper's ✕ or Escape. The stepper is the only control (no banner over the page). Nothing
// here prints: the fading is screen-only (the print view is separate and never sees it).

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



// ---- The status bar's dialogue stepper (components/DialogueStepper.jsx) ----------------------

const SNIPPET_MAX = 48;
/** A speech's first words: its first dialogue line (else parenthetical), on one line, cut at a word. */
export function speechSnippet(parts = [], max = SNIPPET_MAX) {
  const line = (parts.find((p) => p.type === 'dialogue' && p.text?.trim()) || parts.find((p) => p.text?.trim()))?.text || '';
  const flat = line.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/**
 * Every speech of `name`, in script order: [{ id, cueId, scene, page, snippet, label }] — `id` is
 * the block to scroll to and pulse (the first dialogue line, else the cue), `label` the list row:
 * Sc. 12 · p. 34 — "Turn us around."
 */
export function dialogueStops(analysis, name, { sceneOf = {}, scenes = [], pageOf = {} } = {}) {
  const c = name ? analysis?.characters?.get(name) : null;
  if (!c) return [];
  const byId = new Map(scenes.map((s) => [s.id, s]));
  return c.entries.map((en) => {
    const target = en.parts.find((p) => p.type === 'dialogue') || en.cue;
    const sc = byId.get(sceneOf[en.cue.id]);
    const page = pageOf[target.id] ?? pageOf[en.cue.id] ?? null;
    const scene = sc?.number ?? null;
    const snippet = speechSnippet(en.parts);
    const where = [scene != null ? `Sc. ${scene}` : null, page != null ? `p. ${page}` : null].filter(Boolean).join(' · ') || 'Before the first scene';
    return { id: target.id, cueId: en.cue.id, scene, page, snippet, label: snippet ? `${where} — “${snippet}”` : where };
  });
}

/** "3 of 12" while stepping; just "12" before the first step (Format, Dialogue, Find — like Density). */
export const stepperPosition = (index, total) => (index >= 0 && index < total ? `${index + 1} of ${total}` : String(total));

const isEditable = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));

/**
 * The stepper's keys while a filter is on: Alt+↓ / Alt+↑ anywhere; ] / [ only when not typing in
 * the script or a field (they're ordinary characters there). → 'next' | 'prev' | null.
 */
export function dialogueKeyAction(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (e.altKey && !mod && !e.shiftKey) {
    if (e.key === 'ArrowDown') return 'next';
    if (e.key === 'ArrowUp') return 'prev';
    return null;
  }
  if (mod || e.altKey || isEditable(e.target)) return null;
  if (e.key === ']') return 'next';
  if (e.key === '[') return 'prev';
  return null;
}
