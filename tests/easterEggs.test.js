import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  MILESTONES, MILESTONE_TOAST_MS, SESSION_WORD_GOAL, finishedSentence, isLateNight, milestonesReached,
} from '../src/lib/milestones.js';
import * as milestones from '../src/lib/milestones.js';
import * as noirLib from '../src/lib/noir.js';
import { NOIR_CLASS, isNoirGenre, isNoirShortcut, noirGenrePicked, noirKeyAction } from '../src/lib/noir.js';
import { emptyStoryDna, genresFromText, toggleGenre } from '../src/lib/storyDna.js';
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

describe('Title page contact: no phone auto-linking', () => {
  it('index.html turns off telephone detection', () => {
    assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /<meta name="format-detection" content="telephone=no" \/>/);
  });
  it('the contact block opts out of auto-linking and translation, and is rebuilt (keyed) when its text changes', () => {
    assert.match(read('components/TitlePageSheet.jsx'),
      /<div key=\{contact\} className=\{`ts-contact\$\{typedContact \? '' : ' is-placeholder'\}`\} data-no-autolink="true" translate="no">\s*<RichLine text=\{contact\} \/>/);
  });
});

describe('Title page placeholders: Chilli Palmer, faint, on screen only', () => {
  it('an empty author / contact shows the placeholder, marked is-placeholder; typed text replaces it', () => {
    const sheet = read('components/TitlePageSheet.jsx');
    assert.match(sheet, /const author = typedAuthor \|\| \(placeholders \? AUTHOR_PLACEHOLDER : ''\);/);
    assert.match(sheet, /const contact = typedContact \|\| \(placeholders \? CONTACT_PLACEHOLDER : ''\);/);
    assert.match(sheet, /className=\{`ts-author\$\{typedAuthor \? '' : ' is-placeholder'\}`\}/);
    const css = read('components/TitlePageSheet.css');
    assert.match(css, /\.title-sheet \.is-placeholder \{ opacity: 0\.35; \}/);
    assert.match(css, /@media print \{ \.title-sheet \.is-placeholder \{ display: none !important; \} \}/);
  });
  it('only the on-screen cover and the dialog preview ask for them — print never does', () => {
    assert.match(read('App.jsx'), /<TitlePageSheet meta=\{meta\} className="cover-sheet" specStamp=\{specStamp\} placeholders \/>/);
    assert.match(read('components/TitlePageModal.jsx'), /<TitlePageSheet meta=\{form\} specStamp=\{specStamp\} placeholders \/>/);
    assert.ok(!/placeholders/.test(read('components/PrintView.jsx')));
    const modal = read('components/TitlePageModal.jsx');
    assert.match(modal, /\{ key: 'author', label: 'Author', placeholder: AUTHOR_PLACEHOLDER \}/);
    assert.match(modal, /\{ key: 'contact', label: 'Contact \/ Copyright', placeholder: CONTACT_PLACEHOLDER, multiline: true \}/);
  });
});

describe('Spec stamp on the title page', () => {
  const sheet = read('components/TitlePageSheet.jsx');
  const css = read('components/TitlePageSheet.css');
  it('says the line, as a crimson stamp at -18°, uppercase bold typewriter, never in the way', () => {
    assert.match(read('lib/specStamp.js'), /export const SPEC_STAMP_TEXT = 'THIS IS A SPEC SCRIPT\. DO NOT SHOW TO HARVEY\.';/);
    assert.match(sheet, /import \{ SPEC_STAMP_TEXT \} from '\.\.\/lib\/specStamp\.js';/);
    assert.match(sheet, /\{specStamp && <div className="ts-spec-stamp" aria-hidden="true">\{SPEC_STAMP_TEXT\}<\/div>\}/);
    const rule = /\.ts-spec-stamp \{([^}]*)\}/.exec(css)[1];
    for (const d of ['rotate(-18deg)', 'color: rgba(176, 37, 37, 0.38)', 'border: 2px solid rgba(176, 37, 37, 0.38)', 'mix-blend-mode: multiply', 'pointer-events: none', 'text-transform: uppercase', 'font: 700', "'Courier Prime'"]) assert.ok(rule.includes(d), d);
  });
  it('keeps its verified size, angle and ink: 78% wide, -18°, 0.3in Courier, crimson at 0.38, multiplied', () => {
    const rule = /\.ts-spec-stamp \{([^}]*)\}/.exec(read('components/TitlePageSheet.css'))[1];
    for (const d of ['width: 78%', 'transform: translate(-50%, -50%) rotate(-18deg)', 'font: 700 calc(var(--in) * 0.3) / 1.25',
      'color: rgba(176, 37, 37, 0.38)', 'border: 2px solid rgba(176, 37, 37, 0.38)', 'mix-blend-mode: multiply']) assert.ok(rule.includes(d), d);
  });
  it('a "Spec stamp" switch in the Title Page dialog, remembered; on screen only — never printed', () => {
    assert.match(read('components/TitlePageModal.jsx'), /<input type="checkbox" checked=\{specStamp\} onChange=\{\(e\) => onSpecStampChange\(e\.target\.checked\)\} \/>\s*Spec stamp/);
    const app = read('App.jsx');
    assert.match(app, /<TitlePageSheet meta=\{meta\} className="cover-sheet" specStamp=\{specStamp\} placeholders \/>/);
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

describe('The End bell is gone', () => {
  it('no bell, no sound module, no ending-line watcher', () => {
    assert.ok(!existsSync(new URL('../src/lib/sounds.js', import.meta.url)), 'sounds.js removed');
    for (const name of ['newEndings', 'isEndingLine', 'ENDING_MIN_PAGE']) assert.equal(milestones[name], undefined, name);
    const app = read('App.jsx');
    assert.ok(!/typewriterBell|newEndings|endingsChimed|sounds\.js/.test(app));
    assert.ok(!/bell/i.test(read('content/userGuide.md')), 'not in the guide');
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
  it('typing "noir" into a search box no longer does anything', () => {
    for (const gone of ['NOIR_SEARCH_SELECTOR', 'isNoirQuery', 'NOIR_WORD']) assert.equal(noirLib[gone], undefined, gone);
    const app = read('App.jsx');
    assert.ok(!/addEventListener\('input'|isNoirQuery|NOIR_SEARCH_SELECTOR/.test(app));
  });
  it('picking the Noir genre (or "Film Noir") in Story DNA turns it on — only when newly picked', () => {
    assert.ok(isNoirGenre('Noir') && isNoirGenre('film noir') && isNoirGenre('Film-Noir') && !isNoirGenre('Noirish') && !isNoirGenre('Drama'));
    const before = emptyStoryDna();
    const picked = toggleGenre(before, 'Noir', true);
    assert.equal(noirGenrePicked(before, picked), true);
    assert.equal(noirGenrePicked(picked, toggleGenre(picked, 'Drama', true)), false, 'already Noir: another genre doesn’t re-trigger');
    assert.equal(noirGenrePicked(picked, toggleGenre(picked, 'Noir', false)), false, 'unpicking never turns it on');
    assert.deepEqual(genresFromText('Film Noir, Crime').genres, ['Crime', 'Noir'], '"Film Noir" is the Noir genre');
    const app = read('App.jsx');
    assert.match(app, /const changeStoryDna = useCallback\(\(next\) => \{\s*if \(noirGenrePicked\(storyDna, next\) && !noirRef\.current\) setNoirMode\(true\);\s*setStoryDna\(next\);\s*\}, \[storyDna, setNoirMode\]\);/);
    assert.match(app, /onStoryDnaChange=\{changeStoryDna\}/);
  });
  it('leaving Noir (Esc, the keys, the chip) never touches the script’s Story DNA — "Noir" stays in genres', () => {
    const app = read('App.jsx');
    const body = /const setNoirMode = useCallback\(\(on\) => \{([\s\S]*?)\n {2}\}, \[\]\);/.exec(app)[1];
    assert.ok(!/storyDna|setStoryDna|genres|toggleGenre/i.test(body), 'setNoirMode only sets the view, the sound and the class');
    assert.match(body, /noirRef\.current = on;\s*setNoir\(on\);/);
    // Every way out goes through setNoirMode(false) and nothing else.
    assert.match(app, /e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);\s*setNoirMode\(act === 'on'\);\s*\};/);
    assert.match(app, /className="status-noir" onClick=\{\(\) => setNoirMode\(false\)\}/);
    // The only Story DNA write tied to Noir is the one that passes the writer's own change through unchanged.
    const writes = [...app.matchAll(/setStoryDna\(([^)]*)\)/g)].map((m) => m[1]);
    assert.ok(writes.every((w) => /^(next|doc\.storyDna|next\.storyDna|after\.storyDna|x\.storyDna)$/.test(w.trim())), writes.join(' | '));
    const kept = toggleGenre(emptyStoryDna(), 'Noir', true);
    const snapshot = JSON.stringify(kept);
    for (const act of [noirKeyAction({ key: 'Escape', code: 'Escape' }, true), noirKeyAction(key({ ctrlKey: true, shiftKey: true, altKey: true }), true)]) assert.equal(act, 'off');
    assert.equal(JSON.stringify(kept), snapshot);
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
