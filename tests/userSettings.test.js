import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  USER_SETTINGS_KEY, DEFAULT_SETTINGS, THEME_COLORS, normalizeSettings, readSettings, writeSettings, applyTheme,
  resolveTheme, followSystemTheme, SYSTEM_LIGHT_QUERY,
} from '../src/lib/userSettings.js';
import { moreMenuItems } from '../src/lib/toolbar.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const memory = (init = {}) => {
  const map = new Map(Object.entries(init));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
};

// A window whose device asks for light or dark, and lets the test flip it.
const device = (light) => {
  const listeners = new Set();
  const mq = { matches: light, addEventListener: (_, f) => listeners.add(f), removeEventListener: (_, f) => listeners.delete(f) };
  return { mq, listeners, matchMedia: (q) => { assert.equal(q, SYSTEM_LIGHT_QUERY); return mq; } };
};

describe('Settings: stored under draftline_user_settings, System Default by default', () => {
  it('the key, and the defaults: System Default, counts showing', () => {
    assert.equal(USER_SETTINGS_KEY, 'draftline_user_settings');
    assert.deepEqual(DEFAULT_SETTINGS, { theme: 'system', showCounts: true });
    assert.deepEqual(readSettings(memory()), DEFAULT_SETTINGS, 'a new visitor follows their device');
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
  it('a choice stays until it is changed; the first build\'s unchosen "dark" (no v) now means System Default', () => {
    const s = memory();
    writeSettings({ theme: 'dark' }, s);
    assert.equal(readSettings(s).theme, 'dark', 'Espresso Noir, picked, stays');
    writeSettings({ theme: 'system' }, s);
    assert.equal(readSettings(s).theme, 'system');
    assert.equal(readSettings(memory({ [USER_SETTINGS_KEY]: JSON.stringify({ theme: 'dark', showCounts: true }) })).theme, 'system');
    assert.equal(readSettings(memory({ [USER_SETTINGS_KEY]: JSON.stringify({ theme: 'light', showCounts: true }) })).theme, 'light', 'its light was a choice');
  });
  it('System Default shows what the device asks for; a chosen theme ignores the device', () => {
    for (const light of [true, false]) {
      const w = device(light);
      assert.equal(resolveTheme('system', w), light ? 'light' : 'dark');
      assert.equal(resolveTheme('dark', w), 'dark');
      assert.equal(resolveTheme('light', w), 'light');
    }
    assert.equal(resolveTheme('system', {}), 'dark', 'no matchMedia: dark');
    assert.equal(resolveTheme('system', { matchMedia() { throw new Error('nope'); } }), 'dark');
  });
  it('applyTheme sets data-theme="light" on <html> (dark removes it) and the browser chrome colour', () => {
    const attrs = new Map();
    let chrome = null;
    const doc = {
      documentElement: { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k) },
      querySelector: () => ({ setAttribute: (_, v) => { chrome = v; } }),
    };
    applyTheme('light', doc, device(false));
    assert.equal(attrs.get('data-theme'), 'light');
    assert.equal(chrome, THEME_COLORS.light);
    applyTheme('dark', doc, device(true));
    assert.equal(attrs.has('data-theme'), false);
    assert.equal(chrome, THEME_COLORS.dark);
    applyTheme('system', doc, device(true));
    assert.equal(attrs.get('data-theme'), 'light', 'System Default on a light device');
    applyTheme('system', doc, device(false));
    assert.equal(attrs.has('data-theme'), false, 'System Default on a dark device');
  });
  it('System Default follows the device while DraftLine is open; a chosen theme does not listen', () => {
    const w = device(false);
    let calls = 0;
    const stop = followSystemTheme('system', () => calls++, w);
    assert.equal(w.listeners.size, 1);
    for (const f of w.listeners) f();
    assert.equal(calls, 1);
    stop();
    assert.equal(w.listeners.size, 0, 'stops when the theme changes or the app closes');
    followSystemTheme('dark', () => calls++, w);
    followSystemTheme('light', () => calls++, w);
    assert.equal(w.listeners.size, 0);
  });
});

describe('Settings: no flash of the wrong theme', () => {
  const html = read('index.html');
  it('index.html applies the theme before anything paints, from the same key, rule and colours', () => {
    const script = html.match(/<script>(try\{[^<]*draftline_user_settings[^<]*)<\/script>/);
    assert.ok(script, 'an inline pre-paint script');
    assert.ok(html.indexOf(script[0]) < html.indexOf('<script type="module"'), 'before the app bundle');
    assert.match(script[1], /setAttribute\('data-theme','light'\)/);
    assert.ok(script[1].includes(THEME_COLORS.light));
    const run = (stored, light = false) => {
      const attrs = new Map();
      const meta = { content: THEME_COLORS.dark, setAttribute: (_, v) => { meta.content = v; } };
      const localStorage = { getItem: () => stored };
      const document = { documentElement: { setAttribute: (k, v) => attrs.set(k, v) }, querySelector: () => meta };
      new Function('localStorage', 'document', 'matchMedia', script[1])(localStorage, document, () => ({ matches: light }));
      return [attrs.get('data-theme') ?? null, meta.content];
    };
    const LIGHT = ['light', THEME_COLORS.light];
    const DARK = [null, THEME_COLORS.dark];
    assert.deepEqual(run(JSON.stringify({ theme: 'light', v: 2 }), false), LIGHT, 'Editorial Light, even on a dark device');
    assert.deepEqual(run(JSON.stringify({ theme: 'dark', v: 2 }), true), DARK, 'Espresso Noir, even on a light device');
    assert.deepEqual(run(null, true), LIGHT, 'new visitors follow a light device');
    assert.deepEqual(run(null, false), DARK, '…and a dark one');
    assert.deepEqual(run(JSON.stringify({ theme: 'system', v: 2 }), true), LIGHT);
    assert.deepEqual(run(JSON.stringify({ theme: 'dark', showCounts: true }), true), LIGHT, 'the first build\'s unchosen dark is System Default');
    assert.deepEqual(run(JSON.stringify({ theme: 'light' }), false), LIGHT, 'the first build\'s light was a choice');
    assert.deepEqual(run('{oops', false), DARK, 'bad JSON never throws out of the script');
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
    assert.match(app, /writeSettings\(patch\);\s*setSettings/, 'only what the writer picks is written');
    assert.match(app, /applyTheme\(settings\.theme\);\s*return followSystemTheme\(settings\.theme, \(\) => applyTheme\(settings\.theme\)\);\s*\}, \[settings\.theme\]\);/);
    const css = read('src/index.css');
    const light = css.slice(css.indexOf(":root[data-theme='light'] {"), css.indexOf('}', css.indexOf(":root[data-theme='light'] {")));
    for (const pageToken of ['--paper:', '--ink:', '--caret:', '--selection:']) assert.ok(!light.includes(pageToken), `${pageToken} belongs to the page, not the shell`);
  });
  it('Appearance: the three themes in one row across the same width as the two page colours; stacked when narrow', () => {
    const css = read('src/components/SettingsModal.css');
    assert.match(modal, /className="st-row st-row-3" role="radiogroup" aria-label="Interface theme"/);
    assert.match(css, /\.st-row \{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; \}/);
    assert.match(css, /\.st-row-3 \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/, 'three equal columns in the same width');
    assert.match(css, /@media \(max-width: 560px\) \{\s*\.st-row-3 \{ grid-template-columns: 1fr; \}/);
    assert.match(css, /\.st-swatch\.is-system \{ background: linear-gradient\(135deg, #1b1c1f 50%, #ebe6dc 50%\); \}/);
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

describe('Theme names and the Settings shortcut', () => {
  it('System Default (first, the default), Espresso Noir and Editorial Light, each a title and one short line', async () => {
    const { UI_THEMES } = await import('../src/lib/userSettings.js');
    assert.deepEqual(UI_THEMES.map((t) => [t.id, t.label, t.hint]), [
      ['system', 'System Default', 'Matches your device'],
      ['dark', 'Espresso Noir', 'Deep roast & cinematic'],
      ['light', 'Editorial Light', 'Warm linen & editorial'],
    ]);
  });
  it('Ctrl+, (⌘, on a Mac) opens Settings, and the shortcut list and ⋮ show it', async () => {
    const { SHORTCUTS } = await import('../src/lib/shortcuts.js');
    assert.match(SHORTCUTS['Ctrl+,'], /^Settings/);
    assert.match(read('src/App.jsx'), /else if \(mod && !e\.altKey && !e\.shiftKey && e\.code === 'Comma'\) \{\s*e\.preventDefault\(\);[^\n]*\n\s*setSettingsAt\(\(a\) => \(a \? null : 'top'\)\);/);
    const noop = () => {};
    const s = moreMenuItems({ onShortcuts: noop, onAbout: noop, onSettings: noop }).find((i) => i.label === 'Settings…');
    assert.equal(s.hint, 'Ctrl+,');
  });
  it('no light-theme suggestion card any more: System Default already follows a light device', async () => {
    const { HINTS } = await import('../src/lib/hints.js');
    assert.equal(HINTS.lightTheme, undefined);
    assert.doesNotMatch(read('src/App.jsx'), /lightTip|LIGHT_TIP|lightThemeTip/);
  });
});

describe('The public pages follow the same theme rule as the app', () => {
  const PAGES = ['public/features/index.html', 'public/compare/index.html', 'public/philosophy/index.html'];
  const scriptOf = (html) => html.match(/<script>\s*(\(function \(\) \{\s*var KEY = 'draftline_user_settings';[\s\S]*?\}\)\(\);)\s*<\/script>/);
  it('each reads the app\'s setting before it paints, and has the light palette only under data-theme', () => {
    for (const p of PAGES) {
      const html = read(p);
      const s = scriptOf(html);
      assert.ok(s, `${p}: the theme script`);
      assert.ok(html.indexOf(s[0]) < html.indexOf('<style>'), `${p}: before the styles, so no flash`);
      assert.match(html, /:root\[data-theme='light'\] \{ --bg: #f4f0e8;/, p);
      assert.doesNotMatch(html.replace(s[0], ''), /prefers-color-scheme/, `${p}: no separate rule of its own`);
    }
  });
  it('System Default follows the device (and its switches); a theme picked in the app wins', () => {
    const run = (stored, light) => {
      const attrs = new Map();
      const meta = { content: '#1c1d20', setAttribute: (_, v) => { meta.content = v; } };
      const listeners = [];
      const mq = { matches: light, addEventListener: (_, f) => listeners.push(f) };
      const document = {
        documentElement: { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: (k) => attrs.delete(k) },
        querySelector: () => meta,
      };
      const window = { matchMedia: () => mq, addEventListener() {} };
      new Function('window', 'document', 'localStorage', scriptOf(read(PAGES[2]))[1])(window, document, { getItem: () => stored });
      return { look: attrs.get('data-theme') ?? 'dark', chrome: meta.content, flip: () => { mq.matches = !mq.matches; listeners.forEach((f) => f()); return attrs.get('data-theme') ?? 'dark'; } };
    };
    assert.equal(run(null, true).look, 'light');
    assert.equal(run(null, true).chrome, '#f4f0e8');
    assert.equal(run(null, false).look, 'dark');
    assert.equal(run(JSON.stringify({ theme: 'dark', v: 2 }), true).look, 'dark');
    assert.equal(run(JSON.stringify({ theme: 'light', v: 2 }), false).look, 'light');
    assert.equal(run(JSON.stringify({ theme: 'dark', showCounts: true }), true).look, 'light', 'the first build\'s unchosen dark');
    assert.equal(run(null, false).flip(), 'light', 'the device switches while the page is open');
    assert.equal(run(JSON.stringify({ theme: 'dark', v: 2 }), false).flip(), 'dark', 'a chosen theme does not');
    const same = (p) => scriptOf(read(p))[1];
    assert.equal(same(PAGES[0]), same(PAGES[2]));
    assert.equal(same(PAGES[1]), same(PAGES[2]));
  });
});
