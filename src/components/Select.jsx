import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { edgeIndex, flattenOptions, openIndex, placeList, selectedIndex, stepIndex, typeaheadIndex } from '../lib/selectModel.js';
import './Select.css';

/**
 * DraftLine's dropdown, used everywhere in place of the browser's <select>: a <select>'s open list
 * is drawn by the operating system (Windows' blue highlight, its own font and edges) and sits above
 * the whole page, so nothing can be styled to match or shown over it. This one draws its own list.
 *
 *   options      — items (see lib/selectModel.js): { value, label, hint, style, disabled, checked,
 *                  muted } or { group, options: […] } for a titled group
 *   value        — the chosen option's value; onChange(value, option) when another is picked
 *   placeholder  — what the closed control shows when no option has `value` ("+ Add device…")
 *   renderValue  — (option) → what the closed control shows for the chosen option (default: label)
 *   keepFocus    — clicking never takes focus from where it is (Element ▾ keeps the script's caret)
 *
 * The keyboard works as on a <select>: ↓ ↑ Enter Space or Alt+↓ open it; ↑ ↓ Home End Page Up/Down
 * move; Enter or Space picks; Esc closes; Tab closes and moves on; typing jumps to an option. It
 * follows the ARIA "select-only combobox" pattern, so screen readers announce it like a <select>.
 */
export default function Select({
  value, onChange, options, ariaLabel, title, className = '', id, disabled = false, keepFocus = false,
  placeholder = '', renderValue,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const [host, setHost] = useState(null); // where the list is drawn (see openList)
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', timer: 0 });
  const listId = useId();
  const flat = useMemo(() => flattenOptions(options), [options]);
  const sel = flat[selectedIndex(flat, value)] || null;

  const close = () => {
    setOpen(false);
    setPos(null);
  };
  const openList = () => {
    if (disabled || !flat.length) return;
    // A dialog is drawn in the top layer: the list goes inside it, or it would sit behind it.
    setHost(btnRef.current?.closest('dialog') || document.body);
    setActive(openIndex(flat, value));
    setOpen(true);
  };
  const choose = (i) => {
    const o = flat[i];
    if (!o || o.disabled) return;
    close();
    if (o.value !== value || o.checked !== undefined) onChange(o.value, o);
  };
  const jump = (key) => {
    const t = typed.current;
    clearTimeout(t.timer);
    t.text += key;
    t.timer = setTimeout(() => {
      t.text = '';
    }, 700);
    return t.text;
  };

  // Keys while the list is open, caught before anything else (the script, a dialog's Esc): this
  // works whether focus is on the control or, with keepFocus, still in the script.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const page = Math.max(1, Math.floor((listRef.current?.clientHeight || 300) / 30));
      const move = {
        ArrowDown: () => setActive((i) => stepIndex(flat, i, 1)),
        ArrowUp: () => setActive((i) => (e.altKey ? i : stepIndex(flat, i, -1))),
        Home: () => setActive(edgeIndex(flat, 1)),
        End: () => setActive(edgeIndex(flat, -1)),
        PageDown: () => setActive((i) => Array.from({ length: page }).reduce((j) => stepIndex(flat, j, 1), i)),
        PageUp: () => setActive((i) => Array.from({ length: page }).reduce((j) => stepIndex(flat, j, -1), i)),
      }[e.key];
      if (move) move();
      else if (e.key === 'Enter' || (e.key === ' ' && !typed.current.text) || (e.key === 'ArrowUp' && e.altKey)) choose(active);
      else if (e.key === 'Escape') close();
      else if (e.key === 'Tab') {
        close();
        return; // let focus move on
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const q = jump(e.key);
        setActive((i) => typeaheadIndex(flat, q, i));
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Close on a press outside, on resize or the window losing focus, and when anything but the
  // list itself scrolls (the control moved).
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!btnRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) close();
    };
    const onScroll = (e) => {
      if (!listRef.current?.contains(e.target)) close();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(typed.current.timer), []);

  // Place the list under (or over) the control, and keep the active option in view.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !listRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos(placeList(r, listRef.current.scrollHeight, { width: window.innerWidth, height: window.innerHeight }));
  }, [open]);
  useLayoutEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, pos]);

  const optId = (i) => `${listId}-o${i}`;
  const shown = sel ? (renderValue ? renderValue(sel) : sel.label) : placeholder;

  const row = (o) => (
    <div
      key={`${o.index}:${o.value}`}
      id={optId(o.index)}
      data-i={o.index}
      role="option"
      aria-selected={o.value === value}
      aria-disabled={o.disabled || undefined}
      className={`dl-opt${o.index === active ? ' is-active' : ''}${o.muted ? ' is-muted' : ''}`}
      onMouseEnter={() => !o.disabled && setActive(o.index)}
      onMouseDown={(e) => e.preventDefault()} // never take focus: it stays on the control (or the script)
      onClick={() => choose(o.index)}
    >
      <span className="dl-opt-check" aria-hidden="true">
        {(o.checked ?? o.value === value) && <Check size={14} strokeWidth={2} />}
      </span>
      <span className="dl-opt-label" style={o.style}>{o.label}</span>
      {o.hint && <span className="dl-opt-hint">{o.hint}</span>}
    </div>
  );
  const groups = [];
  for (const o of flat) {
    const last = groups[groups.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else groups.push({ group: o.group, items: [o] });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        className={`dl-select ${className}`.trim()}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onMouseDown={(e) => {
          if (keepFocus) e.preventDefault();
        }}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (open) return; // the window listener has it
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) || (e.altKey && e.key === 'ArrowDown')) {
            e.preventDefault();
            openList();
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const i = typeaheadIndex(flat, jump(e.key), selectedIndex(flat, value));
            openList();
            setActive(i);
          }
        }}
      >
        <span className={`dl-select-value${sel && !sel.muted ? '' : ' is-placeholder'}`} style={sel?.style}>{shown}</span>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden className="dl-select-chev" />
      </button>
      {open && host && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`dl-select-list is-${pos?.placement || 'measuring'}`}
          style={pos ? { left: pos.left, top: pos.top, minWidth: pos.minWidth, maxHeight: pos.maxHeight } : { left: -9999, top: 0 }}
        >
          {groups.map((g) => (g.group ? (
            <div key={`g:${g.group}`} role="group" aria-label={g.group} className="dl-group">
              <div className="dl-group-label" aria-hidden="true">{g.group}</div>
              {g.items.map(row)}
            </div>
          ) : g.items.map(row)))}
        </div>,
        host,
      )}
    </>
  );
}
