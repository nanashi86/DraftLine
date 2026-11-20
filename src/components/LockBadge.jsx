import { lockBadge } from '../lib/lock.js';

/**
 * Status bar: Editing ⇄ Viewing (Ctrl+Alt+L). Muted while editable; warm amber when locked.
 * `newer`: a project saved by a newer DraftLine, always read-only here ("Read-only"; a click explains).
 */
export default function LockBadge({ locked, onToggle, newer = false }) {
  const base = lockBadge(locked || newer);
  const b = newer
    ? { ...base, label: 'Read-only', title: 'Saved by a newer version of DraftLine: read-only here. Reload or update DraftLine to edit it.' }
    : base;
  return (
    <button
      type="button"
      className={b.className}
      onClick={onToggle}
      title={b.title}
      aria-label={b.title}
      aria-pressed={locked || newer}
      data-locked={locked || newer ? 'true' : 'false'}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="2" y="5.5" width="8" height="5.5" rx="1.2" fill="currentColor" />
        <path d={locked ? 'M4 5.5V4a2 2 0 0 1 4 0v1.5' : 'M4 5.5V4a2 2 0 0 1 3.9-.6'} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span className="status-lock-label">{b.label}</span>
    </button>
  );
}
