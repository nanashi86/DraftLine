import { useEffect, useRef, useState } from 'react';

/**
 * Small dropdown menu: a button that opens a list of actions. `items` can be a function,
 * called each time the menu opens — for menus whose contents depend on the page right then.
 */
export default function Menu({
  label, title, items, align = 'left', className = 'btn', caret = true, ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={rootRef}>
      <button
        className={`${className}${open ? ' is-on-subtle' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        aria-label={ariaLabel}
      >
        {label}
        {caret && <> <span className="menu-caret" aria-hidden="true">▾</span></>}
      </button>
      {open && (
        <div className={`menu-pop menu-${align}`} role="menu">
          {(typeof items === 'function' ? items() : items).map((it, i) => (it.divider ? (
            <div key={`d${i}`} className="menu-divider" role="separator" />
          ) : it.heading ? (
            <div key={`h${i}`} className="menu-heading">{it.heading}</div>
          ) : (
            <button
              key={it.label}
              role="menuitem"
              className={`menu-item${it.danger ? ' is-danger' : ''}`}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.sub ? (
                <span className="menu-label">
                  <span>{it.label}</span>
                  <small className="menu-sub">{it.sub}</small>
                </span>
              ) : <span>{it.label}</span>}
              {it.hint && <span className="menu-hint">{it.hint}</span>}
            </button>
          )))}
        </div>
      )}
    </div>
  );
}
