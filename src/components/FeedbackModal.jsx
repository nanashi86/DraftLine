import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  DETAILS_MAX, EMAIL_MAX, FEATURE_MAX, FOUND_VIA, PREVIOUS_APPS, WRITES_ON, sendFeedback,
} from '../lib/feedback.js';
import './FeedbackModal.css';

/**
 * One question answered with pills: pick one, pick it again to clear it.
 */
function PillGroup({ id, label, options, value, onChange }) {
  return (
    <div className="afb-field">
      <span className="afb-label" id={id}>{label}</span>
      <div className="afb-pills" role="radiogroup" aria-labelledby={id}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={value === opt}
            className={`afb-pill${value === opt ? ' is-on' : ''}`}
            onClick={() => onChange((cur) => (cur === opt ? null : opt))}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * ⋮ → Send Feedback…: three pill questions, what's on your mind, details, an optional email, and Send. Esc, ✕, Cancel or a click outside closes it.
 * On success the app closes it and thanks the writer; on failure it stays open (nothing typed is lost)
 * and the app says so. What's sent is in lib/feedback.js.
 */
export default function FeedbackModal({ onClose, onSent, onFailed, send = sendFeedback }) {
  const dialogRef = useRef(null);
  const featureRef = useRef(null);
  const [foundVia, setFoundVia] = useState(null);
  const [writesOn, setWritesOn] = useState(null);
  const [previousApp, setPreviousApp] = useState(null);
  const [missingFeature, setMissingFeature] = useState('');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [canQuote, setCanQuote] = useState(false);
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
    const ok = await send({ foundVia, writesOn, previousApp, missingFeature, details, email, canQuote });
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
          <h2 id="afb-title">Share Feedback</h2>
          <button type="button" className="btn btn-icon afb-close" onClick={close} aria-label="Close" title="Close (Esc)">
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        <div className="afb-body">
          <PillGroup id="afb-found" label="How did you find DraftLine?" options={FOUND_VIA} value={foundVia} onChange={setFoundVia} />
          <PillGroup id="afb-writes" label="Where do you write?" options={WRITES_ON} value={writesOn} onChange={setWritesOn} />
          <PillGroup id="afb-prev" label="I previously used:" options={PREVIOUS_APPS} value={previousApp} onChange={setPreviousApp} />

          <label className="afb-field">
            <span className="afb-label">What’s on your mind?</span>
            <input
              ref={featureRef}
              className="afb-input"
              value={missingFeature}
              onChange={(e) => setMissingFeature(e.target.value)}
              maxLength={FEATURE_MAX}
              required
              aria-required="true"
              placeholder="A bug, an idea, a missing feature, or just what you think…"
            />
          </label>

          <label className="afb-field">
            <span className="afb-label">More details <span className="afb-optional">(optional)</span></span>
            <textarea
              className="afb-input afb-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={DETAILS_MAX}
              rows={3}
            />
          </label>

          <label className="afb-field">
            <span className="afb-label">Want a reply? <span className="afb-optional">(optional)</span></span>
            <input
              type="email"
              className="afb-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={EMAIL_MAX}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="afb-check">
            <input type="checkbox" checked={canQuote} onChange={(e) => setCanQuote(e.target.checked)} />
            <span>OK to quote me anonymously on the DraftLine site</span>
          </label>
        </div>

        <footer className="afb-foot">
          <p className="afb-notice">Anonymous unless you add your email. No cookies, accounts, or IP addresses collected.</p>
          <div className="afb-actions">
            <button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button>
            <button type="submit" className="btn afb-send" disabled={!canSend}>{busy ? 'Sending…' : 'Send Feedback'}</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
