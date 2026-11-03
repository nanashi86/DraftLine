import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIGHT_TIP_KEY, DAY_START_HOUR, DAY_END_HOUR, isDaytime, lightTipSeen, lightTipWanted, markLightTipSeen, resetLightTip,
} from '../src/lib/lightThemeTip.js';
import { USER_SETTINGS_KEY, SETTINGS_VERSION, readChosenSettings, readSettings, themeChosen, writeSettings } from '../src/lib/userSettings.js';
import { HINTS, HINT_IDS, LIGHT_TIP_HINT } from '../src/lib/hints.js';

const memory = (init = {}) => {
  const map = new Map(Object.entries(init));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};
const at = (h) => new Date(2026, 10, 3, h, 30);
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

describe('Light-theme tip: one master flag', () => {
  it('the key, and it is set the moment the tip is shown', () => {
    assert.equal(LIGHT_TIP_KEY, 'draftline_tip_light_theme_seen');
    const s = memory();
    assert.equal(lightTipSeen(s), false);
    assert.equal(markLightTipSeen(s), true);
    assert.equal(s.map.get(LIGHT_TIP_KEY), 'true');
    assert.equal(lightTipSeen(s), true);
    assert.match(app, /if \(id === LIGHT_TIP_HINT\) \{\s*markLightTipSeen\(\);[^}]*setLightTipDone\(true\);\s*\}\s*setActiveHint\(id\);/, 'marked before the card is set, on display');
  });
  it('Switch to Light and Keep Dark both set the flag and record a theme choice', () => {
    assert.match(app, /if \(activeHint === LIGHT_TIP_HINT\) \{\s*markLightTipSeen\(\);\s*changeSettings\(\{ theme: 'light' \}\);/);
    assert.match(app, /if \(activeHint === LIGHT_TIP_HINT\) \{\s*markLightTipSeen\(\);\s*changeSettings\(\{ theme: 'dark' \}\);/);
    assert.deepEqual([HINTS.lightTheme.action, HINTS.lightTheme.dismiss], ['Switch to Light', 'Keep Dark']);
  });
  it('blocked storage counts as seen: nothing to remember it with, so never shown', () => {
    assert.equal(lightTipSeen(null), true);
    assert.equal(lightTipSeen({ getItem() { throw new Error('blocked'); } }), true);
    assert.equal(lightTipWanted({ storage: null, isOsLight: () => true, now: at(12) }), false);
  });
});

describe('Light-theme tip: pre-flight bailout, then one OR', () => {
  const never = () => { throw new Error('checked the system after a bailout'); };
  it('already seen: exits before looking at the system or the clock', () => {
    const s = memory({ [LIGHT_TIP_KEY]: 'true' });
    assert.equal(lightTipWanted({ storage: s, isOsLight: never, now: at(12) }), false);
  });
  it('a theme already chosen (light or dark): exits before looking at the system or the clock', () => {
    for (const theme of ['light', 'dark']) {
      const s = memory();
      writeSettings({ theme }, s);
      assert.equal(themeChosen(s), true, theme);
      assert.equal(lightTipWanted({ storage: s, isOsLight: never, now: at(12) }), false, theme);
    }
  });
  it('otherwise: system light OR daytime', () => {
    const s = memory();
    assert.equal(lightTipWanted({ storage: s, isOsLight: () => true, now: at(23) }), true, 'light system at night');
    assert.equal(lightTipWanted({ storage: s, isOsLight: () => false, now: at(12) }), true, 'dark system by day');
    assert.equal(lightTipWanted({ storage: s, isOsLight: () => false, now: at(23) }), false, 'dark system at night');
    assert.equal(lightTipWanted({ storage: s, isOsLight: () => true, now: at(12) }), true);
  });
  it('daytime is 7:00 up to 19:00, local', () => {
    assert.deepEqual([DAY_START_HOUR, DAY_END_HOUR], [7, 19]);
    assert.equal(isDaytime(new Date(2026, 0, 1, 6, 59)), false);
    assert.equal(isDaytime(new Date(2026, 0, 1, 7, 0)), true);
    assert.equal(isDaytime(new Date(2026, 0, 1, 18, 59)), true);
    assert.equal(isDaytime(new Date(2026, 0, 1, 19, 0)), false);
  });
});

describe('Light-theme tip: only Show tips again clears it', () => {
  it('resetLightTip removes the flag; the app calls it only from Show tips again', () => {
    const s = memory({ [LIGHT_TIP_KEY]: 'true' });
    resetLightTip(s);
    assert.equal(s.map.has(LIGHT_TIP_KEY), false);
    assert.equal((app.match(/resetLightTip\(/g) || []).length, 1);
    assert.match(app, /const resetTips = \(\) => \{\s*resetLightTip\(\);/);
    for (const f of ['../src/components/SettingsModal.jsx', '../src/components/HelpModal.jsx']) {
      assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /LIGHT_TIP_KEY|lightThemeTip/, f);
    }
  });
  it('after a reset it still stays away once a theme has been chosen', () => {
    assert.match(app, /setLightTipDone\(themeChosen\(\)\);/);
    const s = memory();
    writeSettings({ theme: 'dark' }, s);
    resetLightTip(s);
    assert.equal(lightTipWanted({ storage: s, isOsLight: () => true, now: at(12) }), false);
  });
  it('it is a card like feedback, not a counted tip, pointing at ⋮ where Settings lives', () => {
    assert.equal(LIGHT_TIP_HINT, 'lightTheme');
    assert.ok(!HINT_IDS.includes(LIGHT_TIP_HINT));
    assert.equal(HINTS.lightTheme.target, '.btn-kebab');
  });
  it('one card per session, and only at a calm moment', () => {
    assert.match(app, /if \(!id && !sessionHint && !lightTipDone && calm\(HINT_SETTLE_MS\) && lightTipWanted\(\)\) id = LIGHT_TIP_HINT;/);
  });
});

describe('Settings: only real choices are stored', () => {
  it('a default is never written back on load; a pick is, with v: 2', () => {
    const s = memory();
    assert.deepEqual(readChosenSettings(s), {});
    writeSettings({ showCounts: false }, s);
    assert.deepEqual(JSON.parse(s.map.get(USER_SETTINGS_KEY)), { showCounts: false, v: SETTINGS_VERSION });
    assert.equal(themeChosen(s), false, 'hiding the counts is not a theme choice');
    writeSettings({ theme: 'dark' }, s);
    assert.deepEqual(readChosenSettings(s), { showCounts: false, theme: 'dark' });
    assert.deepEqual(readSettings(s), { theme: 'dark', showCounts: false });
  });
  it('the first build’s blanket defaults (no v) are not choices; anything else it stored is', () => {
    assert.equal(themeChosen(memory({ [USER_SETTINGS_KEY]: '{"theme":"dark","showCounts":true}' })), false);
    assert.equal(themeChosen(memory({ [USER_SETTINGS_KEY]: '{"theme":"light","showCounts":true}' })), true);
    assert.deepEqual(readChosenSettings(memory({ [USER_SETTINGS_KEY]: '{"theme":"dark","showCounts":false}' })), { showCounts: false });
  });
});
