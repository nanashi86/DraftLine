import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_SECTIONS, BIBLE_SECTIONS, anySelected, bibleSectionSummary, exportBible } from '../lib/biblePdfExport.js';
import './ExportBibleModal.css';

/**
 * Export → Story Bible (PDF)…: pick any of Story DNA, Story Notes and Character Bios (all on to
 * start; each says what it holds). Export PDF is disabled with none picked; it prints the chosen
 * sections as a formatted dossier from its own window, so Save as PDF suggests
 * "<Title> - Story Bible.pdf".
 *   project: { meta, storyDna, storyNotes, characters, actMode }
 */
export default function ExportBibleModal({ project, onClose }) {
  const dialogRef = useRef(null);
  const [sel, setSel] = useState(ALL_SECTIONS);
  const ok = anySelected(sel);
  const summary = useMemo(() => bibleSectionSummary(project), [project]);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    onClose();
    exportBible(project, sel);
  };

  return (
    <dialog
      ref={dialogRef}
      className="eb-modal"
      aria-labelledby="eb-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="eb-title">Export Story Bible (PDF)</h2>
        <p className="eb-sub">A formatted dossier: title page header, then each section on its own pages. Choose <b>Save as PDF</b> in the print dialog.</p>
        <fieldset className="eb-options">
          <legend className="eb-legend">Include</legend>
          {BIBLE_SECTIONS.map((s) => (
            <label key={s.id} className={`eb-option${sel[s.id] ? ' is-on' : ''}`}>
              <input type="checkbox" checked={!!sel[s.id]} onChange={(e) => setSel((x) => ({ ...x, [s.id]: e.target.checked }))} />
              <span className="eb-text">
                <span className="eb-label">{s.label} <span className="eb-hint">({s.hint})</span></span>
                {summary[s.id] && <span className="eb-summary">{summary[s.id]}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        {!ok && <p className="eb-warn" role="status">Pick at least one section to export.</p>}
        <div className="eb-actions">
          <button type="button" className="btn eb-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary eb-export" disabled={!ok}>Export PDF</button>
        </div>
      </form>
    </dialog>
  );
}
