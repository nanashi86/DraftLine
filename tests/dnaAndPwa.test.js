import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIP_MARGIN, clipToViewport, placeTooltip } from '../src/lib/tooltip.js';
import {
  PLOT_DEVICES, addDevice, availableDevices, deviceInfo, emptyStoryDna, normalizeStoryDna, removeDevice, setDevice,
} from '../src/lib/storyDna.js';
import { STRUCTURE_DICTIONARY, dictionaryEntry } from '../src/lib/structureDictionary.js';
import { dialogueFilter, filterLabel } from '../src/lib/dialogueFilter.js';
import { analyzeScript } from '../src/lib/screenplay.js';
import { buildServiceWorker, CORE_FONTS_CSS } from '../src/pwa/vitePlugin.js';
import { registerServiceWorker } from '../src/pwa/register.js';
import { renameCharacter } from '../src/lib/renameCharacter.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const B = (id, type, text) => ({ id, type, text });

describe('(i) tooltips stay inside the drawer', () => {
  const drawer = { left: 1200, top: 52, right: 1600, bottom: 920 }; // the 400px dock
  const inside = (t, size) => t.left >= drawer.left + TIP_MARGIN && t.left + t.width <= drawer.right - TIP_MARGIN
    && t.top >= drawer.top + TIP_MARGIN && t.top + size.height <= drawer.bottom - TIP_MARGIN;
  const size = { width: 290, height: 140 };

  it('right-aligned under a button at the right edge', () => {
    const t = placeTooltip({ left: 1560, right: 1577, top: 300, bottom: 317 }, size, drawer);
    assert.equal(t.placement, 'below');
    assert.ok(inside(t, size));
    assert.equal(t.left + t.width, 1577 + 6);
  });
  it('never cut off on the left: a button near the drawer’s left edge slides the tooltip right', () => {
    const t = placeTooltip({ left: 1300, right: 1317, top: 300, bottom: 317 }, size, drawer);
    assert.equal(t.left, drawer.left + TIP_MARGIN);
    assert.ok(inside(t, size));
  });
  it('flips above a button near the bottom', () => {
    const t = placeTooltip({ left: 1560, right: 1577, top: 850, bottom: 867 }, size, drawer);
    assert.equal(t.placement, 'above');
    assert.ok(inside(t, size));
  });
  it('a narrow (phone-width) drawer shrinks the tooltip to fit', () => {
    const narrow = { left: 0, top: 52, right: 280, bottom: 800 };
    const t = placeTooltip({ left: 250, right: 267, top: 200, bottom: 217 }, size, narrow);
    assert.equal(t.width, 280 - 2 * TIP_MARGIN);
    assert.equal(t.left, TIP_MARGIN);
  });
  it('a drawer partly off-screen is clipped to the window first', () => {
    assert.deepEqual(clipToViewport({ left: -50, top: 40, right: 2000, bottom: 1200 }, 1600, 900), { left: 0, top: 40, right: 1600, bottom: 900 });
  });
  it('the tooltip is drawn in a fixed layer on <body>, not inside the drawer’s overflow', () => {
    const src = read('src/components/StoryDna.jsx');
    assert.match(src, /createPortal\(/);
    assert.match(src, /document\.body,/);
    assert.match(read('src/components/ProjectBibleDrawer.css'), /\.dna-tip-pop \{\s*position: fixed;/);
  });
});

describe('Glossary', () => {
  it('is what the DNA view calls it now', () => {
    const src = read('src/components/StoryDna.jsx');
    assert.match(src, /DNA_VIEWS\.map/);
    assert.ok(!/Structure Dictionary/.test(src));
  });
  it('every plot device has its glossary entry for the (i)', () => {
    for (const d of PLOT_DEVICES) assert.ok(dictionaryEntry(STRUCTURE_DICTIONARY, d.dict), d.id);
  });
});

describe('Plot Devices', () => {
  it('the picklist offers the eight devices, minus the ones already added', () => {
    assert.deepEqual(PLOT_DEVICES.map((d) => d.label), [
      'Foreshadowing', 'Flashback', 'Deus ex machina', 'MacGuffin', 'Quest', 'Cliffhanger', 'Red herring', 'Love triangle',
    ]);
    let d = addDevice(emptyStoryDna(), 'macguffin');
    d = addDevice(d, 'macguffin'); // no duplicates
    assert.deepEqual(d.devices, [{ id: 'macguffin', on: true, notes: '' }]);
    assert.ok(!availableDevices(d).some((x) => x.id === 'macguffin'));
    assert.equal(availableDevices(d).length, 7);
    d = setDevice(d, 'macguffin', { on: false, notes: 'The letter' });
    assert.deepEqual(d.devices[0], { id: 'macguffin', on: false, notes: 'The letter' });
    assert.deepEqual(removeDevice(d, 'macguffin').devices, []);
    assert.equal(addDevice(emptyStoryDna(), 'bogus').devices.length, 0);
  });
  it('old Foreshadowing / Flashback notes migrate into Plot Devices, nothing lost', () => {
    const old = normalizeStoryDna({
      technique: { on: false, notes: '' },
      foreshadowing: { on: true, notes: 'The ferry horn, twice.' },
      flashback: { on: false, notes: 'Maybe 1986?' },
    });
    assert.deepEqual(old.devices, [
      { id: 'foreshadowing', on: true, notes: 'The ferry horn, twice.' },
      { id: 'flashback', on: false, notes: 'Maybe 1986?' },
    ]);
    for (const k of ['technique', 'foreshadowing', 'flashback']) assert.equal(k in old, false);
  });
  it('an old "Special Plot Technique" with notes is kept as its own device', () => {
    const old = normalizeStoryDna({ technique: { on: true, notes: 'Told in reverse.' } });
    assert.deepEqual(old.devices, [{ id: 'technique', on: true, notes: 'Told in reverse.' }]);
    assert.equal(deviceInfo('technique').label, 'Special Plot Technique');
    assert.ok(!availableDevices(old).some((x) => x.id === 'technique'), 'not offered for new scripts');
  });
  it('unused old toggles leave no device behind; a saved device list loads as it is', () => {
    assert.deepEqual(normalizeStoryDna({ foreshadowing: { on: false, notes: '' }, flashback: false }).devices, []);
    const d = normalizeStoryDna({ devices: [{ id: 'quest', on: true, notes: 'x' }, { id: 'nope' }, { id: 'quest' }] });
    assert.deepEqual(d.devices, [{ id: 'quest', on: true, notes: 'x' }]);
  });
  it('the Central Dramatic Question is a field of its own', () => {
    assert.equal(emptyStoryDna().centralQuestion, '');
    assert.equal(normalizeStoryDna({ centralQuestion: 'Will she go back?' }).centralQuestion, 'Will she go back?');
    assert.match(read('src/components/StoryDna.jsx'), /placeholder="What core question does the climax answer\?"/);
  });
  it('renaming a character reaches device notes and the central question', () => {
    const dna = { ...emptyStoryDna(), centralQuestion: 'Will Fito talk?', devices: [{ id: 'redHerring', on: true, notes: 'Fito’s bike' }] };
    const { project } = renameCharacter({ blocks: [], beats: [], characters: [], storyDna: dna }, 'FITO', 'Marc');
    assert.equal(project.storyDna.centralQuestion, 'Will Marc talk?');
    assert.equal(project.storyDna.devices[0].notes, 'Marc’s bike');
  });
});

describe('Dialogue filter', () => {
  const blocks = [
    B('s', 'scene', 'INT. FERRY - NIGHT'), B('a', 'action', 'Rain.'),
    B('c1', 'character', 'THEO'), B('d1', 'dialogue', 'You said six.'),
    B('c2', 'character', 'MARIE'), B('d2', 'dialogue', 'I did.'),
    B('c3', 'character', 'THEO (CONT’D)'), B('p3', 'parenthetical', '(quietly)'), B('d3', 'dialogue', 'Fine.'),
  ];
  const analysis = analyzeScript(blocks);
  it('spotlights every cue, parenthetical and line of that character; nothing else', () => {
    const f = dialogueFilter(analysis, 'THEO');
    assert.deepEqual([...f.ids].sort(), ['c1', 'c3', 'd1', 'd3', 'p3']);
    assert.equal(filterLabel(f), 'Filtering dialogue: THEO · 2 lines');
    assert.equal(filterLabel(dialogueFilter(analysis, 'MARIE')), 'Filtering dialogue: MARIE · 1 line');
  });
  it('no filter without a name, or for a name that no longer speaks', () => {
    assert.equal(dialogueFilter(analysis, null), null);
    assert.equal(dialogueFilter(analysis, 'GHOST'), null);
  });
  it('the banner clears on its button or Esc, and never prints', () => {
    const app = read('src/App.jsx');
    assert.match(app, /className="filter-clear" onClick=\{\(\) => setSelectedChar\(null\)\}/);
    assert.match(app, /e\.key === 'Escape' && filter && !e\.defaultPrevented[^\n]*\n\s*setSelectedChar\(null\)/);
    assert.match(read('src/App.css'), /@media print \{ \.filter-banner \{ display: none !important; \} \}/);
    assert.ok(app.indexOf('className="filter-banner"') < app.indexOf('<PrintView'), 'lives in the app, not the print view');
  });
});

describe('PWA', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  it('manifest: name, standalone, theme colour #18181b, icons that exist', () => {
    assert.equal(manifest.name, 'DraftLine');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, '#18181b');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
    for (const i of manifest.icons) assert.ok(readFileSync(new URL(`../public/${i.src}`, import.meta.url)).length > 500, i.src);
  });
  it('index.html links the manifest and theme colour under the app’s base path', () => {
    const html = read('index.html');
    assert.match(html, /<link rel="manifest" href="%BASE_URL%manifest\.json" \/>/);
    assert.match(html, /<meta name="theme-color" content="#18181b" \/>/);
  });
  it('the service worker precaches this build’s files, Courier Prime and Inter', () => {
    const { source, list, version } = buildServiceWorker(['assets/index-abc.js', 'assets/index-def.css', 'icon-192.png', 'manifest.json', 'sw.js', 'x.js.map']);
    assert.deepEqual(list, ['./', './assets/index-abc.js', './assets/index-def.css', './icon-192.png', './index.html', './manifest.json']);
    assert.match(source, /const PRECACHE = \[/);
    assert.match(source, new RegExp(`const VERSION = "${version}"`));
    assert.match(CORE_FONTS_CSS, /Courier\+Prime/);
    assert.match(source, /Courier\+Prime/);
    assert.ok(!/__PRECACHE__|__VERSION__|__CORE_FONTS_CSS__/.test(source), 'every placeholder filled');
    new Function(source.replace(/self\./g, 'globalThis.__sw.')); // it parses
  });
  it('a new build gets a new version (fresh cache); the same build keeps it', () => {
    const a = buildServiceWorker(['assets/index-1.js']).version;
    assert.equal(buildServiceWorker(['assets/index-1.js']).version, a);
    assert.notEqual(buildServiceWorker(['assets/index-2.js']).version, a);
  });
  it('offline lookups ignore Vary (module scripts carry an Origin header the precache didn’t)', () => {
    assert.match(read('src/pwa/sw.template.js'), /ignoreSearch: true, ignoreVary: true/);
  });
  it('registers only in production, at the base path', () => {
    const calls = [];
    const nav = { serviceWorker: { register: (url, opts) => { calls.push([url, opts.scope]); return Promise.resolve(); } } };
    const win = { document: { readyState: 'complete' }, addEventListener() {} };
    assert.equal(registerServiceWorker({ base: '/DraftLine/', prod: false, nav, win }), false);
    assert.equal(registerServiceWorker({ base: '/DraftLine/', prod: true, nav, win }), true);
    assert.deepEqual(calls, [['/DraftLine/sw.js', '/DraftLine/']]);
    assert.equal(registerServiceWorker({ prod: true, nav: {}, win }), false, 'no service worker support → nothing');
  });
  it('the build is wired to the plugin', () => {
    assert.match(read('vite.config.js'), /plugins: \[react\(\), draftlinePwa\(\)\]/);
  });
});
