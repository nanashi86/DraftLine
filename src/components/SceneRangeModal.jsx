import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatPageTargets, parseSceneRanges, rangesFromPageTargets, structureFor, validateSceneRanges,
} from '../lib/beats.js';
import './SceneRangeModal.css';

/**
 * "Assign by Scene Ranges…": one range input per visible act column — three in 3-Act
 * view (Act 1 · Act 2 · Act 3), four in 4-Act view (Act 1 · 2A · 2B · Act 3). Starts from
 * the page-target placement; Apply is enabled once every scene is in exactly one act.
 */
export default function SceneRangeModal({ mode, scenes, pageCount, onApply, onClose }) {
  const dialogRef = useRef(null);
  const cols = structureFor(mode);
  const defaults = useMemo(() => rangesFromPageTargets(scenes, mode, pageCount), [scenes, mode, pageCount]);
  const [inputs, setInputs] = useState(defaults);
  const check = validateSceneRanges(inputs, scenes.length, mode);
  const byNumber = useMemo(() => new Map(scenes.map((s) => [s.number, s])), [scenes]);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  /** "4 scenes · pp. 1–27" for one row. */
  const rowInfo = (input) => {
    const { numbers, error } = parseSceneRanges(input);
    if (error) return null;
    const pages = numbers.map((n) => byNumber.get(n)?.page).filter(Boolean);
    if (!numbers.length) return 'No scenes';
    const pp = pages.length ? ` · pp. ${Math.min(...pages)}–${Math.max(...pages)}` : '';
    return `${numbers.length} ${numbers.length === 1 ? 'scene' : 'scenes'}${pp}`;
  };

  return (
    <dialog
      ref={dialogRef}
      className="sr-modal"
      aria-labelledby="sr-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (check.ok) onApply(inputs);
        }}
      >
        <header className="sr-head">
          <h2 id="sr-title">Assign by Scene Ranges</h2>
          <p>
            {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'} · {pageCount} {pageCount === 1 ? 'page' : 'pages'} ·{' '}
            {mode} Acts ({formatPageTargets(mode, pageCount)}). Enter scene numbers per act — ranges and lists like <code>1-12, 15</code>.
          </p>
        </header>

        <div className="sr-rows">
          {cols.map((c, i) => (
            <label key={c.label} className="sr-row">
              <span className="sr-act">
                <b>{c.label}</b>
                <span>{c.name}</span>
              </span>
              <input
                value={inputs[i] ?? ''}
                autoFocus={i === 0}
                spellCheck={false}
                placeholder="e.g. 1-12"
                onChange={(e) => setInputs((v) => v.map((x, k) => (k === i ? e.target.value : x)))}
                aria-label={`${c.label} scenes`}
              />
              <span className="sr-info">{rowInfo(inputs[i])}</span>
            </label>
          ))}
        </div>

        <div className={`sr-check${check.ok ? ' is-ok' : ''}`} role="status" aria-live="polite">
          {check.ok
            ? `All ${scenes.length} scenes accounted for.`
            : check.errors.map((e) => <div key={e}>{e}</div>)}
        </div>

        <footer className="sr-foot">
          <button type="button" className="btn sr-reset" onClick={() => setInputs(defaults)} title={formatPageTargets(mode, pageCount)}>
            Reset to page targets
          </button>
          <span className="sr-spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!check.ok}>Apply</button>
        </footer>
      </form>
    </dialog>
  );
}
