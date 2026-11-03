// App settings (⋮ → Settings…): the interface theme and drafting preferences, kept in one
// localStorage entry. The page colour (Paper / Midnight) stays in its own key (lib/canvasTheme.js):
// the shell and the page are set independently.
//
// The theme is applied to <html data-theme="light"> before the first paint by the inline script in
// index.html (it reads the same key), so a light-shell writer never sees a dark flash; this module
// keeps it in step afterwards. Dark is the default: no attribute at all.

export const USER_SETTINGS_KEY = 'draftline_user_settings';
export const UI_THEMES = [
  { id: 'dark', label: 'Dark Charcoal', hint: 'The default' },
  { id: 'light', label: 'Editorial Light', hint: 'Warm linen and ink' },
];
export const DEFAULT_SETTINGS = Object.freeze({ theme: 'dark', showCounts: true });
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

/** Remember the settings. Returns true if they were stored. */
export function writeSettings(settings, storage = browserStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(USER_SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
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
