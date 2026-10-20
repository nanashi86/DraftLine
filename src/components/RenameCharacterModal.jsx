import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CATEGORIES, RENAME_CATEGORIES, renameCharacter, renamePreview } from '../lib/renameCharacter.js';
import './RenameCharacterModal.css';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Rename a character everywhere, after a review: each category shows how many changes it
 * makes (with a few examples) and can be switched off. Confirming is one undoable step.
 */
export default function RenameCharacterModal({ oldName, project, speakers = [], onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [newName, setNewName] = useState('');
  const [on, setOn] = useState({ ...ALL_CATEGORIES });
  const typed = useDeferredValue(newName);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    inputRef.current?.focus(); // showModal focuses the first field (the read-only one)
  }, []);

  const { counts } = useMemo(() => renameCharacter(project, oldName, typed), [project, oldName, typed]);
  const preview = useMemo(() => renamePreview(project, oldName, typed), [project, oldName, typed]);
  const total = RENAME_CATEGORIES.reduce((t, c) => t + (on[c.id] ? counts[c.id] : 0), 0);
  const target = newName.trim().replace(/\s+/g, ' ');
  const sameName = target.toUpperCase() === oldName.trim().toUpperCase() && target === oldName.trim();
  const merges = target && target.toUpperCase() !== oldName.trim().toUpperCase()
    && speakers.some((s) => s.toUpperCase() === target.toUpperCase());

  const submit = (e) => {
    e.preventDefault();
    if (!target || !total || sameName) return;
    onConfirm(target, on);
  };

  return (
    <dialog
      ref={dialogRef}
      className="rn-modal"
      aria-labelledby="rn-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={submit}>
        <header className="rn-head">
          <h2 id="rn-title">Rename character</h2>
          <p className="rn-sub">Review what changes, switch off anything you want left alone. Ctrl+Z undoes it all at once.</p>
        </header>

        <div className="rn-names">
          <label className="rn-field">
            <span>From</span>
            <input value={oldName} readOnly tabIndex={-1} />
          </label>
          <span className="rn-arrow" aria-hidden="true">→</span>
          <label className="rn-field">
            <span>To</span>
            <input
              ref={inputRef}
              value={newName}
              placeholder="New name"
              onChange={(e) => setNewName(e.target.value)}
              aria-describedby={merges ? 'rn-merge' : undefined}
            />
          </label>
        </div>
        {merges && (
          <p id="rn-merge" className="rn-warn" role="note">
            {target.toUpperCase()} already speaks in this script — renamed cues will join that character in Dialogue.
          </p>
        )}

        <ul className="rn-cats">
          {RENAME_CATEGORIES.map((c) => {
            const n = counts[c.id];
            const examples = preview[c.id];
            return (
              <li key={c.id} className={`rn-cat${n ? '' : ' is-empty'}`}>
                <label className="rn-check">
                  <input
                    type="checkbox"
                    checked={on[c.id] && n > 0}
                    disabled={!n}
                    onChange={(e) => setOn((s) => ({ ...s, [c.id]: e.target.checked }))}
                  />
                  <span className="rn-cat-text">
                    <b>{c.label}</b>
                    <small>{c.hint}</small>
                  </span>
                  <span className="rn-count" aria-label={`${n} changes`}>{target ? n : '–'}</span>
                </label>
                {target && on[c.id] && examples.length > 0 && (
                  <ul className="rn-examples">
                    {examples.map((ex, i) => (
                      <li key={i}>
                        <span className="rn-before">{ex.before}</span>
                        <span className="rn-after">{ex.after}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <footer className="rn-foot">
          <span className="rn-total" aria-live="polite">
            {!target ? 'Type the new name.' : total ? `${plural(total, 'change')} will be made.` : 'Nothing to change.'}
          </span>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!target || !total || sameName}>
            Rename{total ? ` (${total})` : ''}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
