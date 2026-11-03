import { useEffect, useRef } from 'react';
import { UI_THEMES } from '../lib/userSettings.js';
import { CANVAS_THEMES } from '../lib/canvasTheme.js';
import StorageDestination from './StorageDestination.jsx';
import './SettingsModal.css';

/** One choice in a two-up radio row, with a little swatch of what it looks like. */
function Choice({ name, id, label, hint, checked, onPick }) {
  return (
    <label className={`st-choice${checked ? ' is-on' : ''}`}>
      <input type="radio" name={name} value={id} checked={checked} onChange={() => onPick(id)} />
      <span className={`st-swatch is-${id}`} aria-hidden="true" />
      <span className="st-choice-text"><b>{label}</b><small>{hint}</small></span>
    </label>
  );
}

const PAGE_HINTS = { paper: 'Ivory, black ink', midnight: 'Dark page, light ink' };

/**
 * Settings (⋮ → Settings…): Appearance (interface theme and page colour, set independently), Storage &
 * Backup (Storage Destination, moved here from Projects: the same component, the same App handlers), and
 * Drafting. `focus` ('storage' | 'folder') opens it on the storage block, as the status bar's save status
 * and the backup tip do — 'folder' lands on the Linked Folder card with its Link Folder… / Allow access
 * button focused.
 */
export default function SettingsModal({ settings, onChange, canvas, onCanvas, storage, focus = null, tips, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    if (!focus) return undefined;
    const f = requestAnimationFrame(() => {
      const sd = dialogRef.current?.querySelector('.sd');
      const card = focus === 'folder' ? sd?.querySelector('.sd-card-folder') : null;
      (card || sd)?.scrollIntoView({ block: card ? 'center' : 'start' });
      (card?.querySelector('.sd-buttons .btn') || sd?.querySelector('input:checked'))?.focus();
    });
    return () => cancelAnimationFrame(f);
  }, [focus]);

  return (
    <dialog
      ref={dialogRef}
      className="st-modal"
      aria-labelledby="st-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="st-head">
        <h2 id="st-title">Settings</h2>
        <button type="button" className="btn" onClick={onClose}>Done</button>
      </header>

      <div className="st-body">
        <section className="st-section" aria-labelledby="st-appearance">
          <h3 id="st-appearance" className="micro-label">Appearance</h3>
          <div className="st-row" role="radiogroup" aria-label="Interface theme">
            {UI_THEMES.map((t) => (
              <Choice key={t.id} name="st-theme" {...t} checked={settings.theme === t.id} onPick={(theme) => onChange({ theme })} />
            ))}
          </div>
          <div className="st-row" role="radiogroup" aria-label="Page colour">
            {CANVAS_THEMES.map((t) => (
              <Choice key={t.id} name="st-page" id={t.id} label={`${t.label} page`} hint={PAGE_HINTS[t.id]} checked={canvas === t.id} onPick={onCanvas} />
            ))}
          </div>
          <p className="st-note">The interface and the page are set separately. Printing and PDFs are always black on white.</p>
        </section>

        {storage && (
          <section className="st-section st-storage">
            <StorageDestination sync={storage.sync} onChoose={storage.onChoose} onLink={storage.onLink} onDisconnect={storage.onDisconnect} onAllow={storage.onAllow} />
          </section>
        )}

        <section className="st-section" aria-labelledby="st-drafting">
          <h3 id="st-drafting" className="micro-label">Drafting</h3>
          <label className="st-toggle">
            <input type="checkbox" checked={settings.showCounts} onChange={(e) => onChange({ showCounts: e.target.checked })} />
            <span><b>Scene and word counts</b><small>In the status bar, beside the page count</small></span>
          </label>
          {tips && (
            <div className="st-tips">
              <span><b>Tips</b><small>{tips.finished} of {tips.total} seen · each shows once, then stays out of your way</small></span>
              <button type="button" className="btn btn-outline" disabled={tips.finished === 0} onClick={tips.onReset}>Show tips again</button>
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
}
