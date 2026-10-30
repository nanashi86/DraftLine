import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HINTS, HINTS_KEY, HINT_IDLE_MS, HINT_IDS, HINT_MIN_BIOS, HINT_MIN_PAGES, HINT_MIN_SCENES, HINT_SESSION_KEY, HINT_SETTLE_MS,
  hintCalm, hintWanted, markHint, pickHint, readHints, resetHints,
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
  it('three hints, each pointing at its tool’s real button', () => {
    assert.deepEqual(HINT_IDS, ['importScenes', 'analyzeShifts', 'populateBio']);
    assert.deepEqual(HINT_IDS.map((id) => HINTS[id].target), ['.board-import', '.board-analyze', '.pb-populate']);
    assert.deepEqual(HINT_IDS.map((id) => HINTS[id].beacon), ['split', null, 'characters']);
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
  it('Characters already open on Dialogue: the dot moves to the Bios tab (clicking Characters would close it)', () => {
    assert.match(app, /activeHint === 'populateBio' && charactersOpen \? 'bios-tab' : HINTS\[activeHint\]\.beacon/);
    assert.match(app, /tabBeacon=\{hintBeacon === 'bios-tab' \? 'bios' : null\}/);
    assert.match(read('components/CharactersDrawer.jsx'), /\$\{tabBeacon === t\.id \? ' has-hint-beacon' : ''\}/);
  });
  it('the card only shows once the tool’s panel is open; hidden in Focus, Plan and Viewing', () => {
    assert.match(app, /const hintHidden = !activeHint \|\| focusMode \|\| inPlan \|\| isLocked;/);
    assert.match(app, /const hintPanelOpen = activeHint === 'populateBio' \? charactersOpen && characterTab !== 'dialogue' : showBoard;/);
    assert.match(app, /\{hintCardShown && \(\s*<HintCard id=\{activeHint\}/);
  });
  it('its button does exactly what the tool’s button does; focus then goes back to the script', () => {
    assert.match(app, /document\.querySelector\(HINTS\[activeHint\]\.target\)\?\.click\(\); \/\/ exactly what clicking the tool does/);
    assert.match(app, /k\.el\.focus\(\{ preventScroll: true \}\);\s*try \{\s*k\.el\.setSelectionRange\(k\.start, k\.end\);/);
    assert.match(card, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\} \/\/ never pull focus/);
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
