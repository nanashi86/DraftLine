import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FEEDBACK_BREAK_MS, FEEDBACK_IDLE_MS, FEEDBACK_MIN_SESSION_MS, FEEDBACK_PROMPT_KEY, FEEDBACK_SESSIONS, FEEDBACK_SESSION_WORDS,
  FEEDBACK_SEEDED_KEY, RETURNING_WRITER_WORDS, WRITING_SESSIONS_KEY, countWritingSession, feedbackPause, feedbackPromptFinished,
  feedbackWanted, finishFeedbackPrompt, seedReturningWriter, sessionCounted, writingSessions,
} from '../src/lib/feedbackPrompt.js';
import { FEEDBACK_HINT, HINTS, HINT_IDS } from '../src/lib/hints.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('feedback card: only after real use', () => {
  it('a session counts once 150 words of the writer’s own typing are in it, and only once', () => {
    assert.equal(FEEDBACK_SESSION_WORDS, 150);
    const local = mem();
    const s1 = mem();
    assert.equal(countWritingSession(local, s1, 4), 0, 'a scene heading doesn’t count');
    assert.equal(countWritingSession(local, s1, 149), 0);
    assert.equal(countWritingSession(local, s1, 150), 1);
    assert.equal(countWritingSession(local, s1, 900), 1, 'counted once per session');
    assert.equal(sessionCounted(s1), true);
    assert.equal(countWritingSession(local, mem(), 200), 2, 'a new session (a new tab, a new visit) counts again');
    assert.equal(writingSessions(local), 2);
    assert.equal(local.getItem(WRITING_SESSIONS_KEY), '2');
  });
  it('wanted from the 3rd writing session, in a session that itself counts, online, and not finished', () => {
    assert.equal(FEEDBACK_SESSIONS, 3);
    assert.equal(feedbackWanted({ sessions: 2, counted: true }), false);
    assert.equal(feedbackWanted({ sessions: 3, counted: false }), false, 'third visit, but no writing yet this time');
    assert.equal(feedbackWanted({ sessions: 3, counted: true }), true);
    assert.equal(feedbackWanted({ sessions: 7, counted: true, online: false }), false, 'the form can’t send offline');
    assert.equal(feedbackWanted({ sessions: 7, counted: true, finished: true }), false);
  });
  it('blocked storage (a private window) never counts, so the card never comes', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(countWritingSession(broken, broken, 999), 0);
    assert.equal(feedbackPromptFinished(broken), false);
  });
});

describe('feedback card: at a natural pause', () => {
  const base = { now: 10 * 60_000, sessionStart: 0, lastKeyAt: 0, breakAt: 0, busy: false };
  it('two minutes into the session, then 45 s with no typing', () => {
    assert.equal(FEEDBACK_MIN_SESSION_MS, 120_000);
    assert.equal(FEEDBACK_IDLE_MS, 45_000);
    assert.equal(feedbackPause({ ...base, lastKeyAt: base.now - 45_000 }), true);
    assert.equal(feedbackPause({ ...base, lastKeyAt: base.now - 20_000 }), false, 'a short pause mid-scene');
    assert.equal(feedbackPause({ ...base, sessionStart: base.now - 60_000, lastKeyAt: 0 }), false, 'too early in the session');
  });
  it('or right after a break (a panel or dialog closed, Projects closed, Write ⇄ Plan)', () => {
    assert.equal(FEEDBACK_BREAK_MS, 6000);
    assert.equal(feedbackPause({ ...base, lastKeyAt: base.now - 8000, breakAt: base.now - 2000 }), true);
    assert.equal(feedbackPause({ ...base, lastKeyAt: base.now - 8000, breakAt: base.now - 20_000 }), false, 'the break has passed');
    assert.equal(feedbackPause({ ...base, lastKeyAt: base.now - 1000, breakAt: base.now - 500 }), false, 'never mid-sentence');
  });
  it('never while busy (Focus, Viewing, Plan, another card or toast)', () => {
    assert.equal(feedbackPause({ ...base, busy: true }), false);
  });
});

describe('feedback card: once, and not a tip', () => {
  it('Not now, Share feedback or opening ⋮ → Send Feedback… finishes it; done is final', () => {
    const local = mem();
    finishFeedbackPrompt(local, 'dismissed');
    assert.equal(local.getItem(FEEDBACK_PROMPT_KEY), 'dismissed');
    finishFeedbackPrompt(local, 'done');
    finishFeedbackPrompt(local, 'dismissed');
    assert.equal(local.getItem(FEEDBACK_PROMPT_KEY), 'done');
    assert.equal(feedbackPromptFinished(local), true);
  });
  it('the card: the tips’ look, a speech bubble, under ⋮ at every width; not counted in Tips, not brought back by Show tips again', () => {
    const h = HINTS[FEEDBACK_HINT];
    assert.equal(h.title, 'Have thoughts about DraftLine?');
    assert.equal(h.text, 'Found a bug, have an idea, or just want to say what you think? It’s anonymous, takes a minute, and helps make DraftLine better.');
    assert.deepEqual([h.action, h.dismiss, h.icon, h.target, h.beacon], ['Share feedback', 'Not now', 'message', '.btn-kebab', null]);
    assert.ok(!HINT_IDS.includes(FEEDBACK_HINT));
    const card = read('components/HintCard.jsx');
    assert.match(card, /hint\.icon === 'message'\s*\? <MessageSquare/);
    assert.match(card, /\{hint\.dismiss \|\| 'Got it'\}/);
    assert.doesNotMatch(read('App.css'), /\.btn-kebab \{[^}]*display: none/, '⋮ is never hidden');
    assert.match(read('components/HintCard.css'), /\.hint-actions \.hint-go:hover:not\(:disabled\) \{ background: color-mix/, 'hovered, the card’s main button stays terracotta');
  });
  it('the app: one card per session, feedback last; the form opened any way ends it', () => {
    const app = read('App.jsx');
    assert.match(app, /if \(!id && !sessionHint && !feedbackDone && feedbackWanted\(\{/);
    assert.match(app, /if \(activeHint === FEEDBACK_HINT\) \{\s*setFeedbackOpen\(true\);/);
    assert.match(app, /if \(!feedbackOpen\) return;\s*finishFeedbackPrompt\(LOCAL, 'done'\);/);
    assert.match(app, /finishFeedbackPrompt\(LOCAL, 'dismissed'\); \/\/ Not now: never asked again/);
    assert.match(app, /countWritingSession\(LOCAL, SESSION, sessionTyped\.current\);/);
    assert.match(app, /was\.dock && !sig\.dock\) \|\| \(was\.projects && !sig\.projects\) \|\| was\.workspace !== sig\.workspace \|\| was\.dialogs > sig\.dialogs/);
  });
});

describe('feedback card: writers already writing before this update', () => {
  const script = (words) => [{ type: 'action', text: Array.from({ length: words }, (_, i) => `w${i}`).join(' ') }];
  it('a script of their own with 500+ words: they start at 2, so their next writing session is the third', () => {
    assert.equal(RETURNING_WRITER_WORDS, 500);
    const local = mem();
    assert.equal(seedReturningWriter(local, [{ title: 'Run!', script: script(800) }]), true);
    assert.equal(writingSessions(local), 2);
    assert.equal(countWritingSession(local, mem(), 150), 3, 'one real session after the update, and it’s due');
  });
  it('only the sample, a little writing, or nothing: they start at 0 like anyone new', () => {
    for (const list of [[{ title: 'The Last Ferry', script: script(900) }], [{ title: 'Untitled', script: script(120) }], []]) {
      const local = mem();
      assert.equal(seedReturningWriter(local, list), false);
      assert.equal(writingSessions(local), 0);
    }
  });
  it('decided once per browser, and never lowers a count', () => {
    const local = mem();
    assert.equal(seedReturningWriter(local, []), false);
    assert.equal(local.getItem(FEEDBACK_SEEDED_KEY), '1');
    assert.equal(seedReturningWriter(local, [{ title: 'Run!', script: script(800) }]), false, 'already decided');
    const ahead = mem();
    ahead.setItem(WRITING_SESSIONS_KEY, '4');
    assert.equal(seedReturningWriter(ahead, [{ title: 'Run!', script: script(800) }]), false);
    assert.equal(writingSessions(ahead), 4);
  });
  it('the app runs it once on load, over the whole library', () => {
    assert.match(read('App.jsx'), /projects\.getAllProjects\(\)\.then\(\(list\) => seedReturningWriter\(LOCAL, list\), \(\) => \{\}\);/);
  });
});
