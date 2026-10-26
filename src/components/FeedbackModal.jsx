import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DETAILS_MAX, FEATURE_MAX, PREVIOUS_APPS, sendFeedback } from '../lib/feedback.js';
import './FeedbackModal.css';

/**
 * ⋮ → Send Feedback…: three questions and Send. Esc, ✕, Cancel or a click outside closes it.
 * On success the app closes it and thanks the writer; on failure it stays open (nothing typed is lost)
 * and the app says so. What's sent is in lib/feedback.js.
 */
export default function FeedbackModal({ onClose, onSent, onFailed, send = sendFeedback }) {
  const dialogRef = useRef(null);
  const featureRef = useRef(null);
  const [previousApp, setPreviousApp] = useState(null);
  const [missingFeature, setMissingFeature] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const canSend = missingFeature.trim().length > 0 && !busy;

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    featureRef.current?.focus();
  }, []);

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    const ok = await send({ previousApp, missingFeature, details });
    setBusy(false);
    if (ok) onSent();
    else onFailed();
  };

  return (
    <dialog
      ref={dialogRef}
      className="afb-modal"
      aria-labelledby="afb-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) close();
      }}
    >
      <form onSubmit={submit}>
        <header className="afb-head">
          <h2 id="afb-title">Share Anonymous Feedback</h2>
          <button type="button" className="btn btn-icon afb-close" onClick={close} aria-label="Close" title="Close (Esc)">
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        <div className="afb-body">
          <div className="afb-field">
            <span className="afb-label" id="afb-prev">I previously used:</span>
            <div className="afb-pills" role="radiogroup" aria-labelledby="afb-prev">
              {PREVIOUS_APPS.map((app) => (
                <button
                  key={app}
                  type="button"
                  role="radio"
                  aria-checked={previousApp === app}
                  className={`afb-pill${previousApp === app ? ' is-on' : ''}`}
                  onClick={() => setPreviousApp((cur) => (cur === app ? null : app))}
                >
                  {app}
                </button>
              ))}
            </div>
          </div>

          <label className="afb-field">
            <span className="afb-label">What missing feature is keeping you from using DraftLine daily?</span>
            <input
              ref={featureRef}
              className="afb-input"
              value={missingFeature}
              onChange={(e) => setMissingFeature(e.target.value)}
              maxLength={FEATURE_MAX}
              required
              aria-required="true"
              placeholder="e.g. Revision colours, an iPad app…"
            />
          </label>

          <label className="afb-field">
            <span className="afb-label">Additional details or bug notes <span className="afb-optional">(optional)</span></span>
            <textarea
              className="afb-input afb-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={DETAILS_MAX}
              rows={4}
            />
          </label>
        </div>

        <footer className="afb-foot">
          <p className="afb-notice">No cookies, accounts, or IP addresses collected.</p>
          <div className="afb-actions">
            <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
            <button type="submit" className="btn afb-send" disabled={!canSend}>{busy ? 'Sending…' : 'Send Feedback'}</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
