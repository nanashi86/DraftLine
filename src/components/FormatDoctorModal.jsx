import { useEffect, useRef } from 'react';
import { BookOpen } from 'lucide-react';
import { ELEMENT_META } from '../lib/screenplay.js';
import { HEADING_TIMES, ISSUE_KINDS, canFix, canFixAll, findingPreview, withTime } from '../lib/formatDoctor.js';
import Select from './Select.jsx';
import { FORMAT_TERM_FOR_ISSUE } from '../lib/structureDictionary.js';
import './FormatDoctorModal.css';

const typeLabel = (t) => (t ? ELEMENT_META[t].label : 'Removed');

/**
 * Lists the Format Doctor's findings. Each can be fixed on its own or all at once;
 * every fix is a normal edit, so Ctrl+Z undoes it. A finding's chip opens the Glossary's Screenplay
 * Format term behind it (onTerm), when there is one.
 */
const TIME_OPTIONS = HEADING_TIMES.map((t) => ({ value: t, label: t }));

/**
 * Lists the Format Doctor's findings. Each can be fixed on its own or all at once;
 * every fix is a normal edit, so Ctrl+Z undoes it. A finding's chip opens the Glossary's Screenplay
 * Format term behind it (onTerm), when there is one. A fix that needs the writer's call (Missing
 * time of day) is a DAY / NIGHT / … picker on its row, plus "Add to all" for the group (onFixGroup);
 * Fix All leaves those alone.
 */
export default function FormatDoctorModal({ issues, pageOfBlock, onFix, onFixAll, onFixGroup, onIgnore, onShow, onClose, onTerm = null, supportFooter = null }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const counts = issues.reduce((m, it) => ({ ...m, [it.kind]: (m[it.kind] || 0) + 1 }), {});
  const fixable = issues.filter((it) => canFixAll(it.kind)).length; // what Fix All will do (no time-of-day guesses)
  const choosing = issues.filter((it) => ISSUE_KINDS[it.kind].choose); // findings that need your call
  const fixAllTitle = fixable
    ? `Fix the ${fixable} ${fixable === 1 ? 'finding' : 'findings'} with one right answer${choosing.length ? `; ${choosing.length} missing a time of day ${choosing.length === 1 ? 'needs' : 'need'} your pick` : ''} · a snapshot is saved first`
    : choosing.length ? 'Missing time of day needs your call: pick a time on each row, or Add to all' : undefined;

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
          <button type="button" className="btn btn-primary" disabled={!fixable} onClick={onFixAll} title={fixAllTitle}>
            Fix All{fixable ? ` (${fixable})` : ''}
          </button>
        </div>
      </header>

      {issues.length > 0 && (
        <div className="fd-chips">
          {Object.entries(ISSUE_KINDS).filter(([k]) => counts[k]).map(([k, v]) => {
            const term = onTerm && FORMAT_TERM_FOR_ISSUE[k];
            return term ? (
              <button
                key={k}
                type="button"
                className={`fd-chip fd-k-${k} is-term`}
                onClick={() => onTerm(term)}
                title="What does this mean? Open the term in the Glossary"
              >
                {v.label} <b>{counts[k]}</b>
                <BookOpen size={12} strokeWidth={1.75} aria-hidden className="fd-chip-term" />
              </button>
            ) : (
              <span key={k} className={`fd-chip fd-k-${k}`}>{v.label} <b>{counts[k]}</b></span>
            );
          })}
          {onFixGroup && choosing.length > 1 && (
            <Select
              className="fd-time fd-time-all"
              value=""
              placeholder={`Add to all ${choosing.length}…`}
              options={TIME_OPTIONS}
              onChange={(t) => onFixGroup(choosing.map((it) => withTime(it, t)))}
              ariaLabel={`Add a time of day to all ${choosing.length} headings missing one`}
              title={`Add the same time of day to all ${choosing.length} headings · Ctrl+Z undoes`}
            />
          )}
        </div>
      )}

      <ol className="fd-list">
        {issues.length === 0 && (
          <li className="fd-clean">
            <span className="fd-check" aria-hidden="true">✓</span>
            No unclassified or badly formatted sluglines, stray or orphaned cues and parentheticals, untagged or run-in format cues, false or orphaned dialogue, lowercase character introductions, double blank lines, misaligned endings or empty lines.
          </li>
        )}
        {/* App passes this only for a clean report, at most every 30 days (lib/supportTips.js). */}
        {issues.length === 0 && supportFooter && <li className="fd-support-row">{supportFooter}</li>}
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
                {kind.choose ? (
                  <Select
                    className="fd-time"
                    value=""
                    placeholder={`${kind.verb}…`}
                    options={TIME_OPTIONS}
                    onChange={(t) => onFix(withTime(it, t))}
                    ariaLabel={`Add a time of day to ${findingPreview(it)}`}
                    title={kind.fix}
                  />
                ) : canFix(it.kind) && (
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
