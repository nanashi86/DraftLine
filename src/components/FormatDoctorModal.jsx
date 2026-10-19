import { useEffect, useRef } from 'react';
import { ELEMENT_META } from '../lib/screenplay.js';
import { ISSUE_KINDS } from '../lib/formatDoctor.js';
import './FormatDoctorModal.css';

const typeLabel = (t) => (t ? ELEMENT_META[t].label : 'Removed');

/**
 * Lists the Format Doctor's findings. Each can be fixed on its own or all at once;
 * every fix is a normal edit, so Ctrl+Z undoes it.
 */
export default function FormatDoctorModal({ issues, pageOfBlock, onFix, onFixAll, onShow, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const counts = issues.reduce((m, it) => ({ ...m, [it.kind]: (m[it.kind] || 0) + 1 }), {});

  return (
    <dialog
      ref={dialogRef}
      className="fd-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="fd-head">
        <div>
          <h2>Format Doctor</h2>
          <p className="fd-sub">
            {issues.length
              ? `${issues.length} ${issues.length === 1 ? 'element looks' : 'elements look'} mis-tagged. Review, then fix one at a time or all at once — Ctrl+Z undoes.`
              : 'Every element looks correctly tagged.'}
          </p>
        </div>
        <div className="fd-head-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" disabled={!issues.length} onClick={onFixAll}>
            Fix All{issues.length ? ` (${issues.length})` : ''}
          </button>
        </div>
      </header>

      {issues.length > 0 && (
        <div className="fd-chips">
          {Object.entries(ISSUE_KINDS).filter(([k]) => counts[k]).map(([k, v]) => (
            <span key={k} className={`fd-chip fd-k-${k}`}>{v.label} <b>{counts[k]}</b></span>
          ))}
        </div>
      )}

      <ol className="fd-list">
        {issues.length === 0 && (
          <li className="fd-clean">
            <span className="fd-check" aria-hidden="true">✓</span>
            No unclassified sluglines, stray character cues, untagged or run-in format cues, false or orphaned dialogue, misaligned endings or empty lines.
          </li>
        )}
        {issues.map((it) => (
          <li key={it.id} className="fd-row">
            <span className={`fd-kind fd-k-${it.kind}`}>{ISSUE_KINDS[it.kind].label}</span>
            <span className="fd-page">p.{pageOfBlock[it.id] ?? '–'}</span>
            <span className="fd-text">{it.text.trim() ? it.text.trim().split('\n')[0] : '(empty line)'}</span>
            <span className="fd-change">
              {typeLabel(it.from)} <span aria-hidden="true">→</span> <b>{typeLabel(it.to)}</b>
            </span>
            <span className="fd-actions">
              <button type="button" className="btn" onClick={() => onShow(it.id)}>Show</button>
              <button type="button" className="btn btn-outline" onClick={() => onFix(it)} title={ISSUE_KINDS[it.kind].fix}>
                {ISSUE_KINDS[it.kind].fix}
              </button>
            </span>
          </li>
        ))}
      </ol>
    </dialog>
  );
}
