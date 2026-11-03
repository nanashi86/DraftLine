// App settings (⋮ → Settings…): the interface theme and drafting preferences, kept in one
// localStorage entry. The page colour (Paper / Midnight) stays in its own key (lib/canvasTheme.js):
// the shell and the page are set independently.
//
// The theme is applied to <html data-theme="light"> before the first paint by the inline script in
// index.html (it reads the same key), so a light-shell writer never sees a dark flash; this module
// keeps it in step afterwards. Dark is the default: no attribute at all.

export const USER_SETTINGS_KEY = 'draftline_user_settings';
export const UI_THEMES = [
  { id: 'dark', label: 'Espresso Noir', hint: 'Deep roast & cinematic' }, // the default
  { id: 'light', label: 'Editorial Light', hint: 'Warm linen & editorial' },
];
export const DEFAULT_SETTINGS = Object.freeze({ theme: 'dark', showCounts: true });
/** Stored with every choice, so a choice can be told from the first build's blanket defaults. */
export const SETTINGS_VERSION = 2;
/** The browser chrome's colour (<meta name="theme-color">) for each shell. */
export const THEME_COLORS = { dark: '#18181b', light: '#f4f0e8' };

const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Any stored value → a complete, valid settings object (unknown keys dropped, bad values defaulted). */
export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    theme: UI_THEMES.some((t) => t.id === s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    showCounts: typeof s.showCounts === 'boolean' ? s.showCounts : DEFAULT_SETTINGS.showCounts,
  };
}

/** The saved settings, or the defaults (also when storage is empty, blocked or holds something else). */
export function readSettings(storage = browserStorage()) {
  try {
    return normalizeSettings(JSON.parse(storage?.getItem(USER_SETTINGS_KEY) || 'null'));
  } catch {
    return normalizeSettings(null);
  }
}

/** What the writer has actually chosen, as stored: only the keys they've set (never the defaults). */
export function readChosenSettings(storage = browserStorage()) {
  try {
    const raw = JSON.parse(storage?.getItem(USER_SETTINGS_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    // The first build (no v) wrote every setting on each load, so a default value there was never a
    // choice: only what differs from the default counts. Choices since are stored with v: 2.
    const legacy = raw.v !== SETTINGS_VERSION;
    const valid = normalizeSettings(raw);
    return Object.fromEntries(Object.keys(DEFAULT_SETTINGS)
      .filter((k) => k in raw && raw[k] === valid[k] && !(legacy && raw[k] === DEFAULT_SETTINGS[k]))
      .map((k) => [k, raw[k]]));
  } catch {
    return {};
  }
}

/** Has the writer picked a theme (in Settings, or through the light-theme tip)? A default never counts. */
export const themeChosen = (storage = browserStorage()) => 'theme' in readChosenSettings(storage);

/**
 * Remember what the writer just chose: the patch is merged into what they chose before, so a key is
 * only ever stored once it has been picked (theme: 'dark' is a choice, not the default written back).
 * Returns true if it was stored.
 */
export function writeSettings(patch, storage = browserStorage()) {
  try {
    if (!storage) return false;
    const next = { ...readChosenSettings(storage) };
    const valid = normalizeSettings({ ...DEFAULT_SETTINGS, ...patch });
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in (patch || {})) next[k] = valid[k];
    storage.setItem(USER_SETTINGS_KEY, JSON.stringify({ ...next, v: SETTINGS_VERSION }));
    return true;
  } catch {
    return false;
  }
}

/** Put the shell theme on <html> (attribute only for light) and the browser chrome colour to match. */
export function applyTheme(theme, doc = globalThis.document) {
  const root = doc?.documentElement;
  if (!root) return;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  doc.querySelector?.('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.dark);
}
