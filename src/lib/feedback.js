// ⋮ → Send Feedback…: what the form sends, and how.
//
// Only what the writer types or picks (how they found DraftLine, where they write, the app they used
// before, an optional email for a reply, whether they're happy to be quoted) and a coarse OS name
// are sent. No cookies or credentials (credentials: 'omit'), no referrer, no script text, no
// project or library data, nothing stored in the browser. The endpoint is a Cloudflare Worker;
// set VITE_FEEDBACK_ENDPOINT at build time to send somewhere else.
//
// The body is JSON sent as text/plain, a "simple" request, so there's no CORS preflight. The Worker
// still has to answer with Access-Control-Allow-Origin for the browser to see its 200.

export const DEFAULT_FEEDBACK_ENDPOINT = 'https://draftline-feedback.elemaire86.workers.dev';
export const FEEDBACK_ENDPOINT = import.meta.env?.VITE_FEEDBACK_ENDPOINT || DEFAULT_FEEDBACK_ENDPOINT;

/** "I previously used:" — the software choices, then "None" for a writer new to screenwriting software. */
export const NO_PREVIOUS_APP = 'None (New Writer)';
export const PREVIOUS_APPS = ['Final Draft', 'Fade In', 'Highland 2', 'WriterDuet', 'WriterSolo', 'Beat', 'Celtx', 'Google Docs / Word', 'Other', NO_PREVIOUS_APP];
export const FOUND_VIA = ['Google search', 'Google ad', 'AI assistant', 'YouTube', 'Instagram / Threads', 'TikTok', 'X', 'Reddit', 'AlternativeTo', 'A friend', 'Other'];
export const WRITES_ON = ['Computer', 'Phone', 'Tablet', 'All of them'];

/**
 * draftlineapp.com/#feedback opens DraftLine with this form already up (a link for Reddit, Discord,
 * emails…). The "#feedback" is then taken off the address, so a reload or a bookmark of the page
 * the writer ends up on doesn't open the form again.
 */
export const FEEDBACK_HASH = '#feedback';
export function takeFeedbackLink(loc = globalThis.location, hist = globalThis.history) {
  if (String(loc?.hash || '').toLowerCase() !== FEEDBACK_HASH) return false;
  try {
    hist?.replaceState(hist.state, '', `${loc.pathname}${loc.search}`);
  } catch {
    // the address keeps its #feedback: harmless, the form still opens
  }
  return true;
}

export const FEATURE_MAX = 200;
export const DETAILS_MAX = 2000;
export const EMAIL_MAX = 254;
const TIMEOUT_MS = 10_000;

/** "Windows" · "macOS" · "Other": nothing finer than that. */
export function osFamily(userAgent = '') {
  if (userAgent.includes('Win')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  return 'Other';
}

/** A plausible email address, or '' (the field is optional; a typo is dropped rather than sent). */
export function replyEmail(value = '') {
  const v = String(value).trim();
  return v.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : '';
}

/**
 * The request body. Trimmed, length-capped; a choice is null when none was picked (or it isn't one
 * of the listed answers). replyEmail is '' unless the writer typed one; canQuote is true only when ticked.
 */
export function feedbackPayload({
  previousApp = null, foundVia = null, writesOn = null, missingFeature = '', details = '', email = '', canQuote = false,
}, userAgent = '') {
  return {
    previousApp: PREVIOUS_APPS.includes(previousApp) ? previousApp : null,
    foundVia: FOUND_VIA.includes(foundVia) ? foundVia : null,
    writesOn: WRITES_ON.includes(writesOn) ? writesOn : null,
    missingFeature: String(missingFeature).trim().slice(0, FEATURE_MAX),
    details: String(details).trim().slice(0, DETAILS_MAX),
    replyEmail: replyEmail(email),
    canQuote: canQuote === true,
    env: osFamily(userAgent),
  };
}

/**
 * Send the feedback. Resolves true on a 2xx answer, false on anything else: offline, a network
 * error, a timeout or an error status. Never throws.
 */
export async function sendFeedback(fields, {
  endpoint = FEEDBACK_ENDPOINT, fetchImpl = globalThis.fetch, nav = globalThis.navigator, timeoutMs = TIMEOUT_MS,
} = {}) {
  const payload = feedbackPayload(fields, nav?.userAgent || '');
  if (!payload.missingFeature) return false;
  if (nav && nav.onLine === false) return false;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    return !!res?.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
