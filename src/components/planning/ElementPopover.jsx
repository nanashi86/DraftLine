import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from '../Select.jsx';
import { CATEGORIES, LEGACY_LISTS, nameKey } from '../../lib/elements.js';
import { HIDDEN, useDismiss, useFloating, useFocusWhenPlaced } from './floating.js';

/**
 * Breakdowns → click an item: the shared element it stands for (lib/elements.js), in the shooting-day
 * card's style. Three parts, kept apart so it's clear what a change reaches:
 *   Element, every scene:  its name (Enter renames it everywhere) and category (moves it everywhere)
 *   In this scene:         this scene's own quantity and note (another scene's stay as they are)
 *   Used in:               the scenes that need it (tap one to go there) and their shooting days
 * then Separate here · Merge into… · Remove from scene · Delete everywhere…
 *
 * Confirming: a rename happens on Enter only ("Press Enter to rename" shows while the name differs);
 * quantity and note on Enter or on leaving the field. Esc closes and keeps nothing unconfirmed (an
 * open dropdown takes the first Esc); clicking outside closes, keeps quantity and note as leaving the
 * field would, and says so if a rename was left unconfirmed (ops.notice). Confirmed changes stay.
 *
 *   need:    the item, { id, name, category, from?, qty?, note? } (lib/elements.js sceneNeeds)
 *   sceneId, sceneNumber: the card it was opened from
 *   elements: the registry; usage: elementUsage(rows, schedule).get(id) (may be undefined)
 *   ops:     App's element operations (each one undo step): rename, reclassify, setNeed, separate,
 *            merge, remove, del — rename and merge return what stopped them ({ clashes } / { conflicts });
 *            notice(text) shows a toast
 *   onJump(sceneId): open that scene's card
 */
export default function ElementPopover({ need, sceneId, sceneNumber, anchor, elements, usage, ops, budget = null, onOpenBudget, onJump, onClose }) {
  const ref = useRef(null);
  const done = useRef(false); // closing: a field's late blur must not save anything
  const [name, setName] = useState(need.name);
  const [qty, setQty] = useState(need.qty !== undefined ? String(need.qty) : '');
  const [note, setNote] = useState(need.note || '');
  const [clash, setClash] = useState(null); // scene numbers where another element already has the new name
  const [moving, setMoving] = useState(null); // a category waiting for "Move it everywhere"
  const [merge, setMerge] = useState(null); // { into, conflicts, resolve }
  const [deleting, setDeleting] = useState(false);

  const scenes = usage?.scenes || [];
  const days = usage?.days || [];
  const shared = scenes.length > 1;
  const legacy = need.from ? LEGACY_LISTS.find((l) => l.id === need.from)?.label : null;
  const sameCategory = Object.values(elements || {}).filter((e) => e.category === need.category && e.id !== need.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const numbersOf = (sceneIds) => sceneIds.map((sid) => scenes.find((s) => s.sceneId === sid)?.number ?? '?');

  const cleanName = name.replace(/\s+/g, ' ').trim();
  const renamePending = !!cleanName && cleanName !== need.name && !clash;
  const commitName = () => {
    const clean = cleanName;
    if (!clean || clean === need.name) {
      setName(need.name);
      setClash(null);
      return;
    }
    const r = ops.rename(need.id, clean);
    if (r?.clashes?.length) setClash(numbersOf(r.clashes));
    else setClash(null);
  };
  const commitQty = () => {
    if (done.current) return;
    const t = qty.trim();
    const n = t === '' ? null : Number(t);
    if (t !== '' && !(Number.isInteger(n) && n > 0)) {
      setQty(need.qty !== undefined ? String(need.qty) : ''); // not a whole number above 0: as it was
      return;
    }
    if ((n ?? undefined) !== need.qty) ops.setNeed(sceneId, need.id, { qty: n });
  };
  const commitNote = () => {
    if (done.current) return;
    if (note.trim() !== (need.note || '')) ops.setNeed(sceneId, need.id, { note: note.trim() });
  };
  const chooseCategory = (cat) => {
    if (cat === need.category && !need.from) return;
    if (shared && cat !== need.category) setMoving(cat);
    else ops.reclassify(need.id, cat);
  };
  const startMerge = (into) => {
    const r = ops.merge(need.id, into, {});
    if (r?.conflicts?.length) setMerge({ into, conflicts: r.conflicts, resolve: {} });
    else if (r?.done) finish();
  };
  const finishMerge = () => {
    const r = ops.merge(need.id, merge.into, merge.resolve);
    if (r?.done) finish();
  };
  const notesMeet = merge ? scenes.some((s) => s.note) : false;
  const onEnter = (e, fn) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fn();
    }
  };
  const leave = (how) => {
    if (done.current) return;
    if (how === 'outside') {
      commitQty();
      commitNote();
      if (renamePending) ops.notice?.(`“${need.name}” wasn’t renamed: press Enter in its name to rename it`);
    }
    finish();
  };
  const finish = () => {
    done.current = true;
    onClose();
  };
  const pos = useFloating(anchor, ref, () => leave('outside'));
  useDismiss(ref, anchor, () => leave('outside'));
  useFocusWhenPlaced(ref, pos, '.el-pop-name');

  return createPortal(
    <div
      ref={ref}
      className="plan-pop el-pop"
      role="dialog"
      aria-label={`${need.name}, scene ${sceneNumber}`}
      style={pos || HIDDEN}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { // an open dropdown catches its own Esc first (Select.jsx)
          e.preventDefault();
          e.stopPropagation();
          leave('escape');
        }
      }}
    >
      <section className="el-pop-part" aria-label="The element, in every scene">
        <span className="plan-label">{shared ? `Element · all ${scenes.length} scenes` : 'Element'}</span>
        <div className="el-pop-row">
          <input
            className="el-pop-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setClash(null);
            }}
            onKeyDown={(e) => onEnter(e, commitName)}
            aria-label={shared ? 'Name (renames it in every scene)' : 'Name'}
          />
          <Select
            className="el-pop-cat"
            ariaLabel={shared ? 'Category (for every scene)' : 'Category'}
            value={need.category}
            options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
            onChange={chooseCategory}
          />
        </div>
        {renamePending && (
          <p className="el-pop-hint el-pop-pending" role="status">Press Enter to rename{shared ? ' in every scene' : ''} · Esc cancels</p>
        )}
        {legacy && (
          <p className="el-pop-hint">
            From the older “{legacy}” list, so it’s in {CATEGORIES.find((c) => c.id === need.category)?.label} until you choose.{' '}
            <button type="button" className="plan-clear" onClick={() => ops.reclassify(need.id, need.category)}>That’s right</button>
          </p>
        )}
        {clash && (
          <p className="el-pop-warn" role="status">
            Scene {clash.join(', ')} already {clash.length === 1 ? 'has' : 'have'} another “{name.trim()}”, so it wasn’t renamed. Merge them instead (below), or choose another name.
          </p>
        )}
        {moving && (
          <div className="el-pop-confirm" role="group" aria-label="Change category everywhere">
            <p>This moves it to {CATEGORIES.find((c) => c.id === moving)?.label} in all {scenes.length} scenes. For this scene only, use Separate here first.</p>
            <button type="button" className="btn" onClick={() => { ops.reclassify(need.id, moving); setMoving(null); }}>Move everywhere</button>
            <button type="button" className="btn" onClick={() => setMoving(null)}>Cancel</button>
          </div>
        )}
      </section>

      <section className="el-pop-part" aria-label={`In scene ${sceneNumber}`}>
        <span className="plan-label">In scene {sceneNumber}</span>
        <div className="el-pop-row">
          <label className="el-pop-qty">
            <span>Qty</span>
            <input type="text" inputMode="numeric" value={qty} placeholder="–" onChange={(e) => setQty(e.target.value)} onBlur={commitQty} onKeyDown={(e) => onEnter(e, commitQty)} aria-label="Quantity in this scene" />
          </label>
          <input className="el-pop-note" value={note} placeholder="Scene-specific note…" onChange={(e) => setNote(e.target.value)} onBlur={commitNote} onKeyDown={(e) => onEnter(e, commitNote)} aria-label="Note for this scene" />
        </div>
      </section>

      <section className="el-pop-part" aria-label="Where it’s used">
        <span className="plan-label">Used in</span>
        <div className="el-pop-uses">
          {scenes.length ? scenes.map((s) => (
            <button
              key={s.sceneId}
              type="button"
              className={`el-pop-scene${s.sceneId === sceneId ? ' is-here' : ''}`}
              onClick={() => (s.sceneId === sceneId ? null : onJump(s.sceneId))}
              title={s.sceneId === sceneId ? 'This scene' : `Go to scene ${s.number}`}
            >
              Sc {s.number}{s.qty !== undefined ? ` ×${s.qty}` : ''}
            </button>
          )) : <span className="plan-none">No scene yet</span>}
          {days.length > 0 && <span className="el-pop-days">Shooting day{days.length > 1 ? 's' : ''} {days.join(' · ')}</span>}
        </div>
        {budget && (
          <p className="el-pop-budget">
            Budget: {budget.text}
            {onOpenBudget && <> · <button type="button" className="plan-clear" onClick={() => { finish(); onOpenBudget(budget.key); }}>Open</button></>}
          </p>
        )}
      </section>

      {merge && (
        <div className="el-pop-confirm" role="group" aria-label="Merge">
          <p>
            Merging into “{elements[merge.into]?.name}”. These scenes have both, with different quantities: choose each one
            {notesMeet ? ' (notes are kept side by side)' : ''}.
          </p>
          {merge.conflicts.map((c) => (
            <div key={c.sceneId} className="el-pop-pick" role="radiogroup" aria-label={`Quantity in scene ${numbersOf([c.sceneId])[0]}`}>
              <span>Sc {numbersOf([c.sceneId])[0]}</span>
              {[[c.from, `×${c.from}`], [c.into, `×${c.into}`], [null, 'none']].map(([v, label]) => (
                <label key={label}>
                  <input
                    type="radio"
                    name={`mq-${c.sceneId}`}
                    checked={merge.resolve[c.sceneId] === v && c.sceneId in merge.resolve}
                    onChange={() => setMerge((m) => ({ ...m, resolve: { ...m.resolve, [c.sceneId]: v } }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          ))}
          <button type="button" className="btn" disabled={merge.conflicts.some((c) => !(c.sceneId in merge.resolve))} onClick={finishMerge}>Merge</button>
          <button type="button" className="btn" onClick={() => setMerge(null)}>Cancel</button>
        </div>
      )}
      {deleting && (
        <div className="el-pop-confirm" role="group" aria-label="Delete everywhere">
          <p>Delete “{need.name}” from {scenes.length > 1 ? `all ${scenes.length} scenes` : 'this scene'} and from the project? Ctrl+Z undoes it.</p>
          <button type="button" className="el-pop-act is-danger" onClick={() => { ops.del(need.id); finish(); }}>Delete everywhere</button>
          <button type="button" className="btn" onClick={() => setDeleting(false)}>Cancel</button>
        </div>
      )}

      <footer className="el-pop-foot">
        {shared && <button type="button" className="el-pop-act" onClick={() => { ops.separate(sceneId, need.id); finish(); }} title="This scene gets its own, kept apart from the others">Separate here</button>}
        {sameCategory.length > 0 && !merge && (
          <Select
            className="el-pop-merge"
            ariaLabel="Merge into another element"
            value=""
            placeholder="Merge into…"
            options={sameCategory.map((e) => ({ value: e.id, label: e.name, hint: nameKey(e.name) === nameKey(need.name) ? 'same name' : '' }))}
            onChange={startMerge}
          />
        )}
        <span className="sr-spacer" />
        <button type="button" className="el-pop-act is-quiet" onClick={() => { ops.remove(sceneId, need.id, need.name); finish(); }}>Remove from scene</button>
        {!deleting && <button type="button" className="el-pop-act is-danger" onClick={() => setDeleting(true)}>Delete everywhere…</button>}
      </footer>
    </div>,
    document.body,
  );
}
