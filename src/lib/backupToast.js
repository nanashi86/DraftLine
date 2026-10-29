// The backup tip: once a script is long enough to hurt to lose (10 pages or 5,000 words) and it lives
// only in browser storage, a corner card suggests linking a folder. It never blocks typing, and it
// stays away for the session once closed, or for good with "Don't show again".

export const BACKUP_TOAST_PAGES = 10;
export const BACKUP_TOAST_WORDS = 5000;
/** localStorage: "Don't show again". */
export const BACKUP_TOAST_DISMISSED_KEY = 'draftline_backup_toast_dismissed';
/** sessionStorage: closed for this session (Dismiss, ✕ or Link Folder). */
export const BACKUP_TOAST_SESSION_KEY = 'draftline_backup_toast_session';

export const BACKUP_TOAST = {
  heading: 'Keep your pages safe',
  message: 'Tip: Your script is saved locally in this browser. Accidentally clearing your history will delete your files. '
    + 'Link a computer folder in Projects to keep an automatic physical file backup on your hard drive or cloud drive of your choice.',
};

/**
 * Show the tip? Only when all of these hold:
 *   pages ≥ 10 or words ≥ 5,000; the status is App Storage Only ('local'); this browser can link a
 *   folder (`supported`); not "Don't show again" (`dismissedForever`); not closed this session.
 * `busy` (another corner toast showing, Focus mode…) holds it back without dismissing it.
 */
export function shouldShowBackupToast({
  pages = 0, words = 0, state = 'local', supported = true, dismissedForever = false, dismissedSession = false, busy = false,
} = {}) {
  if (dismissedForever || dismissedSession || busy || !supported || state !== 'local') return false;
  return pages >= BACKUP_TOAST_PAGES || words >= BACKUP_TOAST_WORDS;
}

/** Read a flag from storage; a private window or blocked storage reads as "not set". */
export function readFlag(storage, key) {
  try {
    return storage?.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** Set a flag; blocked storage just means it lasts as long as the page. */
export function writeFlag(storage, key) {
  try {
    storage?.setItem(key, 'true');
  } catch { /* private window: the in-memory state still hides it */ }
}
