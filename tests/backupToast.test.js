import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BACKUP_REMINDER_MS, BACKUP_TOAST, BACKUP_TOAST_DISMISSED_KEY, BACKUP_TOAST_PAGES, BACKUP_TOAST_SESSION_KEY, BACKUP_TOAST_WORDS,
  LAST_BACKUPS_KEY, backupToastCopy, browserFamily, readFlag, readLastBackups, recordBackup, shouldShowBackupToast, writeFlag,
} from '../src/lib/backupToast.js';
import { PERSIST_ASKED_KEY, requestPersistence } from '../src/lib/storagePersist.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('Backup tip: when it shows', () => {
  it('at 10 pages, or 5,000 words, while the script is in App Storage Only', () => {
    assert.equal(BACKUP_TOAST_PAGES, 10);
    assert.equal(BACKUP_TOAST_WORDS, 5000);
    assert.equal(shouldShowBackupToast({ pages: 9, words: 4999 }), false);
    assert.equal(shouldShowBackupToast({ pages: 10, words: 100 }), true);
    assert.equal(shouldShowBackupToast({ pages: 3, words: 5000 }), true);
  });
  it('never once a folder is linked and syncing, or waiting for permission', () => {
    for (const state of ['synced', 'permission', 'paused', 'error']) assert.equal(shouldShowBackupToast({ pages: 40, state }), false, state);
  });
  it('never after "Don’t show again", nor again this session after it was closed', () => {
    assert.equal(shouldShowBackupToast({ pages: 40, dismissedForever: true }), false);
    assert.equal(shouldShowBackupToast({ pages: 40, dismissedSession: true }), false);
  });
  it('in a browser that can’t link a folder: when this script was never backed up', () => {
    assert.equal(shouldShowBackupToast({ pages: 40, supported: false }), true);
    assert.equal(shouldShowBackupToast({ pages: 4, words: 900, supported: false }), false, 'still needs 10 pages / 5,000 words');
  });
  it('…then again only once it’s been saved 7+ days after its last backup', () => {
    const day = 24 * 60 * 60 * 1000;
    assert.equal(BACKUP_REMINDER_MS, 7 * day);
    const last = Date.UTC(2026, 9, 1);
    const base = { pages: 40, supported: false, lastBackupAt: last };
    assert.equal(shouldShowBackupToast({ ...base, savedAt: last + 2 * day }), false);
    assert.equal(shouldShowBackupToast({ ...base, savedAt: last + 7 * day - 1 }), false);
    assert.equal(shouldShowBackupToast({ ...base, savedAt: last + 7 * day }), true);
    assert.equal(shouldShowBackupToast({ ...base, savedAt: null }), false);
    assert.equal(shouldShowBackupToast({ ...base, savedAt: last + 30 * day, dismissedSession: true }), false);
    assert.equal(shouldShowBackupToast({ ...base, savedAt: last + 30 * day, dismissedForever: true }), false);
  });
  it('Link Folder browsers ignore the backup clock', () => {
    assert.equal(shouldShowBackupToast({ pages: 40, supported: true, lastBackupAt: 5, savedAt: 6 }), true);
  });
  it('waits while another corner toast or Focus mode is up', () => {
    assert.equal(shouldShowBackupToast({ pages: 40, busy: true }), false);
  });
});

describe('Backup tip: remembering the choice', () => {
  it('"Don’t show again" is the localStorage flag draftline_backup_toast_dismissed = "true"', () => {
    assert.equal(BACKUP_TOAST_DISMISSED_KEY, 'draftline_backup_toast_dismissed');
    const local = memoryStorage();
    assert.equal(readFlag(local, BACKUP_TOAST_DISMISSED_KEY), false);
    writeFlag(local, BACKUP_TOAST_DISMISSED_KEY);
    assert.equal(local.getItem('draftline_backup_toast_dismissed'), 'true');
    assert.equal(readFlag(local, BACKUP_TOAST_DISMISSED_KEY), true);
  });
  it('last backups: draftline_last_backups = { projectId: ms }, kept per project', () => {
    assert.equal(LAST_BACKUPS_KEY, 'draftline_last_backups');
    const local = memoryStorage();
    assert.deepEqual(readLastBackups(local), {});
    let map = recordBackup(local, 'p1', 100);
    map = recordBackup(local, 'p2', 200, map);
    assert.deepEqual(map, { p1: 100, p2: 200 });
    assert.deepEqual(readLastBackups(local), { p1: 100, p2: 200 });
    assert.deepEqual(recordBackup(local, null, 300, map), map, 'no id: nothing recorded');
    local.setItem(LAST_BACKUPS_KEY, 'not json');
    assert.deepEqual(readLastBackups(local), {});
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.deepEqual(recordBackup(blocked, 'p1', 5), { p1: 5 }, 'blocked storage: still known in memory');
  });
  it('blocked storage reads as unset and never throws', () => {
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.equal(readFlag(blocked, BACKUP_TOAST_SESSION_KEY), false);
    assert.doesNotThrow(() => writeFlag(blocked, BACKUP_TOAST_SESSION_KEY));
    assert.equal(readFlag(undefined, BACKUP_TOAST_SESSION_KEY), false);
  });
});

describe('Backup tip: the card', () => {
  const card = read('src/components/BackupToast.jsx');
  const css = read('src/components/BackupToast.css');
  const app = read('src/App.jsx');
  it('the wording: Chrome and Edge (Link Folder)', () => {
    assert.deepEqual(backupToastCopy({ supported: true, family: 'other' }), {
      heading: 'Keep your pages safe',
      message: 'Tip: Your script is only saved locally in this browser. Clearing history will delete your files. Link a computer folder in Projects to keep an automatic physical file backup on a hard drive or cloud drive of your choice.',
      action: 'Link Folder',
      extra: null,
      kind: 'link',
    });
  });
  it('the wording: Firefox and other browsers without folder linking (Backup Project)', () => {
    const c = backupToastCopy({ supported: false, family: 'firefox' });
    assert.equal(c.message, 'Tip: Your script is only saved locally in this browser. Clearing history will delete your files. Back it up now and then you can open the file again any time with File → Open.');
    assert.equal(c.action, 'Backup Project');
    assert.equal(c.extra, null);
    assert.equal(backupToastCopy({ supported: false, family: 'other' }).extra, null);
  });
  it('the wording: Safari adds Add to Dock (Mac) or Add to Home Screen (iPad, iPhone), unless already opened that way', () => {
    assert.equal(backupToastCopy({ supported: false, family: 'mac-safari' }).extra,
      'Adding DraftLine to your Dock (File → Add to Dock) also keeps Safari from clearing it after a week away.');
    assert.equal(backupToastCopy({ supported: false, family: 'ios' }).extra,
      'Adding DraftLine to your Home Screen (Share → Add to Home Screen) also keeps Safari from clearing it after a week away.');
    assert.equal(backupToastCopy({ supported: false, family: 'mac-safari', standalone: true }).extra, null);
    assert.equal(backupToastCopy({ supported: false, family: 'ios', standalone: true }).extra, null);
  });
  it('a line icon (no emoji), ✕, the main button, Dismiss and Don’t show again', () => {
    assert.match(card, /<HardDrive size=\{15\} strokeWidth=\{1\.75\} aria-hidden/);
    assert.doesNotMatch(card + JSON.stringify(BACKUP_TOAST), /💾/);
    assert.match(card, /className="btn btn-icon bk-close" onClick=\{onDismiss\} aria-label="Close"/);
    assert.match(card, /onClick=\{onAction\}>\{copy\.action\}<\/button>/);
    assert.match(card, /\{copy\.extra && <p className="bk-msg bk-extra">\{copy\.extra\}<\/p>\}/);
    assert.match(card, /onClick=\{onDismiss\}>Dismiss<\/button>/);
    assert.match(card, /onClick=\{onNever\}>Don’t show again<\/button>/);
  });
  it('non-blocking: a status region that never takes focus, bottom-right above the status bar, zinc surface', () => {
    assert.match(card, /<aside className="bk-toast" role="status"/);
    assert.doesNotMatch(card, /autoFocus|\.focus\(|<dialog/);
    assert.match(css, /\.bk-toast \{[^}]*position: fixed;[^}]*right: 18px;[^}]*bottom: calc\(var\(--status-h\) \+ 14px\);/);
    assert.match(css, /\.bk-toast \{[^}]*border: 1px solid #3f3f46;[^}]*background: #18181b;/);
  });
  it('the app: page count and words, the status state, and Link Folder → Projects on the Linked Folder card', () => {
    assert.match(app, /pages: layout\.pageCount,\s*words: analysis\.words,\s*state: saveStatus\.state,\s*supported: sync\.supported,/);
    assert.match(app, /onAction=\{\(\) => \{\s*closeBackupTip\(\);\s*if \(sync\.supported\) openStorage\('folder'\);\s*else backupProject\(\);\s*\}\}/);
    assert.match(app, /lastBackupAt: lastBackups\[projectId\] \?\? null,\s*savedAt: saved\.at \?\? null,/);
    assert.match(app, /setLastBackups\(\(cur\) => recordBackup\(globalThis\.localStorage, rec\.id, Date\.now\(\), cur\)\);/);
    assert.match(app, /onNever=\{\(\) => closeBackupTip\(true\)\}/);
    assert.match(app, /if \(forever\) writeFlag\(globalThis\.localStorage, BACKUP_TOAST_DISMISSED_KEY\);/);
  });
});

describe('Backup tip: which browser', () => {
  const UA = {
    chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
    chromeAndroid: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  };
  it('Chrome, Edge and Android Chrome are "other"; Firefox is "firefox"', () => {
    for (const k of ['chromeWin', 'edge', 'chromeMac', 'chromeAndroid']) assert.equal(browserFamily(UA[k]), 'other', k);
    assert.equal(browserFamily(UA.firefox), 'firefox');
    assert.equal(browserFamily(UA.firefoxAndroid), 'firefox');
  });
  it('Safari on a Mac is "mac-safari"; iPhone and iPad (any browser) are "ios"', () => {
    assert.equal(browserFamily(UA.safariMac), 'mac-safari');
    assert.equal(browserFamily(UA.iphone), 'ios');
    assert.equal(browserFamily(UA.chromeIos), 'ios');
    assert.equal(browserFamily(UA.safariMac, { maxTouchPoints: 5 }), 'ios', 'iPadOS reports a Mac with a touch screen');
  });
});

describe('Protected storage request', () => {
  const fakeStorage = (persisted = false, grant = true) => {
    const calls = { persist: 0 };
    return {
      calls,
      persisted: async () => persisted,
      persist: async () => {
        calls.persist += 1;
        return grant;
      },
    };
  };
  it('Chrome, Edge, Safari: asked quietly, no click needed', async () => {
    const st = fakeStorage();
    assert.equal(await requestPersistence({ storage: st, family: 'other' }), true);
    assert.equal(st.calls.persist, 1);
    assert.equal(await requestPersistence({ storage: fakeStorage(false, false), family: 'mac-safari' }), false);
  });
  it('already protected: not asked again', async () => {
    const st = fakeStorage(true);
    assert.equal(await requestPersistence({ storage: st }), true);
    assert.equal(st.calls.persist, 0);
  });
  it('Firefox: only from a Backup Project click, and only once', async () => {
    const st = fakeStorage();
    const local = memoryStorage();
    assert.equal(await requestPersistence({ storage: st, family: 'firefox', local }), null, 'no click: not asked');
    assert.equal(st.calls.persist, 0);
    assert.equal(await requestPersistence({ storage: st, family: 'firefox', fromClick: true, local }), true);
    assert.equal(local.getItem(PERSIST_ASKED_KEY), 'true');
    assert.equal(await requestPersistence({ storage: st, family: 'firefox', fromClick: true, local }), null, 'asked once');
    assert.equal(st.calls.persist, 1);
  });
  it('no support, or an error: null, never throws', async () => {
    assert.equal(await requestPersistence({ storage: undefined }), null);
    assert.equal(await requestPersistence({ storage: { persisted: async () => { throw new Error('x'); }, persist: async () => true } }), null);
  });
  it('the app: asked after a save with words in it, and from Backup Project', () => {
    const app = read('src/App.jsx');
    assert.match(app, /if \(persistAsked\.current \|\| !saved\.ok \|\| !saved\.at \|\| analysis\.words === 0\) return;/);
    assert.match(app, /const backupProject = async \(\) => \{\s*\/\/[^\n]*\n\s*requestPersistence\(\{ family: BROWSER_FAMILY, fromClick: true, local: globalThis\.localStorage \}\);/);
  });
});
