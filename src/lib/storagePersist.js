// Protected storage: asking the browser not to clear DraftLine's scripts to free up space
// (navigator.storage.persist()). About shows the answer on its "Protected" line.
//
// Chrome, Edge and Safari answer on their own with no prompt, so DraftLine asks quietly after the
// first save that has words in it, once per session until the browser says yes. Firefox shows a
// permission bar instead, so there it's asked only when the writer clicks Backup Project (the reason
// is obvious then), and only once: Firefox remembers Allow or Block itself.

/** localStorage: Firefox has been asked (from Backup Project), so it isn't asked again. */
export const PERSIST_ASKED_KEY = 'draftline_persist_asked';

/**
 * Ask for protected storage if it's worth asking now. Resolves to true (protected), false (not), or
 * null (not asked: no support, or Firefox without a click). Never rejects.
 *   family  — browserFamily(): 'firefox' only asks with `fromClick`, and only once (`local` flag)
 */
export async function requestPersistence({ storage = globalThis.navigator?.storage, family = 'other', fromClick = false, local } = {}) {
  try {
    if (!storage?.persist || !storage?.persisted) return null;
    if (await storage.persisted()) return true;
    if (family === 'firefox') {
      if (!fromClick || local?.getItem(PERSIST_ASKED_KEY) === 'true') return null;
      try {
        local?.setItem(PERSIST_ASKED_KEY, 'true');
      } catch { /* blocked storage: Firefox still remembers its own answer */ }
    }
    return !!(await storage.persist());
  } catch {
    return null;
  }
}
