// The page's colour: classic Paper (ivory, black ink) or Midnight (dark paper, light ink).
// Only the on-screen page changes; printing and PDFs are always black on white (the print
// view lives outside the app and never inherits the Midnight colours — see index.css).

export const CANVAS_THEME_KEY = 'draftline_canvas_theme';
export const CANVAS_THEMES = [
  { id: 'paper', label: 'Paper', hint: 'Ivory page, black ink' },
  { id: 'midnight', label: 'Midnight', hint: 'Dark page, light ink — on screen only; printing stays black on white' },
];
export const DEFAULT_CANVAS_THEME = 'paper';

const valid = (t) => CANVAS_THEMES.some((x) => x.id === t);
const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** The saved theme, or Paper (also when storage is empty, blocked or holds something else). */
export function readCanvasTheme(storage = browserStorage()) {
  try {
    const t = storage?.getItem(CANVAS_THEME_KEY);
    return valid(t) ? t : DEFAULT_CANVAS_THEME;
  } catch {
    return DEFAULT_CANVAS_THEME;
  }
}

/** Remember the theme. Returns true if it was stored. */
export function writeCanvasTheme(theme, storage = browserStorage()) {
  if (!valid(theme)) return false;
  try {
    if (!storage) return false;
    storage.setItem(CANVAS_THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** Paper ↔ Midnight. */
export const nextCanvasTheme = (theme) => (theme === 'midnight' ? 'paper' : 'midnight');
export const canvasThemeInfo = (theme) => CANVAS_THEMES.find((x) => x.id === theme) || CANVAS_THEMES[0];
