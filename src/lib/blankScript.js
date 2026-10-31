// Is a script still blank? Two questions, used on a writer's first visit:
//   scriptIsBlank   — nothing written in the script itself (every element empty). The sample and
//                     Focus hints, and the SEO tab title, go by this.
//   projectUntouched — nothing written anywhere: script, title, Scene Board, bios, Story Bible, Plan.
//                     Only such a project may be replaced by the sample (nothing of the writer's lost).

/** True when no element of the script has any text. */
export function scriptIsBlank(blocks) {
  return !(blocks || []).some((b) => (b?.text || '').trim());
}

/** "Untitled" or nothing: the title a new script starts with. */
export function isUntitled(title) {
  const t = String(title || '').trim();
  return !t || t === 'Untitled';
}

// Keys that hold structure, not writing: section ids and names, device ids.
const NOT_WRITING = new Set(['id', 'title', 'version']);

/** Any text the writer typed, anywhere inside x (strings only; flags and numbers aren't writing). */
function hasWriting(x) {
  if (typeof x === 'string') return !!x.trim();
  if (Array.isArray(x)) return x.some(hasWriting);
  if (x && typeof x === 'object') return Object.entries(x).some(([k, v]) => !NOT_WRITING.has(k) && hasWriting(v));
  return false;
}

/** True when the project holds nothing the writer made: safe to replace without asking. */
export function projectUntouched({ meta = {}, blocks = [], beats = [], characters = [], storyNotes, storyDna, production } = {}) {
  return isUntitled(meta.title)
    && scriptIsBlank(blocks)
    && !(beats || []).length
    && !(characters || []).length
    && !hasWriting(storyNotes)
    && !hasWriting(storyDna)
    && !hasWriting(production);
}
