// Tabs and windows of DraftLine on one computer: a quick heads-up when one saves, and which are open.
//
// This is for a smooth experience only. What guarantees no tab ever saves over another's newer work is
// the version check in the library's own write (projectStorage.js revisionOf / ConflictError). These
// messages just let a tab notice sooner: a tab with nothing unsaved takes the newer version at once,
// and one with unsaved changes asks before it would have tried to save.
//
//   BroadcastChannel 'draftline-projects': { type: 'saved' | 'deleted', id, revision, from }
//   Web Lock 'draftline-tab:<tabId>', held for the tab's whole life: a crash journal whose tab still
//   holds its lock belongs to a tab that's open (hidden, not closed), so it's left alone at start-up.
// Both are local to this browser profile: nothing leaves the computer.

export const TAB_CHANNEL = 'draftline-projects';
const TAB_LOCK = 'draftline-tab:';

/** A new id for this tab (also names its crash journal). */
export const newTabId = () => (globalThis.crypto?.randomUUID?.() || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

/**
 * Listen for other tabs' saves. onMessage({ type, id, revision }) — never this tab's own messages.
 * Returns { announce(type, id, revision), close() }; without BroadcastChannel both do nothing.
 */
export function createTabSync({ tabId, onMessage, Channel = globalThis.BroadcastChannel }) {
  let ch = null;
  try {
    ch = typeof Channel === 'function' ? new Channel(TAB_CHANNEL) : null;
  } catch {
    ch = null;
  }
  if (ch) {
    ch.onmessage = (e) => {
      const m = e?.data;
      if (!m || m.from === tabId || typeof m.id !== 'string' || (m.type !== 'saved' && m.type !== 'deleted')) return;
      onMessage?.(m);
    };
  }
  return {
    announce(type, id, revision = null) {
      try {
        ch?.postMessage({ type, id, revision, from: tabId });
      } catch { /* closed: nothing to tell */ }
    },
    close() {
      try {
        ch?.close();
      } catch { /* already closed */ }
    },
  };
}

/** Hold this tab's lock until the page goes away (the browser releases it then, even on a crash). */
export function holdTabLock(tabId, locks = globalThis.navigator?.locks) {
  if (!locks?.request) return false;
  locks.request(`${TAB_LOCK}${tabId}`, () => new Promise(() => {})).catch(() => {});
  return true;
}

/**
 * Tabs that are open now (their lock is held), as a Set of tab ids. null when the browser can't tell
 * (no Web Locks): then no journal can be known to be another open tab's.
 */
export async function openTabs(locks = globalThis.navigator?.locks) {
  if (!locks?.query) return null;
  try {
    const { held = [] } = await locks.query();
    return new Set(held.map((l) => l.name).filter((n) => n?.startsWith(TAB_LOCK)).map((n) => n.slice(TAB_LOCK.length)));
  } catch {
    return null;
  }
}
