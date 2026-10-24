// Support callouts: the "consider supporting" line on an export toast (at most every 14 days) and
// under a clean Format Doctor report (at most every 30 days). Both remember, in this browser's
// localStorage, when they last showed, and either can be muted for good.
//
// Keys (as stored):
//   last_export_tip_shown          ms timestamp       export_tip_muted          'true'
//   last_format_doctor_tip_shown   ms timestamp       format_doctor_tip_muted   'true'
//
// Quiet by default: when storage can't be read or written (a private window, blocked site data),
// the tips never show, because without a memory they would come back on every export.

export const DAY_MS = 24 * 60 * 60 * 1000;

export const KO_FI_URL = 'https://ko-fi.com/draftline';
export const PATREON_URL = 'https://patreon.com/DraftLine';

export const EXPORT_TIP = Object.freeze({
  lastKey: 'last_export_tip_shown',
  muteKey: 'export_tip_muted',
  cooldownMs: 14 * DAY_MS,
});

export const FORMAT_DOCTOR_TIP = Object.freeze({
  lastKey: 'last_format_doctor_tip_shown',
  muteKey: 'format_doctor_tip_muted',
  cooldownMs: 30 * DAY_MS,
});

/** The browser's localStorage, or null where it's unavailable. */
export function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * The cooldown rule on its own: show unless muted, or unless it last showed less than
 * `cooldownMs` ago. Never shown before counts as due. A timestamp from the future (a clock
 * that was set back) is ignored rather than allowed to silence the tip for longer.
 */
export function shouldShowTip(tip, { now, last, muted }) {
  if (muted) return false;
  if (!Number.isFinite(last) || last <= 0 || last > now) return true;
  return now - last >= tip.cooldownMs;
}

/** What's stored for `tip`: { last, muted }, or null if storage can't be read. */
export function readTip(tip, storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(tip.lastKey);
    return { last: raw == null ? NaN : Number(raw), muted: storage.getItem(tip.muteKey) === 'true' };
  } catch {
    return null;
  }
}

/**
 * Decide and record in one step: true if the tip is due, in which case `now` is stored as the
 * time it was shown (so the cooldown starts from this showing). False, and nothing written,
 * when it's muted, cooling down, or storage isn't usable.
 */
export function claimTip(tip, { storage = defaultStorage(), now = Date.now() } = {}) {
  const state = readTip(tip, storage);
  if (!state || !shouldShowTip(tip, { now, ...state })) return false;
  try {
    storage.setItem(tip.lastKey, String(now));
    return true;
  } catch {
    return false;
  }
}

/** Don't show again: mute `tip` in this browser for good. */
export function muteTip(tip, storage = defaultStorage()) {
  try {
    storage?.setItem(tip.muteKey, 'true');
  } catch { /* blocked storage: it can't show again anyway */ }
}

/** Export toast: how long it stays (ms) unless you're pointing at it or have tabbed into it. */
export const EXPORT_TOAST_MS = 8000;

/**
 * A dismiss timer that can pause while the toast is hovered or focused, so the links can be read
 * and reached. `timers` is { setTimeout, clearTimeout } (the globals by default).
 * Returns { pause(), resume(), cancel() }.
 */
export function autoDismiss(onDismiss, ms = EXPORT_TOAST_MS, timers = globalThis) {
  let id = null;
  let left = ms;
  let started = 0;
  let done = false;
  const start = () => {
    if (done || id !== null) return;
    started = Date.now();
    id = timers.setTimeout(() => { done = true; id = null; onDismiss(); }, left);
  };
  start();
  return {
    pause() {
      if (id === null) return;
      timers.clearTimeout(id);
      id = null;
      left = Math.max(0, left - (Date.now() - started));
    },
    resume: start,
    cancel() {
      done = true;
      if (id !== null) timers.clearTimeout(id);
      id = null;
    },
  };
}
