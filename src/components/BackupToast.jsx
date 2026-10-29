import { HardDrive, X } from 'lucide-react';
import { BACKUP_TOAST } from '../lib/backupToast.js';
import './BackupToast.css';

/**
 * The backup tip (lib/backupToast.js decides when): a corner card above the status bar. It never
 * takes focus, so typing carries on underneath. Link Folder opens Projects on the Linked Folder card;
 * Dismiss and ✕ close it for this session; Don't show again closes it for good.
 */
export default function BackupToast({ onLink, onDismiss, onNever }) {
  return (
    <aside className="bk-toast" role="status" aria-labelledby="bk-title">
      <div className="bk-head">
        <HardDrive size={15} strokeWidth={1.75} aria-hidden className="bk-icon" />
        <h2 id="bk-title">{BACKUP_TOAST.heading}</h2>
        <button type="button" className="btn btn-icon bk-close" onClick={onDismiss} aria-label="Close" title="Close">
          <X size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <p className="bk-msg">{BACKUP_TOAST.message}</p>
      <div className="bk-actions">
        <button type="button" className="btn bk-link" onClick={onLink}>Link Folder</button>
        <button type="button" className="btn" onClick={onDismiss}>Dismiss</button>
        <button type="button" className="btn bk-never" onClick={onNever}>Don’t show again</button>
      </div>
    </aside>
  );
}
