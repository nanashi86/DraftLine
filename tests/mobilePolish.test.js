// Mobile polish, round 1: phones and touch screens get a few things differently, and a desktop with
// a mouse gets none of it (lib/mobile.js, the "Phones and touch screens" block in App.css).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FULL_WIDTH_PANELS_QUERY, PHONE_QUERY, TOUCH_QUERY, exclusivePanels, isShortcutHint, mediaMatches, viewOnPhone, writeViewsFor,
} from '../src/lib/mobile.js';
import { moreMenuItems } from '../src/lib/toolbar.js';
import { fillGuide, parseGuide, touchIntro } from '../src/lib/userGuide.js';
import { SHORTCUTS } from '../src/lib/shortcuts.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('src/App.css');
const VIEWS = [{ id: 'page' }, { id: 'split' }, { id: 'board' }];

describe('queries', () => {
  it('phone = the existing 559.98px "phones" step; full-width panels = the 720px step; touch = no hover', () => {
    assert.equal(PHONE_QUERY, '(max-width: 559.98px)');
    assert.equal(FULL_WIDTH_PANELS_QUERY, '(max-width: 720px)');
    assert.equal(TOUCH_QUERY, '(hover: none)');
    assert.match(css, /@media \(max-width: 720px\) \{(?:[^{}]*\{[^{}]*\})*?[^{}]*:root \{ --nav-w: 100vw; \}/);
  });
  it('mediaMatches: no window, or a broken one, reads as no', () => {
    assert.equal(mediaMatches(PHONE_QUERY, {}), false);
    assert.equal(mediaMatches(PHONE_QUERY, { matchMedia: () => { throw new Error('x'); } }), false);
    assert.equal(mediaMatches(PHONE_QUERY, { matchMedia: (q) => ({ matches: q === PHONE_QUERY }) }), true);
  });
});

describe('Split view on phones', () => {
  it('a phone offers Page · Board; anything wider keeps Page · Split · Board', () => {
    assert.deepEqual(writeViewsFor(VIEWS, true).map((v) => v.id), ['page', 'board']);
    assert.equal(writeViewsFor(VIEWS, false), VIEWS);
  });
  it('Split shows as Page on a phone; nothing else changes', () => {
    assert.equal(viewOnPhone('split', true), 'page');
    assert.equal(viewOnPhone('board', true), 'board');
    assert.equal(viewOnPhone('page', true), 'page');
    assert.equal(viewOnPhone('split', false), 'split');
  });
});

describe('one full-width panel at a time (phones)', () => {
  const none = { dock: null, navOpen: false };
  it('opening Characters closes Scenes', () => {
    assert.deepEqual(exclusivePanels({ dock: null, navOpen: true }, { dock: 'characters', navOpen: true }), { dock: 'characters', navOpen: false });
  });
  it('opening the Story Bible closes Scenes (and the dock swaps Characters for it, as always)', () => {
    assert.deepEqual(exclusivePanels({ dock: 'characters', navOpen: false }, { dock: 'bible', navOpen: false }), { dock: 'bible', navOpen: false });
    assert.deepEqual(exclusivePanels({ dock: null, navOpen: true }, { dock: 'bible', navOpen: true }), { dock: 'bible', navOpen: false });
  });
  it('opening Scenes closes the dock panel', () => {
    assert.deepEqual(exclusivePanels({ dock: 'bible', navOpen: false }, { dock: 'bible', navOpen: true }), { dock: null, navOpen: true });
  });
  it('both open already (a window narrowed to phone width): the dock panel stays', () => {
    assert.deepEqual(exclusivePanels({ dock: 'notes', navOpen: true }, { dock: 'notes', navOpen: true }), { dock: 'notes', navOpen: false });
  });
  it('one or none open: left as it is', () => {
    assert.deepEqual(exclusivePanels(none, { dock: 'snapshots', navOpen: false }), { dock: 'snapshots', navOpen: false });
    assert.deepEqual(exclusivePanels(none, { dock: null, navOpen: true }), { dock: null, navOpen: true });
    assert.deepEqual(exclusivePanels({ dock: 'bible', navOpen: false }, none), none);
  });
  it('App applies it only where panels are full width', () => {
    const app = read('src/App.jsx');
    assert.match(app, /if \(!mediaMatches\(FULL_WIDTH_PANELS_QUERY\)\) return;\s*const next = exclusivePanels\(was, now\);/);
  });
});

describe('keyboard-shortcut hints', () => {
  it('shortcuts are recognised', () => {
    for (const h of ['Alt+S', 'Ctrl+/', 'Ctrl+,', 'Ctrl+Alt+N', 'Ctrl+O', 'Alt+1', 'Alt+D', '⌘O', '⌘⇧Z', 'F1', 'Esc exits']) assert.ok(isShortcutHint(h), h);
  });
  it('counts, file types and words are not', () => {
    for (const h of ['12', '0', 'Clean', 'Plan', 'Showing', '.fdx', '.fountain', 'Word · Docs · PDF', 'The Last Ferry', 'locked', 'only script', '', null, undefined, 'Deep roast & cinematic']) {
      assert.ok(!isShortcutHint(h), String(h));
    }
  });
  it('touch screens hide them (menus, the Element list, the suggestion footer); nothing else', () => {
    const block = css.slice(css.lastIndexOf('@media (hover: none) {'));
    assert.match(block, /^@media \(hover: none\) \{\s*\.menu-hint\.is-kbd,\s*\.dl-opt-hint\.is-kbd,\s*\.ac-hint \{ display: none; \}/);
    assert.match(read('src/components/Menu.jsx'), /isShortcutHint\(it\.hint\) \? ' is-kbd'/);
    assert.match(read('src/components/Select.jsx'), /isShortcutHint\(o\.hint\) \? ' is-kbd'/);
  });
  it('the ⋮ menu leaves out Keyboard Shortcuts on a touch screen only', () => {
    const labels = (touch) => moreMenuItems({ bibleOnBar: true, charactersOnBar: true, touch }).filter((i) => !i.divider).map((i) => i.label);
    assert.ok(labels(false).includes('Keyboard Shortcuts'));
    assert.ok(!labels(true).includes('Keyboard Shortcuts'));
    const shape = (touch) => moreMenuItems({ bibleOnBar: true, charactersOnBar: true, touch }).map((i) => (i.divider ? '---' : i.label));
    assert.deepEqual(shape(true), ['View Snapshots', 'Margin Notes', '---', 'About DraftLine']); // no doubled divider
  });
  it('the User Guide opens without the F1 / Ctrl+/ paragraph on a touch screen; the rest and the printout keep it', () => {
    const guide = parseGuide(fillGuide(read('src/content/userGuide.md'), {}, { shortcuts: SHORTCUTS }).text);
    const has = (blocks) => blocks.some((b) => /`F1`/.test(b.text || ''));
    assert.ok(has(guide.intro));
    const t = touchIntro(guide.intro);
    assert.ok(!has(t));
    assert.equal(t.length, guide.intro.length - 1);
    assert.match(read('src/components/UserGuideModal.jsx'), /mediaMatches\(TOUCH_QUERY\) \? touchIntro\(GUIDE\.intro\) : GUIDE\.intro/);
  });
});

describe('phone menus and touch targets (App.css)', () => {
  const tail = css.slice(css.indexOf('/* ---------- Phones and touch screens'));
  it('every rule of the block sits inside a phone or touch media query (desktop untouched)', () => {
    const top = tail.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').trim();
    assert.equal(top, '');
    const queries = [...tail.matchAll(/@media ([^{]+)\{/g)].map((m) => m[1].trim());
    assert.deepEqual(queries, ['(max-width: 559.98px)', '(max-width: 559.98px) and (hover: none)', '(hover: none)', '(hover: none) and (pointer: coarse)']);
  });
  it('File ▾ on a phone: inside the window, 8px from each edge, scrolling when taller', () => {
    assert.match(tail, /\.bar \.file-menu \.menu-pop \{\s*position: fixed;\s*top: calc\(var\(--bar-h\) \+ 6px\);\s*left: 8px;\s*right: 8px;\s*min-width: 0;/);
    assert.match(tail, /\.bar \.menu-pop \{[^}]*max-height: calc\(100dvh - var\(--bar-h\) - 14px\);[^}]*overflow-y: auto;/);
  });
  it('bar buttons get a 44px-tall invisible tap area; menu items and segment neighbours never overlap', () => {
    assert.match(tail, /\.bar button:not\(\.menu-item\)::before \{[^}]*height: max\(100%, 44px\);/);
    assert.match(tail, /\.bar \.seg > \.seg-btn::before \{ left: 0; right: 0; \}/);
    assert.doesNotMatch(tail, /::before \{[^}]*background/);
  });
});
