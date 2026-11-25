import { useEffect, useRef, useState } from 'react';
import { TOTAL_LABEL, exportBudgetPdf } from '../lib/budgetExport.js';
import { money } from '../lib/budgetUi.js';
import './ExportBibleModal.css';

const KINDS = [
  { id: 'summary', label: 'Summary', hint: 'About a page: totals by category, contingency, fees and taxes, and what’s still missing' },
  { id: 'detailed', label: 'Detailed', hint: 'The summary, then every item with its method, basis, rate and amount, and calculation notes' },
];

/**
 * Export → Budget (PDF)…: Summary or Detailed, then the print dialog (Save as PDF suggests
 * "<Title> - Budget Summary.pdf" or "<Title> - Budget.pdf"). Shows the total it will print, in the
 * Budget's own words. Reads the project as it was when chosen; writes nothing.
 *   data: { production, model, meta } (lib/budgetExport.js budgetForExport)
 */
export default function ExportBudgetModal({ data, onClose }) {
  const dialogRef = useRef(null);
  const [kind, setKind] = useState('detailed');
  const locale = globalThis.navigator?.language || 'en-US';
  const m = data.model;

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    onClose();
    exportBudgetPdf({ production: data.production, model: m, meta: data.meta, kind, locale });
  };

  return (
    <dialog
      ref={dialogRef}
      className="eb-modal"
      aria-labelledby="ebud-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="ebud-title">Export Budget (PDF)</h2>
        <p className="eb-sub">
          {TOTAL_LABEL[m.status]} <b>{money(m.totals.total, m.currency, locale)}</b>
          {m.status === 'incomplete' ? ' · not a full budget yet' : m.status === 'estimated' ? ' · includes estimates' : ''}
          {' '}· Choose <b>Save as PDF</b> in the print dialog, on A4 or Letter paper.
        </p>
        <fieldset className="eb-options">
          <legend className="eb-legend">Report</legend>
          {KINDS.map((k) => (
            <label key={k.id} className={`eb-option${kind === k.id ? ' is-on' : ''}`}>
              <input type="radio" name="budget-report" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} />
              <span className="eb-text">
                <span className="eb-label">{k.label}</span>
                <span className="eb-summary">{k.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="eb-actions">
          <button type="button" className="btn eb-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary eb-export">Export PDF</button>
        </div>
      </form>
    </dialog>
  );
}
