// A deploy replaces the built files (their names carry a hash of their contents). A tab still
// running the previous build can then ask for one that no longer exists, for example when the
// writer first opens Feedback, Settings or Plan after the deploy, and React has nothing to show.
// Vite reports that failure as a "vite:preloadError" event; we reload once, which loads the new
// build. A second failure within a minute isn't a stale tab (the files are really missing, or
// the writer is offline), so it's left alone rather than reloading in a loop.

export const STALE_RELOAD_KEY = 'draftline-stale-reload';
const WINDOW_MS = 60_000;

/** Reloads unless it already did within the last minute. Returns whether it reloaded. */
export function reloadForNewBuild({ storage, reload, now = Date.now() }) {
  let last = 0;
  try {
    last = Number(storage?.getItem(STALE_RELOAD_KEY)) || 0;
  } catch {
    // blocked storage: still reload once (a loop can't start, since nothing would trigger it again)
  }
  if (now - last < WINDOW_MS) return false;
  try {
    storage?.setItem(STALE_RELOAD_KEY, String(now));
  } catch {
    // nothing to do
  }
  reload();
  return true;
}

export function reloadWhenBuildIsStale(win = globalThis.window) {
  if (!win?.addEventListener) return;
  win.addEventListener('vite:preloadError', () => {
    let storage;
    try {
      storage = win.sessionStorage;
    } catch {
      // blocked storage (some private windows): reloadForNewBuild copes with none
    }
    reloadForNewBuild({ storage, reload: () => win.location.reload() });
  });
}
