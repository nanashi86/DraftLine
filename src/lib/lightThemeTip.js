// The Editorial Light discovery tip: once, ever, a card beside ⋮ suggesting the light theme to a writer
// who's probably in a bright room — their system is set to light, or it's daytime where they are.
// It's a card like the feature hints (lib/hints.js HINTS.lightTheme: same look, same calm moments,
// same one-card-per-session rule), but it isn't counted in About → Tips.
//
// It can't come back on its own, whatever happens across sessions:
//   • one flag, LIGHT_TIP_KEY, set to 'true' the moment the card is shown — before Switch to Light or
//     Keep Dark is even clicked — so a reload, a crash or a second tab never shows it again
//   • the check bails out first, before looking at the system or the clock: the flag is set, or the
//     writer has already chosen a theme (in Settings, or through this card)
//   • only Show tips again (Settings or About) clears the flag — and even then it stays away for a
//     writer who has chosen a theme.
import { themeChosen } from './userSettings.js';

/** localStorage: 'true' once the tip has been shown (or answered). */
export const LIGHT_TIP_KEY = 'draftline_tip_light_theme_seen';
/** Daytime, in the writer's local hours: 7:00 up to 19:00. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 19;

const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Has the tip been shown? Blocked storage reads as seen: with nothing to remember it, never show it. */
export function lightTipSeen(storage = browserStorage()) {
  try {
    if (!storage) return true;
    return storage.getItem(LIGHT_TIP_KEY) === 'true';
  } catch {
    return true;
  }
}

/** Shown, dismissed or accepted: never again (until Show tips again). Returns true if it was stored. */
export function markLightTipSeen(storage = browserStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(LIGHT_TIP_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

/** Show tips again: the only way the flag is ever cleared. */
export function resetLightTip(storage = browserStorage()) {
  try {
    storage?.removeItem(LIGHT_TIP_KEY);
  } catch { /* nothing to clear */ }
}

/** Is the system asking for light? (prefers-color-scheme: light) */
export function osPrefersLight(win = globalThis) {
  try {
    return win.matchMedia?.('(prefers-color-scheme: light)')?.matches === true;
  } catch {
    return false;
  }
}

/** Is it daytime where the writer is? */
export const isDaytime = (date = new Date()) => date.getHours() >= DAY_START_HOUR && date.getHours() < DAY_END_HOUR;

/**
 * Should the tip be offered now? The bailouts come first and return before anything else is checked:
 * the flag is set, or a theme has been chosen. Only then the one condition, evaluated once:
 * the system is in light mode OR it's daytime.
 *   opts: { storage, isOsLight: () => boolean, now: Date } (defaults: the browser's)
 */
export function lightTipWanted({ storage = browserStorage(), isOsLight = osPrefersLight, now = new Date() } = {}) {
  if (lightTipSeen(storage)) return false;
  if (themeChosen(storage)) return false;
  return isOsLight() || isDaytime(now);
}
