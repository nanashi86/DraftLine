import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENDING_MIN_PAGE, MILESTONES, MILESTONE_TOAST_MS, SESSION_WORD_GOAL, finishedSentence, isEndingLine, isLateNight, milestonesReached, newEndings,
} from '../src/lib/milestones.js';
import { NOIR_CLASS, NOIR_SEARCH_SELECTOR, isNoirQuery, isNoirShortcut, noirKeyAction } from '../src/lib/noir.js';
import { typewriterBell } from '../src/lib/sounds.js';
import { GUIDE_VALUES } from '../src/config/features.js';
import { fillGuide } from '../src/lib/userGuide.js';
import { SHORTCUTS } from '../src/lib/shortcuts.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const key = (o) => ({ key: 'n', code: 'KeyN', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
const at = (h, m = 0) => new Date(2026, 9, 21, h, m);

describe('User Guide: 3- and 4-act wording (item 1)', () => {
  const guide = fillGuide(read('content/userGuide.md'), GUIDE_VALUES, { shortcuts: SHORTCUTS }).text.replace(/\s+/g, ' ');
  it('Synopsis in 3 acts (Act I · II · III) and 4 acts (Act 1 · 2A · 2B · 3); the Treatment adapts to the active view', () => {
    assert.ok(guide.includes('**Synopsis**: in 3 acts, Act I: Setup, Act II: Confrontation, Act III: Resolution; in 4 acts, Act 1: Setup, Act 2A: Escalation to Midpoint, Act 2B: Fall & Crisis, Act 3: Climax & Resolution.'));
    assert.ok(guide.includes('It adapts to the active 3- or 4-act view.'));
  });
  it('imports: Roman numerals and 4-act numbers', () => {
    assert.ok(guide.includes('both traditional Roman numerals and 4-act numbers are recognized, such as `### ACT I: SETUP`, `### ACT II`, `### ACT 1`, `### ACT 2A`, `### ACT 2B`, `### ACT 3`.'));
  });
});

describe('Spec stamp on the title page', () => {
  const sheet = read('components/TitlePageSheet.jsx');
  const css = read('components/TitlePageSheet.css');
  it('says the line, as a crimson stamp at -18°, uppercase bold typewriter, never in the way', () => {
    assert.match(sheet, /export const SPEC_STAMP_TEXT = 'THIS IS A SPEC SCRIPT\. DO NOT SHOW TO HARVEY\.';/);
    assert.match(sheet, /\{specStamp && <div className="ts-spec-stamp" aria-hidden="true">\{SPEC_STAMP_TEXT\}<\/div>\}/);
    const rule = /\.ts-spec-stamp \{([^}]*)\}/.exec(css)[1];
    for (const d of ['rotate(-18deg)', 'color: rgba(176, 37, 37, 0.38)', 'border: 2px solid rgba(176, 37, 37, 0.38)', 'mix-blend-mode: multiply', 'pointer-events: none', 'text-transform: uppercase', 'font: 700', "'Courier Prime'"]) assert.ok(rule.includes(d), d);
  });
  it('a "Spec stamp" switch in the Title Page dialog, remembered; on screen only — never printed', () => {
    assert.match(read('components/TitlePageModal.jsx'), /<input type="checkbox" checked=\{specStamp\} onChange=\{\(e\) => onSpecStampChange\(e\.target\.checked\)\} \/>\s*Spec stamp/);
    const app = read('App.jsx');
    assert.match(app, /<TitlePageSheet meta=\{meta\} className="cover-sheet" specStamp=\{specStamp\} \/>/);
    assert.match(app, /writeJSON\(PREFS_KEY, \{[^}]*specStamp \}\)/);
    assert.ok(!/specStamp/.test(read('components/PrintView.jsx')), 'the print view never gets it');
    assert.match(css, /@media print \{ \.ts-spec-stamp \{ display: none !important; \} \}/);
  });
});

describe('Milestone toasts', () => {
  const none = new Set();
  it('the four lines, shown 3.5 s', () => {
    assert.equal(MILESTONE_TOAST_MS, 3500);
    assert.equal(MILESTONES.words500, "Now you're writing with gasoline.");
    assert.equal(MILESTONES.lateNight, 'Nothing good gets written after 2:00 AM... except Act III.');
    assert.match(MILESTONES.page90, /^“The script is what you’ve dreamed up–this is what it should be\. The film is what you end up with\.” – George Lucas$/);
    assert.equal(MILESTONES.page120, 'Your producer is already looking for a red pen.');
  });
  it('500 words written this session — when the count crosses it, once', () => {
    assert.equal(SESSION_WORD_GOAL, 500);
    assert.deepEqual(milestonesReached({ prev: { sessionWords: 498, pages: 3 }, next: { sessionWords: 503, pages: 3 }, fired: none }), ['words500']);
    assert.deepEqual(milestonesReached({ prev: { sessionWords: 503, pages: 3 }, next: { sessionWords: 510, pages: 3 }, fired: none }), []);
    assert.deepEqual(milestonesReached({ prev: { sessionWords: 498, pages: 3 }, next: { sessionWords: 503, pages: 3 }, fired: new Set(['words500']) }), []);
  });
  it('after midnight (00:00–03:59), on finishing a sentence', () => {
    const p = { sessionWords: 10, pages: 3 };
    assert.deepEqual(milestonesReached({ prev: p, next: p, sentence: true, now: at(1, 15) }), ['lateNight']);
    assert.deepEqual(milestonesReached({ prev: p, next: p, sentence: true, now: at(4, 0) }), []);
    assert.deepEqual(milestonesReached({ prev: p, next: p, sentence: false, now: at(2) }), []);
    assert.deepEqual([isLateNight(at(0)), isLateNight(at(3, 59)), isLateNight(at(23, 59))], [true, true, false]);
    assert.equal(finishedSentence('She runs', 'She runs.'), true);
    assert.equal(finishedSentence('“Go', '“Go!”'), true);
    assert.equal(finishedSentence('She runs.', 'She runs. '), false);
    assert.equal(finishedSentence('She runs.', 'She runs'), false);
  });
  it('page 90 and page 120, when an edit reaches them (opening a long script doesn’t count)', () => {
    assert.deepEqual(milestonesReached({ prev: { sessionWords: 0, pages: 89 }, next: { sessionWords: 5, pages: 90 } }), ['page90']);
    assert.deepEqual(milestonesReached({ prev: { sessionWords: 0, pages: 89 }, next: { sessionWords: 600, pages: 121 } }), ['words500', 'page90', 'page120']);
    const app = read('App.jsx');
    assert.match(app, /if \(Date\.now\(\) - lastEdit\.current\.at < 1500\) \{/, 'only right after the writer’s own edit');
    assert.match(app, /if \(!s \|\| s\.projectId !== projectId\) \{\s*writingSession\.current = \{ \.\.\.now, startWords: analysis\.words \};\s*return;/, 'a new script starts a new count');
    assert.match(app, /ids\.forEach\(\(id\) => milestonesFired\.current\.add\(id\)\);/, 'once per session');
  });
  it('a corner toast, out of the way of everything', () => {
    const css = read('App.css');
    const rule = /\.milestone-toast \{([^}]*)\}/.exec(css)[1];
    for (const d of ['position: fixed', 'right: 18px', 'pointer-events: none', 'milestone-out 300ms ease-in 3.2s']) assert.ok(rule.includes(d), d);
  });
});

describe('FADE OUT. — the typewriter bell', () => {
  const blocks = (text, type = 'transition') => [{ id: 'end', type, text }];
  it('a Transition, Centered or all-caps line saying FADE OUT. or THE END', () => {
    assert.ok(isEndingLine({ type: 'transition', text: 'FADE OUT.' }));
    assert.ok(isEndingLine({ type: 'centered', text: 'THE END' }));
    assert.ok(isEndingLine({ type: 'action', text: 'FADE OUT.' }));
    assert.ok(!isEndingLine({ type: 'action', text: 'She fades out. The end of hope.' }));
    assert.ok(!isEndingLine({ type: 'transition', text: 'FADE OUT' }), 'the period makes it FADE OUT.');
  });
  it('rings once, when the line is completed on page 80 or later', () => {
    assert.equal(ENDING_MIN_PAGE, 80);
    assert.deepEqual(newEndings(blocks('FADE OUT'), blocks('FADE OUT.'), { end: 95 }), ['end']);
    assert.deepEqual(newEndings(blocks('FADE OUT'), blocks('FADE OUT.'), { end: 79 }), []);
    assert.deepEqual(newEndings(blocks('FADE OUT.'), blocks('FADE OUT.'), { end: 95 }), [], 'already there: no ring');
    assert.deepEqual(newEndings(blocks('FADE OUT'), blocks('FADE OUT.'), { end: 95 }, new Set(['end'])), [], 'once');
    assert.deepEqual(newEndings([], blocks('THE END', 'centered'), { end: 102 }), ['end']);
  });
  it('a synthesised ~2 kHz triangle with exponential decay (Web Audio, no sound files)', () => {
    const made = [];
    const param = () => ({ setValueAtTime: (v) => made.push(['set', v]), exponentialRampToValueAtTime: (v, t) => made.push(['ramp', v, t]), value: 0 });
    const node = () => ({ connect: (n) => n, gain: param(), frequency: param() });
    const ctx = {
      currentTime: 0, destination: {},
      createGain: () => node(),
      createOscillator: () => { const o = { ...node(), start() {}, stop() {}, set type(t) { made.push(['type', t]); } }; return o; },
    };
    assert.equal(typewriterBell({ ctx }), true);
    assert.ok(made.some(([k, v]) => k === 'type' && v === 'triangle'));
    assert.ok(made.some(([k, v]) => k === 'set' && v === 2000));
    assert.ok(made.some(([k, v, t]) => k === 'ramp' && v === 0.0001 && t > 1));
    assert.equal(typewriterBell({ ctx: null }), false, 'no Web Audio: silently nothing');
    assert.match(read('App.jsx'), /if \(endings\.length\) \{\s*endings\.forEach\(\(id\) => endingsChimed\.current\.add\(id\)\);\s*typewriterBell\(\);/);
  });
});

describe('Film Noir mode', () => {
  it('Ctrl+Shift+Alt+N (or ⌘⇧⌥N) toggles it; Esc leaves it; other keys do nothing', () => {
    assert.ok(isNoirShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true })));
    assert.ok(isNoirShortcut(key({ metaKey: true, shiftKey: true, altKey: true, key: '˜' })));
    assert.ok(!isNoirShortcut(key({ ctrlKey: true, altKey: true })));
    assert.ok(!isNoirShortcut(key({ altKey: true })), 'Alt+N stays the margin note');
    assert.equal(noirKeyAction(key({ ctrlKey: true, shiftKey: true, altKey: true }), false), 'on');
    assert.equal(noirKeyAction(key({ ctrlKey: true, shiftKey: true, altKey: true }), true), 'off');
    assert.equal(noirKeyAction({ key: 'Escape', code: 'Escape' }, true), 'off');
    assert.equal(noirKeyAction({ key: 'Escape', code: 'Escape' }, false), null, 'Esc is left alone when it’s off');
    assert.equal(noirKeyAction(key({}), true), null);
  });
  it('typing "noir" into a drawer search box turns it on', () => {
    assert.ok(isNoirQuery('noir') && isNoirQuery(' NOIR ') && !isNoirQuery('noirish'));
    for (const sel of ['input[type="search"]', '.pb-search', 'input[placeholder^="Filter"]']) assert.ok(NOIR_SEARCH_SELECTOR.includes(sel), sel);
  });
  it('the app: capture-phase keys (Esc leaves Noir first), the root class, rain while on, a status chip that turns it off', () => {
    const app = read('App.jsx');
    assert.match(app, /window\.addEventListener\('keydown', onKey, true\);/);
    assert.match(app, /e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);\s*setNoirMode\(act === 'on'\);/);
    assert.match(app, /noir \? NOIR_CLASS : '',/);
    assert.equal(NOIR_CLASS, 'film-noir-mode');
    assert.match(app, /if \(on\) \(noirAudio\.current \?\?= createNoirAudio\(\)\)\.start\(\);\s*else noirAudio\.current\?\.stop\(\);/, 'sound on with Noir, off with Esc / the keys / the chip (all setNoirMode)');
    assert.match(app, /noirAudio\.current\?\.dispose\(\);/);
    assert.ok(!/rainLoop/.test(app));
    assert.match(app, /\{noir && \(\s*<button type="button" className="status-noir" onClick=\{\(\) => setNoirMode\(false\)\}[^>]*>\s*<span aria-hidden="true">🌧<\/span> Noir Active · Esc to exit/);
  });
  it('the look: warm monochrome, a vignette, soft Venetian-blind shadows and 35 mm grain', () => {
    const css = read('App.css');
    assert.match(css, /\.film-noir-mode \.scroller,\s*\.film-noir-mode \.board \{ filter: grayscale\(1\) sepia\(0\.18\) contrast\(1\.18\) brightness\(0\.94\); \}/);
    const over = /\.film-noir-mode \.workspace::after \{([^}]*)\}/.exec(css)[1];
    assert.ok(over.includes('radial-gradient(ellipse at center, transparent 65%, rgba(0, 0, 0, 0.45) 100%)'), 'vignette');
    assert.ok(over.includes('repeating-linear-gradient(-28deg'), 'blinds');
    const alphas = [...over.matchAll(/rgba\(0, 0, 0, ([\d.]+)\)/g)].map((m) => Number(m[1])).filter((a) => a > 0 && a !== 0.45);
    assert.deepEqual([Math.min(...alphas), Math.max(...alphas)], [0.12, 0.24], 'slats between 0.12 and 0.24');
    assert.ok(over.includes('pointer-events: none'));
    const grain = /\.film-noir-mode \.workspace::before \{([^}]*)\}/.exec(css)[1];
    for (const d of ['opacity: 0.04', 'feTurbulence', 'animation: noir-grain', 'pointer-events: none']) assert.ok(grain.includes(d), d);
    assert.match(css, /@keyframes noir-grain/);
    assert.match(css, /@media print \{ \.film-noir-mode \.workspace::after, \.film-noir-mode \.workspace::before \{ display: none; \}/);
  });
});
