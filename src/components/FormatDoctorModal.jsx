import { useEffect, useRef } from 'react';
import { ELEMENT_META } from '../lib/screenplay.js';
import { ISSUE_KINDS, canFix, findingPreview } from '../lib/formatDoctor.js';
import './FormatDoctorModal.css';

const typeLabel = (t) => (t ? ELEMENT_META[t].label : 'Removed');

/**
 * Lists the Format Doctor's findings. Each can be fixed on its own or all at once;
 * every fix is a normal edit, so Ctrl+Z undoes it.
 */
export default function FormatDoctorModal({ issues, pageOfBlock, onFix, onFixAll, onIgnore, onShow, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const counts = issues.reduce((m, it) => ({ ...m, [it.kind]: (m[it.kind] || 0) + 1 }), {});
  const fixable = issues.filter((it) => canFix(it.kind)).length;

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
              ? `${issues.length} ${issues.length === 1 ? 'finding' : 'findings'}. Review, then fix one at a time or all at once — Ctrl+Z undoes. Ignore hides one for this session.`
              : 'Every element looks correctly tagged and formatted.'}
          </p>
        </div>
        <div className="fd-head-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" disabled={!fixable} onClick={onFixAll}>
            Fix All{fixable ? ` (${fixable})` : ''}
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
            No unclassified or badly formatted sluglines, stray or orphaned cues and parentheticals, untagged or run-in format cues, false or orphaned dialogue, lowercase character introductions, double blank lines, misaligned endings or empty lines.
          </li>
        )}
        {issues.map((it) => {
          const kind = ISSUE_KINDS[it.kind];
          const change = it.from === it.to
            ? (canFix(it.kind) ? kind.fix : 'Yours to fix — Show it, then edit')
            : `${typeLabel(it.from)} → ${typeLabel(it.to)}`;
          return (
            <li key={`${it.id}:${it.kind}`} className="fd-row">
              <span className={`fd-kind fd-k-${it.kind}`} title={kind.label}>{kind.label}</span>
              <span className="fd-page">p.{pageOfBlock[it.id] ?? '–'}</span>
              <span className="fd-snippet">
                <span className="fd-text">{findingPreview(it)}</span>
                <span className="fd-change">{change}</span>
              </span>
              {/* One button each: the fix (short verb, the full change in its tooltip), Show, Ignore. */}
              <span className="fd-actions">
                {canFix(it.kind) && (
                  <button type="button" className="btn fd-fix" onClick={() => onFix(it)} title={kind.fix}>{kind.verb}</button>
                )}
                <button type="button" className="btn" onClick={() => onShow(it.id)} title="Jump to it in the script">Show</button>
                {onIgnore && <button type="button" className="btn" onClick={() => onIgnore(it)} title="Hide this finding for this session">Ignore</button>}
              </span>
            </li>
          );
        })}
      </ol>
    </dialog>
  );
}
