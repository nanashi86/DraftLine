import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HINTS, HINTS_KEY, HINT_IDLE_MS, HINT_IDS, HINT_MIN_BIOS, HINT_MIN_FINDINGS, HINT_MIN_PAGES, HINT_MIN_SCENES, HINT_MIN_SPEAKERS,
  HINT_MIN_SPEECHES, HINT_OVERLAYS, HINT_PLAN_PAGES, HINT_SESSION_KEY, HINT_SETTLE_MS,
  hintCalm, hintRoomFor, hintWanted, markHint, pickHint, readHints, resetHints,
} from '../src/lib/hints.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};

describe('feature hints: when each one is wanted (by what the writer has done)', () => {
  it('Import Scenes: 8+ scenes or 10+ pages, and no scene cards yet', () => {
    assert.equal(HINT_MIN_SCENES, 8);
    assert.equal(HINT_MIN_PAGES, 10);
    assert.equal(hintWanted('importScenes', { scenes: 7, pages: 9 }), false, 'one page is too early');
    assert.equal(hintWanted('importScenes', { scenes: 8 }), true);
    assert.equal(hintWanted('importScenes', { scenes: 2, pages: 10 }), true);
    assert.equal(hintWanted('importScenes', { scenes: 40, sceneCards: 1 }), false, 'the board already has scene cards');
  });
  it('Analyze Value Shifts: scene cards on the board, none with a Value Shift yet', () => {
    assert.equal(hintWanted('analyzeShifts', { sceneCards: 0 }), false);
    assert.equal(hintWanted('analyzeShifts', { sceneCards: 12 }), true);
    assert.equal(hintWanted('analyzeShifts', { sceneCards: 12, shiftedCards: 1 }), false);
  });
  it('Populate Bio: 3+ characters it would add to', () => {
    assert.equal(HINT_MIN_BIOS, 3);
    assert.equal(hintWanted('populateBio', { bioGains: 2 }), false);
    assert.equal(hintWanted('populateBio', { bioGains: 3 }), true);
  });
  it('Format Doctor: 5+ findings showing', () => {
    assert.equal(HINT_MIN_FINDINGS, 5);
    assert.equal(hintWanted('formatDoctor', { findings: 4 }), false);
    assert.equal(hintWanted('formatDoctor', { findings: 5 }), true);
  });
  it('Dialogue: 3+ speaking characters and 20+ speeches', () => {
    assert.equal(HINT_MIN_SPEAKERS, 3);
    assert.equal(HINT_MIN_SPEECHES, 20);
    assert.equal(hintWanted('dialogue', { speakers: 2, speeches: 80 }), false, 'a two-hander');
    assert.equal(hintWanted('dialogue', { speakers: 4, speeches: 19 }), false);
    assert.equal(hintWanted('dialogue', { speakers: 3, speeches: 20 }), true);
  });
  it('Plan: a feature-length draft (90+ pages)', () => {
    assert.equal(HINT_PLAN_PAGES, 90);
    assert.equal(hintWanted('plan', { pages: 89, scenes: 120 }), false);
    assert.equal(hintWanted('plan', { pages: 90 }), true);
  });
});

describe('feature hints: only at a calm moment', () => {
  const base = { now: 100000, lastKeyAt: 100000 - HINT_IDLE_MS, openedAt: 100000 - HINT_SETTLE_MS, busy: false };
  it('a few seconds after the last keystroke, a minute after the script opened, and nothing else busy', () => {
    assert.equal(HINT_IDLE_MS, 3000);
    assert.equal(HINT_SETTLE_MS, 60000);
    assert.equal(hintCalm(base), true);
    assert.equal(hintCalm({ ...base, lastKeyAt: base.now - 500 }), false, 'mid-sentence');
    assert.equal(hintCalm({ ...base, openedAt: base.now - 20000 }), false, 'a script just imported settles first');
    assert.equal(hintCalm({ ...base, busy: true }), false, 'Focus, Viewing, Plan or another corner card');
  });
});

describe('feature hints: once each, one new one per session (Analyze may follow Import)', () => {
  const ready = { scenes: 20, pages: 25, sceneCards: 0, bioGains: 5 };
  it('picks in order, skipping finished ones', () => {
    assert.equal(pickHint({}, null, ready), 'importScenes');
    assert.equal(pickHint({ importScenes: 'dismissed' }, null, ready), 'populateBio');
    assert.equal(pickHint({ importScenes: 'done', populateBio: 'done' }, null, { ...ready, sceneCards: 5 }), 'analyzeShifts');
    assert.equal(pickHint({ importScenes: 'done', analyzeShifts: 'done', populateBio: 'dismissed' }, null, ready), null);
  });
  it('after one hint this session, only the same one or Analyze straight after Import', () => {
    assert.equal(pickHint({ importScenes: 'dismissed' }, 'importScenes', ready), null, 'Populate Bio waits for another session');
    assert.equal(pickHint({ importScenes: 'done' }, 'importScenes', { ...ready, sceneCards: 5 }), 'analyzeShifts');
    assert.equal(pickHint({}, 'populateBio', ready), 'populateBio');
  });
  it('states are saved per browser; done is final; Show tips again clears them', () => {
    const local = mem();
    const session = mem();
    assert.deepEqual(readHints(local), {});
    let st = markHint(local, 'importScenes', 'dismissed');
    assert.deepEqual(st, { importScenes: 'dismissed' });
    st = markHint(local, 'importScenes', 'done', st);
    st = markHint(local, 'importScenes', 'dismissed', st);
    assert.equal(st.importScenes, 'done', 'a used tool stays done');
    assert.deepEqual(JSON.parse(local.getItem(HINTS_KEY)), { importScenes: 'done' });
    assert.deepEqual(markHint(local, 'nope', 'done', st), st, 'unknown ids are ignored');
    session.setItem(HINT_SESSION_KEY, 'importScenes');
    assert.deepEqual(resetHints(local, session), {});
    assert.equal(local.getItem(HINTS_KEY), null);
    assert.equal(session.getItem(HINT_SESSION_KEY), null);
  });
  it('blocked or broken storage reads as nothing shown, and never throws', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    assert.deepEqual(readHints(broken), {});
    assert.deepEqual(markHint(broken, 'populateBio', 'done', {}), { populateBio: 'done' });
    assert.deepEqual(resetHints(broken, broken), {});
    const junk = mem();
    junk.setItem(HINTS_KEY, '[1,2]');
    assert.deepEqual(readHints(junk), {});
  });
});

describe('feature hints: the wording is honest about running the tools again', () => {
  it('six hints, each pointing at its tool’s real button', () => {
    assert.deepEqual(HINT_IDS, ['importScenes', 'analyzeShifts', 'populateBio', 'formatDoctor', 'dialogue', 'plan']);
    assert.deepEqual(HINT_IDS.map((id) => HINTS[id].target), [
      '.board-import', '.board-analyze', '.pb-populate',
      '.stepper[aria-label="Format Doctor findings"] .stepper-main', '.pb-characters .cast-chip', '.ws-btn[data-workspace="plan"]',
    ]);
    assert.deepEqual(HINT_IDS.map((id) => HINTS[id].beacon), ['split', null, 'characters', null, 'characters', null]);
    assert.deepEqual(HINT_IDS.filter((id) => HINTS[id].caret), ['importScenes', 'populateBio'], 'only tools that edit the script in place hand the cursor back');
    assert.match(read('App.jsx'), /data-workspace=\{id\}/);
    assert.match(read('components/CharactersDrawer.jsx'), /data-tab=\{t\.id\}/);
  });
  it('the new three: honest about what they do', () => {
    assert.match(HINTS.formatDoctor.text, /most fix in one click/);
    assert.match(HINTS.dialogue.text, /every line that character speaks, in script order/);
    assert.match(HINTS.plan.text, /The script stays exactly as it is, and Write is one click back/);
  });
  it('Import Scenes keeps your edits; Analyze is a second opinion; Populate Bio only fills empty fields', () => {
    assert.match(HINTS.importScenes.text, /your titles, synopses and tags stay/);
    assert.match(HINTS.analyzeShifts.text, /second opinion: you choose what to apply/);
    assert.match(HINTS.populateBio.text, /only fills empty fields, so it’s safe to run again/);
  });
});

describe('feature hints: the app never interrupts, and nothing runs without a click', () => {
  const app = read('App.jsx');
  const card = read('components/HintCard.jsx');
  const css = read('components/HintCard.css');
  it('a dot on Split (not Board: the script stays on screen) and on Characters', () => {
    assert.match(app, /\$\{id === 'split' && hintBeacon === 'split' \? ' has-hint-beacon' : ''\}/);
    assert.match(app, /\$\{hintBeacon === 'characters' \? ' has-hint-beacon' : ''\}/);
    assert.match(css, /\.has-hint-beacon::after \{[^}]*border-radius: 50%;[^}]*pointer-events: none;/);
  });
  it('Characters already open on the other tab: the dot moves to the tab (clicking Characters would close it)', () => {
    assert.match(app, /activeHint === 'populateBio' && charactersOpen \? 'bios-tab'\s*: activeHint === 'dialogue' && charactersOpen \? 'dialogue-tab' : HINTS\[activeHint\]\.beacon/);
    assert.match(app, /tabBeacon=\{\{ 'bios-tab': 'bios', 'dialogue-tab': 'dialogue' \}\[hintBeacon\] \?\? null\}/);
    assert.match(read('components/CharactersDrawer.jsx'), /\$\{tabBeacon === t\.id \? ' has-hint-beacon' : ''\}/);
  });
  it('the card only shows once the tool’s panel is open; hidden in Focus, Plan and Viewing', () => {
    assert.match(app, /const hintHidden = !activeHint \|\| hintHandedOff === activeHint \|\| focusMode \|\| inPlan \|\| isLocked;/);
    assert.match(app, /populateBio: charactersOpen && characterTab !== 'dialogue',\s*dialogue: charactersOpen && characterTab === 'dialogue',\s*formatDoctor: true,\s*plan: true,/);
    assert.match(app, /\{hintCardShown && \(\s*<HintCard id=\{activeHint\}/);
  });
  it('its button does exactly what the tool’s button does; focus then goes back to the script', () => {
    assert.match(app, /document\.querySelector\(HINTS\[activeHint\]\.target\)\?\.click\(\); \/\/ exactly what clicking the tool does/);
    assert.match(app, /k\.el\.focus\(\{ preventScroll: true \}\);\s*try \{\s*k\.el\.setSelectionRange\(k\.start, k\.end\);/);
    assert.match(card, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\} \/\/ never pull focus/);
  });
  it('once its button is clicked, the card steps aside so it never sits under the tool’s own menu', () => {
    assert.match(app, /setHintHandedOff\(activeHint\); \/\/ the tool takes over/);
  });
  it('the Format stepper, a spotlight or Plan, used any way and any time, ends that hint (even before it showed)', () => {
    assert.match(app, /const formatUsed = formatAt !== null \|\| doctorOpen;/);
    assert.match(app, /const dialogueUsed = !!selectedChar;/);
    assert.match(app, /\[formatUsed && 'formatDoctor', dialogueUsed && 'dialogue', inPlan && 'plan'\]/);
    assert.equal(HINTS.formatDoctor.usedBy, '.stepper[aria-label="Format Doctor findings"]', 'opening its list counts');
    assert.match(app, /if \(e\.target\?\.closest\?\.\(HINTS\[id\]\.usedBy\)\) hintToolUsed\(id\);/);
  });
  it('using a tool any way at all ends its hint', () => {
    assert.match(read('components/BeatBoard.jsx'), /onChange\(result\.beats\);\s*onToolUsed\?\.\('importScenes'\);/);
    assert.match(read('components/BeatBoard.jsx'), /setShiftScan\(scanValueShifts\(getBlocks\(\)\)\);\s*onToolUsed\?\.\('analyzeShifts'\);/);
    assert.match(read('components/CharactersDrawer.jsx'), /onToolUsed\?\.\('populateBio'\);/);
    assert.match(app, /onToolUsed=\{hintToolUsed\}/);
  });
  it('waits for calm: typing, a just-opened script, Focus, Viewing, Plan or another corner card hold it back', () => {
    assert.match(app, /const hintBusy = !!\(focusMode \|\| isLocked \|\| inPlan \|\| milestone \|\| exportToast \|\| backupTipShown\);/);
    assert.match(app, /hintClock\.current\.openedAt = Date\.now\(\); \/\/ a script just opened or imported: hints wait a minute/);
  });
  it('About → Tips → Show tips again, once any hint has been seen or used', () => {
    const help = read('components/HelpModal.jsx');
    assert.match(help, /\{onResetTips && tipsFinished > 0 && \(/);
    assert.match(help, />Show tips again<\/button>/);
    assert.match(app, /onResetTips=\{resetTips\}/);
  });
  it('reduced motion: no pulse, no slide', () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.hint-card \{ animation: none; \}\s*\.has-hint-beacon::after \{ animation: none; \}/);
  });
});

describe('feature hints: the card never overlaps anything, and never floats over a covered tool', () => {
  // A tiny fake page: elements with rectangles, and what elementFromPoint finds.
  const rect = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h });
  const el = (r, opts = {}) => ({ getBoundingClientRect: () => r, offsetParent: opts.hidden ? null : {}, contains: (x) => x === opts.child, ...opts });
  const page = ({ atCentre, overlays = [], dialogOpen = false }) => ({
    elementFromPoint: () => atCentre,
    querySelectorAll: (sel) => (sel === HINT_OVERLAYS ? overlays : []),
    querySelector: (sel) => (sel === 'dialog[open]' && dialogOpen ? {} : null),
    defaultView: { getComputedStyle: () => ({ position: 'absolute' }) },
  });
  const card = rect(100, 140, 300, 120);
  const target = el(rect(200, 100, 120, 30));
  it('shows when the tool is the topmost thing at its centre and nothing overlaps the card', () => {
    assert.equal(hintRoomFor(target, card, page({ atCentre: target })), true);
    const child = {};
    const t2 = el(rect(200, 100, 120, 30), { child });
    assert.equal(hintRoomFor(t2, card, page({ atCentre: child })), true, 'its icon or label counts as the tool');
  });
  it('hides when the tool is gone, hidden, covered by a drawer, or under a modal', () => {
    assert.equal(hintRoomFor(null, card, page({ atCentre: null })), false);
    assert.equal(hintRoomFor(el(rect(200, 100, 120, 30), { hidden: true }), card, page({ atCentre: target })), false);
    assert.equal(hintRoomFor(target, card, page({ atCentre: { drawer: true } })), false, 'Story Bible slid over the board');
    assert.equal(hintRoomFor(target, card, page({ atCentre: target, dialogOpen: true })), false, 'About, Export, Format Doctor…');
  });
  it('hides while a menu, dropdown, hover card or toast overlaps it (its own tool’s menu included)', () => {
    const menu = el(rect(150, 120, 280, 200));
    assert.equal(hintRoomFor(target, card, page({ atCentre: target, overlays: [menu] })), false);
    const farMenu = el(rect(900, 500, 200, 100));
    assert.equal(hintRoomFor(target, card, page({ atCentre: target, overlays: [farMenu] })), true, 'a menu elsewhere is fine');
    for (const sel of ['.menu-pop', '.dl-select-list', '.cue-card', '.ac', '.bk-toast', '.milestone-toast', '.find-bar']) {
      assert.ok(HINT_OVERLAYS.includes(sel), sel);
    }
    assert.ok(!HINT_OVERLAYS.includes('listbox'), 'the Dialogue cast list is a listbox but not a popup');
  });
  it('the card checks its room continuously while it’s up', () => {
    const c = read('components/HintCard.jsx');
    assert.match(c, /if \(!hintRoomFor\(target, \{ left, top, right: left \+ w, bottom: top \+ h \}\)\) \{\s*setPos\(null\);/);
    assert.match(c, /const again = setInterval\(place, 250\);/);
  });
  it('flipped above its button (the status bar), the notch points down at it', () => {
    assert.match(read('components/HintCard.jsx'), /\$\{pos\?\.above \? ' is-above' : ''\}/);
    assert.match(read('components/HintCard.css'), /\.hint-card\.is-above::before \{[^}]*bottom: -6px;/);
  });
});
