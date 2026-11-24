import { useEffect, useRef, useState } from 'react';
import Select from '../Select.jsx';
import { CATEGORIES, needText, sceneNeeds } from '../../lib/elements.js';
import '../SceneRangeModal.css';

/**
 * Plan → "… no longer attached · Review": breakdowns whose scene heading left the script (deleted,
 * merged into the scene above, turned into Action). Nothing here is ever deleted on its own: for each
 * one the writer sees what it held, and either attaches it to a scene (its items join that scene's) or
 * removes it. Both are ordinary undo steps (Ctrl+Z). If the heading comes back (undo in Write), the
 * breakdown is attached again by itself and leaves this list.
 *   items:   unattachedScenes() → [{ id, entry }]
 *   scenes:  the script's scenes, [{ id, number, heading }], for "Attach to"
 */
export default function UnattachedModal({ items, scenes, elements = {}, onAttach, onRemove, onClose, returnFocus = null }) {
  const dialogRef = useRef(null);
  const [target, setTarget] = useState({});
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);
  useEffect(() => {
    if (!items.length) onClose();
  }, [items.length, onClose]);
  const options = [
    { value: '', label: 'Choose a scene…' },
    ...scenes.map((s) => ({ value: s.id, label: `${s.number}. ${s.heading}` })),
  ];
  return (
    <dialog
      ref={dialogRef}
      className="sr-modal un-modal"
      aria-labelledby="un-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <header className="sr-head">
        <h2 id="un-title">Breakdowns no longer attached</h2>
        <p>
          These scenes’ headings are no longer in the script (deleted, merged into another scene, or turned into Action).
          Their breakdowns are kept. Attach each to a scene, or remove it. Ctrl+Z undoes either.
        </p>
      </header>
      <ul className="un-list">
        {items.map(({ id, entry }) => {
          const needs = sceneNeeds(entry, elements);
          const lists = CATEGORIES.filter((c) => needs[c.id].length);
          return (
            <li key={id} className="un-item">
              <dl className="un-what">
                {lists.map((c) => (
                  <div key={c.id}>
                    <dt>{c.label}</dt>
                    <dd>{needs[c.id].map(needText).join(' · ')}</dd>
                  </div>
                ))}
                {entry.notes?.trim() && (
                  <div>
                    <dt>Production Notes</dt>
                    <dd className="un-notes">{entry.notes.trim()}</dd>
                  </div>
                )}
                {!lists.length && !entry.notes?.trim() && <div><dd>Details saved by a newer version of DraftLine.</dd></div>}
              </dl>
              <div className="un-actions">
                <Select
                  className="un-select"
                  ariaLabel="Attach to scene"
                  value={target[id] || ''}
                  options={options}
                  onChange={(v) => setTarget((t) => ({ ...t, [id]: v }))}
                />
                <button type="button" className="btn btn-primary" disabled={!target[id]} onClick={() => onAttach(id, target[id])}>Attach</button>
                <button type="button" className="btn" onClick={() => onRemove(id)}>Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="sr-foot">
        <span className="sr-spacer" />
        <button type="button" className="btn" onClick={onClose} autoFocus>Close</button>
      </footer>
    </dialog>
  );
}
