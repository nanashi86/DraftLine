// App settings (⋮ → Settings…): the interface theme and drafting preferences, kept in one
// localStorage entry. The page colour (Paper / Midnight) stays in its own key (lib/canvasTheme.js):
// the shell and the page are set independently.
//
// The theme is applied to <html data-theme="light"> before the first paint by the inline script in
// index.html (it reads the same key), so a light-shell writer never sees a dark flash; this module
// keeps it in step afterwards. Dark has no attribute at all.
//
// System Default (the default) follows the device's light or dark appearance, and switches with it
// while DraftLine is open. A writer who picks Espresso Noir or Editorial Light keeps that look on this
// device until they change it. The public pages (features/, compare/, philosophy/) read the same key
// and apply the same rule before they paint.

export const USER_SETTINGS_KEY = 'draftline_user_settings';
export const UI_THEMES = [
  { id: 'system', label: 'System Default', hint: 'Matches your device' }, // the default
  { id: 'dark', label: 'Espresso Noir', hint: 'Deep roast & cinematic' },
  { id: 'light', label: 'Editorial Light', hint: 'Warm linen & editorial' },
];
export const DEFAULT_SETTINGS = Object.freeze({ theme: 'system', showCounts: true });
/** What the device asks for: prefers-color-scheme: light, or dark (also when it can't be read). */
export const SYSTEM_LIGHT_QUERY = '(prefers-color-scheme: light)';
/** Stored with every choice, so a choice can be told from the first build's blanket defaults. */
export const SETTINGS_VERSION = 2;
/** What the first build wrote on every load (dark was its default): never a choice. */
const FIRST_BUILD_DEFAULTS = Object.freeze({ theme: 'dark', showCounts: true });
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

/**
 * The settings in effect: what the writer chose, and the defaults for the rest (also when storage is
 * empty, blocked or holds something else). A value the first build wrote without being chosen (no v)
 * counts as the default, so it now gets System Default.
 */
export function readSettings(storage = browserStorage()) {
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...readChosenSettings(storage) });
}

/** What the writer has actually chosen, as stored: only the keys they've set (never the defaults). */
export function readChosenSettings(storage = browserStorage()) {
  try {
    const raw = JSON.parse(storage?.getItem(USER_SETTINGS_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    // The first build (no v) wrote every setting on each load, so its default values were never a
    // choice: only what differs from them counts. Choices since are stored with v: 2.
    const legacy = raw.v !== SETTINGS_VERSION;
    const valid = normalizeSettings(raw);
    return Object.fromEntries(Object.keys(DEFAULT_SETTINGS)
      .filter((k) => k in raw && raw[k] === valid[k] && !(legacy && raw[k] === FIRST_BUILD_DEFAULTS[k]))
      .map((k) => [k, raw[k]]));
  } catch {
    return {};
  }
}


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

/** Is the device set to a light appearance? */
export function systemPrefersLight(win = globalThis) {
  try {
    return win.matchMedia?.(SYSTEM_LIGHT_QUERY)?.matches === true;
  } catch {
    return false;
  }
}

/** The look a setting shows right now: 'light' or 'dark' (System Default asks the device). */
export const resolveTheme = (theme, win = globalThis) => (theme === 'light' || (theme === 'system' && systemPrefersLight(win)) ? 'light' : 'dark');

/** Put the shell theme on <html> (attribute only for light) and the browser chrome colour to match. */
export function applyTheme(theme, doc = globalThis.document, win = globalThis) {
  const root = doc?.documentElement;
  if (!root) return;
  const look = resolveTheme(theme, win);
  if (look === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  doc.querySelector?.('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[look]);
}

/**
 * System Default: re-apply when the device switches between light and dark while DraftLine is open.
 * Returns a function that stops listening (a no-op for a chosen theme, which never follows the device).
 */
export function followSystemTheme(theme, onChange, win = globalThis) {
  if (theme !== 'system') return () => {};
  try {
    const mq = win.matchMedia?.(SYSTEM_LIGHT_QUERY);
    if (!mq?.addEventListener) return () => {};
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}
