import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical } from 'lucide-react';
import { StripHead, StripLegend, StripRow } from './strips.jsx';
import { PRODUCTION_BUCKETS, eighthsLabel } from '../../lib/productionEngine.js';
import { DOOD_CODES, dayDateLabel } from '../../lib/schedule.js';
import { categoriesOf } from '../../lib/elements.js';

/**
 * Stripboard → Schedule: the same strips, in shooting order, under day breaks.
 *
 *   DAY 3 · Tue 12 May · 4 2/8 pgs ●        ← a button: the day's details (DayPopover)
 *   ⋮⋮ [ 12  INT  FACTORY BUILDING - OFFICE   DAY   2   2, 7, 24 ]   ← handle · strip (opens Write)
 *   UNSCHEDULED · 5 scenes · 6 2/8 pgs
 *
 * A strip is moved with its handle: drag it (mouse), Alt+↑ / Alt+↓ on the handle or the strip
 * (keyboard), or click / tap the handle for Move to Day… (every device). Dragging is off while the
 * filter hides strips, so nothing is dropped among scenes you can't see; the handle's menu still works.
 * Nothing here changes the script: every move is a schedule edit, an undo step in App.
 *
 *   model: scheduleModel(rows, schedule) — days, unscheduled, totals; built from every scene
 *   visible: Set of scene ids the filter shows, or null
 *   ops: { moveScene(id, dayId|null, index), addDay(afterId), removeDay(id), moveDay(id, index),
 *          setDate(id, date), setNote(id, note), fillDates(id, start, skipWeekends), setTarget(eighths),
 *          … }
 */
export default function ScheduleBoard({ model, totals, visible, onOpenScene, ops, pagesTarget }) {
  const [menu, setMenu] = useState(null); // { sceneId, anchor }
  const [dayPop, setDayPop] = useState(null); // { dayId, anchor }
  const [drag, setDrag] = useState(null); // sceneId being dragged
  const [drop, setDrop] = useState(null); // { dayId|null, index, key }
  const canDrag = !visible;
  const shows = (r) => !visible || visible.has(r.id);

  // Where a scene is: { dayIndex (-1: unscheduled), index }
  const where = (id) => {
    for (let i = 0; i < model.days.length; i++) {
      const k = model.days[i].rows.findIndex((r) => r.id === id);
      if (k >= 0) return { dayIndex: i, index: k };
    }
    return { dayIndex: -1, index: model.unscheduled.findIndex((r) => r.id === id) };
  };
  /** Alt+↑ / Alt+↓: one place up or down; past a day's edge into the next or previous day. */
  const step = (id, dir) => {
    const { dayIndex, index } = where(id);
    const days = model.days;
    if (dayIndex < 0) {
      if (dir < 0 && days.length) ops.moveScene(id, days[days.length - 1].id, null);
      return;
    }
    const day = days[dayIndex];
    if (dir < 0) {
      if (index > 0) ops.moveScene(id, day.id, index - 1);
      else if (dayIndex > 0) ops.moveScene(id, days[dayIndex - 1].id, null);
    } else if (index < day.rows.length - 1) {
      ops.moveScene(id, day.id, index + 1);
    } else if (dayIndex < days.length - 1) {
      ops.moveScene(id, days[dayIndex + 1].id, 0);
    } else {
      ops.moveScene(id, null);
    }
  };
  const onKeyMove = (e, id) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const target = e.currentTarget;
    step(id, e.key === 'ArrowUp' ? -1 : 1);
    requestAnimationFrame(() => {
      const again = document.querySelector(`[data-schedule-scene="${CSS.escape(id)}"] ${target.classList.contains('strip-handle') ? '.strip-handle' : '.strip'}`);
      again?.focus({ preventScroll: false });
    });
  };

  // ---- Drag and drop (mouse) ----
  const dragProps = (r) => (canDrag ? {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `scene:${r.id}`);
      setDrag(r.id);
    },
    onDragEnd: () => {
      setDrag(null);
      setDrop(null);
    },
  } : {});
  const over = (e, dayId, index, key) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!drop || drop.key !== key) setDrop({ dayId, index, key });
  };
  const overStrip = (e, dayId, index, id) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    over(e, dayId, dayId ? index + (after ? 1 : 0) : null, `${id}:${after ? 'a' : 'b'}`);
  };
  const onDrop = (e) => {
    if (!drag || !drop) return;
    e.preventDefault();
    let { index } = drop;
    const from = where(drag);
    // Moving down within the same day: the gap it leaves shifts the target by one.
    if (drop.dayId && from.dayIndex >= 0 && model.days[from.dayIndex].id === drop.dayId && index != null && index > from.index) index -= 1;
    ops.moveScene(drag, drop.dayId, index);
    setDrag(null);
    setDrop(null);
  };
  const dropMark = (key) => (drop?.key === key ? ' is-drop' : '');

  const slot = (r, dayId, index) => (
    <div
      key={r.id}
      className={`strip-slot${drag === r.id ? ' is-dragging' : ''}${drop?.key === `${r.id}:b` ? ' is-drop-before' : ''}${drop?.key === `${r.id}:a` ? ' is-drop-after' : ''}`}
      data-schedule-scene={r.id}
      onDragOver={(e) => overStrip(e, dayId, index, r.id)}
      onDrop={onDrop}
      {...dragProps(r)}
    >
      <button
        type="button"
        className="strip-handle"
        aria-haspopup="menu"
        aria-expanded={menu?.sceneId === r.id}
        aria-label={`Move scene ${r.number}`}
        title={canDrag ? 'Drag to move · click for Move to Day… · Alt+↑/↓' : 'Move to Day… · Alt+↑/↓ (dragging is off while filtered)'}
        onClick={(e) => setMenu({ sceneId: r.id, anchor: e.currentTarget })}
        onKeyDown={(e) => onKeyMove(e, r.id)}
      >
        <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <StripRow r={r} onOpenScene={onOpenScene} onKeyDown={(e) => onKeyMove(e, r.id)} />
    </div>
  );

  const unscheduledEighths = model.unscheduled.reduce((n, r) => n + (r.eighths || 0), 0);
  return (
    <div className="plan-stripboard is-schedule" role="region" aria-label="Stripboard">
      <StripLegend totals={totals} />
      <div className="strips" role="table" aria-label="Stripboard, in shooting order">
        <div className="strip-slot is-head"><span className="strip-gutter" aria-hidden="true" /><StripHead /></div>
        {model.days.map((d) => {
          const rowsShown = d.rows.filter(shows);
          return (
            <div key={d.id} className="strip-day-group" role="rowgroup">
              <div
                className={`strip-break${dropMark(`day:${d.id}`)}`}
                role="row"
                onDragOver={(e) => over(e, d.id, 0, `day:${d.id}`)}
                onDrop={onDrop}
              >
                <button
                  type="button"
                  role="cell"
                  className="strip-break-btn"
                  aria-haspopup="dialog"
                  aria-expanded={dayPop?.dayId === d.id}
                  onClick={(e) => setDayPop({ dayId: d.id, anchor: e.currentTarget })}
                  title="This day’s cast, places, needs, notes and date"
                >
                  <span className="strip-break-day">Day {d.number}</span>
                  {d.date && <span>&nbsp;· {dayDateLabel(d.date)}</span>}
                  <span>&nbsp;· {d.rows.length ? `${eighthsLabel(d.eighths)} ${d.eighths > 8 ? 'pgs' : 'pg'}` : 'no scenes'}</span>
                  {d.rows.length !== rowsShown.length && <span className="strip-break-muted">&nbsp;· {rowsShown.length} of {d.rows.length} shown</span>}
                  {d.notes.length > 0 && <span className="strip-break-note" aria-label={`${d.notes.length} ${d.notes.length === 1 ? 'note' : 'notes'}`} title={d.notes.map((n) => n.text).join(' · ')}>●</span>}
                </button>
              </div>
              {rowsShown.map((r) => slot(r, d.id, d.rows.indexOf(r)))}
              {!d.rows.length && (
                <div
                  className={`strip-empty${dropMark(`empty:${d.id}`)}`}
                  onDragOver={(e) => over(e, d.id, 0, `empty:${d.id}`)}
                  onDrop={onDrop}
                >
                  No scenes yet. Drag strips here, or use a strip’s <GripVertical size={12} strokeWidth={1.75} aria-label="handle" /> → Move to Day…
                </div>
              )}
            </div>
          );
        })}
        <div className="strip-day-group" role="rowgroup">
          <div
            className={`strip-break is-unscheduled${dropMark('unscheduled')}`}
            role="row"
            onDragOver={(e) => over(e, null, null, 'unscheduled')}
            onDrop={onDrop}
          >
            <span role="cell" className="strip-break-btn is-static">
              <span className="strip-break-day">Unscheduled</span>
              <span>&nbsp;· {model.unscheduled.length} {model.unscheduled.length === 1 ? 'scene' : 'scenes'}</span>
              {model.unscheduled.length > 0 && <span>&nbsp;· {eighthsLabel(unscheduledEighths)} {unscheduledEighths > 8 ? 'pgs' : 'pg'}</span>}
            </span>
          </div>
          {model.unscheduled.filter(shows).map((r) => slot(r, null, null))}
        </div>
      </div>
      {menu && (
        <StripMenu
          menu={menu}
          model={model}
          where={where(menu.sceneId)}
          onMove={(dayId) => ops.moveScene(menu.sceneId, dayId, null)}
          onStep={(dir) => step(menu.sceneId, dir)}
          onClose={() => setMenu(null)}
        />
      )}
      {dayPop && model.days.some((d) => d.id === dayPop.dayId) && (
        <DayPopover
          day={model.days.find((d) => d.id === dayPop.dayId)}
          count={model.days.length}
          anchor={dayPop.anchor}
          ops={ops}
          pagesTarget={pagesTarget}
          onClose={() => setDayPop(null)}
        />
      )}
    </div>
  );
}

// Before it's measured, a floating card waits out of sight at the window's corner.
const HIDDEN = { visibility: 'hidden', top: 0, left: 0 };

/**
 * Keep a floating card next to its anchor and inside the window, following it as the board scrolls
 * (strips moving change the board's height, which scrolls it a little); `gone` once the anchor has
 * scrolled out of sight or left the page, which closes the card.
 */
function useFloating(anchor, ref, onGone) {
  const gone = useRef(onGone);
  useLayoutEffect(() => {
    gone.current = onGone;
  });
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const a = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
      if (!a || a.bottom < 0 || a.top > window.innerHeight) {
        gone.current?.();
        return;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.max(8, Math.min(a.left, window.innerWidth - w - 8));
      const below = a.bottom + 6;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, a.top - h - 6) : below;
      setPos({ left, top });
    };
    place();
    const onScroll = (e) => {
      if (!ref.current?.contains(e.target)) place();
    };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor, ref]);
  return pos;
}

/**
 * Close a floating card on a click outside; when it closes, focus goes back to its anchor (without
 * scrolling). Set up once per card, whatever re-renders in between.
 */
function useDismiss(ref, anchor, onClose) {
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const down = (e) => {
      if (!ref.current?.contains(e.target) && !anchor?.contains(e.target) && !e.target.closest?.('.select-list')) close.current();
    };
    document.addEventListener('mousedown', down);
    return () => {
      document.removeEventListener('mousedown', down);
      if (anchor?.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [ref, anchor]);
}

/** Focus `selector` inside the card once it's in place (a hidden element can't take focus). */
function useFocusWhenPlaced(ref, pos, selector) {
  const done = useRef(false);
  useEffect(() => {
    if (!pos || done.current) return;
    done.current = true;
    ref.current?.querySelector(selector)?.focus({ preventScroll: true });
  }, [ref, pos, selector]);
}

function StripMenu({ menu, model, where, onMove, onStep, onClose }) {
  const ref = useRef(null);
  const pos = useFloating(menu.anchor, ref, onClose);
  useDismiss(ref, menu.anchor, onClose);
  useFocusWhenPlaced(ref, pos, '[role="menuitem"]:not([disabled])');
  const act = (fn) => () => {
    fn();
    onClose();
  };
  const onKeyDown = (e) => {
    const items = [...ref.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      onClose();
    }
  };
  const inDay = where.dayIndex;
  return createPortal(
    <div ref={ref} className="plan-pop strip-menu" role="menu" aria-label="Move scene" style={pos || HIDDEN} onKeyDown={onKeyDown}>
      <p className="plan-pop-label">Move to Day…</p>
      {model.days.map((d, i) => (
        <button key={d.id} type="button" role="menuitem" disabled={inDay === i} onClick={act(() => onMove(d.id))}>
          Day {d.number}{d.date ? ` · ${dayDateLabel(d.date)}` : ''}
        </button>
      ))}
      <button type="button" role="menuitem" disabled={inDay < 0} onClick={act(() => onMove(null))}>Unscheduled</button>
      <span className="plan-pop-sep" role="separator" />
      <button type="button" role="menuitem" disabled={inDay < 0 ? !model.days.length : inDay === 0 && where.index === 0} onClick={act(() => onStep(-1))}>Move Up <kbd>Alt+↑</kbd></button>
      <button type="button" role="menuitem" disabled={inDay < 0} onClick={act(() => onStep(1))}>Move Down <kbd>Alt+↓</kbd></button>
    </div>,
    document.body,
  );
}

const doodText = (code) => `${code}: ${DOOD_CODES[code][0]}, ${DOOD_CODES[code][1]}`;

function DayPopover({ day, count, anchor, ops, pagesTarget, onClose }) {
  const ref = useRef(null);
  const pos = useFloating(anchor, ref, onClose);
  useDismiss(ref, anchor, onClose);
  useFocusWhenPlaced(ref, pos, 'input, button');
  const [note, setNote] = useState(day.note);
  const [target, setTarget] = useState(pagesTarget ? String(pagesTarget / 8) : '');
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [explain, setExplain] = useState(null); // { name, code }: the cast code explained under the list
  const commitNote = () => {
    if (note !== day.note) ops.setNote(day.id, note);
  };
  const commitTarget = () => {
    const pages = Number(String(target).replace(',', '.'));
    const eighths = target.trim() === '' || !(pages > 0) ? null : Math.round(pages * 8);
    if (eighths !== (pagesTarget || null)) ops.setTarget(eighths);
  };
  // Phase 2A: still shown under the four list labels (the eight categories show in 2B), each name once.
  const needs = PRODUCTION_BUCKETS.map((b) => [b.label, [...new Map(categoriesOf(b.id)
    .flatMap((c) => day.requirements[c] || []).map((x) => [x.name.toLowerCase(), x.name])).values()]]).filter(([, list]) => list.length);
  return createPortal(
    <div
      ref={ref}
      className="plan-pop day-pop"
      role="dialog"
      aria-label={`Day ${day.number}`}
      style={pos || HIDDEN}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.target.closest('[aria-expanded="true"]')) {
          e.preventDefault();
          e.stopPropagation();
          commitNote();
          onClose();
        }
      }}
    >
      <header className="day-pop-head">
        <strong>Day {day.number}</strong>
        <span>{eighthsLabel(day.eighths)} {day.eighths > 8 ? 'pages' : 'page'} · {day.rows.length} {day.rows.length === 1 ? 'scene' : 'scenes'}</span>
      </header>

      <div className="day-pop-row day-pop-plan">
        <label className="day-pop-field">
          <span className="plan-label">Date</span>
          <input type="date" value={day.date || ''} onChange={(e) => ops.setDate(day.id, e.target.value || null)} />
        </label>
        <label className="day-pop-field day-pop-target">
          <span className="plan-label">Page target, every day</span>
          <span>
            <input type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} onBlur={commitTarget}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTarget(); }} placeholder="none" aria-label="Page target per day, in pages" /> pages
          </span>
        </label>
      </div>
      {day.date && day.number < count && (
        <span className="day-pop-fill">
          <button type="button" className="plan-clear" onClick={() => ops.fillDates(day.id, day.date, skipWeekends)}>Date the days after</button>
          <label className="day-pop-check"><input type="checkbox" checked={skipWeekends} onChange={(e) => setSkipWeekends(e.target.checked)} /> skip weekends</label>
        </span>
      )}

      {day.notes.length > 0 && (
        <ul className="day-pop-notes" aria-label="Notes">
          {day.notes.map((n) => <li key={n.kind}>{n.text}</li>)}
        </ul>
      )}

      <div className="day-pop-section">
        <span className="plan-label">Cast</span>
        {day.cast.length || day.hold.length ? (
          <ul className="day-pop-cast">
            {[...day.cast, ...day.hold].map((c) => {
              const open = explain?.name === c.name;
              return (
                <li key={c.name} className={c.code === 'H' ? 'is-hold' : undefined}>
                  <b>{c.number}</b> {c.name}{' '}
                  <button
                    type="button"
                    className="day-pop-code"
                    title={doodText(c.code)}
                    aria-label={`${c.code}: ${DOOD_CODES[c.code][0]}`}
                    aria-expanded={open}
                    aria-controls={`dood-${day.id}`}
                    onClick={() => setExplain(open ? null : { name: c.name, code: c.code })}
                  >
                    {c.code}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <span className="plan-none">No speaking cast</span>}
        <p id={`dood-${day.id}`} className="day-pop-explain" aria-live="polite">
          {explain && DOOD_CODES[explain.code] ? `${explain.name} · ${doodText(explain.code)}.` : ''}
        </p>
      </div>

      {day.places.length > 0 && (
        <div className="day-pop-section">
          <span className="plan-label">Places</span>
          <span>{day.places.join(' · ')}</span>
        </div>
      )}
      {needs.map(([label, list]) => (
        <div key={label} className="day-pop-section">
          <span className="plan-label">{label}</span>
          <span>{list.join(' · ')}</span>
        </div>
      ))}

      <label className="day-pop-section">
        <span className="plan-label">Day note</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={commitNote} placeholder="Call time, parking, anything for this day" />
      </label>

      <footer className="day-pop-foot">
        <button type="button" className="btn" disabled={day.number === 1} onClick={() => ops.moveDay(day.id, day.number - 2)}>Earlier</button>
        <button type="button" className="btn" disabled={day.number === count} onClick={() => ops.moveDay(day.id, day.number)}>Later</button>
        <span className="sr-spacer" />
        <button type="button" className="btn" onClick={() => { ops.removeDay(day.id); onClose(); }}>Remove Day</button>
      </footer>
    </div>,
    document.body,
  );
}
