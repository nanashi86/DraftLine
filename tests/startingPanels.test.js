import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PANELS_BESIDE_MIN_WIDTH, startingPanels } from '../src/lib/dock.js';
import { moreMenuItems } from '../src/lib/toolbar.js';

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('what’s open when DraftLine loads', () => {
  it('a first visit on a wide screen: the Scenes list beside the page, Characters closed', () => {
    assert.deepEqual(startingPanels({}, 1600), { dock: null, navOpen: true });
  });
  it('a returning writer on a wide screen: whatever they left open', () => {
    assert.deepEqual(startingPanels({ dock: 'characters', navOpen: false }, 1600), { dock: 'characters', navOpen: false });
    assert.deepEqual(startingPanels({ dock: 'bible', navOpen: true }, 1280), { dock: 'bible', navOpen: true });
  });
  it('a phone, a small tablet or a narrow window: nothing over the page, whatever was left open', () => {
    for (const width of [390, 844, 820, PANELS_BESIDE_MIN_WIDTH - 1]) {
      assert.deepEqual(startingPanels({ dock: 'characters', navOpen: true }, width), { dock: null, navOpen: false }, String(width));
      assert.deepEqual(startingPanels({}, width), { dock: null, navOpen: false }, `${width}, first visit`);
    }
  });
  it('the breakpoint is the one where App.css stops putting panels beside the page', () => {
    assert.equal(PANELS_BESIDE_MIN_WIDTH, 1100);
    assert.match(read('App.css'), /@media \(min-width: 1100px\) \{\s*\.dock-open \.workspace \{ padding-right: var\(--tuner-w\); \}\s*\.nav-open \.workspace \{ padding-left: var\(--nav-w\); \}/);
    assert.match(read('App.jsx'), /useState\(\(\) => startingPanels\(initialPrefs, globalThis\.innerWidth \?\? Infinity\)\)/);
  });
});

describe('phones: the Scenes button is hidden, so ⋮ has Scenes', () => {
  const base = { onBible() {}, onCharacters() {}, onSnapshots() {}, onNotes() {}, onShortcuts() {}, onAbout() {}, bibleOnBar: true, charactersOnBar: true };
  it('⋮ → Scenes only while the button isn’t on the bar, first in the list', () => {
    const onScenes = () => {};
    assert.equal(moreMenuItems({ ...base, scenesOnBar: false, onScenes })[0].label, 'Scenes');
    assert.equal(moreMenuItems({ ...base, scenesOnBar: false, onScenes })[0].hint, 'Alt+S');
    assert.ok(!moreMenuItems({ ...base, scenesOnBar: true, onScenes }).some((it) => it.label === 'Scenes'));
  });
  it('the app wires it to the Scenes button', () => {
    const app = read('App.jsx');
    assert.match(app, /ref=\{scenesBtnRef\}\s*className=\{`btn btn-icon/);
    assert.match(app, /scenesOnBar: inPlan \|\| !showEditor \|\| isOnBar\(scenesBtnRef\.current, barRef\.current\),/);
    assert.match(read('App.css'), /\.zone-left > \.btn-icon \{ display: none; \}/);
  });
});
