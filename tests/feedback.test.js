import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_FEEDBACK_ENDPOINT, DETAILS_MAX, EMAIL_MAX, FEATURE_MAX, FEEDBACK_ENDPOINT, FOUND_VIA, NO_PREVIOUS_APP, PREVIOUS_APPS, WRITES_ON,
  feedbackPayload, osFamily, replyEmail, sendFeedback,
} from '../src/lib/feedback.js';
import { moreMenuItems } from '../src/lib/toolbar.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Safari/605.1.15';
const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36';

/** A fetch that records its call and answers with `status` (or throws). */
const fakeFetch = (status, { fail = false } = {}) => {
  const f = async (url, init) => {
    f.calls.push({ url, init });
    if (fail) throw new TypeError('Failed to fetch');
    return { ok: status >= 200 && status < 300, status };
  };
  f.calls = [];
  return f;
};
const nav = (userAgent, onLine = true) => ({ userAgent, onLine });

describe('Anonymous feedback: what is sent', () => {
  it('the previous-app choices, in order: the software, then "None (New Writer)"', () => {
    assert.deepEqual(PREVIOUS_APPS, ['Final Draft', 'Fade In', 'Highland 2', 'WriterDuet', 'Celtx', 'Google Docs / Word', 'Other', 'None (New Writer)']);
    assert.equal(NO_PREVIOUS_APP, 'None (New Writer)');
    assert.equal(PREVIOUS_APPS.at(-1), NO_PREVIOUS_APP, 'last, so it sits beneath the software choices');
  });
  it('"None (New Writer)" and "Other" go into the payload as previousApp', async () => {
    for (const choice of [NO_PREVIOUS_APP, 'Other']) {
      assert.equal(feedbackPayload({ previousApp: choice, missingFeature: 'x' }).previousApp, choice);
      const f = fakeFetch(200);
      await sendFeedback({ previousApp: choice, missingFeature: 'Outline view' }, { fetchImpl: f, nav: nav(WIN) });
      assert.equal(JSON.parse(f.calls[0].init.body).previousApp, choice);
    }
    assert.equal(feedbackPayload({ previousApp: 'New Writer', missingFeature: 'x' }).previousApp, null, 'the old label is no longer a choice');
  });
  it('how they found DraftLine and where they write: listed answers only, or null', () => {
    assert.deepEqual(FOUND_VIA, ['Google search', 'Google ad', 'AI assistant', 'YouTube', 'Instagram / Threads', 'TikTok', 'X', 'Reddit', 'AlternativeTo', 'A friend', 'Other']);
    assert.deepEqual(WRITES_ON, ['Computer', 'Phone', 'Tablet', 'All of them']);
    const p = feedbackPayload({ foundVia: 'TikTok', writesOn: 'Phone', missingFeature: 'x' });
    assert.equal(p.foundVia, 'TikTok');
    assert.equal(p.writesOn, 'Phone');
    const q = feedbackPayload({ foundVia: 'Facebook', writesOn: 'Typewriter', missingFeature: 'x' });
    assert.equal(q.foundVia, null);
    assert.equal(q.writesOn, null);
  });
  it('the reply email is optional, and a typo is dropped rather than sent; quoting is opt-in', () => {
    assert.equal(replyEmail('  sam@example.com '), 'sam@example.com');
    for (const bad of ['', 'sam', 'sam@example', 'sam @example.com', `${'a'.repeat(EMAIL_MAX)}@example.com`]) assert.equal(replyEmail(bad), '', bad);
    assert.equal(feedbackPayload({ missingFeature: 'x' }).replyEmail, '');
    assert.equal(feedbackPayload({ missingFeature: 'x' }).canQuote, false);
    assert.equal(feedbackPayload({ missingFeature: 'x', canQuote: 'yes' }).canQuote, false, 'only a real tick');
    assert.equal(feedbackPayload({ missingFeature: 'x', canQuote: true }).canQuote, true);
  });
  it('only a coarse OS name: Windows, macOS or Other', () => {
    assert.deepEqual([osFamily(WIN), osFamily(MAC), osFamily(LINUX), osFamily('')], ['Windows', 'macOS', 'Other', 'Other']);
  });
  it('the payload is exactly these fields: trimmed and capped', () => {
    const p = feedbackPayload({ previousApp: 'Fade In', missingFeature: '  Revision colours  ', details: ' crashes on paste ' }, WIN);
    assert.deepEqual(p, {
      previousApp: 'Fade In', foundVia: null, writesOn: null, missingFeature: 'Revision colours', details: 'crashes on paste', replyEmail: '', canQuote: false, env: 'Windows',
    });
    assert.deepEqual(Object.keys(p), ['previousApp', 'foundVia', 'writesOn', 'missingFeature', 'details', 'replyEmail', 'canQuote', 'env']);
    assert.equal(feedbackPayload({ previousApp: 'Notepad', missingFeature: 'x' }).previousApp, null, 'only a listed app, or null');
    assert.equal(feedbackPayload({ missingFeature: 'x'.repeat(FEATURE_MAX + 50), details: 'y'.repeat(DETAILS_MAX + 50) }).missingFeature.length, FEATURE_MAX);
    assert.equal(feedbackPayload({ missingFeature: 'x', details: 'y'.repeat(DETAILS_MAX + 50) }).details.length, DETAILS_MAX);
  });
  it('posts to the Worker by default (VITE_FEEDBACK_ENDPOINT overrides it at build time)', () => {
    assert.equal(DEFAULT_FEEDBACK_ENDPOINT, 'https://draftline-feedback.elemaire86.workers.dev');
    assert.equal(FEEDBACK_ENDPOINT, DEFAULT_FEEDBACK_ENDPOINT);
    assert.match(read('src/lib/feedback.js'), /import\.meta\.env\?\.VITE_FEEDBACK_ENDPOINT \|\| DEFAULT_FEEDBACK_ENDPOINT/);
  });
});

describe('Anonymous feedback: sending', () => {
  it('200: a POST of the JSON payload with no cookies, no referrer, no cache, and true back', async () => {
    const f = fakeFetch(200);
    const ok = await sendFeedback({ previousApp: 'Celtx', missingFeature: 'Index cards on iPad' }, { fetchImpl: f, nav: nav(MAC) });
    assert.equal(ok, true);
    const [{ url, init }] = f.calls;
    assert.equal(url, DEFAULT_FEEDBACK_ENDPOINT);
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), {
      previousApp: 'Celtx', foundVia: null, writesOn: null, missingFeature: 'Index cards on iPad', details: '', replyEmail: '', canQuote: false, env: 'macOS',
    });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers['Content-Type'], 'text/plain;charset=UTF-8', 'a simple request: no CORS preflight');
  });
  it('an error status, a network failure or being offline: false, never a throw', async () => {
    assert.equal(await sendFeedback({ missingFeature: 'x' }, { fetchImpl: fakeFetch(500), nav: nav(WIN) }), false);
    assert.equal(await sendFeedback({ missingFeature: 'x' }, { fetchImpl: fakeFetch(0, { fail: true }), nav: nav(WIN) }), false);
    const f = fakeFetch(200);
    assert.equal(await sendFeedback({ missingFeature: 'x' }, { fetchImpl: f, nav: nav(WIN, false) }), false);
    assert.equal(f.calls.length, 0, 'offline: nothing is attempted');
  });
  it('the missing-feature answer is required: an empty one sends nothing', async () => {
    const f = fakeFetch(200);
    assert.equal(await sendFeedback({ missingFeature: '   ' }, { fetchImpl: f, nav: nav(WIN) }), false);
    assert.equal(f.calls.length, 0);
  });
  it('a request that hangs is abandoned (timeout) as a failure', async () => {
    const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    assert.equal(await sendFeedback({ missingFeature: 'x' }, { fetchImpl: hang, nav: nav(WIN), timeoutMs: 20 }), false);
  });
});

describe('Anonymous feedback: menu and modal', () => {
  const modal = read('src/components/FeedbackModal.jsx');
  const app = read('src/App.jsx');
  it('⋮ has "Send Feedback…" directly above "About DraftLine"', () => {
    const items = moreMenuItems({ bibleOnBar: true, charactersOnBar: true, onFeedback() {}, onAbout() {}, onGuide() {} });
    const at = items.findIndex((i) => i.label === 'Send Feedback…');
    assert.ok(at > 0);
    assert.equal(items[at + 1].label, 'About DraftLine');
    assert.match(app, /onFeedback: \(\) => setFeedbackOpen\(true\),/);
    assert.match(app, /const FeedbackModal = lazy\(\(\) => import\('\.\/components\/FeedbackModal\.jsx'\)\);/, 'loaded on first use');
  });
  it('the modal: title, ✕, the questions, the notice, Cancel and Send', () => {
    assert.match(modal, /<h2 id="afb-title">Share Anonymous Feedback<\/h2>/);
    assert.match(modal, /aria-label="Close"/);
    assert.match(modal, /label="How did you find DraftLine\?" options=\{FOUND_VIA\}/);
    assert.match(modal, /label="Where do you write\?" options=\{WRITES_ON\}/);
    assert.match(modal, /label="I previously used:" options=\{PREVIOUS_APPS\}/);
    assert.match(modal, /role="radiogroup"[\s\S]*?options\.map[\s\S]*?role="radio"\s*aria-checked=\{value === opt\}/, 'single-select pills');
    assert.match(modal, /Want a reply\? <span className="afb-optional">\(optional\)<\/span>[\s\S]*?type="email"/);
    assert.match(modal, /type="checkbox" checked=\{canQuote\}[\s\S]*?OK to quote me anonymously on the DraftLine site/);
    assert.match(modal, /placeholder="Your email \(used only to reply\)"/);
    assert.match(modal, /send\(\{ foundVia, writesOn, previousApp, missingFeature, details, email, canQuote \}\)/);
    const css = read('src/components/FeedbackModal.css');
    assert.match(css, /\.afb-pills \{ display: flex; flex-wrap: wrap; gap: 6px; \}/, 'answers wrap as one-line pills');
    assert.match(css, /\.afb-pill \{[^}]*white-space: nowrap;/, 'a pill never breaks over two lines');
    assert.match(modal, />What’s on your mind\?</, 'a bug, an idea or a thank-you fits, not only a missing feature');
    assert.match(modal, /placeholder="A bug, an idea, a missing feature, or just what you think…"/);
    assert.match(modal, /<input[\s\S]*?required\s*aria-required="true"/);
    assert.match(modal, /More details <span className="afb-optional">\(optional\)<\/span>[\s\S]*?<textarea/);
    assert.match(modal, /<p className="afb-notice">This form collects no cookies, accounts, or IP addresses\.<\/p>/);
    assert.match(modal, />Cancel<\/button>/);
    assert.match(modal, /disabled=\{!canSend\}>\{busy \? 'Sending…' : 'Send Feedback'\}/);
  });
  it('Esc and a click outside close it; nothing typed is lost on a failed send', () => {
    assert.match(modal, /onCancel=\{\(e\) => \{\s*e\.preventDefault\(\);\s*close\(\);/);
    assert.match(modal, /if \(e\.target === dialogRef\.current\) close\(\);/);
    assert.match(modal, /if \(ok\) onSent\(\);\s*else onFailed\(\);/);
  });
  it('the toasts: thanks on success (closing the modal), the connection message on failure, 4 seconds each', () => {
    assert.match(app, /onSent=\{\(\) => \{\s*setFeedbackOpen\(false\);\s*notify\('Thank you for your feedback!', 4000\);/);
    assert.match(app, /onFailed=\{\(\) => notify\('Could not send feedback\. Check your internet connection\.', 4000\)\}/);
    assert.match(app, /const notify = useCallback\(\(msg, ms = 2400\) => \{/);
  });
  it('zinc surfaces on dark, linen on Editorial Light (float tokens)', () => {
    const css = read('src/components/FeedbackModal.css');
    assert.match(css, /\.afb-modal \{[^}]*background: var\(--float-bg\);/);
    assert.match(css, /\.afb-input \{[^}]*background: var\(--float-field\);/);
  });
});
