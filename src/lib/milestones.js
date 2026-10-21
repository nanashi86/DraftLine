// Writing milestones: small corner toasts that fire once per session, and the "FADE OUT." bell.
//
// Only the writer's own typing counts: every check compares the state just before an edit with
// the state just after it, so opening a 100-page script never "reaches page 90", and pasting a
// draft in counts the same as typing it.

/** Each milestone's message. */
export const MILESTONES = {
  words500: "Now you're writing with gasoline.",
  lateNight: 'Nothing good gets written after 2:00 AM... except Act III.',
  page90: '“The script is what you’ve dreamed up–this is what it should be. The film is what you end up with.” – George Lucas',
  page120: 'Your producer is already looking for a red pen.',
};
export const MILESTONE_TOAST_MS = 3500;
export const SESSION_WORD_GOAL = 500;
export const LATE_NIGHT_HOURS = [0, 4]; // 00:00 up to (not including) 04:00, local time
export const PAGE_MILESTONES = [['page90', 90], ['page120', 120]];

export const isLateNight = (date) => {
  const h = new Date(date).getHours();
  return h >= LATE_NIGHT_HOURS[0] && h < LATE_NIGHT_HOURS[1];
};

/** Did this edit finish a sentence? (The text grew and now ends in . ! or ?, maybe before a quote or bracket.) */
export function finishedSentence(before, after) {
  const end = /[.!?]["'”’)\]]*\s*$/;
  return String(after || '').length > String(before || '').length && end.test(after || '') && !end.test(before || '');
}

/**
 * The milestones one edit reaches, not yet fired this session (in order):
 *   prev / next — { sessionWords, pages } just before and after the edit
 *   sentence    — the edit finished a sentence
 *   fired       — Set of ids already shown this session
 */
export function milestonesReached({ prev, next, sentence = false, now = new Date(), fired = new Set() }) {
  const out = [];
  if (prev.sessionWords < SESSION_WORD_GOAL && next.sessionWords >= SESSION_WORD_GOAL) out.push('words500');
  if (sentence && isLateNight(now)) out.push('lateNight');
  for (const [id, page] of PAGE_MILESTONES) if (prev.pages < page && next.pages >= page) out.push(id);
  return out.filter((id) => !fired.has(id));
}

// ---- "FADE OUT." ---------------------------------------------------------------------------------

export const ENDING_MIN_PAGE = 80;
const ENDING_RE = /\bFADE OUT\.|\bTHE END\b/;

/** A line that ends a screenplay: a Transition (or Centered, or any all-caps line) saying FADE OUT. / THE END. */
export function isEndingLine(block) {
  const text = String(block?.text || '').trim();
  if (!ENDING_RE.test(text.toUpperCase())) return false;
  if (block.type === 'transition' || block.type === 'centered') return true;
  return text === text.toUpperCase() && /[A-Z]/.test(text);
}

/**
 * Ending lines this edit just completed, on page ENDING_MIN_PAGE or later, not chimed for yet:
 * → block ids. `pageOf` is layout.pageOfBlock (1-based).
 */
export function newEndings(prevBlocks, nextBlocks, pageOf, chimed = new Set()) {
  const before = new Map((prevBlocks || []).map((b) => [b.id, b]));
  return (nextBlocks || [])
    .filter((b) => isEndingLine(b) && !isEndingLine(before.get(b.id)) && !chimed.has(b.id) && (pageOf?.[b.id] || 0) >= ENDING_MIN_PAGE)
    .map((b) => b.id);
}
