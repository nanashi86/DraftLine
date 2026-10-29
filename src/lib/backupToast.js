// The backup tip: once a script is long enough to hurt to lose (10 pages or 5,000 words) and it lives
// only in browser storage, a corner card suggests keeping a copy outside the browser. It never blocks
// typing, and it stays away for the session once closed, or for good with "Don't show again".
//
// Two versions, by what the browser can do:
//   'link'   — desktop Chrome and Edge can link a folder: Link Folder opens Projects on that card.
//              Shown once the script is long enough; once closed it stays closed for the session.
//   'backup' — Safari, Firefox, phones and tablets can't: Backup Project downloads a .draftline file.
//              Shown once the script is long enough and never backed up, then again whenever the
//              script has been saved 7+ days after its last backup (from the tip or the File menu).
// Safari adds one line: Add to Dock on a Mac, Add to Home Screen on iPad and iPhone, since an app
// opened from there isn't cleared after a week away. Not shown once DraftLine is opened that way.

export const BACKUP_TOAST_PAGES = 10;
export const BACKUP_TOAST_WORDS = 5000;
/** Backup Project version: comes back this long after the last backup, once the script has changed. */
export const BACKUP_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;
/** localStorage: "Don't show again". */
export const BACKUP_TOAST_DISMISSED_KEY = 'draftline_backup_toast_dismissed';
/** sessionStorage: closed for this session (Dismiss, ✕, Link Folder or Backup Project). */
export const BACKUP_TOAST_SESSION_KEY = 'draftline_backup_toast_session';
/** localStorage: { [projectId]: time of its last .draftline backup, in ms }. */
export const LAST_BACKUPS_KEY = 'draftline_last_backups';

const LOCAL_ONLY = 'Tip: Your script is only saved locally in this browser. Clearing history will delete your files.';

export const BACKUP_TOAST = {
  heading: 'Keep your pages safe',
  link: {
    message: `${LOCAL_ONLY} Link a computer folder in Projects to keep an automatic physical file backup on a hard drive or cloud drive of your choice.`,
    action: 'Link Folder',
  },
  backup: {
    message: `${LOCAL_ONLY} Back it up now and then you can open the file again any time with File → Open.`,
    action: 'Backup Project',
  },
  /** The extra Safari line, by platform. */
  install: {
    'mac-safari': 'Adding DraftLine to your Dock (File → Add to Dock) also keeps Safari from clearing it after a week away.',
    ios: 'Adding DraftLine to your Home Screen (Share → Add to Home Screen) also keeps Safari from clearing it after a week away.',
  },
};

/**
 * Which browser family this is, as far as the tip and the storage request care:
 *   'ios'        — iPhone or iPad, any browser (all of them are Safari underneath)
 *   'mac-safari' — Safari on a Mac
 *   'firefox'    — Firefox on a computer or Android (its storage request shows a permission bar)
 *   'other'      — Chrome, Edge, Brave, Opera…
 * iPadOS reports itself as a Mac, so a "Mac" with a touch screen is an iPad.
 */
export function browserFamily(ua = '', { maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua)) return 'mac-safari';
  return 'other';
}

/**
 * The tip's wording for this browser: { heading, message, action, extra }.
 * `supported` (can link a folder) picks Link Folder; otherwise Backup Project, plus the Safari line
 * unless DraftLine is already running from the Dock or Home Screen (`standalone`).
 */
export function backupToastCopy({ supported = true, family = 'other', standalone = false } = {}) {
  const v = supported ? BACKUP_TOAST.link : BACKUP_TOAST.backup;
  const extra = !supported && !standalone ? BACKUP_TOAST.install[family] || null : null;
  return { heading: BACKUP_TOAST.heading, message: v.message, action: v.action, extra, kind: supported ? 'link' : 'backup' };
}

/**
 * Show the tip? Never when any of these hold: "Don't show again" (`dismissedForever`), closed this
 * session (`dismissedSession`), something else in the corner or Focus mode (`busy`, held back, not
 * dismissed), or the script isn't in App Storage Only (`state` ≠ 'local'). Otherwise the script must
 * be 10+ pages or 5,000+ words, and then:
 *   - a browser that can link a folder (`supported`): show it.
 *   - one that can't: show it if this script was never backed up (`lastBackupAt` null), or if it was
 *     last saved (`savedAt`) 7+ days after its last backup. A backup resets the clock.
 */
export function shouldShowBackupToast({
  pages = 0, words = 0, state = 'local', supported = true, dismissedForever = false, dismissedSession = false, busy = false,
  lastBackupAt = null, savedAt = null,
} = {}) {
  if (dismissedForever || dismissedSession || busy || state !== 'local') return false;
  if (pages < BACKUP_TOAST_PAGES && words < BACKUP_TOAST_WORDS) return false;
  if (supported || lastBackupAt == null) return true;
  return savedAt != null && savedAt - lastBackupAt >= BACKUP_REMINDER_MS;
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

/** Every project's last backup time ({ id: ms }); unreadable or blocked storage reads as none. */
export function readLastBackups(storage) {
  try {
    const v = JSON.parse(storage?.getItem(LAST_BACKUPS_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** Record a backup of project `id` at `at`; returns the updated map (kept in memory if storage is blocked). */
export function recordBackup(storage, id, at, current = readLastBackups(storage)) {
  if (!id) return current;
  const next = { ...current, [id]: at };
  try {
    storage?.setItem(LAST_BACKUPS_KEY, JSON.stringify(next));
  } catch { /* private window: this session still knows */ }
  return next;
}
