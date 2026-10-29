import { HardDrive, X } from 'lucide-react';
import './BackupToast.css';

/**
 * The backup tip (lib/backupToast.js decides when, and backupToastCopy() the wording): a corner card
 * above the status bar. It never takes focus, so typing carries on underneath. The main button is
 * Link Folder (opens Projects on the Linked Folder card) or Backup Project (downloads a .draftline);
 * Dismiss and ✕ close it for this session; Don't show again closes it for good.
 */
export default function BackupToast({ copy, onAction, onDismiss, onNever }) {
  return (
    <aside className="bk-toast" role="status" aria-labelledby="bk-title">
      <div className="bk-head">
        <HardDrive size={15} strokeWidth={1.75} aria-hidden className="bk-icon" />
        <h2 id="bk-title">{copy.heading}</h2>
        <button type="button" className="btn btn-icon bk-close" onClick={onDismiss} aria-label="Close" title="Close">
          <X size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <p className="bk-msg">{copy.message}</p>
      {copy.extra && <p className="bk-msg bk-extra">{copy.extra}</p>}
      <div className="bk-actions">
        <button type="button" className="btn bk-link" onClick={onAction}>{copy.action}</button>
        <button type="button" className="btn" onClick={onDismiss}>Dismiss</button>
        <button type="button" className="btn bk-never" onClick={onNever}>Don’t show again</button>
      </div>
    </aside>
  );
}
