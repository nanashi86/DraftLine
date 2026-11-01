// The feedback card: once, after a writer has used DraftLine enough to have an opinion, at a moment
// they aren't writing. It's a card like the feature hints (lib/hints.js HINTS.feedback, same look,
// same rule of one card per session, same collision checks), but it isn't a tip: it's not counted
// in About → Tips, and Show tips again doesn't bring it back.
//
// When:
//   • from the 3rd writing session: a session (one visit, in one tab) counts once the writer has
//     typed 150+ words of their own in it, the same measure as the 500-word milestone. Opening
//     the app, or typing a scene heading, doesn't count.
//   • that session must itself count (150+ words), and be at least 2 minutes old
//   • at a natural pause: 45 seconds without a keystroke, or just after a break: a panel or dialog
//     closed, Projects closed, or a switch between Write and Plan
//   • online only (the form can't send without a connection), and never in Focus, Viewing or Plan,
//     nor while another card or corner toast is up (lib/hints.js hintCalm's busy)
// How often: once. Share feedback, Not now, opening ⋮ → Send Feedback… or sending feedback ends it.

/** localStorage: how many writing sessions this browser has had (a number). */
export const WRITING_SESSIONS_KEY = 'draftline_writing_sessions';
/** sessionStorage: this session has been counted. */
export const SESSION_COUNTED_KEY = 'draftline_session_counted';
/** localStorage: 'done' | 'dismissed' once the card is finished. */
export const FEEDBACK_PROMPT_KEY = 'draftline_feedback_prompt';

export const FEEDBACK_SESSION_WORDS = 150;
export const FEEDBACK_SESSIONS = 3;
export const FEEDBACK_MIN_SESSION_MS = 2 * 60 * 1000;
export const FEEDBACK_IDLE_MS = 45 * 1000;
/** A break counts as the pause for this long after it happens. */
export const FEEDBACK_BREAK_MS = 6 * 1000;

const get = (s, k) => {
  try {
    return s?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const set = (s, k, v) => {
  try {
    s?.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};

/** Writing sessions so far in this browser. */
export const writingSessions = (local) => Math.max(0, parseInt(get(local, WRITING_SESSIONS_KEY), 10) || 0);

/** Has this session been counted? */
export const sessionCounted = (session) => get(session, SESSION_COUNTED_KEY) === '1';

/**
 * Count this session once it reaches FEEDBACK_SESSION_WORDS of the writer's own typing. Returns the
 * number of writing sessions. Blocked storage: nothing is counted (a private window never gets the card).
 */
export function countWritingSession(local, session, sessionWords) {
  const n = writingSessions(local);
  if (sessionWords < FEEDBACK_SESSION_WORDS || sessionCounted(session)) return n;
  if (!set(local, WRITING_SESSIONS_KEY, String(n + 1))) return n;
  set(session, SESSION_COUNTED_KEY, '1');
  return n + 1;
}

/** Is the card finished (shown and answered, or the form opened any way)? */
export const feedbackPromptFinished = (local) => !!get(local, FEEDBACK_PROMPT_KEY);

/** Finish it: 'done' (the form was opened or sent) or 'dismissed' (Not now). */
export function finishFeedbackPrompt(local, state) {
  if (get(local, FEEDBACK_PROMPT_KEY) === 'done') return;
  set(local, FEEDBACK_PROMPT_KEY, state);
}

/** Has the writer used DraftLine enough, in a session that counts? */
export function feedbackWanted({ sessions = 0, counted = false, finished = false, online = true } = {}) {
  return !finished && online && counted && sessions >= FEEDBACK_SESSIONS;
}

/**
 * Is now a natural pause? now, sessionStart, lastKeyAt, breakAt in ms; busy as for hints.
 * At least 2 minutes into the session, never mid-sentence, and either 45 s with no typing or just
 * after a break.
 */
export function feedbackPause({ now = 0, sessionStart = 0, lastKeyAt = 0, breakAt = 0, busy = false } = {}) {
  if (busy || now - sessionStart < FEEDBACK_MIN_SESSION_MS || now - lastKeyAt < 3000) return false;
  return now - lastKeyAt >= FEEDBACK_IDLE_MS || (breakAt > 0 && now - breakAt <= FEEDBACK_BREAK_MS);
}
