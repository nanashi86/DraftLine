import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BACKUP_TOAST, BACKUP_TOAST_DISMISSED_KEY, BACKUP_TOAST_PAGES, BACKUP_TOAST_SESSION_KEY, BACKUP_TOAST_WORDS, readFlag,
  shouldShowBackupToast, writeFlag,
} from '../src/lib/backupToast.js';

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
  it('not in a browser that can’t link a folder (its button would lead nowhere)', () => {
    assert.equal(shouldShowBackupToast({ pages: 40, supported: false }), false);
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
  it('the wording', () => {
    assert.equal(BACKUP_TOAST.heading, 'Keep your pages safe');
    assert.equal(BACKUP_TOAST.message, 'Tip: Your script is saved locally in this browser. Accidentally clearing your history will delete your files. Link a computer folder in Projects to keep an automatic physical file backup on your hard drive or cloud drive of your choice.');
  });
  it('a line icon (no emoji), ✕, Link Folder, Dismiss and Don’t show again', () => {
    assert.match(card, /<HardDrive size=\{15\} strokeWidth=\{1\.75\} aria-hidden/);
    assert.doesNotMatch(card + JSON.stringify(BACKUP_TOAST), /💾/);
    assert.match(card, /className="btn btn-icon bk-close" onClick=\{onDismiss\} aria-label="Close"/);
    assert.match(card, /onClick=\{onLink\}>Link Folder<\/button>/);
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
    assert.match(app, /onLink=\{\(\) => \{\s*closeBackupTip\(\);\s*openStorage\('folder'\);\s*\}\}/);
    assert.match(app, /onNever=\{\(\) => closeBackupTip\(true\)\}/);
    assert.match(app, /if \(forever\) writeFlag\(globalThis\.localStorage, BACKUP_TOAST_DISMISSED_KEY\);/);
  });
});
