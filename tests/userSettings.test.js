import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  USER_SETTINGS_KEY, DEFAULT_SETTINGS, THEME_COLORS, normalizeSettings, readSettings, writeSettings, applyTheme,
} from '../src/lib/userSettings.js';
import { moreMenuItems } from '../src/lib/toolbar.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const memory = (init = {}) => {
  const map = new Map(Object.entries(init));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
};

describe('Settings: stored under draftline_user_settings, dark by default', () => {
  it('the key, and the defaults: Dark Charcoal, counts showing', () => {
    assert.equal(USER_SETTINGS_KEY, 'draftline_user_settings');
    assert.deepEqual(DEFAULT_SETTINGS, { theme: 'dark', showCounts: true });
    assert.deepEqual(readSettings(memory()), DEFAULT_SETTINGS, 'a new visitor gets dark');
    assert.deepEqual(readSettings(null), DEFAULT_SETTINGS, 'no storage at all');
  });
  it('anything odd in storage falls back to the defaults, field by field', () => {
    assert.deepEqual(readSettings(memory({ [USER_SETTINGS_KEY]: 'not json' })), DEFAULT_SETTINGS);
    assert.deepEqual(readSettings(memory({ [USER_SETTINGS_KEY]: '"light"' })), DEFAULT_SETTINGS);
    assert.deepEqual(normalizeSettings({ theme: 'neon', showCounts: 'yes', extra: 1 }), DEFAULT_SETTINGS);
    assert.deepEqual(normalizeSettings({ theme: 'light' }), { theme: 'light', showCounts: true });
    const throwing = { getItem() { throw new Error('blocked'); } };
    assert.deepEqual(readSettings(throwing), DEFAULT_SETTINGS);
  });
  it('round-trips, and a blocked write just says it failed', () => {
    const s = memory();
    assert.equal(writeSettings({ theme: 'light', showCounts: false }, s), true);
    assert.deepEqual(readSettings(s), { theme: 'light', showCounts: false });
    assert.equal(writeSettings({ theme: 'light' }, { setItem() { throw new Error('full'); } }), false);
    assert.equal(writeSettings({ theme: 'light' }, null), false);
  });
  it('applyTheme sets data-theme="light" on <html> (dark removes it) and the browser chrome colour', () => {
    const attrs = new Map();
    let chrome = null;
    const doc = {
      documentElement: { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k) },
      querySelector: () => ({ setAttribute: (_, v) => { chrome = v; } }),
    };
    applyTheme('light', doc);
    assert.equal(attrs.get('data-theme'), 'light');
    assert.equal(chrome, THEME_COLORS.light);
    applyTheme('dark', doc);
    assert.equal(attrs.has('data-theme'), false);
    assert.equal(chrome, THEME_COLORS.dark);
  });
});

describe('Settings: no flash of the wrong theme', () => {
  const html = read('index.html');
  it('index.html applies a saved light theme before anything paints, from the same key and colours', () => {
    const script = html.match(/<script>(try\{[^<]*draftline_user_settings[^<]*)<\/script>/);
    assert.ok(script, 'an inline pre-paint script');
    assert.ok(html.indexOf(script[0]) < html.indexOf('<script type="module"'), 'before the app bundle');
    assert.match(script[1], /setAttribute\('data-theme','light'\)/);
    assert.ok(script[1].includes(THEME_COLORS.light));
    const run = (stored) => {
      const attrs = new Map();
      const meta = { content: THEME_COLORS.dark, setAttribute: (_, v) => { meta.content = v; } };
      const localStorage = { getItem: () => stored };
      const document = { documentElement: { setAttribute: (k, v) => attrs.set(k, v) }, querySelector: () => meta };
      new Function('localStorage', 'document', script[1])(localStorage, document);
      return [attrs.get('data-theme') ?? null, meta.content];
    };
    assert.deepEqual(run(JSON.stringify({ theme: 'light' })), ['light', THEME_COLORS.light]);
    assert.deepEqual(run(null), [null, THEME_COLORS.dark], 'new visitors stay dark');
    assert.deepEqual(run('{oops'), [null, THEME_COLORS.dark], 'bad JSON never throws out of the script');
  });
});

describe('Settings: the dialog, the ⋮ menu and where storage lives', () => {
  const app = read('src/App.jsx');
  const modal = read('src/components/SettingsModal.jsx');
  const drawer = read('src/components/ProjectsDrawer.jsx');
  it('Settings… sits directly above User Guide, Send Feedback… and About DraftLine', () => {
    const noop = () => {};
    const labels = moreMenuItems({ onShortcuts: noop, onAbout: noop, onSettings: noop, onGuide: noop, onFeedback: noop }).filter((i) => i.label).map((i) => i.label);
    assert.deepEqual(labels.slice(-4), ['Settings…', 'User Guide', 'Send Feedback…', 'About DraftLine']);
    assert.match(app, /onSettings: \(\) => setSettingsAt\('top'\),/);
  });
  it('Focus stays on the toolbar, not in Settings', () => {
    assert.doesNotMatch(modal, /Focus/);
  });
  it('the dialog holds Appearance (theme and page, set separately), Storage Destination and Drafting', () => {
    assert.match(modal, /aria-label="Interface theme"/);
    assert.match(modal, /aria-label="Page colour"/);
    assert.match(modal, /<StorageDestination sync=\{storage\.sync\} onChoose=\{storage\.onChoose\} onLink=\{storage\.onLink\} onDisconnect=\{storage\.onDisconnect\} onAllow=\{storage\.onAllow\} \/>/);
    assert.match(modal, />Drafting</);
    assert.match(app, /storage=\{storageControls\}/, 'the same App handlers the drawer used');
  });
  it('the status bar and the backup tip open Settings on the storage block', () => {
    assert.match(app, /const openStorage = \(target = 'storage'\) => setSettingsAt\(target\);/);
    assert.match(app, /focus=\{settingsAt === 'top' \? null : settingsAt\}/);
    assert.match(modal, /focus === 'folder' \? sd\?\.querySelector\('\.sd-card-folder'\)/);
  });
  it('Projects only manages scripts now: no storage block, but its folder badges still read the sync state', () => {
    assert.doesNotMatch(drawer, /StorageDestination|focusStorage/);
    assert.match(app, /<ProjectsDrawer[\s\S]*?sync=\{sync\}/);
    assert.match(drawer, /sync\?\.active \? ` · synced to \$\{sync\.folderName\}`/);
  });
  it('the shell theme and the page colour stay independent', () => {
    assert.match(app, /data-canvas=\{canvasTheme\}/);
    assert.match(app, /applyTheme\(settings\.theme\);\s*writeSettings\(settings\);/);
    const css = read('src/index.css');
    const light = css.slice(css.indexOf(":root[data-theme='light'] {"), css.indexOf('}', css.indexOf(":root[data-theme='light'] {")));
    for (const pageToken of ['--paper:', '--ink:', '--caret:', '--selection:']) assert.ok(!light.includes(pageToken), `${pageToken} belongs to the page, not the shell`);
  });
  it('the scene and word counts can be hidden; margin notes stay', () => {
    assert.match(app, /\{settings\.showCounts && <span>\{analysis\.sceneCount\} scenes<\/span>\}/);
    assert.match(app, /\{settings\.showCounts && <span>\{analysis\.words\.toLocaleString\(\)\} words<\/span>\}/);
  });
});

describe('Editorial Light: every shell token has a light value', () => {
  const css = read('src/index.css');
  const block = (sel) => {
    const i = css.indexOf(`${sel} {`);
    return css.slice(i, css.indexOf('\n}', i));
  };
  const names = (body) => [...body.matchAll(/^\s*(--[a-z-]+):/gm)].map((m) => m[1]);
  it('the light block retunes the shell and status tokens (page tokens excluded)', () => {
    const dark = names(block(':root'));
    const light = new Set(names(block(":root[data-theme='light']")));
    const shell = ['--desk', '--bar', '--panel', '--card', '--field', '--chip', '--line-soft', '--text', '--muted', '--border-subtle', '--accent', '--accent-amber', '--on-accent', '--hover-bg', '--danger'];
    const status = dark.filter((n) => ['--veil', '--ok', '--warn', '--amber-ink', '--error-ink', '--danger-ink', '--ink-', '--night-ink', '--text-strong', '--tip-bg', '--float-'].some((p) => n.startsWith(p)));
    assert.ok(status.length >= 20, 'the status inks are tokens');
    for (const n of [...shell, ...status]) assert.ok(light.has(n), `${n} has a light value`);
  });
  it('the palette: linen app, warm chalk cards, stone lines, ink text, antique amber and terracotta — no stark white frame', () => {
    const light = block(":root[data-theme='light']");
    for (const [t, v] of [['--desk', '#ebe6dc'], ['--card', '#fbf9f5'], ['--line-soft', '#d8d2c6'], ['--text', '#22201e'], ['--muted', '#6e6a64'], ['--accent', '#b83a2c'], ['--accent-amber', '#b56a00']]) {
      assert.match(light, new RegExp(`${t}: ${v};`), t);
    }
    assert.doesNotMatch(light, /--(desk|bar|panel|card): #fff(fff)?;/i);
  });
  it('status colours in components come from tokens, so they read on both shells', () => {
    for (const [f, hexes] of [
      ['src/App.css', ['#9fd3aa', '#f2c27e', '#e28b78', '#f0a090', '#8fcb9c', '#fbbf24']],
      ['src/components/ProjectsDrawer.css', ['#f0a090', '#52525b', '#a1a1aa', '#fbbf24', '#9fd3aa', '#e8c08a']],
      ['src/components/ProjectBibleDrawer.css', ['#ffffff', '#f0a090', '#101114', '#9fd3aa', 'rgba(255, 255, 255']],
      ['src/components/BackupToast.css', ['#18181b', '#3f3f46', '#a1a1aa']],
      ['src/components/FeedbackModal.css', ['#18181b', '#27272a', '#a1a1aa']],
      ['src/components/planning/PlanningWorkspace.css', ['#fbbf24', '#a9b6c9']],
    ]) {
      const body = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const h of hexes) assert.ok(!body.includes(h), `${f} still hard-codes ${h}`);
    }
  });
  it('an on header button keeps its accent fill under the pointer (else on-accent text vanishes on linen)', () => {
    assert.match(read('src/App.css'), /\.btn-accent\.is-on:hover:not\(:disabled\),\s*\.btn-bible\.is-on:hover:not\(:disabled\) \{ background: color-mix\(in srgb, var\(--accent\) 88%, var\(--text\)\); \}/);
  });
  it('INT. DAY strips stay white on linen, with an edge', () => {
    assert.match(read('src/components/planning/PlanningWorkspace.css'), /:root\[data-theme='light'\] \.strip\.strip-int-day,/);
  });
});
